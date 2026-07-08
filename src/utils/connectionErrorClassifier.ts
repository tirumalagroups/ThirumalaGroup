export type ClassifiedErrorType =
  | 'OFFLINE'              // Device is offline
  | 'QUOTA_LIMITED'         // Rate limited or quota exceeded (e.g. 429, or egress exceeded message)
  | 'BACKEND_UNREACHABLE'   // Database server down (e.g. 500, 502, 503, 504)
  | 'AUTH_ERROR'            // Unauthorized (e.g. 401, 403)
  | 'REQUEST_FAILED';       // General query failure (e.g. bad syntax, bad input)

export interface ClassificationResult {
  type: ClassifiedErrorType;
  message: string;
  isTransient: boolean;
}

export function classifySupabaseError(error: any): ClassificationResult {
  // 1. Check network online state
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      type: 'OFFLINE',
      message: 'Your device is offline. Please check your internet connection.',
      isTransient: true,
    };
  }

  if (!error) {
    return {
      type: 'REQUEST_FAILED',
      message: 'An unknown request error occurred.',
      isTransient: false,
    };
  }

  const status = error.status || error.statusCode || (error.response && error.response.status);
  const message = error.message || error.details || String(error);

  // 2. Check Quota / Rate Limits
  if (status === 429 || /quota/i.test(message) || /rate limit/i.test(message) || /egress/i.test(message)) {
    return {
      type: 'QUOTA_LIMITED',
      message: 'Database storage/network quota exceeded or rate limit hit. Please try again later or contact support.',
      isTransient: true,
    };
  }

  // 3. Check Authentication / Authorization
  if (status === 401 || status === 403 || /unauthorized/i.test(message) || /jwt/i.test(message)) {
    return {
      type: 'AUTH_ERROR',
      message: 'Authentication session expired or access denied. Please re-login.',
      isTransient: false,
    };
  }

  // 4. Check Backend Server Errors
  if (status >= 500 && status <= 599) {
    return {
      type: 'BACKEND_UNREACHABLE',
      message: 'The server is temporarily unreachable. Please retry shortly.',
      isTransient: true,
    };
  }

  // 5. Network fetch failure (CORS, DNS, connection reset)
  if (message.includes('fetch') || message.includes('NetworkError') || message.includes('Failed to fetch')) {
    return {
      type: 'BACKEND_UNREACHABLE',
      message: 'Could not connect to database servers. Check your internet connection or retry.',
      isTransient: true,
    };
  }

  // Default: General Query/Request Failure
  return {
    type: 'REQUEST_FAILED',
    message: message || 'Query request failed.',
    isTransient: false,
  };
}
