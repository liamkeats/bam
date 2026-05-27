function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function clampAmount(value, fallback = 0) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return Math.max(0, parsedValue)
}

function sanitizeNutrition(nutrition = {}) {
  return {
    caloriesPerServing: clampAmount(nutrition.caloriesPerServing),
    proteinPerServing: clampAmount(nutrition.proteinPerServing),
    carbsPerServing: clampAmount(nutrition.carbsPerServing),
    fatPerServing: clampAmount(nutrition.fatPerServing),
    fiberPerServing: clampAmount(nutrition.fiberPerServing),
    sugarPerServing: clampAmount(nutrition.sugarPerServing),
    nutrients:
      nutrition.nutrients && typeof nutrition.nutrients === 'object'
        ? nutrition.nutrients
        : {},
  }
}

export function createMealItemOverride(item, formValues = {}) {
  const amountPerUse = clampAmount(
    formValues.amountPerUse ?? formValues.targetAmount ?? item.amountPerUse,
    item.amountPerUse,
  )
  const unit = cleanText(formValues.unit ?? formValues.targetUnit ?? item.unit)

  return {
    name: cleanText(formValues.name) || item.name,
    displayAmount: cleanText(formValues.displayAmount) || item.displayAmount,
    targetAmount:
      clampAmount(formValues.targetAmount, item.targetAmount ?? amountPerUse) ||
      item.targetAmount ||
      amountPerUse,
    targetUnit: cleanText(formValues.targetUnit) || item.targetUnit || unit,
    amountPerUse: amountPerUse || item.amountPerUse,
    unit: unit || item.unit,
    startingAmount: clampAmount(
      formValues.startingAmount,
      item.startingAmount ?? item.restockAmount ?? 0,
    ),
    restockAmount: clampAmount(
      formValues.restockAmount,
      item.restockAmount ?? item.startingAmount ?? 0,
    ),
    trackInventory: Boolean(formValues.trackInventory),
    defaultNutrition: sanitizeNutrition(formValues.defaultNutrition),
  }
}

export function applyMealItemOverrides(items, overrides = {}) {
  return items.map((item) => {
    const override = overrides[item.id]

    if (!override) {
      return item
    }

    return {
      ...item,
      ...override,
      id: item.id,
      meal: item.meal,
      thresholdGroup: item.thresholdGroup,
      lowThresholdDays: item.lowThresholdDays,
      urgentThresholdDays: item.urgentThresholdDays,
      defaultNutrition: {
        ...(item.defaultNutrition ?? {}),
        ...(override.defaultNutrition ?? {}),
        nutrients:
          override.defaultNutrition?.nutrients ??
          item.defaultNutrition?.nutrients ??
          {},
      },
    }
  })
}

export function normalizeMealItemOverrides(overrides = {}, baseItems = []) {
  if (!overrides || typeof overrides !== 'object') {
    return {}
  }

  const baseItemMap = Object.fromEntries(baseItems.map((item) => [item.id, item]))

  return Object.entries(overrides).reduce((nextOverrides, [itemId, override]) => {
    const item = baseItemMap[itemId]

    if (!item || !override || typeof override !== 'object') {
      return nextOverrides
    }

    nextOverrides[itemId] = createMealItemOverride(item, {
      ...override,
      trackInventory: override.trackInventory ?? item.trackInventory !== false,
      defaultNutrition: {
        ...(item.defaultNutrition ?? {}),
        ...(override.defaultNutrition ?? {}),
      },
    })

    return nextOverrides
  }, {})
}

