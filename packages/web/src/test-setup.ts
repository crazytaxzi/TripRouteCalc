import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: (): void => undefined,
    removeListener: (): void => undefined,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
    dispatchEvent: (): boolean => false,
  }),
});
