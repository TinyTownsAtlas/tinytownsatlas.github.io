// Data adapter. The pages talk only to this interface, never to files directly.
//
// Contract (every adapter must provide):
//   getCatalogue()                  -> { domains, measures }          public definitions
//   authenticate(ttid, code)        -> { ttid, label } | null         sign-in
//   getParticipantView(ttid)        -> participant view | null        released data only
//
// createSyntheticAdapter() reads the synthetic JSON files that ship with the prototype.
// createRestAdapter() is a placeholder for an approved backend. It throws on purpose.

import { isValidTtid } from './policy.js';

export const ADAPTER_CONTRACT = Object.freeze({
  getCatalogue: 'Promise<{domains, measures}>',
  authenticate: '(ttid, activationCode) => Promise<{ttid, label} | null>',
  getParticipantView: '(ttid) => Promise<ParticipantView | null>',
});

// Demo data is emitted by the Vite demo build under <base>my-ten4ten/data/.
const DEFAULT_BASE = new URL(
  `${import.meta.env?.BASE_URL ?? '/'}my-ten4ten/data/`,
  globalThis.location?.href ?? 'http://localhost/',
);
const CODE_PATTERN = /^[A-Z0-9-]{4,20}$/;

export function createSyntheticAdapter({ base = DEFAULT_BASE, fetchImpl } = {}) {
  const doFetch = fetchImpl || ((url) => fetch(url, { cache: 'no-store' }));
  let catalogueP = null;
  let accountsP = null;

  async function getJson(relativePath) {
    const res = await doFetch(new URL(relativePath, base));
    if (!res || !res.ok) return null;
    return res.json();
  }

  return {
    kind: 'synthetic-demo',

    getCatalogue() {
      catalogueP = catalogueP || getJson('measure_catalogue.json');
      return catalogueP;
    },

    async authenticate(ttidInput, codeInput) {
      const ttid = String(ttidInput || '').trim().toUpperCase();
      const code = String(codeInput || '').trim().toUpperCase();
      if (!isValidTtid(ttid) || !CODE_PATTERN.test(code)) return null;
      accountsP = accountsP || getJson('demo_accounts.json');
      const accounts = (await accountsP) || [];
      const hit = accounts.find((a) => a.ttid === ttid && a.code === code);
      return hit ? { ttid: hit.ttid, label: hit.label } : null;
    },

    // Demo-only helper for the testers' list on the sign-in page. Not part of the contract.
    async listDemoAccounts() {
      accountsP = accountsP || getJson('demo_accounts.json');
      return (await accountsP) || [];
    },

    async getParticipantView(ttid) {
      if (!isValidTtid(ttid)) return null;
      const view = await getJson(`participant_views/${ttid}.json`);
      // A view must belong to the person who asked for it. Anything else is refused.
      if (!view || view.ttid !== ttid) return null;
      return view;
    },
  };
}

export function createRestAdapter() {
  // Async, so callers get a rejected promise rather than a synchronous throw.
  const notBuilt = async () => {
    throw new Error(
      'Production adapter is not built. It needs an approved backend, an approved identity method and governance sign-off.',
    );
  };
  return { kind: 'rest-placeholder', getCatalogue: notBuilt, authenticate: notBuilt, getParticipantView: notBuilt };
}
