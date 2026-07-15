import { MockRemoteServerEvalClient } from 'statsig-test-helpers';

import {
  PrecomputedEvaluationsInterface,
  StatsigClientEventCallback,
  StatsigClientEventName,
  StatsigMetadataProvider,
} from '@statsig/client-core';

import { SessionReplayClient } from '../../SessionReplayClient';
import { TriggeredSessionReplay } from '../../TriggeredSessionReplay';
import { mockClientContext } from '../../testUtils/mockClientContext';

describe('Triggered Session Replay with autoStartRecording and keepRollingWindow', () => {
  let client: jest.MockedObject<PrecomputedEvaluationsInterface>;
  let gateEvaluationListener: StatsigClientEventCallback<StatsigClientEventName>;
  let valuesUpdatedListener: StatsigClientEventCallback<StatsigClientEventName>;
  const createdReplays: TriggeredSessionReplay[] = [];

  const createSessionReplay = (
    options: ConstructorParameters<typeof TriggeredSessionReplay>[1],
  ) => {
    const sessionReplay = new TriggeredSessionReplay(client, options);
    createdReplays.push(sessionReplay);
    return sessionReplay;
  };

  beforeEach(() => {
    client = MockRemoteServerEvalClient.create();
    client.flush.mockResolvedValue();
    client.$on.mockImplementation((name, listener) => {
      if (name === 'gate_evaluation') {
        gateEvaluationListener = listener;
      }
      if (name === 'values_updated') {
        valuesUpdatedListener = listener;
      }
      if (name === 'logs_flushed') {
        listener({ name: 'logs_flushed', events: [] });
      }
    });
    StatsigMetadataProvider.add({ isRecordingSession: undefined });
    client.checkGate.mockImplementation((name: string) => {
      const gate = {
        name: name,
        value: false,
        ruleID: '',
        details: {
          reason: '',
        },
        idType: 'userID',
        __evaluation: null,
      };
      gateEvaluationListener({ name: 'gate_evaluation', gate });

      return false;
    });
  });

  afterEach(() => {
    while (createdReplays.length > 0) {
      createdReplays.pop()?.stopRecording();
    }
  });

  it('does not start rolling window when recording is blocked', () => {
    mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: false,
      recording_blocked: true,
      passes_session_recording_targeting: true,
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    expect(sessionReplay.isRecording()).toBe(false);
  });

  it('starts rolling window for non-sampled sessions instead of shutting down', () => {
    mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    const metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe(undefined);
    expect(sessionReplay.isRecording()).toBe(true);
  });

  it('auto-starts active recording for sampled sessions', () => {
    mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    });
    createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    const metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');
  });

  it('restarts rrweb with active config after rolling window for sampled sessions', () => {
    const recordSpy = jest.spyOn(SessionReplayClient.prototype, 'record');

    mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    expect(recordSpy).toHaveBeenCalledTimes(2);
    expect(recordSpy.mock.calls[0][3]).toBe(true);
    expect(recordSpy.mock.calls[1][3]).toBeUndefined();
    expect(sessionReplay.isRecording()).toBe(true);

    recordSpy.mockRestore();
  });

  it('does not restart active recording on values_updated', () => {
    const recordSpy = jest.spyOn(SessionReplayClient.prototype, 'record');
    const { handle } = mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    });
    createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    expect(recordSpy).toHaveBeenCalledTimes(2);
    recordSpy.mockClear();

    handle.values = {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    };
    valuesUpdatedListener({
      name: 'values_updated',
      status: 'Ready',
      values: null,
    });

    expect(recordSpy).not.toHaveBeenCalled();
    recordSpy.mockRestore();
  });

  it('can promote a rolling window session to active recording on trigger', () => {
    mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
      session_recording_exposure_triggers: {
        3114454104: {},
      },
    });
    createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    let metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe(undefined);

    client.checkGate('test_gate');

    metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');
  });

  it('keeps force-triggered recording when values_updated is not sampled', () => {
    const { handle } = mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
      session_recording_exposure_triggers: {
        3114454104: {},
      },
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    client.checkGate('test_gate');

    let metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');

    handle.values = {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
      session_recording_exposure_triggers: {
        3114454104: {},
      },
    };
    valuesUpdatedListener({
      name: 'values_updated',
      status: 'Ready',
      values: null,
    });

    metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');
    expect(sessionReplay.isRecording()).toBe(true);
  });

  it('promotes to active recording when values_updated grants sampling', () => {
    const { handle } = mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
    });
    createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    let metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe(undefined);

    handle.values = {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    };
    valuesUpdatedListener({
      name: 'values_updated',
      status: 'Ready',
      values: null,
    });

    metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');
  });

  it('does not start rolling window while active recording is flagged', () => {
    const recordSpy = jest.spyOn(SessionReplayClient.prototype, 'record');
    const { handle } = mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    expect(recordSpy).toHaveBeenCalledTimes(2);
    (sessionReplay as any)._replayer.stop();
    recordSpy.mockClear();

    handle.values = {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    };
    valuesUpdatedListener({
      name: 'values_updated',
      status: 'Ready',
      values: null,
    });

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0][3]).toBeUndefined();
    const metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');
    recordSpy.mockRestore();
  });

  it('restarts force-triggered recording when rrweb stops on values_updated', () => {
    const recordSpy = jest.spyOn(SessionReplayClient.prototype, 'record');
    const { handle } = mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
      session_recording_exposure_triggers: {
        3114454104: {},
      },
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    client.checkGate('test_gate');
    expect(sessionReplay.isRecording()).toBe(true);

    (sessionReplay as any)._replayer.stop();
    recordSpy.mockClear();

    handle.values = {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
      session_recording_exposure_triggers: {
        3114454104: {},
      },
    };
    valuesUpdatedListener({
      name: 'values_updated',
      status: 'Ready',
      values: null,
    });

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(sessionReplay.isRecording()).toBe(true);
    const metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');
    recordSpy.mockRestore();
  });

  it('does not overwrite active events with stale rolling buffer on restart', () => {
    const recordSpy = jest
      .spyOn(SessionReplayClient.prototype, 'record')
      .mockImplementation(() => undefined);
    const { handle } = mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    const activeEvent = { type: 3, eventIndex: 0 } as any;
    (sessionReplay as any)._events = [activeEvent];
    (sessionReplay as any)._currentEventIndex = 1;
    (sessionReplay as any)._runningEventData = [
      { events: [{ event: { type: 1, eventIndex: 0 }, data: {} }] },
    ];
    (sessionReplay as any)._replayer.stop();

    handle.values = {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    };
    valuesUpdatedListener({
      name: 'values_updated',
      status: 'Ready',
      values: null,
    });

    expect((sessionReplay as any)._events).toEqual([activeEvent]);
    expect((sessionReplay as any)._runningEventData).toEqual([]);
    recordSpy.mockRestore();
  });

  it('returns to rolling buffer when values_updated revokes sampling', () => {
    const { handle } = mockClientContext(client, {
      session_recording_rate: 1,
      can_record_session: true,
      passes_session_recording_targeting: true,
    });
    const sessionReplay = createSessionReplay({
      autoStartRecording: true,
      keepRollingWindow: true,
    });

    let metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('true');

    handle.values = {
      session_recording_rate: 1,
      can_record_session: false,
      passes_session_recording_targeting: true,
    };
    valuesUpdatedListener({
      name: 'values_updated',
      status: 'Ready',
      values: null,
    });

    metadata = StatsigMetadataProvider.get() as any;
    expect(metadata.isRecordingSession).toBe('false');
    expect(sessionReplay.isRecording()).toBe(true);
  });
});
