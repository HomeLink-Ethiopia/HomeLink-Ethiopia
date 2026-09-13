/**
 * aiApi.js — Frontend API client for HomeLink AI endpoints.
 *
 * Calls the backend Express proxy at /api/ai/*
 * (which in turn forwards to the FastAPI AI microservice).
 *
 * Set VITE_BACKEND_URL in .env for non-localhost deployments.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

async function _post(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/** Estimate monthly rent for a property. */
export async function estimateRent(params) {
  return _post("/api/ai/estimate-rent", params);
}

/** Analyse a listing for fraud risk. */
export async function detectFraud(params) {
  return _post("/api/ai/detect-fraud", params);
}

/** Get ranked property recommendations. */
export async function getRecommendations(params) {
  return _post("/api/ai/recommend", params);
}

/** Check if the AI service is reachable. */
export async function checkAiHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/health`);
    return res.ok;
  } catch {
    return false;
  }
}
