import { ApiError } from "@/lib/apiClient";

type ValidationErrorDetail = {
  loc?: Array<string | number>;
  msg?: string;
};

function normalizeValidationField(field: string): string {
  return field.replace(/\[(\d+)\]/g, ".$1");
}

export function getErrorStatus(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null;
}

export function isUnauthorizedError(error: unknown): boolean {
  return getErrorStatus(error) === 401;
}

export function isRetryable(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 429 || status === 503;
}

export function getValidationErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return {};
  }

  const detail = error.detail;
  if (!Array.isArray(detail)) {
    return {};
  }

  return detail.reduce<Record<string, string>>((acc, item) => {
    if (!item || typeof item !== "object") {
      return acc;
    }

    const typedItem = item as ValidationErrorDetail;
    if (!Array.isArray(typedItem.loc) || typeof typedItem.msg !== "string") {
      return acc;
    }

    const fieldPath = typedItem.loc
      .filter((segment) => segment !== "body")
      .map((segment) => String(segment))
      .join(".");

    if (!fieldPath) {
      return acc;
    }

    acc[normalizeValidationField(fieldPath)] = typedItem.msg;
    return acc;
  }, {});
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Your session has expired. Please log in again.";
      case 403:
        return "You don't have permission to access this workspace.";
      case 404:
        return "This resource was not found. It may have been deleted.";
      case 422:
        return "Please review the highlighted fields and try again.";
      case 429:
        return "Too many requests. Please wait a moment before trying again.";
      case 500:
      case 503:
        return "Something went wrong. Please try again.";
      default:
        if (typeof error.detail === "string" && error.detail.trim().length > 0) {
          return error.detail;
        }
        return "Something went wrong. Please try again.";
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
