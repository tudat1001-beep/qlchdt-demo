/**
 * Format number as Vietnamese Dong (VND)
 * Ex: 15000000 -> "15.000.000 ₫"
 */
export function formatVND(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0 ₫';
  }
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (isNaN(numeric)) {
    return '0 ₫';
  }
  return `${numeric.toLocaleString('vi-VN')} ₫`;
}

/**
 * Format plain integer number with dot thousands separator
 * Ex: 15000 -> "15.000"
 */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (isNaN(numeric)) {
    return '0';
  }
  return numeric.toLocaleString('vi-VN');
}

/**
 * Format ISO datetime string to Vietnamese locale representation
 * Ex: 2026-11-01T02:50:00Z -> "01/11/2026 09:50"
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Format ISO date string to date only
 * Ex: 2026-11-01T02:50:00Z -> "01/11/2026"
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Format Vietnamese phone number nicely
 * Ex: 0987654321 -> "0987 654 321"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}
