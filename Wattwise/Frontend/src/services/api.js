const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  ""
);
export const ACCESS_TOKEN_KEY = "wattwise_access_token";

async function readResponse(response) {
  const responseText = await response.text();
  if (!responseText) return {};

  try {
    return JSON.parse(responseText);
  } catch {
    return { detail: responseText };
  }
}

async function postAuth(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await readResponse(response);

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

export function forgotPassword(email) {
  return postAuth("/api/auth/forgot-password", {email})
}

export function resetPassword(token, newPassword) {
  return postAuth("/api/auth/reset-password", {token, new_password: newPassword})
}

export function demoLogin() {
  return postAuth("/api/auth/demo", {});
}

async function requestApi(path, options = {}) {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const result = await readResponse(response);

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
  return requestApi(`/api/dashboards/${encodeURIComponent(id)}`, {
    headers: getDashboardAccessHeaders(id),
  });
}

function getDashboardAccessHeaders(id) {
  const headers = {};
  const dashboardToken = sessionStorage.getItem(
    `wattwise_dashboard_unlock_${id}`
  );
  if (dashboardToken) headers["X-Dashboard-Access"] = dashboardToken;
  return headers;
}

export function getDashboardLogbook(id) {
  return requestApi(
    `/api/dashboards/${encodeURIComponent(id)}/logbook`,
    { headers: getDashboardAccessHeaders(id) }
  );
}

export function syncDashboardMeasurements(id, measurements) {
  return requestApi(
    `/api/dashboards/${encodeURIComponent(id)}/measurements`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getDashboardAccessHeaders(id),
      },
      body: JSON.stringify({ measurements }),
    }
  );
}

export function saveDashboardSlaRule(id, rule) {
  return requestApi(
    `/api/dashboards/${encodeURIComponent(id)}/sla-rules`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getDashboardAccessHeaders(id),
      },
      body: JSON.stringify(rule),
    }
  );
}

export function clearDashboardSlaRule(id, metric) {
  return requestApi(
    `/api/dashboards/${encodeURIComponent(id)}/sla-rules/${encodeURIComponent(metric)}`,
    {
      method: "DELETE",
      headers: getDashboardAccessHeaders(id),
    }
  );
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
