export function getApi() {
  if (!window.shopLedger) {
    throw new Error("Shop Ledger API not available. Run inside Electron.");
  }
  return window.shopLedger;
}

export const api = new Proxy(
  {},
  {
    get(_target, prop) {
      return getApi()[prop];
    },
  }
);
