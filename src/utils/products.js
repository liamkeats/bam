const OPEN_FOOD_FACTS_FIELDS = [
  'code',
  'product_name',
  'brands',
  'serving_size',
  'serving_quantity',
  'quantity',
  'product_quantity',
  'nutriments',
  'image_front_small_url',
].join(',')

const SEARCH_FIELDS = OPEN_FOOD_FACTS_FIELDS

const nutrientSpecs = [
  { id: 'vitaminD', key: 'vitamin-d', label: 'Vitamin D' },
  { id: 'calcium', key: 'calcium', label: 'Calcium' },
  { id: 'iron', key: 'iron', label: 'Iron' },
  { id: 'potassium', key: 'potassium', label: 'Potassium' },
  { id: 'sodium', key: 'sodium', label: 'Sodium' },
  { id: 'omega3', key: 'omega-3-fat', label: 'Omega-3' },
  { id: 'epa', key: 'eicosapentaenoic-acid', label: 'EPA' },
  { id: 'dha', key: 'docosahexaenoic-acid', label: 'DHA' },
]

export const emptyNutrition = {
  caloriesPerServing: 0,
  proteinPerServing: 0,
  carbsPerServing: 0,
  fatPerServing: 0,
  fiberPerServing: 0,
  sugarPerServing: 0,
  nutrients: {},
}

function roundAmount(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function toNumber(value, fallback = 0) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return parsedValue
}

export function clampAmount(value, fallback = 0) {
  return roundAmount(Math.max(0, toNumber(value, fallback)))
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBarcode(value) {
  return cleanText(value).replace(/[^\d]/g, '')
}

export function normalizeUnit(value) {
  const unit = cleanText(value).toLowerCase()

  if (['grams', 'gram', 'g'].includes(unit)) {
    return 'g'
  }

  if (['milliliters', 'milliliter', 'ml'].includes(unit)) {
    return 'ml'
  }

  if (['micrograms', 'microgram', 'mcg', 'ug', 'µg'].includes(unit)) {
    return 'mcg'
  }

  if (['international units', 'international unit', 'iu'].includes(unit)) {
    return 'iu'
  }

  if (['servings', 'serving'].includes(unit)) {
    return 'serving'
  }

  if (['pills', 'pill', 'capsules', 'capsule', 'tablets', 'tablet'].includes(unit)) {
    return 'pill'
  }

  return unit
}

export function formatProductAmount(value) {
  const safeValue = clampAmount(value)

  if (Number.isInteger(safeValue)) {
    return `${safeValue}`
  }

  return safeValue.toFixed(2).replace(/\.?0+$/, '')
}

export function parseServingSize(servingSize = '') {
  const text = cleanText(servingSize).replace(',', '.')
  const fractionMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*([a-zA-Zµ]+)?/)

  if (fractionMatch) {
    const numerator = toNumber(fractionMatch[1])
    const denominator = toNumber(fractionMatch[2], 1)

    return {
      amount: denominator ? roundAmount(numerator / denominator) : 0,
      unit: cleanText(fractionMatch[3] ?? 'serving') || 'serving',
      text,
    }
  }

  const mixedMatch = text.match(/(\d+(?:\.\d+)?)\s*([a-zA-Zµ]+)?/)

  if (!mixedMatch) {
    return { amount: 1, unit: 'serving', text }
  }

  return {
    amount: clampAmount(mixedMatch[1], 1),
    unit: cleanText(mixedMatch[2] ?? 'serving') || 'serving',
    text,
  }
}

function canScaleFrom100g(unit) {
  return ['g', 'ml'].includes(normalizeUnit(unit))
}

function nutrimentPerServing(nutriments, key, servingAmount, servingUnit) {
  const servingValue = toNumber(nutriments?.[`${key}_serving`], null)

  if (Number.isFinite(servingValue)) {
    return roundAmount(servingValue)
  }

  const value100g = toNumber(nutriments?.[`${key}_100g`], null)

  if (
    Number.isFinite(value100g) &&
    servingAmount > 0 &&
    canScaleFrom100g(servingUnit)
  ) {
    return roundAmount((value100g * servingAmount) / 100)
  }

  const directValue = toNumber(nutriments?.[key], null)

  return Number.isFinite(directValue) ? roundAmount(directValue) : 0
}

function nutrientUnit(nutriments, key) {
  return cleanText(nutriments?.[`${key}_unit`]) || 'g'
}

function mapNutrients(nutriments, servingAmount, servingUnit) {
  return nutrientSpecs.reduce((mapped, spec) => {
    const amount = nutrimentPerServing(
      nutriments,
      spec.key,
      servingAmount,
      servingUnit,
    )

    if (!amount) {
      return mapped
    }

    const unit = nutrientUnit(nutriments, spec.key)

    if (spec.id === 'vitaminD' && normalizeUnit(unit) === 'mcg') {
      mapped[spec.id] = {
        label: spec.label,
        amount: roundAmount(amount * 40),
        unit: 'IU',
      }
      return mapped
    }

    mapped[spec.id] = {
      label: spec.label,
      amount,
      unit,
    }

    return mapped
  }, {})
}

function hasMacroData(product) {
  return Boolean(
    product.caloriesPerServing ||
      product.proteinPerServing ||
      product.carbsPerServing ||
      product.fatPerServing ||
      product.fiberPerServing ||
      product.sugarPerServing,
  )
}

export function sanitizeProduct(product = {}) {
  const barcode = normalizeBarcode(product.barcode)
  const source = product.source === 'open_food_facts' ? 'open_food_facts' : 'manual'
  const id =
    cleanText(product.id) ||
    (barcode ? `barcode-${barcode}` : `manual-${Date.now().toString(36)}`)
  const servingSize = clampAmount(product.servingSize, 1) || 1
  const servingUnit = cleanText(product.servingUnit) || 'serving'
  const nutrients = product.nutrients && typeof product.nutrients === 'object'
    ? Object.fromEntries(
        Object.entries(product.nutrients)
          .map(([key, nutrient]) => [
            key,
            {
              label: cleanText(nutrient?.label) || key,
              amount: clampAmount(nutrient?.amount),
              unit: cleanText(nutrient?.unit) || 'unit',
            },
          ])
          .filter(([, nutrient]) => nutrient.amount > 0),
      )
    : {}
  const nextProduct = {
    id,
    barcode,
    name: cleanText(product.name) || 'Unnamed product',
    brand: cleanText(product.brand),
    servingSize,
    servingUnit,
    servingText:
      cleanText(product.servingText) ||
      `${formatProductAmount(servingSize)} ${servingUnit}`,
    caloriesPerServing: clampAmount(product.caloriesPerServing),
    proteinPerServing: clampAmount(product.proteinPerServing),
    carbsPerServing: clampAmount(product.carbsPerServing),
    fatPerServing: clampAmount(product.fatPerServing),
    fiberPerServing: clampAmount(product.fiberPerServing),
    sugarPerServing: clampAmount(product.sugarPerServing),
    nutrients,
    imageUrl: cleanText(product.imageUrl),
    source,
    fetchedAt: product.fetchedAt ?? new Date().toISOString(),
  }

  return {
    ...nextProduct,
    missingNutrition: !hasMacroData(nextProduct) && Object.keys(nutrients).length === 0,
  }
}

export function mapOpenFoodFactsProduct(rawProduct = {}, barcode = '') {
  const parsedServing = parseServingSize(rawProduct.serving_size)
  const servingAmount = clampAmount(
    rawProduct.serving_quantity ?? parsedServing.amount,
    parsedServing.amount || 1,
  )
  const servingUnit = parsedServing.unit || 'serving'
  const nutriments = rawProduct.nutriments ?? {}
  const product = sanitizeProduct({
    id: `barcode-${normalizeBarcode(rawProduct.code ?? barcode)}`,
    barcode: rawProduct.code ?? barcode,
    name: rawProduct.product_name,
    brand: rawProduct.brands,
    servingSize: servingAmount || 1,
    servingUnit,
    servingText: rawProduct.serving_size,
    caloriesPerServing: nutrimentPerServing(
      nutriments,
      'energy-kcal',
      servingAmount,
      servingUnit,
    ),
    proteinPerServing: nutrimentPerServing(
      nutriments,
      'proteins',
      servingAmount,
      servingUnit,
    ),
    carbsPerServing: nutrimentPerServing(
      nutriments,
      'carbohydrates',
      servingAmount,
      servingUnit,
    ),
    fatPerServing: nutrimentPerServing(
      nutriments,
      'fat',
      servingAmount,
      servingUnit,
    ),
    fiberPerServing: nutrimentPerServing(
      nutriments,
      'fiber',
      servingAmount,
      servingUnit,
    ),
    sugarPerServing: nutrimentPerServing(
      nutriments,
      'sugars',
      servingAmount,
      servingUnit,
    ),
    nutrients: mapNutrients(nutriments, servingAmount, servingUnit),
    imageUrl: rawProduct.image_front_small_url,
    source: 'open_food_facts',
  })

  return product
}

export async function lookupOpenFoodFactsProduct(barcode) {
  const cleanBarcode = normalizeBarcode(barcode)

  if (!cleanBarcode) {
    throw new Error('Enter a valid barcode.')
  }

  const url = new URL(
    `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`,
  )
  url.searchParams.set('fields', OPEN_FOOD_FACTS_FIELDS)
  url.searchParams.set('app_name', 'Bam')
  url.searchParams.set('app_version', '1.1.0')

  let response

  try {
    response = await fetch(url)
  } catch {
    throw new Error('Could not reach Open Food Facts. Check your connection.')
  }

  if (!response.ok) {
    throw new Error('Product lookup failed. Try again or enter it manually.')
  }

  const payload = await response.json()

  if (payload.status !== 1 || !payload.product) {
    throw new Error('No product found for that barcode.')
  }

  return mapOpenFoodFactsProduct(payload.product, cleanBarcode)
}

export async function searchOpenFoodFactsProducts(searchTerm) {
  const cleanSearchTerm = cleanText(searchTerm)

  if (!cleanSearchTerm) {
    throw new Error('Enter a product name to search.')
  }

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', cleanSearchTerm)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '8')
  url.searchParams.set('fields', SEARCH_FIELDS)
  url.searchParams.set('app_name', 'Bam')
  url.searchParams.set('app_version', '1.1.0')

  let response

  try {
    response = await fetch(url)
  } catch {
    throw new Error('Search failed. Check your connection.')
  }

  if (!response.ok) {
    throw new Error('Search failed. Try again or enter the product manually.')
  }

  const payload = await response.json()
  const products = Array.isArray(payload.products) ? payload.products : []

  return products.map((product) => mapOpenFoodFactsProduct(product, product.code))
}

export function createManualProduct(item = {}) {
  const defaultNutrition = item.defaultNutrition ?? emptyNutrition
  const firstNutrient = Object.values(defaultNutrition.nutrients ?? {})[0]
  const servingSize = item.thresholdGroup === 'supplement' ? 1 : item.targetAmount ?? 1
  const servingUnit = item.thresholdGroup === 'supplement'
    ? item.unit ?? 'pill'
    : item.targetUnit ?? item.unit ?? 'serving'

  return sanitizeProduct({
    id: `manual-${Date.now().toString(36)}`,
    name: item.name ? `${item.name} product` : 'Manual product',
    servingSize,
    servingUnit,
    caloriesPerServing: defaultNutrition.caloriesPerServing,
    proteinPerServing: defaultNutrition.proteinPerServing,
    carbsPerServing: defaultNutrition.carbsPerServing,
    fatPerServing: defaultNutrition.fatPerServing,
    fiberPerServing: defaultNutrition.fiberPerServing,
    sugarPerServing: defaultNutrition.sugarPerServing,
    nutrients: firstNutrient
      ? {
          manualNutrient: firstNutrient,
        }
      : {},
    source: 'manual',
  })
}

export function normalizeProducts(products = {}) {
  if (!products || typeof products !== 'object') {
    return {}
  }

  const entries = Array.isArray(products)
    ? products.map((product) => [product.id, product])
    : Object.entries(products)

  return entries.reduce((nextProducts, [id, product]) => {
    const normalizedProduct = sanitizeProduct({ ...product, id: product?.id ?? id })
    nextProducts[normalizedProduct.id] = normalizedProduct
    return nextProducts
  }, {})
}

export function normalizeProductLinks(links = {}) {
  if (!links || typeof links !== 'object') {
    return {}
  }

  return Object.entries(links).reduce((nextLinks, [itemId, link]) => {
    if (!link || typeof link !== 'object' || !link.productId) {
      return nextLinks
    }

    nextLinks[itemId] = {
      mealItemId: link.mealItemId ?? itemId,
      productId: link.productId,
      targetAmount: clampAmount(link.targetAmount, 1) || 1,
      targetUnit: cleanText(link.targetUnit) || 'serving',
      productAmountPerServing:
        clampAmount(link.productAmountPerServing, 1) || 1,
      productUnit: cleanText(link.productUnit) || 'serving',
      servingsNeeded: clampAmount(link.servingsNeeded, 1) || 1,
      updatedAt: link.updatedAt ?? new Date().toISOString(),
    }

    return nextLinks
  }, {})
}

export function normalizeProductInventory(productInventory = {}) {
  if (!productInventory || typeof productInventory !== 'object') {
    return {}
  }

  return Object.entries(productInventory).reduce((nextInventory, [productId, item]) => {
    if (!item || typeof item !== 'object') {
      return nextInventory
    }

    nextInventory[productId] = {
      productId: item.productId ?? productId,
      quantity: clampAmount(item.quantity),
      status: ['have', 'low', 'out', 'need'].includes(item.status)
        ? item.status
        : 'need',
      linkedMealItemIds: Array.isArray(item.linkedMealItemIds)
        ? [...new Set(item.linkedMealItemIds.filter(Boolean))]
        : [],
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    }

    return nextInventory
  }, {})
}

export function convertAmount(amount, fromUnit, toUnit) {
  const safeAmount = toNumber(amount, null)
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)

  if (!Number.isFinite(safeAmount)) {
    return null
  }

  if (!from || !to || from === to) {
    return safeAmount
  }

  if (from === 'mcg' && to === 'iu') {
    return safeAmount * 40
  }

  if (from === 'iu' && to === 'mcg') {
    return safeAmount / 40
  }

  return null
}

function findMatchingNutrient(product, targetUnit) {
  const target = normalizeUnit(targetUnit)

  return Object.values(product?.nutrients ?? {}).find((nutrient) => {
    const directMatch = normalizeUnit(nutrient.unit) === target
    const convertedMatch = convertAmount(1, nutrient.unit, target) !== null

    return directMatch || convertedMatch
  })
}

export function inferProductAmountForTarget(item, product, targetUnit) {
  const nutrient = findMatchingNutrient(product, targetUnit)

  if (nutrient) {
    const convertedAmount = convertAmount(nutrient.amount, nutrient.unit, targetUnit)
    return clampAmount(convertedAmount ?? nutrient.amount, 1) || 1
  }

  const servingSize = clampAmount(product?.servingSize, 1)

  if (servingSize > 0) {
    return servingSize
  }

  return item.thresholdGroup === 'supplement' ? 1 : item.targetAmount ?? 1
}

export function inferProductUnitForTarget(item, product, targetUnit) {
  const nutrient = findMatchingNutrient(product, targetUnit)

  if (nutrient) {
    return targetUnit
  }

  return product?.servingUnit ?? item.targetUnit ?? item.unit ?? 'serving'
}

export function calculateServingsNeeded({
  targetAmount,
  targetUnit,
  productAmountPerServing,
  productUnit,
}) {
  const safeTarget = clampAmount(targetAmount)
  const safeProductAmount = clampAmount(productAmountPerServing)
  const convertedTarget = convertAmount(safeTarget, targetUnit, productUnit)

  if (safeTarget <= 0 || safeProductAmount <= 0) {
    return 1
  }

  if (Number.isFinite(convertedTarget)) {
    return Math.max(0.01, roundAmount(convertedTarget / safeProductAmount))
  }

  return 1
}

export function createProductLink(item, product, overrides = {}) {
  const targetAmount = clampAmount(
    overrides.targetAmount ?? item.targetAmount ?? item.amountPerUse ?? 1,
    1,
  ) || 1
  const targetUnit =
    cleanText(overrides.targetUnit) || item.targetUnit || item.unit || 'serving'
  const productAmountPerServing =
    clampAmount(
      overrides.productAmountPerServing ??
        inferProductAmountForTarget(item, product, targetUnit),
      1,
    ) || 1
  const productUnit =
    cleanText(overrides.productUnit) ||
    inferProductUnitForTarget(item, product, targetUnit)
  const servingsNeeded = calculateServingsNeeded({
    targetAmount,
    targetUnit,
    productAmountPerServing,
    productUnit,
  })

  return {
    mealItemId: item.id,
    productId: product.id,
    targetAmount,
    targetUnit,
    productAmountPerServing,
    productUnit,
    servingsNeeded,
    updatedAt: new Date().toISOString(),
  }
}

export function deriveLinkedInventoryAmount(item, link) {
  if (!link || !item.amountPerUse) {
    return clampAmount(item.restockAmount)
  }

  return clampAmount((item.restockAmount / item.amountPerUse) * link.servingsNeeded)
}

export function applyProductLinkToMealItem(item, link, product) {
  const targetAmount = item.targetAmount ?? item.amountPerUse ?? 1
  const targetUnit = item.targetUnit ?? item.unit ?? 'serving'

  if (!link || !product) {
    return {
      ...item,
      targetAmount,
      targetUnit,
      linkedProductId: null,
      servingsNeeded: 1,
    }
  }

  const inventoryAmount = deriveLinkedInventoryAmount(item, link)
  const servingUnit = product.servingUnit || item.unit || 'serving'

  return {
    ...item,
    targetAmount: link.targetAmount,
    targetUnit: link.targetUnit,
    linkedProductId: product.id,
    linkedProductName: getProductDisplayName(product),
    productAmountPerServing: link.productAmountPerServing,
    productUnit: link.productUnit,
    servingsNeeded: link.servingsNeeded,
    amountPerUse: link.servingsNeeded,
    unit: servingUnit,
    restockAmount: inventoryAmount,
    startingAmount: inventoryAmount,
  }
}

export function getProductDisplayName(product) {
  if (!product) {
    return 'No linked product'
  }

  return [product.brand, product.name].filter(Boolean).join(' ')
}

export function formatProductLinkSummary(link, product) {
  if (!link || !product) {
    return 'No linked product'
  }

  const servingUnit = product.servingUnit || 'serving'

  return `${formatProductAmount(link.servingsNeeded)} ${servingUnit}/day from ${getProductDisplayName(product)}`
}

export function upsertLinkedProductInventory({
  productInventory,
  product,
  mealItemId,
  quantity,
  status,
}) {
  const existing = productInventory[product.id] ?? {}
  const linkedMealItemIds = [
    ...new Set([...(existing.linkedMealItemIds ?? []), mealItemId]),
  ]

  return {
    ...productInventory,
    [product.id]: {
      productId: product.id,
      quantity: clampAmount(quantity),
      status,
      linkedMealItemIds,
      updatedAt: new Date().toISOString(),
    },
  }
}
