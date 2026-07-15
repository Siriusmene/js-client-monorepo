import { Page, expect, test } from '@playwright/test';

import { StatsigEvent } from '@statsig/client-core';

const DEMO_CLIENT_KEY = 'client-rfLvYGag3eyU0jYW5zcIJTQip7GXxSrhOFN69IGMjvq';

const SESSION_RECORDING_EVENT = 'statsig::session_recording';

type CapturedRgstrEvent = StatsigEvent & {
  metadata?: Record<string, string>;
};

function isDemoClientRgstr(url: string): boolean {
  return (
    (url.includes('/v1/rgstr') || url.includes('/v1/log_event')) &&
    url.includes(DEMO_CLIENT_KEY)
  );
}

function attachRgstrCapture(page: Page): {
  getEvents: () => CapturedRgstrEvent[];
  clearEvents: () => void;
} {
  let events: CapturedRgstrEvent[] = [];

  page.on('request', (request) => {
    if (!isDemoClientRgstr(request.url())) {
      return;
    }
    const body = request.postDataJSON() as { events?: CapturedRgstrEvent[] };
    if (body.events != null) {
      events.push(...body.events);
    }
  });

  return {
    getEvents: () => events,
    clearEvents: () => {
      events = [];
    },
  };
}

function getSessionRecordingEvents(
  events: CapturedRgstrEvent[],
): CapturedRgstrEvent[] {
  return events.filter((event) => event.eventName === SESSION_RECORDING_EVENT);
}

function parseRrwebEvents(metadata: Record<string, string> | undefined): {
  type: number;
}[] {
  if (metadata?.rrweb_events == null) {
    return [];
  }
  return JSON.parse(metadata.rrweb_events) as { type: number }[];
}

async function flushStatsigEvents(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const global = (
      window as {
        __STATSIG__?: { firstInstance?: { flush: () => Promise<void> } };
      }
    ).__STATSIG__;
    await global?.firstInstance?.flush?.();
  });
}

async function waitForSessionRecording(
  getEvents: () => CapturedRgstrEvent[],
  timeout = 60_000,
): Promise<CapturedRgstrEvent[]> {
  await expect
    .poll(() => getSessionRecordingEvents(getEvents()).length, { timeout })
    .toBeGreaterThan(0);
  return getSessionRecordingEvents(getEvents());
}

async function waitForClientReady(page: Page): Promise<void> {
  await page.waitForRequest((request) => isDemoClientRgstr(request.url()));
}

test.describe('Triggered Session Replay E2E', () => {
  test.describe.configure({ timeout: 60_000 });

  test('buffers with autoStart + keepRolling until event trigger when not sampled', async ({
    page,
  }) => {
    const capture = attachRgstrCapture(page);

    await page.goto(
      '/triggered-session-replay-e2e?canRecord=false&autoStart=true&keepRolling=true',
    );
    await page.waitForSelector('#pre-trigger-marker');
    await waitForClientReady(page);
    await page.waitForTimeout(1500);

    expect(getSessionRecordingEvents(capture.getEvents())).toHaveLength(0);

    capture.clearEvents();
    await page.click('#a-button');
    await flushStatsigEvents(page);
    const recordingEvents = await waitForSessionRecording(capture.getEvents);
    expect(recordingEvents.length).toBeGreaterThan(0);
  });

  test('uploads rolling-buffer rrweb events on trigger when not sampled', async ({
    page,
  }) => {
    const capture = attachRgstrCapture(page);

    await page.goto(
      '/triggered-session-replay-e2e?canRecord=false&autoStart=true&keepRolling=true',
    );
    await page.waitForSelector('#pre-trigger-marker');
    await waitForClientReady(page);
    await page.waitForTimeout(2000);

    capture.clearEvents();
    await page.click('#a-button');
    await flushStatsigEvents(page);
    const recordingEvents = await waitForSessionRecording(capture.getEvents);

    const rrwebEvents = parseRrwebEvents(recordingEvents[0].metadata);
    expect(rrwebEvents.length).toBeGreaterThan(1);

    const metadata = recordingEvents[0].metadata;
    expect(metadata?.session_start_ts).toBeDefined();
    expect(metadata?.session_end_ts).toBeDefined();
    expect(Number(metadata?.session_end_ts)).toBeGreaterThanOrEqual(
      Number(metadata?.session_start_ts),
    );
  });

  test('auto-starts active recording when sampled with both flags', async ({
    page,
  }) => {
    const capture = attachRgstrCapture(page);

    await page.goto(
      '/triggered-session-replay-e2e?canRecord=true&autoStart=true&keepRolling=true',
    );
    await page.waitForSelector('#pre-trigger-marker');
    await waitForClientReady(page);
    await page.click('#a-button');
    await flushStatsigEvents(page);

    expect(
      (await waitForSessionRecording(capture.getEvents)).length,
    ).toBeGreaterThan(0);
  });
});
