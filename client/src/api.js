const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

let refreshing = null;

export function getToken() {
  // Auth now uses HttpOnly Secure cookies. This returns a truthy marker for old UI checks.
  return "cookie-session";
}

export function setToken(_token) {
  // Tokens are intentionally not stored in localStorage.
}

export function clearToken() {
  localStorage.removeItem("crobic_token");
}

async function request(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function api(path, options = {}) {
  try {
    return await request(path, options);
  } catch (error) {
    if (error.status !== 401 || path === "/auth/refresh") throw error;

    refreshing = refreshing || request("/auth/refresh", { method: "POST" }).finally(() => {
      refreshing = null;
    });

    try {
      await refreshing;
      return await request(path, options);
    } catch (refreshError) {
      clearToken();
      if (!["/auth/me", "/auth/login", "/auth/register"].includes(path)) {
        window.dispatchEvent(new CustomEvent("crobic:auth-expired"));
      }
      throw refreshError;
    }
  }
}

export async function uploadApi(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`, true);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = async () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.message || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}
