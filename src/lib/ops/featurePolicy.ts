export const FEATURE_POLICY = {
  autoLearn: false,
  autoRecommendations: false,
  trendGeneration: false,
  newImageGeneration: false,
  newVideoGeneration: false,
} as const;

const JST_OFFSET_HOURS = 9;
const GROK_REFRESH_PAUSE_START_HOUR_JST = 1;
const GROK_REFRESH_PAUSE_END_HOUR_JST = 8;

export function getJstHour(date = new Date()): number {
  return (date.getUTCHours() + JST_OFFSET_HOURS) % 24;
}

export function isScheduledGrokRefreshAllowed(date = new Date()): boolean {
  const hour = getJstHour(date);
  return (
    hour < GROK_REFRESH_PAUSE_START_HOUR_JST ||
    hour >= GROK_REFRESH_PAUSE_END_HOUR_JST
  );
}

export const GROK_REFRESH_PAUSE_REASON =
  "scheduled Grok refresh is paused from 01:00 through 07:59 JST";
