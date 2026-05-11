const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 8000;

const fetchWithTimeout = async (url, options = {}, timeout = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    throw new Error('Malformed response payload');
  }
};

export const getHealth = async () => {
  const response = await fetchWithTimeout(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error('Backend unavailable');
  }
  const data = await safeJson(response);
  if (!data || typeof data.status !== 'string') {
    throw new Error('Malformed response payload');
  }
  return data;
};

export const analyzeBurnout = async (payload) => {
  const response = await fetchWithTimeout(`${API_BASE}/api/burnout/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Burnout analysis failed');
  }
  const data = await safeJson(response);
  if (
    !data ||
    typeof data.risk_score !== 'number' ||
    typeof data.burnout_level !== 'string' ||
    typeof data.trend_label !== 'string' ||
    !Array.isArray(data.micro_interventions) ||
    typeof data.summary !== 'string'
  ) {
    throw new Error('Malformed burnout analysis payload');
  }
  return data;
};

export const generateWorkout = async (payload) => {
  const response = await fetchWithTimeout(`${API_BASE}/api/workout/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Workout generation failed');
  }
  const data = await safeJson(response);
  if (!data || typeof data.source !== 'string' || !data.plan) {
    throw new Error('Malformed workout plan payload');
  }
  return data;
};

export const getDashboardPatternInsight = async (payload) => {
  const response = await fetchWithTimeout(`${API_BASE}/api/dashboard/pattern`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Dashboard insight failed');
  }
  const data = await safeJson(response);
  if (!data || typeof data.pattern_summary !== 'string' || typeof data.recommendation !== 'string') {
    throw new Error('Malformed dashboard insight payload');
  }
  return data;
};
