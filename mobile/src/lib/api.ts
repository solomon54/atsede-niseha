import { authEvents } from "./auth-events";
import { authStorage } from "./storage";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://atsede-niseha-v1.vercel.app";

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { requiresAuth = true, headers = {}, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await authStorage.getToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
    headers: requestHeaders,
    ...rest,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // A rejected session must not look like a generic network error: clear
    // the dead token and let the auth provider return to the gateway.
    if (response.status === 401 && requiresAuth) {
      await authStorage.clear().catch(() => {});
      authEvents.emitUnauthorized();
    }

    const errorMessage =
      data?.error || data?.message || `Request failed with status ${response.status}`;
    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }

  return data as T;
}

