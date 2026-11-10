import { BACKEND_URL } from "./config.js";

export function backendUrl() {
  return String(BACKEND_URL || "").trim().replace(/\/$/, "");
}

export function backendConfigured() {
  return /^https?:\/\//.test(backendUrl());
}

async function request(path, options = {}) {
  const { timeout, headers, ...rest } = options;
  const response = await fetch(`${backendUrl()}${path}`, {
    ...rest,
    headers: { Accept: "application/json", ...(headers || {}) },
    signal: AbortSignal.timeout(timeout || 8000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `${response.status}`);
    error.code = body.error || "";
    throw error;
  }
  return body;
}

export function fetchHealth() {
  return request("/health");
}

export function fetchGas() {
  return request("/gas");
}

export function fetchPrices() {
  return request("/prices");
}

export function submitPrices(reports, session) {
  return request("/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consent: true, session, reports }),
  });
}

export function createInstacartLink({ title, lines, linkback }) {
  return request("/instacart/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, lines, linkback }),
    timeout: 12000,
  });
}
