import { CH } from './ch.js';
import { DE } from './de.js';

const registry = Object.freeze({ CH, DE });

export function countryConfig(code) {
  return registry[code] || CH;
}

export function allCountries() {
  return Object.values(registry);
}
