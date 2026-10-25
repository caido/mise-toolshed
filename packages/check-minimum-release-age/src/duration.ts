const ANCHOR_YEAR = 2025;
const DAY_MS = 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * DAY_MS;

type Part =
  | "years"
  | "months"
  | "weeks"
  | "days"
  | "hours"
  | "minutes"
  | "seconds"
  | "milliseconds";

type Parts = Record<Part, number>;

const ZERO: Parts = {
  years: 0,
  months: 0,
  weeks: 0,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  milliseconds: 0,
};

type UnitInfo = {
  readonly part: Part;
  readonly rank: number;
  readonly fraction: boolean;
  readonly divide: number;
};

function unit(part: Part, rank: number, fraction: boolean, divide = 1): UnitInfo {
  return { part, rank, fraction, divide };
}

const UNIT: Record<string, UnitInfo> = {
  y: unit("years", 0, false),
  yr: unit("years", 0, false),
  yrs: unit("years", 0, false),
  year: unit("years", 0, false),
  years: unit("years", 0, false),
  mo: unit("months", 1, false),
  mos: unit("months", 1, false),
  month: unit("months", 1, false),
  months: unit("months", 1, false),
  w: unit("weeks", 2, false),
  wk: unit("weeks", 2, false),
  wks: unit("weeks", 2, false),
  week: unit("weeks", 2, false),
  weeks: unit("weeks", 2, false),
  d: unit("days", 3, false),
  day: unit("days", 3, false),
  days: unit("days", 3, false),
  h: unit("hours", 4, true),
  hr: unit("hours", 4, true),
  hrs: unit("hours", 4, true),
  hour: unit("hours", 4, true),
  hours: unit("hours", 4, true),
  m: unit("minutes", 5, true),
  min: unit("minutes", 5, true),
  mins: unit("minutes", 5, true),
  minute: unit("minutes", 5, true),
  minutes: unit("minutes", 5, true),
  s: unit("seconds", 6, true),
  sec: unit("seconds", 6, true),
  secs: unit("seconds", 6, true),
  second: unit("seconds", 6, true),
  seconds: unit("seconds", 6, true),
  ms: unit("milliseconds", 7, true),
  msec: unit("milliseconds", 7, true),
  msecs: unit("milliseconds", 7, true),
  milli: unit("milliseconds", 7, true),
  millis: unit("milliseconds", 7, true),
  millisecond: unit("milliseconds", 7, true),
  milliseconds: unit("milliseconds", 7, true),
  us: unit("milliseconds", 8, true, 1000),
  usec: unit("milliseconds", 8, true, 1000),
  usecs: unit("milliseconds", 8, true, 1000),
  µs: unit("milliseconds", 8, true, 1000),
  µsec: unit("milliseconds", 8, true, 1000),
  µsecs: unit("milliseconds", 8, true, 1000),
  micro: unit("milliseconds", 8, true, 1000),
  micros: unit("milliseconds", 8, true, 1000),
  microsecond: unit("milliseconds", 8, true, 1000),
  microseconds: unit("milliseconds", 8, true, 1000),
  ns: unit("milliseconds", 9, true, 1_000_000),
  nsec: unit("milliseconds", 9, true, 1_000_000),
  nsecs: unit("milliseconds", 9, true, 1_000_000),
  nano: unit("milliseconds", 9, true, 1_000_000),
  nanos: unit("milliseconds", 9, true, 1_000_000),
  nanosecond: unit("milliseconds", 9, true, 1_000_000),
  nanoseconds: unit("milliseconds", 9, true, 1_000_000),
};

export type MiseAge =
  | { readonly kind: "duration"; readonly milliseconds: number }
  | { readonly kind: "reject" };

const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const ISO =
  /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;
const UNIT_TOKEN = /^(\d+)(?:[.,](\d{1,9}))?\s*([A-Za-zµ]+)\s*/;
const HMS = /^(\d+):(\d+):(\d+)(?:[.,](\d{1,9}))?$/;

export function parseMiseAge(text: string): MiseAge {
  const source = text.trim();
  if (source.length === 0 || source.includes("-") || DATE.test(source)) return { kind: "reject" };
  const parts = partsOf(source);
  if (parts === undefined) return { kind: "reject" };
  const milliseconds = toMilliseconds(parts);
  if (!Number.isFinite(milliseconds)) return { kind: "reject" };
  return { kind: "duration", milliseconds };
}

function partsOf(source: string): Parts | undefined {
  if (/^\d+$/.test(source)) return { ...ZERO, seconds: Number(source) };
  if (source.startsWith("P") || source.startsWith("p")) return isoParts(source);
  const text = source.startsWith("+") ? source.slice(1).trimStart() : source;
  if (text.length === 0 || text.startsWith("-")) return undefined;
  return friendlyParts(text);
}

function isoParts(source: string): Parts | undefined {
  const match = ISO.exec(source);
  if (match === null) return undefined;
  const raw = match.slice(1);
  if (raw.every((item) => item === undefined)) return undefined;
  let fractionUsed = false;
  for (const item of raw) {
    if (item === undefined) continue;
    if (fractionUsed) return undefined;
    if (item.includes(".")) fractionUsed = true;
  }
  const numbers = raw.map((item) => (item === undefined ? 0 : Number(item)));
  const [years, months, weeks, days, hours, minutes, seconds] = numbers;
  return {
    ...ZERO,
    years: years ?? 0,
    months: months ?? 0,
    weeks: weeks ?? 0,
    days: days ?? 0,
    hours: hours ?? 0,
    minutes: minutes ?? 0,
    seconds: seconds ?? 0,
  };
}

function friendlyParts(source: string): Parts | undefined {
  const clock = hmsParts(source);
  if (clock !== undefined) return clock;
  const parts = { ...ZERO };
  let rest = source.trim();
  let lastRank = -1;
  let saw = false;
  while (rest.length > 0) {
    if (lastRank >= 0 && lastRank <= 3) {
      const clockRest = hmsParts(rest);
      if (clockRest !== undefined) return addParts(parts, clockRest);
    }
    const match = UNIT_TOKEN.exec(rest);
    const label = match?.[3];
    const info = label === undefined ? undefined : UNIT[label];
    const whole = match?.[1];
    if (match === null || match.index !== 0 || info === undefined || whole === undefined)
      return undefined;
    const fraction = match[2];
    if (info.rank <= lastRank) return undefined;
    if (fraction !== undefined && !info.fraction) return undefined;
    const amount =
      Number(whole) + (fraction === undefined ? 0 : Number(fraction) / 10 ** fraction.length);
    parts[info.part] += amount / info.divide;
    rest = rest.slice(match[0].length);
    lastRank = info.rank;
    saw = true;
    if (fraction !== undefined) return rest.length === 0 ? parts : undefined;
    if (rest.startsWith(",")) {
      if (!/^,\s/.test(rest)) return undefined;
      rest = rest.replace(/^,\s+/, "");
      if (rest.length === 0) return undefined;
    }
  }
  return saw ? parts : undefined;
}

function hmsParts(text: string): Parts | undefined {
  const match = HMS.exec(text);
  if (match === null) return undefined;
  const fraction = match[4];
  const milliseconds =
    fraction === undefined ? 0 : (Number(fraction) / 10 ** fraction.length) * 1000;
  return {
    ...ZERO,
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: Number(match[3]),
    milliseconds,
  };
}

function addParts(left: Parts, right: Parts): Parts {
  return {
    years: left.years + right.years,
    months: left.months + right.months,
    weeks: left.weeks + right.weeks,
    days: left.days + right.days,
    hours: left.hours + right.hours,
    minutes: left.minutes + right.minutes,
    seconds: left.seconds + right.seconds,
    milliseconds: left.milliseconds + right.milliseconds,
  };
}

function toMilliseconds(parts: Parts): number {
  const wholeYears = Math.trunc(parts.years);
  const wholeMonths = Math.trunc(parts.months);
  let year = ANCHOR_YEAR + wholeYears;
  let month = wholeMonths;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  const start = Date.UTC(ANCHOR_YEAR, 0, 1);
  const end = Date.UTC(year, month, 1 + parts.weeks * 7 + parts.days);
  const yearMs = Date.UTC(ANCHOR_YEAR + 1, 0, 1) - start;
  const monthMs = Date.UTC(year, month + 1, 1) - Date.UTC(year, month, 1);
  return (
    end -
    start +
    (parts.years - wholeYears) * yearMs +
    (parts.months - wholeMonths) * monthMs +
    parts.hours * 60 * 60 * 1000 +
    parts.minutes * 60 * 1000 +
    parts.seconds * 1000 +
    parts.milliseconds
  );
}
