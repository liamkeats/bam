import {
  emptyNutrition,
  formatProductAmount,
  getProductDisplayName,
} from './products'

const macroFields = [
  'caloriesPerServing',
  'proteinPerServing',
  'carbsPerServing',
  'fatPerServing',
  'fiberPerServing',
  'sugarPerServing',
]

function roundAmount(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

function toNumber(value, fallback = 0) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return parsedValue
}

function addNutrient(totalNutrients, nutrient, multiplier = 1) {
  if (!nutrient?.amount || !nutrient.label) {
    return totalNutrients
  }

  const key = `${nutrient.label.toLowerCase()}-${nutrient.unit.toLowerCase()}`
  const existing = totalNutrients[key] ?? {
    label: nutrient.label,
    unit: nutrient.unit,
    amount: 0,
  }

  return {
    ...totalNutrients,
    [key]: {
      ...existing,
      amount: roundAmount(existing.amount + nutrient.amount * multiplier),
    },
  }
}

function getBaseNutrition(item, product) {
  if (product) {
    return {
      caloriesPerServing: product.caloriesPerServing,
      proteinPerServing: product.proteinPerServing,
      carbsPerServing: product.carbsPerServing,
      fatPerServing: product.fatPerServing,
      fiberPerServing: product.fiberPerServing,
      sugarPerServing: product.sugarPerServing,
      nutrients: product.nutrients ?? {},
      sourceLabel: getProductDisplayName(product),
      sourceType: product.source,
    }
  }

  return {
    ...emptyNutrition,
    ...(item.defaultNutrition ?? {}),
    nutrients: item.defaultNutrition?.nutrients ?? {},
    sourceLabel: item.defaultNutrition ? 'Plan estimate' : 'Manual needed',
    sourceType: item.defaultNutrition ? 'estimate' : 'missing',
  }
}

export function getDefaultServingsForItem(item) {
  return item.linkedProductId ? item.servingsNeeded ?? 1 : 1
}

export function getEatenServings(dayRecord, item) {
  const savedServings = toNumber(dayRecord?.eatenServings?.[item.id], null)

  if (Number.isFinite(savedServings) && savedServings >= 0) {
    return savedServings
  }

  return getDefaultServingsForItem(item)
}

export function calculateNutritionForMealItem({
  dayRecord,
  item,
  product,
  link,
}) {
  const checked = Boolean(dayRecord?.checkedItems?.[item.id])
  const baseNutrition = getBaseNutrition(item, product)
  const servingsEaten = checked ? getEatenServings(dayRecord, item) : 0
  const totals = macroFields.reduce((nextTotals, field) => {
    nextTotals[field.replace('PerServing', '')] = roundAmount(
      toNumber(baseNutrition[field]) * servingsEaten,
    )

    return nextTotals
  }, {})
  const nutrients = Object.values(baseNutrition.nutrients ?? {}).reduce(
    (nextNutrients, nutrient) =>
      addNutrient(nextNutrients, nutrient, servingsEaten),
    {},
  )

  return {
    itemId: item.id,
    itemName: item.name,
    displayAmount: item.displayAmount,
    checked,
    servingsEaten,
    servingUnit: product?.servingUnit ?? item.unit,
    servingsNeeded: link?.servingsNeeded ?? 1,
    productName: product ? getProductDisplayName(product) : '',
    sourceLabel: baseNutrition.sourceLabel,
    sourceType: baseNutrition.sourceType,
    totals,
    nutrients,
  }
}

export function calculateDailyNutritionLog({
  date,
  mealSections,
  mealItems,
  products,
  productLinks,
  dayRecord,
}) {
  const emptyTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
  }
  const meals = mealSections.map((section) => {
    const sectionItems = mealItems
      .filter((item) => item.meal === section.id)
      .map((item) => {
        const link = productLinks[item.id]
        const product = link ? products[link.productId] : null

        return calculateNutritionForMealItem({
          dayRecord,
          item,
          product,
          link,
        })
      })
    const totals = sectionItems.reduce((nextTotals, entry) => {
      Object.entries(entry.totals).forEach(([key, value]) => {
        nextTotals[key] = roundAmount((nextTotals[key] ?? 0) + value)
      })

      return nextTotals
    }, { ...emptyTotals })
    const nutrients = sectionItems.reduce((nextNutrients, entry) => {
      Object.values(entry.nutrients).forEach((nutrient) => {
        Object.assign(nextNutrients, addNutrient(nextNutrients, nutrient, 1))
      })

      return nextNutrients
    }, {})

    return {
      id: section.id,
      title: section.title,
      label: section.label,
      items: sectionItems,
      totals,
      nutrients,
    }
  })
  const totalNutrition = meals.reduce((nextTotals, meal) => {
    Object.entries(meal.totals).forEach(([key, value]) => {
      nextTotals[key] = roundAmount((nextTotals[key] ?? 0) + value)
    })

    return nextTotals
  }, { ...emptyTotals })
  const nutrients = meals.reduce((nextNutrients, meal) => {
    Object.values(meal.nutrients).forEach((nutrient) => {
      Object.assign(nextNutrients, addNutrient(nextNutrients, nutrient, 1))
    })

    return nextNutrients
  }, {})

  return {
    date,
    meals,
    totalCalories: totalNutrition.calories,
    totalProtein: totalNutrition.protein,
    totalCarbs: totalNutrition.carbs,
    totalFat: totalNutrition.fat,
    totalFiber: totalNutrition.fiber,
    totalSugar: totalNutrition.sugar,
    nutrients,
  }
}

export function calculatePlannedNutritionLog({
  mealSections,
  mealItems,
  products,
  productLinks,
}) {
  const checkedItems = mealItems.reduce((items, item) => {
    items[item.id] = true
    return items
  }, {})
  const eatenServings = mealItems.reduce((servings, item) => {
    servings[item.id] = getDefaultServingsForItem(item)
    return servings
  }, {})

  return calculateDailyNutritionLog({
    date: 'planned',
    mealSections,
    mealItems,
    products,
    productLinks,
    dayRecord: {
      checkedItems,
      eatenServings,
    },
  })
}

export function formatMacro(value, suffix = 'g') {
  return `${formatProductAmount(value)}${suffix}`
}

export function formatServings(value, unit = 'serving') {
  return `${formatProductAmount(value)} ${unit}`
}
