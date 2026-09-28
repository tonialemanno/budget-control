const STORAGE_KEY = 'finance-v1-preferences';

const defaults = {
  theme: 'auto',
  depth: 'standard',
};

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...defaults, ...stored };
  } catch {
    return { ...defaults };
  }
}

let state = readPreferences();
const subscribers = new Set();

function persist() {
  const { theme, depth } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, depth }));
}

export const store = Object.freeze({
  getState: () => ({ ...state }),
  setState: (patch, { persistPreferences = false } = {}) => {
    state = { ...state, ...patch };
    if (persistPreferences) persist();
    subscribers.forEach((fn) => fn({ ...state }));
  },
  subscribe: (fn) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
});
