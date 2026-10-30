const BASE = import.meta.env.VITE_API_URL || '';

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/api/${path}?${qs}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const getDecision = (day) => get('decision', { day });
export const getErrors = (from, to, horizon) => get('errors', { from, to, horizon });
export const getByHorizon = (from, to) => get('errors/by-horizon', { from, to });
export const getStatus = () => get('status');
