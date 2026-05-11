import type {
  AuthResponse,
  AuthUser,
  DashboardSummary,
  JournalEntry,
  UserProfile,
} from "../types";

const AUTH_STORAGE_KEY = "mindjournal.auth.token";

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (typeof payload === "string") {
      throw new Error(payload || "Request failed.");
    }

    const message =
      typeof payload?.detail === "string"
        ? payload.detail
        : typeof payload?.message === "string"
          ? payload.message
          : "Request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function buildHeaders(token?: string, extraHeaders?: HeadersInit): HeadersInit {
  return {
    ...(extraHeaders ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function getStoredToken() {
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function register(email: string, password: string) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse<AuthResponse>(response);
}

export async function login(email: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse<AuthResponse>(response);
}

export async function fetchCurrentUser(token: string) {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
    headers: buildHeaders(token),
  });
  const data = await parseResponse<{ user: AuthUser }>(response);
  return data.user;
}

export async function logout(token: string) {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    cache: "no-store",
    headers: buildHeaders(token),
  });
  return parseResponse<{ loggedOut: boolean }>(response);
}

export async function fetchEntries(token: string) {
  const response = await fetch("/api/entries", {
    cache: "no-store",
    headers: buildHeaders(token),
  });
  const data = await parseResponse<{ entries: JournalEntry[] }>(response);
  return data.entries;
}

export async function analyzeEntry(token: string, text: string, createdAt: string) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    cache: "no-store",
    headers: buildHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      text,
      created_at: createdAt,
    }),
  });

  const data = await parseResponse<{ entry: JournalEntry }>(response);
  return data.entry;
}

export async function fetchDashboard(token: string) {
  const response = await fetch("/api/dashboard", {
    cache: "no-store",
    headers: buildHeaders(token),
  });
  const data = await parseResponse<{ dashboard: DashboardSummary | null }>(response);
  return data.dashboard;
}

export async function generateWeeklyStrategy(token: string) {
  const response = await fetch("/api/weekly-strategy", {
    method: "POST",
    cache: "no-store",
    headers: buildHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({}),
  });
  const data = await parseResponse<{ strategy: string }>(response);
  return data.strategy;
}

export async function fetchUserProfile(token: string) {
  const response = await fetch("/api/profile", {
    cache: "no-store",
    headers: buildHeaders(token),
  });
  return parseResponse<{ profile: UserProfile; exists: boolean }>(response);
}

export async function saveUserProfile(token: string, profile: UserProfile) {
  const response = await fetch("/api/profile", {
    method: "PUT",
    cache: "no-store",
    headers: buildHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(profile),
  });

  const data = await parseResponse<{ profile: UserProfile; saved: boolean }>(response);
  return data.profile;
}
