export interface ApiErrorPayload {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export interface ApiListResponse<T> {
  items: T[];
  total?: number;
}
