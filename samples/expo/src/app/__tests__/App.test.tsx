import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { DcsResponseString } from 'statsig-test-helpers';

import { Storage } from '@statsig/client-core';

import App from '../App';

const inMemoryStore: Record<string, string> = {};

const storage = {
  getItem(key: string): string | null {
    return inMemoryStore[key] ?? null;
  },
  setItem(key: string, value: string): void {
    inMemoryStore[key] = value;
  },
  removeItem(key: string): void {
    delete inMemoryStore[key];
  },
};

Storage._setProvider({
  _getProviderName: () => 'JestStorage',
  _getAllKeys: () => Promise.resolve(Object.keys(inMemoryStore)),
  _getItemSync: (key: string) => storage.getItem(key),
  _getItem: (key: string) => Promise.resolve(storage.getItem(key)),
  // getItem: (key: string) => Promise.reject(key),
  _setItem: (key: string, value: string) =>
    Promise.resolve(storage.setItem(key, value)),
  _removeItem: (key: string) => Promise.resolve(storage.removeItem(key)),
});

describe('App', () => {
  beforeAll(() => {
    inMemoryStore['statsig.cached.specs.2670598041'] = JSON.stringify({
      data: DcsResponseString,
      source: 'Network',
      receivedAt: 1234,
    });
  });

  test(
    'renders correctly',
    async () => {
      const { getByText } = render(<App />);

      const result = await waitFor(() => getByText('Bootstrapping'));
      expect(result).toBeDefined();
    },
    1000 * 10,
  );
});
