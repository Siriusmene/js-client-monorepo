import {
  DataAdapterAsyncOptions,
  DataAdapterCachePrefix,
  DataAdapterCore,
  DataAdapterResult,
  NetworkCore,
  SpecsDataAdapter,
  StatsigUser,
  _getStorageKey,
} from '@statsig/client-core';

import Network from './Network';
import { StatsigOptions } from './StatsigOptions';

export class StatsigSpecsDataAdapter
  extends DataAdapterCore
  implements SpecsDataAdapter
{
  private _network: Network | null = null;

  constructor() {
    super('SpecsDataAdapter', 'specs');
  }

  override attach(
    sdkKey: string,
    options: StatsigOptions | null,
    network: NetworkCore | null,
  ): void {
    super.attach(sdkKey, options, network);
    if (network !== null && network instanceof Network) {
      this._network = network;
    } else {
      this._network = new Network(options ?? {});
    }
  }

  getDataAsync(
    current: DataAdapterResult | null,
    options?: DataAdapterAsyncOptions,
  ): Promise<DataAdapterResult | null> {
    return this._getDataAsyncImpl(current, undefined, options);
  }

  prefetchData(options?: DataAdapterAsyncOptions): Promise<void> {
    return this._prefetchDataImpl(undefined, options);
  }

  protected override async _fetchFromNetwork(
    _current: string | null,
    _user?: StatsigUser,
    options?: DataAdapterAsyncOptions,
  ): Promise<string | null> {
    return (
      (await this._network?.fetchConfigSpecs(
        this._getSdkKey(),
        options?.priority,
      )) ?? null
    );
  }

  protected override _getCacheKey(): string {
    const key = _getStorageKey(this._getSdkKey());
    return `${DataAdapterCachePrefix}.${this._cacheSuffix}.${key}`;
  }

  protected override _isCachedResultValidFor204(
    result: DataAdapterResult,
    _user: StatsigUser | undefined,
  ): boolean {
    // Simply having a cache value makes it valid
    return result.data.length > 0;
  }
}
