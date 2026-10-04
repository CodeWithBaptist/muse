import { expect, test } from '@playwright/test';
import { mockAppApi, TEST_TRACKS } from './fixtures';

test('chat frame pacing stays near 60 fps with a throttled Chromium CPU', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CPU throttling uses the Chromium DevTools protocol.');

  await mockAppApi(page, {
    chatResponse: {
      events: [
        { type: 'status', stage: 'Searching Spotify catalog' },
        { type: 'delta', delta: 'A few tracks for your request.' },
        {
          type: 'done',
          conversationId: '11111111-1111-4111-8111-111111111111',
          role: 'assistant',
          content: 'A few tracks for your request.',
          tracks: [
            ...TEST_TRACKS,
            {
              ...TEST_TRACKS[0],
              id: '1234567890123456789012',
              uri: 'spotify:track:1234567890123456789012',
              name: 'Quiet Light',
            },
            {
              ...TEST_TRACKS[1],
              id: 'abcdefghijklmnopqrstuv',
              uri: 'spotify:track:abcdefghijklmnopqrstuv',
              name: 'Open Window',
            },
          ],
        },
      ],
    },
  });

  await page.goto('/chat');
  const input = page.getByRole('textbox', { name: 'Message MUSE' });
  await input.fill('Find a relaxed late-night mix');

  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 2 });

  const frameMetricsPromise = page.evaluate(
    () =>
      new Promise<{
        averageFps: number;
        p95FrameMs: number;
        sampleFrames: number;
      }>((resolve) => {
        const intervals: number[] = [];
        let previousFrame = 0;
        const targetIntervals = 180;

        const sample = (timestamp: number) => {
          if (previousFrame > 0) intervals.push(timestamp - previousFrame);
          previousFrame = timestamp;

          if (intervals.length < targetIntervals) {
            window.requestAnimationFrame(sample);
            return;
          }

          const sorted = [...intervals].sort((left, right) => left - right);
          const averageFrameMs =
            intervals.reduce((total, interval) => total + interval, 0) /
            intervals.length;
          const p95Index = Math.min(
            sorted.length - 1,
            Math.ceil(sorted.length * 0.95) - 1,
          );

          resolve({
            averageFps: 1000 / averageFrameMs,
            p95FrameMs: sorted[p95Index],
            sampleFrames: intervals.length,
          });
        };

        window.requestAnimationFrame(sample);
      }),
  );

  await input.press('Enter');
  await expect(page.getByText('A few tracks for your request.')).toBeVisible();
  const frameMetrics = await frameMetricsPromise;

  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await session.detach();

  test.info().annotations.push({
    type: 'frame-pacing',
    description: `${frameMetrics.averageFps.toFixed(1)} average fps, p95 ${frameMetrics.p95FrameMs.toFixed(1)} ms across ${frameMetrics.sampleFrames} frames at 2x CPU throttling.`,
  });

  expect(frameMetrics.sampleFrames).toBe(180);
  expect(frameMetrics.averageFps).toBeGreaterThanOrEqual(58);
  expect(frameMetrics.p95FrameMs).toBeLessThanOrEqual(33.4);
});
