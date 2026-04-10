const LIVE_CLASS_TIMEZONE_OFFSET_MINUTES = 330

const DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?/

const pad = (value) => String(value).padStart(2, '0')

const buildPartsFromDate = (date, useUtc = true) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null

  return {
    year: useUtc ? date.getUTCFullYear() : date.getFullYear(),
    month: (useUtc ? date.getUTCMonth() : date.getMonth()) + 1,
    day: useUtc ? date.getUTCDate() : date.getDate(),
    hour: useUtc ? date.getUTCHours() : date.getHours(),
    minute: useUtc ? date.getUTCMinutes() : date.getMinutes(),
    second: useUtc ? date.getUTCSeconds() : date.getSeconds(),
  }
}

export function extractLiveClassDateTimeParts(
  value,
  { useUtcForDateObjects = true } = {}
) {
  if (!value) return null

  if (value instanceof Date) {
    return buildPartsFromDate(value, useUtcForDateObjects)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    const match = trimmed.match(DATE_TIME_REGEX)

    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
        hour: Number(match[4] || 0),
        minute: Number(match[5] || 0),
        second: Number(match[6] || 0),
      }
    }

    const fallbackDate = new Date(trimmed)
    return buildPartsFromDate(fallbackDate, useUtcForDateObjects)
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'year' in value &&
    'month' in value &&
    'day' in value
  ) {
    return {
      year: Number(value.year),
      month: Number(value.month),
      day: Number(value.day),
      hour: Number(value.hour || 0),
      minute: Number(value.minute || 0),
      second: Number(value.second || 0),
    }
  }

  const fallbackDate = new Date(value)
  return buildPartsFromDate(fallbackDate, useUtcForDateObjects)
}

export function createLiveClassDate(value) {
  const parts = extractLiveClassDateTimeParts(value)
  if (!parts) return null

  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
}

export function formatLiveClassDateTimeForDb(value) {
  const parts = extractLiveClassDateTimeParts(value)
  if (!parts) return null

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(
    parts.hour
  )}:${pad(parts.minute)}:${pad(parts.second)}`
}

export function formatLiveClassDateTimeForApi(value) {
  const parts = extractLiveClassDateTimeParts(value)
  if (!parts) return null

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(
    parts.hour
  )}:${pad(parts.minute)}:${pad(parts.second)}`
}

export function formatLiveClassDateTimeForInput(value) {
  const parts = extractLiveClassDateTimeParts(value)
  if (!parts) return ''

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(
    parts.hour
  )}:${pad(parts.minute)}`
}

export function formatLiveClassDateTimeForDisplay(
  value,
  { locale = 'en-IN', includeSeconds = true } = {}
) {
  const date = createLiveClassDate(value)
  if (!date) return 'Not set'

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(date)
}

export function getLiveClassDateKey(value) {
  const parts = extractLiveClassDateTimeParts(value)
  if (!parts) return null

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function getLiveClassDateTimeComparable(value) {
  const parts = extractLiveClassDateTimeParts(value)
  if (!parts) return null

  return Number(
    `${parts.year}${pad(parts.month)}${pad(parts.day)}${pad(parts.hour)}${pad(
      parts.minute
    )}${pad(parts.second)}`
  )
}

export function getCurrentLiveClassDateTimeComparable() {
  const shiftedNow = new Date(
    Date.now() + LIVE_CLASS_TIMEZONE_OFFSET_MINUTES * 60 * 1000
  )
  return getLiveClassDateTimeComparable(buildPartsFromDate(shiftedNow, true))
}

export function calculateLiveClassStatus(startTime, endTime) {
  if (!startTime) return 'upcoming'

  const nowComparable = getCurrentLiveClassDateTimeComparable()
  const startComparable = getLiveClassDateTimeComparable(startTime)
  const endComparable = endTime
    ? getLiveClassDateTimeComparable(endTime)
    : null

  if (!startComparable) return 'upcoming'
  if (nowComparable < startComparable) return 'upcoming'
  if (endComparable && nowComparable > endComparable) return 'completed'
  if (!endComparable || nowComparable <= endComparable) return 'live'

  return 'upcoming'
}

export function normalizeLiveClassRecord(record) {
  if (!record) return record

  return {
    ...record,
    start_time: formatLiveClassDateTimeForApi(record.start_time),
    end_time: record.end_time
      ? formatLiveClassDateTimeForApi(record.end_time)
      : null,
  }
}

export function normalizeLiveClassRecords(records = []) {
  return records.map(normalizeLiveClassRecord)
}
