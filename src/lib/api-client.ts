import { idempotencyManager } from './idempotency';
import type { ApiErrorResponse } from '../types/api';

export class ApiClientError extends Error {
  public status: number;
  public code: string;
  public details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  idempotencyKey?: string;
  skipIdempotency?: boolean;
}

const API_BASE = '/api';

/**
 * Standard HTTP API client configured for QLCHDT API contract.
 * - Always includes credentials for session cookies
 * - Automatically attaches Idempotency-Key UUID on mutating endpoints (POST, PATCH)
 *   while preserving the UUID across retries of the exact same payload.
 * - Idempotency key is retained until successful response body has been fully parsed.
 * - Parses standardized error formats: { error: { code, message } }
 */
export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: customHeaders, skipIdempotency, idempotencyKey, ...restOptions } = options;
  const method = (restOptions.method || 'GET').toUpperCase();
  const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(customHeaders as Record<string, string> || {}),
  };

  let serializedBody: string | undefined = undefined;
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  // Idempotency Key logic: required for mutating operations (POST, PATCH)
  // except auth endpoints (/auth/login, /auth/logout)
  const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/logout');
  const isMutatingMethod = ['POST', 'PATCH'].includes(method);

  let usedIdempotencyKey: string | undefined = undefined;
  if (isMutatingMethod && !isAuthEndpoint && !skipIdempotency) {
    usedIdempotencyKey = idempotencyKey || idempotencyManager.getOrCreateKey(method, endpoint, body);
    headers['Idempotency-Key'] = usedIdempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...restOptions,
      method,
      headers,
      body: serializedBody,
      credentials: 'include',
    });
  } catch (netErr: unknown) {
    const errorMsg = netErr instanceof Error ? netErr.message : 'Lỗi kết nối mạng đến máy chủ';
    throw new ApiClientError(0, 'NETWORK_ERROR', `Không thể kết nối đến máy chủ: ${errorMsg}`);
  }

  // Handle successful response
  if (response.ok) {
    // 204 No Content
    if (response.status === 204) {
      if (usedIdempotencyKey && isMutatingMethod && !isAuthEndpoint) {
        idempotencyManager.invalidate(method, endpoint, body);
      }
      return {} as T;
    }

    const contentType = response.headers.get('content-type') || '';
    let parsedResult: T;

    try {
      if (contentType.includes('application/json')) {
        parsedResult = (await response.json()) as T;
      } else {
        parsedResult = (await response.text()) as unknown as T;
      }
    } catch {
      // If parsing fails despite 200, do not invalidate the key so the caller can retry
      throw new ApiClientError(
        response.status,
        'PARSE_ERROR',
        'Không thể giải mã phản hồi JSON từ máy chủ'
      );
    }

    // Only invalidate after JSON parsing succeeds!
    if (usedIdempotencyKey && isMutatingMethod && !isAuthEndpoint) {
      idempotencyManager.invalidate(method, endpoint, body);
    }

    return parsedResult;
  }

  // Handle errors
  let errorCode = `HTTP_${response.status}`;
  let errorMessage = `Yêu cầu thất bại với mã lỗi ${response.status}`;
  let errorDetails: unknown = undefined;

  try {
    const errorData = (await response.json()) as ApiErrorResponse;
    if (errorData && errorData.error) {
      errorCode = errorData.error.code || errorCode;
      errorMessage = errorData.error.message || errorMessage;
      errorDetails = errorData;
    }
  } catch {
    // Fallback error messages
    if (response.status === 401) {
      errorCode = 'UNAUTHENTICATED';
      errorMessage = 'Phiên làm việc đã hết hạn hoặc chưa đăng nhập';
    } else if (response.status === 403) {
      errorCode = 'FORBIDDEN';
      errorMessage = 'Không có quyền thực hiện thao tác này';
    } else if (response.status === 404) {
      errorCode = 'NOT_FOUND';
      errorMessage = 'Bản ghi không tồn tại hoặc đã bị xóa';
    } else if (response.status === 409) {
      errorCode = 'CONFLICT';
      errorMessage = 'Dữ liệu bị trùng lặp hoặc xung đột giao dịch';
    } else if (response.status === 422) {
      errorCode = 'UNPROCESSABLE_ENTITY';
      errorMessage = 'Dữ liệu không thỏa mãn quy tắc nghiệp vụ';
    }
  }

  throw new ApiClientError(response.status, errorCode, errorMessage, errorDetails);
}

export const api = {
  get: <T>(url: string, options?: RequestOptions) => apiFetch<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(url, { ...options, method: 'POST', body }),
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(url, { ...options, method: 'PATCH', body }),
};
