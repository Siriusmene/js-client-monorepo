import {
  DataAdapterCachePrefix,
  DataAdapterResult,
  EvaluationsDataAdapter,
  SpecsDataAdapter,
  StatsigClientInterface,
  Storage,
  _typedJsonParse,
} from '@statsig/client-core';

export type StatsigAsyncCacheWarming = {
  result: Promise<void>;
  isResolved: boolean;
};

export function warmCachingFromAsyncStorage(
  client: StatsigClientInterface,
): StatsigAsyncCacheWarming {
  const output: StatsigAsyncCacheWarming = {
    result: Promise.resolve(),
    isResolved: false,
  };

  output.result = _loadCacheAsync(client.dataAdapter).finally(() => {
    output.isResolved = true;
  });

  return output;
}

async function _loadCacheAsync(
  adapter: EvaluationsDataAdapter | SpecsDataAdapter,
): Promise<void> {
  const keys = await Storage._getAllKeys();
  const results: Record<string, DataAdapterResult> = {};

  await Promise.all(
    keys.map(async (key) => {
      if (!key.startsWith(DataAdapterCachePrefix)) {
        return;
      }

      const cache = await Storage._getItem(key);
      if (!cache) {
        return;
      }
      const result = _typedJsonParse<DataAdapterResult>(
        cache,
        'source',
        'cached result',
      );

      if (result && 'source' in result) {
        results[key] = { ...result, source: 'Cache' };
      }
    }),
  );

  adapter.__primeInMemoryCache(results);
}
