export interface GoogleOpeningPoint {
  day?: number;
  hour?: number;
  minute?: number;
}

export interface GoogleOpeningPeriod {
  open?: GoogleOpeningPoint;
  close?: GoogleOpeningPoint;
}

export interface GoogleTargetOpenTime {
  day: number;
  hour: number;
  minute: number;
}

const mealTargetTimes: Record<string, { hour: number; minute: number }> = {
  breakfast: { hour: 9, minute: 0 },
  lunch: { hour: 12, minute: 0 },
  dinner: { hour: 19, minute: 0 },
  lateNight: { hour: 22, minute: 0 },
  late_night: { hour: 22, minute: 0 },
};

const weekdayToGoogleDay: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function googleTargetOpenTimeForMealTime(
  mealTime: string | null | undefined,
  options: { now?: Date; timeZone?: string | null } = {},
): GoogleTargetOpenTime {
  const slot = mealTargetTimes[mealTime ?? ""] ?? mealTargetTimes.dinner;
  return {
    day: googleDayForDate(options.now ?? new Date(), options.timeZone),
    hour: slot.hour,
    minute: slot.minute,
  };
}

export function normalizeGoogleTargetOpenTime(
  value: unknown,
): GoogleTargetOpenTime | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const point = value as GoogleOpeningPoint;
  if (!isValidGoogleOpeningPoint(point)) {
    return null;
  }
  return {
    day: point.day,
    hour: point.hour,
    minute: point.minute,
  };
}

export function isOpenAtGoogleTargetTime(
  periods: GoogleOpeningPeriod[] | undefined,
  target: GoogleTargetOpenTime | null | undefined,
): boolean {
  if (!target || !Array.isArray(periods)) return false;
  return periods.some((period) => periodContainsGoogleMinute(period, target));
}

function googleDayForDate(
  date: Date,
  timeZone: string | null | undefined,
): number {
  const zone = timeZone && timeZone.trim().length > 0 ? timeZone : "UTC";
  try {
    const weekdayName = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: zone,
    }).format(date);
    return weekdayToGoogleDay[weekdayName] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
  }
}

function periodContainsGoogleMinute(
  period: GoogleOpeningPeriod,
  target: GoogleTargetOpenTime,
): boolean {
  const open = googlePointMinuteOfWeek(period.open);
  if (open === null) return false;

  const close = googlePointMinuteOfWeek(period.close);
  if (close === null) {
    return true;
  }

  const targetMinute = target.day * 24 * 60 + target.hour * 60 + target.minute;
  if (close > open) {
    return targetMinute >= open && targetMinute < close;
  }
  return targetMinute >= open || targetMinute < close;
}

function googlePointMinuteOfWeek(
  point: GoogleOpeningPoint | undefined,
): number | null {
  if (!point || !isValidGoogleOpeningPoint(point)) {
    return null;
  }
  return point.day * 24 * 60 + point.hour * 60 + point.minute;
}

function isValidGoogleOpeningPoint(
  point: GoogleOpeningPoint,
): point is GoogleTargetOpenTime {
  return typeof point.day === "number" &&
    typeof point.hour === "number" &&
    typeof point.minute === "number" &&
    Number.isInteger(point.day) &&
    Number.isInteger(point.hour) &&
    Number.isInteger(point.minute) &&
    point.day >= 0 &&
    point.day <= 6 &&
    point.hour >= 0 &&
    point.hour <= 23 &&
    point.minute >= 0 &&
    point.minute <= 59;
}
