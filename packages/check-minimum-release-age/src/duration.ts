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

const UNIT: Record<string, Part> = {
  y: "years",
  yr: "years",
  yrs: "years",
  year: "years",
  years: "years",
  mo: "months",
  mos: "months",
  month: "months",
  months: "months",
  w: "weeks",
  wk: "weeks",
  wks: "weeks",
  week: "weeks",
  weeks: "weeks",
  d: "days",
  day: "days",
  days: "days",
  h: "hours",
  hr: "hours",
  hrs: "hours",
  hour: "hours",
  hours: "hours",
  m: "minutes",
  min: "minutes",
  mins: "minutes",
  minute: "minutes",
  minutes: "minutes",
  s: "seconds",
  sec: "seconds",
  secs: "seconds",
  second: "seconds",
  seconds: "seconds",
  ms: "milliseconds",
  msec: "milliseconds",
  msecs: "milliseconds",
  millisecond: "milliseconds",
  milliseconds: "milliseconds",
};

export type MiseAge =
  | { readonly kind: "duration"; readonly milliseconds: number }
  | { readonly kind: "reject" };

const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const ISO =
  /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;
const TOKEN = /^(\d+(?:\.\d+)?)\s*([A-Za-zµμ]+)\s*/;

const SUB_MILLISECOND: Record<string, number> = {
  us: 1000,
  usec: 1000,
  usecs: 1000,
  µs: 1000,
  μs: 1000,
  µsec: 1000,
  μsec: 1000,
  microsecond: 1000,
  microseconds: 1000,
  ns: 1_000_000,
  nsec: 1_000_000,
  nsecs: 1_000_000,
  nanosecond: 1_000_000,
  nanoseconds: 1_000_000,
};

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
  return friendlyParts(source.replaceAll(",", " "));
}

function isoParts(source: string): Parts | undefined {
  const match = ISO.exec(source);
  if (match === null) return undefined;
  const numbers = match.slice(1).map((item) => (item === undefined ? 0 : Number(item)));
  if (numbers.every((item) => item === 0) && !/\d/.test(source)) return undefined;
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
  const parts = { ...ZERO };
  let rest = source.trim();
  let saw = false;
  while (rest.length > 0) {
    const match = TOKEN.exec(rest);
    const raw = match?.[2]?.toLowerCase();
    const amount = match?.[1];
    const unit = raw === undefined ? undefined : UNIT[raw];
    const divisor = raw === undefined ? undefined : SUB_MILLISECOND[raw];
    if (
      match === null ||
      match.index !== 0 ||
      amount === undefined ||
      (unit === undefined && divisor === undefined)
    ) {
      return undefined;
    }
    if (divisor !== undefined) parts.milliseconds += Number(amount) / divisor;
    else if (unit !== undefined) parts[unit] += Number(amount);
    rest = rest.slice(match[0].length);
    saw = true;
  }
  return saw ? parts : undefined;
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
