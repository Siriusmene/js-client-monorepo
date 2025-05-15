import {
  PrecomputedEvaluationsInterface,
  StatsigMetadataProvider,
  StatsigPlugin,
} from '@statsig/client-core';

import { EndReason, SessionReplayBase } from './SessionReplayBase';
import { RRWebConfig } from './SessionReplayClient';
import { MAX_LOGS } from './SessionReplayUtils';

type SessionReplayOptions = {
  rrwebConfig?: RRWebConfig;
  forceRecording?: boolean;
};

export class StatsigSessionReplayPlugin
  implements StatsigPlugin<PrecomputedEvaluationsInterface>
{
  readonly __plugin = 'session-replay';

  constructor(private readonly options?: SessionReplayOptions) {}

  bind(client: PrecomputedEvaluationsInterface): void {
    runStatsigSessionReplay(client, this.options);
  }
}

export function runStatsigSessionReplay(
  client: PrecomputedEvaluationsInterface,
  options?: SessionReplayOptions,
): void {
  new SessionReplay(client, options);
}

export class SessionReplay extends SessionReplayBase {
  constructor(
    client: PrecomputedEvaluationsInterface,
    options?: SessionReplayOptions,
  ) {
    super(client, options);
    this._client.$on('values_updated', () => {
      if (!this._wasStopped) {
        this._attemptToStartRecording(this._options?.forceRecording);
      }
    });

    this._attemptToStartRecording(this._options?.forceRecording);
  }

  protected override _shutdown(endReason?: EndReason): void {
    super._shutdownImpl(endReason);
  }

  protected _attemptToStartRecording(force = false): void {
    if (this._totalLogs >= MAX_LOGS) {
      return;
    }
    const values = this._client.getContext().values;

    if (values?.recording_blocked === true) {
      this._shutdown();
      return;
    }

    if (!force && values?.can_record_session !== true) {
      this._shutdown();
      return;
    }

    if (values?.passes_session_recording_targeting === false) {
      this._shutdown();
      return;
    }

    if (this._replayer.isRecording()) {
      return;
    }

    this._wasStopped = false;
    StatsigMetadataProvider.add({ isRecordingSession: 'true' });
    this._replayer.record(
      (e, d) => this._onRecordingEvent(e, d),
      this._options?.rrwebConfig ?? {},
      () => {
        this._shutdown();
      },
    );
  }
}
