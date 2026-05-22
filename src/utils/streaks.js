export function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(dateKey, amount) {
  const date = dateFromKey(dateKey)
  date.setDate(date.getDate() + amount)
  return getDateKey(date)
}

export function formatDateLabel(dateKey) {
  return dateFromKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatLongDate(dateKey) {
  return dateFromKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function sortDays(days) {
  return [...days].sort((a, b) => a.date.localeCompare(b.date))
}

function countCheckedItems(day) {
  return Object.keys(day.checkedItems ?? {}).length
}

function getWeekStart(dateKey) {
  const date = dateFromKey(dateKey)
  const dayOfWeek = date.getDay()
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  date.setDate(date.getDate() + offset)
  return getDateKey(date)
}

function getWeekRange(dateKey) {
  const start = getWeekStart(dateKey)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function getWeekStats(days, dateKey = getDateKey()) {
  const weekKeys = new Set(getWeekRange(dateKey))
  const weekDays = sortDays(days).filter((day) => weekKeys.has(day.date))
  const counts = {
    complete: 0,
    flex: 0,
    missed: 0,
    partial: 0,
  }

  weekDays.forEach((day) => {
    if (counts[day.status] !== undefined) {
      counts[day.status] += 1
    }
  })

  return {
    weekDays,
    counts,
    strongDaysLabel: `${counts.complete}/7 strong days`,
  }
}

export function calculateCurrentStreak(days) {
  const sortedDays = sortDays(days).filter((day) => day.status)
  let streak = 0

  for (let index = sortedDays.length - 1; index >= 0; index -= 1) {
    const day = sortedDays[index]

    if (day.status === 'complete') {
      streak += 1
      continue
    }

    if (day.status === 'flex') {
      continue
    }

    if (day.status === 'missed' || day.status === 'partial') {
      break
    }
  }

  return streak
}

export function calculateBestStreak(days) {
  const sortedDays = sortDays(days).filter((day) => day.status)
  let best = 0
  let current = 0

  sortedDays.forEach((day) => {
    if (day.status === 'complete') {
      current += 1
      best = Math.max(best, current)
      return
    }

    if (day.status === 'flex') {
      return
    }

    current = 0
  })

  return best
}

export function getLastNDays(days, count = 14, endDateKey = getDateKey()) {
  const lookup = Object.fromEntries(days.map((day) => [day.date, day]))
  const history = []

  for (let index = count - 1; index >= 0; index -= 1) {
    const dateKey = addDays(endDateKey, -index)
    history.push({
      date: dateKey,
      entry: lookup[dateKey] ?? null,
    })
  }

  return history
}

export function calculateAllTimeStats(days, totalItems) {
  const sortedDays = sortDays(days).filter((day) => day.date)
  const counts = {
    complete: 0,
    flex: 0,
    missed: 0,
    partial: 0,
  }
  let totalCheckedItems = 0
  let longestMissedStreak = 0
  let currentMissedStreak = 0

  sortedDays.forEach((day) => {
    if (counts[day.status] !== undefined) {
      counts[day.status] += 1
    }

    totalCheckedItems += countCheckedItems(day)

    if (day.status === 'missed') {
      currentMissedStreak += 1
      longestMissedStreak = Math.max(longestMissedStreak, currentMissedStreak)
      return
    }

    currentMissedStreak = 0
  })

  const totalTrackedDays = sortedDays.length
  const completionRate = totalTrackedDays
    ? Math.round((totalCheckedItems / (totalTrackedDays * totalItems)) * 100)
    : 0
  const strongDayRate = totalTrackedDays
    ? Math.round((counts.complete / totalTrackedDays) * 100)
    : 0
  const flexUsageRate = totalTrackedDays
    ? Math.round((counts.flex / totalTrackedDays) * 100)
    : 0

  return {
    counts,
    totalCheckedItems,
    totalTrackedDays,
    completionRate,
    strongDayRate,
    flexUsageRate,
    longestMissedStreak,
    bestStreak: calculateBestStreak(sortedDays),
    currentStreak: calculateCurrentStreak(sortedDays),
  }
}
