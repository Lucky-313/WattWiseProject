const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const ACCESS_TOKEN_KEY = "wattwise_access_token";

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

async function requestApi(path, options = {}) {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const responseText = await response.text();
  let result = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { detail: responseText };
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    const detail = result.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(" ")
      : detail;
    throw new Error(message || "Something went wrong. Please try again.");
  }

  return result;
}

function postJson(path, payload) {
  return requestApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getTelemetry() {
  return requestApi("/api/telemetry");
}

export function getDashboards() {
  return requestApi("/api/dashboards");
}

export function createDashboard(details) {
  return postJson("/api/dashboards", details);
}

export function getDashboard(id) {
  const headers = {};
  const dashboardToken = sessionStorage.getItem(
    `wattwise_dashboard_unlock_${id}`
  );
  if (dashboardToken) headers["X-Dashboard-Access"] = dashboardToken;
  return requestApi(`/api/dashboards/${encodeURIComponent(id)}`, { headers });
}

export function verifyDashboardPasscode(id, passcode) {
  return postJson(
    `/api/dashboards/${encodeURIComponent(id)}/verify-passcode`,
    { passcode }
  );
}

export function updateDashboardSettings(id, settings) {
  return requestApi(
    `/api/dashboards/${encodeURIComponent(id)}/settings`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }
  );
}

export function deleteDashboard(id, passcode = null) {
  return requestApi(`/api/dashboards/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
}

export function uploadDashboardCsv(id, file) {
  const headers = { "Content-Type": "text/csv" };
  const dashboardToken = sessionStorage.getItem(
    `wattwise_dashboard_unlock_${id}`
  );
  if (dashboardToken) headers["X-Dashboard-Access"] = dashboardToken;
  return requestApi(
    `/api/dashboards/${encodeURIComponent(id)}/upload-csv?filename=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers,
      body: file,
    }
  );
}