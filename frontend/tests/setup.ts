import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

Object.defineProperty(globalThis.crypto, 'randomUUID', {
  configurable: true,
  value: () => 'test-message-id',
});
