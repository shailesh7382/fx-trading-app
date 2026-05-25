import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: () => {},
	removeListener: () => {},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => false,
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

