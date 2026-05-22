const STORAGE_KEYS = {
  dayHistory: 'bam-day-history',
  inventory: 'bam-inventory',
  shoppingChecks: 'bam-shopping-checks',
  settings: 'bam-settings',
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readJSON(key, fallback) {
  if (!canUseStorage()) {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(key)

    if (!rawValue) {
      return fallback
    }

    return JSON.parse(rawValue)
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function removeKey(key) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(key)
}

export function loadDayHistory() {
  return readJSON(STORAGE_KEYS.dayHistory, [])
}

export function saveDayHistory(dayHistory) {
  writeJSON(STORAGE_KEYS.dayHistory, dayHistory)
}

export function loadInventory() {
  return readJSON(STORAGE_KEYS.inventory, {})
}

export function saveInventory(inventory) {
  writeJSON(STORAGE_KEYS.inventory, inventory)
}

export function loadShoppingChecks() {
  return readJSON(STORAGE_KEYS.shoppingChecks, {})
}

export function saveShoppingChecks(shoppingChecks) {
  writeJSON(STORAGE_KEYS.shoppingChecks, shoppingChecks)
}

export function loadSettings() {
  return readJSON(STORAGE_KEYS.settings, {})
}

export function saveSettings(settings) {
  writeJSON(STORAGE_KEYS.settings, settings)
}

export function createBackupPayload(dayHistory, inventory, shoppingChecks, settings) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    dayHistory,
    inventory,
    shoppingChecks,
    settings,
  }
}

export function parseBackupPayload(text) {
  let parsed

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That backup file is not valid JSON.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('That backup file is not valid.')
  }

  return {
    dayHistory: Array.isArray(parsed.dayHistory) ? parsed.dayHistory : [],
    inventory:
      parsed.inventory && typeof parsed.inventory === 'object'
        ? parsed.inventory
        : {},
    shoppingChecks:
      parsed.shoppingChecks && typeof parsed.shoppingChecks === 'object'
        ? parsed.shoppingChecks
        : {},
    settings:
      parsed.settings && typeof parsed.settings === 'object'
        ? parsed.settings
        : {},
  }
}

export function resetStoredInventory() {
  removeKey(STORAGE_KEYS.inventory)
  removeKey(STORAGE_KEYS.shoppingChecks)
}

export function resetStoredHistory() {
  removeKey(STORAGE_KEYS.dayHistory)
}

export function resetAllStoredData() {
  Object.values(STORAGE_KEYS).forEach(removeKey)
}
