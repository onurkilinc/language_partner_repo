import { API_BASE } from "./config";
import { getIdToken } from "./auth";

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = await getIdToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  return response;
}
