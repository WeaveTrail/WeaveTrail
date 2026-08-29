const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400n;

const EVENT_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

export type CanonicalizationErrorCode =
  "MIXED_SEQUENCE_PRESENCE" | "UNSUPPORTED_EVENT_TIME";

export class CanonicalizationError extends Error {
  readonly code: CanonicalizationErrorCode;

  constructor(code: CanonicalizationErrorCode, message: string) {
    super(message);
    this.name = "CanonicalizationError";
    this.code = code;
  }
}

export function compareUtf16CodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function floorDiv(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  const remainder = value % divisor;
  return remainder < 0n ? quotient - 1n : quotient;
}

function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;

  return era * 146_097 + dayOfEra - 719_468;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return monthLengths[month - 1] ?? 0;
}

function rejectUnsupportedComponent(component: string, value: number): never {
  throw new CanonicalizationError(
    "UNSUPPORTED_EVENT_TIME",
    `eventTime has an unsupported ${component}: ${value}`,
  );
}

function civilFromDays(daysSinceEpoch: number): {
  year: number;
  month: number;
  day: number;
} {
  const shiftedDays = daysSinceEpoch + 719_468;
  const era = Math.floor(shiftedDays / 146_097);
  const dayOfEra = shiftedDays - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1_460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;

  return { year, month, day };
}

function parseEventTimeToEpochNanoseconds(eventTime: string): bigint {
  const match = EVENT_TIME_PATTERN.exec(eventTime);
  if (!match) {
    throw new CanonicalizationError(
      "UNSUPPORTED_EVENT_TIME",
      "eventTime must use an explicit UTC offset and no more than nine fractional digits",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[10]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[11]);

  if (month < 1 || month > 12) rejectUnsupportedComponent("month", month);
  if (day < 1 || day > daysInMonth(year, month)) {
    rejectUnsupportedComponent("day", day);
  }
  if (hour < 0 || hour > 23) rejectUnsupportedComponent("hour", hour);
  if (minute < 0 || minute > 59) rejectUnsupportedComponent("minute", minute);
  if (second < 0 || second > 59) rejectUnsupportedComponent("second", second);
  if (offsetHour < 0 || offsetHour > 23) {
    rejectUnsupportedComponent("offset hour", offsetHour);
  }
  if (offsetMinute < 0 || offsetMinute > 59) {
    rejectUnsupportedComponent("offset minute", offsetMinute);
  }

  const fractionalNanoseconds = BigInt((match[7] ?? "").padEnd(9, "0"));
  const offsetSign = match[9] === "-" ? -1 : 1;
  const offsetSeconds =
    match[8] === "Z"
      ? 0
      : offsetSign * (offsetHour * 3_600 + offsetMinute * 60);

  const localSeconds =
    BigInt(daysFromCivil(year, month, day)) * SECONDS_PER_DAY +
    BigInt(hour * 3_600 + minute * 60 + second);

  return (
    (localSeconds - BigInt(offsetSeconds)) * NANOSECONDS_PER_SECOND +
    fractionalNanoseconds
  );
}

function pad(value: number, width: number): string {
  return value.toString().padStart(width, "0");
}

export function normalizeEventTime(eventTime: string): string {
  const epochNanoseconds = parseEventTimeToEpochNanoseconds(eventTime);
  const epochSeconds = floorDiv(epochNanoseconds, NANOSECONDS_PER_SECOND);
  const fractionalNanoseconds =
    epochNanoseconds - epochSeconds * NANOSECONDS_PER_SECOND;
  const epochDays = floorDiv(epochSeconds, SECONDS_PER_DAY);
  const secondsWithinDay = Number(epochSeconds - epochDays * SECONDS_PER_DAY);
  const { year, month, day } = civilFromDays(Number(epochDays));

  if (year < 0 || year > 9_999) {
    throw new CanonicalizationError(
      "UNSUPPORTED_EVENT_TIME",
      "eventTime must normalize to a UTC year between 0000 and 9999",
    );
  }

  const hour = Math.floor(secondsWithinDay / 3_600);
  const minute = Math.floor((secondsWithinDay % 3_600) / 60);
  const second = secondsWithinDay % 60;

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}.${fractionalNanoseconds.toString().padStart(9, "0")}Z`;
}

export function compareCanonicalEventTimes(
  left: string,
  right: string,
): number {
  const leftNanoseconds = parseEventTimeToEpochNanoseconds(left);
  const rightNanoseconds = parseEventTimeToEpochNanoseconds(right);

  if (leftNanoseconds < rightNanoseconds) return -1;
  if (leftNanoseconds > rightNanoseconds) return 1;
  return 0;
}
