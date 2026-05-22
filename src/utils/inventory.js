function roundAmount(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function clampAmount(value) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return 0
  }

  return roundAmount(Math.max(0, parsedValue))
}

function clampWholeNumber(value, fallback) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return Math.max(0, parsedValue)
}

export function formatAmount(value) {
  const safeValue = clampAmount(value)

  if (Number.isInteger(safeValue)) {
    return `${safeValue}`
  }

  return safeValue.toFixed(2).replace(/\.?0+$/, '')
}

function pluralizeUnit(unit, amount) {
  if (amount === 1) {
    return unit
  }

  if (unit === 'cup cooked') {
    return 'cups cooked'
  }

  if (unit === 'g' || unit === 'ml' || unit === 'tbsp') {
    return unit
  }

  if (unit.endsWith('s')) {
    return unit
  }

  if (unit.endsWith('o')) {
    return `${unit}es`
  }

  if (unit.endsWith('y')) {
    const beforeY = unit.at(-2) ?? ''

    if (!'aeiou'.includes(beforeY.toLowerCase())) {
      return `${unit.slice(0, -1)}ies`
    }
  }

  return `${unit}s`
}

export function formatInventoryLeft(item, currentAmount) {
  const safeAmount = clampAmount(currentAmount)
  const unitLabel = pluralizeUnit(item.unit, safeAmount)

  return `${formatAmount(safeAmount)} ${unitLabel} left`
}

export function createEmptyInventory(items) {
  return items.reduce((inventory, item) => {
    if (item.trackInventory === false) {
      return inventory
    }

    inventory[item.id] = 0
    return inventory
  }, {})
}

export function createFilledInventory(items) {
  return items.reduce((inventory, item) => {
    if (item.trackInventory === false) {
      return inventory
    }

    inventory[item.id] = clampAmount(item.startingAmount)
    return inventory
  }, {})
}

export function mergeInventory(items, savedInventory = {}, options = {}) {
  const { startFilled = false } = options

  return items.reduce((inventory, item) => {
    if (item.trackInventory === false) {
      return inventory
    }

    inventory[item.id] = clampAmount(
      savedInventory[item.id] ?? (startFilled ? item.startingAmount : 0),
    )
    return inventory
  }, {})
}

export function adjustInventoryAmount(inventory, itemId, delta) {
  const currentAmount = clampAmount(inventory[itemId] ?? 0)

  return {
    ...inventory,
    [itemId]: clampAmount(currentAmount + delta),
  }
}

export function setInventoryAmount(inventory, itemId, nextAmount) {
  return {
    ...inventory,
    [itemId]: clampAmount(nextAmount),
  }
}

export function getInventoryAmount(inventory, itemId) {
  return clampAmount(inventory[itemId] ?? 0)
}

function getDaysLeft(currentAmount, amountPerUse) {
  if (!amountPerUse) {
    return 0
  }

  return roundAmount(currentAmount / amountPerUse)
}

function getThresholdsForItem(item, settings = {}) {
  const isSupplement = item.thresholdGroup === 'supplement'
  const defaultLow = isSupplement
    ? item.lowThresholdDays
    : item.lowThresholdDays
  const defaultUrgent = isSupplement
    ? item.urgentThresholdDays
    : item.urgentThresholdDays

  return {
    lowThresholdDays: clampWholeNumber(
      isSupplement
        ? settings.supplementLowThresholdDays
        : settings.lowThresholdDays,
      defaultLow,
    ),
    urgentThresholdDays: clampWholeNumber(
      isSupplement
        ? settings.supplementUrgentThresholdDays
        : settings.urgentThresholdDays,
      defaultUrgent,
    ),
  }
}

function getStatus(item, currentAmount, settings) {
  const daysLeft = getDaysLeft(currentAmount, item.amountPerUse)
  const thresholds = getThresholdsForItem(item, settings)

  if (daysLeft < thresholds.urgentThresholdDays) {
    return 'urgent'
  }

  if (daysLeft < thresholds.lowThresholdDays) {
    return 'soon'
  }

  return 'good'
}

export function buildShoppingItems(
  items,
  inventory,
  shoppingChecks = {},
  settings = {},
) {
  const order = { urgent: 0, soon: 1, good: 2 }

  return items
    .filter((item) => item.trackInventory !== false)
    .map((item) => {
      const currentAmount = clampAmount(inventory[item.id] ?? 0)
      const daysLeft = getDaysLeft(currentAmount, item.amountPerUse)
      const status = getStatus(item, currentAmount, settings)
      const thresholds = getThresholdsForItem(item, settings)

      return {
        ...item,
        currentAmount,
        daysLeft,
        status,
        thresholds,
        checked: Boolean(shoppingChecks[item.id]),
      }
    })
    .sort((left, right) => {
      const statusGap = order[left.status] - order[right.status]

      if (statusGap !== 0) {
        return statusGap
      }

      if (left.daysLeft !== right.daysLeft) {
        return left.daysLeft - right.daysLeft
      }

      return left.name.localeCompare(right.name)
    })
}

export function groupShoppingItems(items) {
  return items.reduce(
    (groups, item) => {
      groups[item.status].push(item)
      return groups
    },
    { urgent: [], soon: [], good: [] },
  )
}
