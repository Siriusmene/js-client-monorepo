import * as React from 'react';

import { getStatsigValues } from '../../utils/statsig-server';
import TriggeredSessionReplayExample, {
  TriggeredSessionReplayPluginOptions,
} from '../triggered-session-replay-example/TriggeredSessionReplayExample';

function parseBooleanParam(
  value: string | string[] | undefined,
  defaultValue: boolean,
): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) {
    return defaultValue;
  }
  return raw === 'true';
}

export default async function Index({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const user = { userID: 'triggered-session-replay-e2e-user' };
  const canRecordSession = parseBooleanParam(params['canRecord'], true);
  const pluginOptions: TriggeredSessionReplayPluginOptions = {
    autoStartRecording: parseBooleanParam(params['autoStart'], false),
    keepRollingWindow: parseBooleanParam(params['keepRolling'], true),
  };
  const values = await getStatsigValues(user, {
    forceSessionReplay: { canRecordSession },
  });

  return (
    <TriggeredSessionReplayExample
      user={user}
      values={values}
      pluginOptions={pluginOptions}
    />
  );
}
