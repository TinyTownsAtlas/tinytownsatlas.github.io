// Demo session held in sessionStorage. Demo only: a production service would use
// server-side sessions issued after an approved identity check.
import { CONFIG } from './config.js';
import { isValidTtid } from './policy.js';

const KEY = 'my-ten4ten.demo-session';

export function startSession({ ttid, label }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ttid, label, startedAt: Date.now() }));
    return true;
  } catch {
    return false; // storage unavailable: the caller will show the signed-out state
  }
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const maxAge = CONFIG.demoSessionMinutes * 60 * 1000;
    if (!s || !isValidTtid(s.ttid) || typeof s.startedAt !== 'number' || Date.now() - s.startedAt > maxAge) {
      clearSession();
      return null;
    }
    return { ttid: s.ttid, label: String(s.label || 'Demo participant') };
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
