const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function postAuth(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();

  if (!response.ok) {
    const detail = result.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(" ")
      : detail;
    throw new Error(message || "Authentication failed. Please try again.");
  }

  return result;
}

export function login(credentials) {
  return postAuth("/api/auth/login", credentials);
}

export function signup(details) {
  return postAuth("/api/auth/signup", details);
}