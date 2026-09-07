import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom leaves these unimplemented; the app calls them when flipping to the confirmation.
window.scrollTo = () => {};
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function scrollIntoView() {};

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
