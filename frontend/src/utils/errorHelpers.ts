import type { ApiError } from "../types";

/**
 * Extract error message from API error response
 * Handles various error formats from backend
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  const apiError = error as ApiError;

  // Check response data for error message
  if (apiError.response?.data) {
    const { data } = apiError.response;

    // Priority order: message > error > first validation error
    if (data.message) return data.message;
    if (data.error) return data.error;

    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      // Return first validation error message
      return data.errors[0].message || "Validation failed";
    }
  }

  // Check direct message property
  if (apiError.message) {
    return apiError.message;
  }

  // Default fallback
  return "An unexpected error occurred";
}

/**
 * Check if error is a network error (no response from server)
 */
export function isNetworkError(error: unknown): boolean {
  const apiError = error as ApiError;
  return !apiError.response || apiError.response.status === undefined;
}

/**
 * Check if error is an authorization error (401 or 403)
 */
export function isAuthError(error: unknown): boolean {
  const apiError = error as ApiError;
  const status = apiError.response?.status || apiError.status;
  return status === 401 || status === 403;
}

/**
 * Check if error is a validation error (400)
 */
export function isValidationError(error: unknown): boolean {
  const apiError = error as ApiError;
  const status = apiError.response?.status || apiError.status;
  return status === 400;
}

/**
 * Check if error is a not found error (404)
 */
export function isNotFoundError(error: unknown): boolean {
  const apiError = error as ApiError;
  const status = apiError.response?.status || apiError.status;
  return status === 404;
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatus(error: unknown): number | undefined {
  const apiError = error as ApiError;
  return apiError.response?.status || apiError.status;
}

/**
 * Get all validation errors from error response
 */
export function getValidationErrors(error: unknown) {
  const apiError = error as ApiError;
  return apiError.response?.data?.errors || [];
}
