/**
 * Thin fetch wrapper around the FastAPI backend.
 *
 * Set window.FINOVA_API_BASE before this script loads (e.g. in a small
 * inline <script> tag) to point at your deployed backend, for example:
 *   <script>window.FINOVA_API_BASE = "https://finova-api.onrender.com";</script>
 * It defaults to http://localhost:8000 for local development.
 *
 * Every function resolves to { ok, data, error }. Callers should always
 * check `ok` and have a local fallback for when the backend is unreachable,
 * since this file never throws.
 */
(function () {
  const BASE = window.FINOVA_API_BASE || 'http://localhost:8000';
  const TIMEOUT_MS = 12000;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...options,
      });
      clearTimeout(timer);
      let body = null;
      try { body = await res.json(); } catch (e) { /* empty/non-JSON body */ }
      if (!res.ok) {
        return { ok: false, data: null, error: (body && body.detail) || `Server error (${res.status}).` };
      }
      return { ok: true, data: body, error: null };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { ok: false, data: null, error: 'The request timed out. Please try again.' };
      }
      return { ok: false, data: null, error: 'Could not reach the server. Check your connection and try again.' };
    }
  }

  window.FinovaAPI = {
    health: () => request('/health'),
    checkLoan: (payload) => request('/api/loan/check', { method: 'POST', body: JSON.stringify(payload) }),
    analyzeCredit: (payload) => request('/api/credit/analyze', { method: 'POST', body: JSON.stringify(payload) }),
    getTips: (payload) => request('/api/financial-tips', { method: 'POST', body: JSON.stringify(payload) }),
    saveRecord: (payload) => request('/api/records/save', { method: 'POST', body: JSON.stringify(payload) }),
    getRecords: (limit = 20) => request(`/api/records?limit=${limit}`),
  };
})();
