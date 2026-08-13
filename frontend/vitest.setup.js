// vitest's jsdom environment does not expose window.localStorage (jsdom only
// provides it for a non-opaque origin, and the shim does not survive the
// bridge into the test global). The offline scan queue is built on it, so the
// suite supplies a Storage of its own — same contract, no persistence.
if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
  const store = new Map()
  const storage = {
    get length() {
      return store.size
    },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => void store.set(String(k), String(v)),
    removeItem: (k) => void store.delete(String(k)),
    clear: () => store.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  if (globalThis.window) {
    Object.defineProperty(globalThis.window, 'localStorage', { value: storage, configurable: true })
  }
}
