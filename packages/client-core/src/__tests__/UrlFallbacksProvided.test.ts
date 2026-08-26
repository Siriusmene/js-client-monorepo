import 'jest-fetch-mock';
import { MockLocalStorage } from 'statsig-test-helpers';

import { _DJB2 } from '../Hashing';
import { Endpoint } from '../NetworkConfig';
import { NetworkFallbackResolver } from '../NetworkFallbackResolver';
import { UrlConfiguration } from '../UrlConfiguration';

const SDK_KEY = 'client-test-sdk-key';
const STORAGE_KEY = `statsig.network_fallback.${_DJB2(SDK_KEY)}`;

Object.defineProperty(global, 'performance', {
  writable: true,
});

let dnsCalls = 0;

jest.mock('../DnsTxtQuery', () => ({
  _fetchTxtRecords: () => {
    dnsCalls++;
    return Promise.reject();
  },
}));

describe('Url Fallbacks Via StatsigOptions', () => {
  let mockStorage: MockLocalStorage;
  let resolver: NetworkFallbackResolver;

  beforeAll(() => {
    mockStorage = MockLocalStorage.enabledMockStorage();
    fetchMock.enableMocks();
  });

  beforeEach(() => {
    resolver = new NetworkFallbackResolver({});
    mockStorage.clear();
    fetchMock.mockClear();
  });

  describe('tryFetchUpdatedFallbackInfo', () => {
    const resolveAgainstConfig = (urlConfig: UrlConfiguration) => {
      return resolver.tryFetchUpdatedFallbackInfo(
        SDK_KEY,
        urlConfig,
        'Uncaught Exception',
        false,
      );
    };

    beforeEach(() => {
      dnsCalls = 0;
    });

    it('does not make dns query when custom url is used', async () => {
      const urlConfig = new UrlConfiguration(
        Endpoint._initialize,
        'https://my-custom-proxy.com/v1/initialize',
        null,
        null,
      );

      await resolveAgainstConfig(urlConfig);

      expect(dnsCalls).toBe(0);
    });

    it('does not make dns query when custom api is used', async () => {
      const urlConfig = new UrlConfiguration(
        Endpoint._initialize,
        null,
        'https://my-custom-proxy.com/v1',
        null,
      );

      await resolveAgainstConfig(urlConfig);

      expect(dnsCalls).toBe(0);
    });

    it('does not make dns query when custom fallback urls are given', async () => {
      const urlConfig = new UrlConfiguration(Endpoint._initialize, null, null, [
        'https://my-custom-proxy.com/v1/initialize',
      ]);

      await resolveAgainstConfig(urlConfig);

      expect(dnsCalls).toBe(0);
    });

    it('returns fallback URL when a custom URL is requested', () => {
      const urlConfig = new UrlConfiguration(
        Endpoint._initialize,
        'https://my-custom-proxy.com/v1/initialize',
        null,
        null,
      );

      mockStorage.data[STORAGE_KEY] = JSON.stringify({
        initialize: {
          urlConfigChecksum: urlConfig.getChecksum(),
          url: 'https://fallback.example.com/v1/initialize',
          previous: [],
          expiryTime: Date.now() + 3600000,
        },
      });

      const result = resolver.getActiveFallbackUrl(SDK_KEY, urlConfig);
      expect(result).toBe('https://fallback.example.com/v1/initialize');
    });
  });

  describe('serving provided fallback urls', () => {
    const CUSTOM_API = 'https://my-statsig-proxy.com/v1';

    const expectServesFallback = async (
      endpoint: Endpoint,
      customUrl: string | null,
      customApi: string | null,
    ) => {
      const fallbackUrl = `https://my-proxy-cache.com/v1/${endpoint}`;
      const urlConfig = new UrlConfiguration(endpoint, customUrl, customApi, [
        fallbackUrl,
      ]);

      const stored = await resolver.tryFetchUpdatedFallbackInfo(
        SDK_KEY,
        urlConfig,
        'Failed to fetch',
        false,
      );

      expect(stored).toBe(true);
      expect(resolver.getActiveFallbackUrl(SDK_KEY, urlConfig)).toBe(
        fallbackUrl,
      );
    };

    // `api` and `initializeUrl` both land in UrlConfiguration.customUrl, so a
    // provided fallback must be served no matter how the primary was configured.
    const primaries = [
      { name: 'the default api', customUrl: null, customApi: null },
      { name: 'a custom api', customUrl: null, customApi: CUSTOM_API },
      {
        name: 'a custom url',
        customUrl: `${CUSTOM_API}/${Endpoint._initialize}`,
        customApi: null,
      },
    ];

    it.each(primaries)(
      'serves the fallback when the primary is $name',
      ({ customUrl, customApi }) =>
        expectServesFallback(Endpoint._initialize, customUrl, customApi),
    );

    // One fallback option per endpoint: initializeFallbackUrls,
    // logEventFallbackUrls and downloadConfigSpecsFallbackUrls.
    it.each(Object.values(Endpoint))(
      'serves the %s fallback when a custom api is set',
      (endpoint) => expectServesFallback(endpoint, null, CUSTOM_API),
    );
  });
});
