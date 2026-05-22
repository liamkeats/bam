import { useEffect, useRef, useState } from 'react'
import './App.css'
import ProgressRing from './components/ProgressRing'
import Toast from './components/Toast'
import StatCard from './components/StatCard'
import TabButton from './components/TabButton'
import ToggleSwitch from './components/ToggleSwitch'
import MealCard from './components/MealCard'
import InventoryCard from './components/InventoryCard'
import { mealItems, mealSections } from './data/mealPlan'
import {
  createBackupPayload,
  loadDayHistory,
  loadInventory,
  loadSettings,
  loadShoppingChecks,
  parseBackupPayload,
  resetAllStoredData,
  resetStoredHistory,
  resetStoredInventory,
  saveDayHistory,
  saveInventory,
  saveSettings,
  saveShoppingChecks,
} from './utils/storage'
import {
  adjustInventoryAmount,
  buildShoppingItems,
  createEmptyInventory,
  createFilledInventory,
  formatAmount,
  formatInventoryLeft,
  getInventoryAmount,
  groupShoppingItems,
  mergeInventory,
  setInventoryAmount,
} from './utils/inventory'
import {
  calculateAllTimeStats,
  calculateBestStreak,
  calculateCurrentStreak,
  formatDateLabel,
  formatLongDate,
  getDateKey,
  getLastNDays,
  getWeekStats,
} from './utils/streaks'
import {
  accentOptions,
  defaultSettings,
  flexDayOptions,
  getSystemTheme,
  resolveTheme,
  sanitizeSettings,
  themeOptions,
} from './utils/settings'

const APP_VERSION = '1.0.0'

const tabs = [
  { id: 'today', label: 'Today' },
  { id: 'meals', label: 'Meals' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
]

const shoppingFilters = [
  { id: 'all', label: 'All' },
  { id: 'need', label: 'Need to buy' },
  { id: 'urgent', label: 'Out / urgent' },
  { id: 'soon', label: 'Buy soon' },
  { id: 'good', label: 'Good' },
]

const shoppingFilterEmptyStates = {
  all: {
    title: 'No tracked shopping items',
    body: 'Inventory-tracked meal items will appear here.',
  },
  need: {
    title: 'Nothing needs buying',
    body: 'Out, urgent, and low-stock items will appear here.',
  },
  urgent: {
    title: 'No out / urgent items',
    body: 'Items below their urgent threshold will appear here.',
  },
  soon: {
    title: 'No buy-soon items',
    body: 'Low-stock items that are not urgent will appear here.',
  },
  good: {
    title: 'No good-stock items yet',
    body: 'Items with enough stock will appear here once inventory is updated.',
  },
}

const statusLabels = {
  complete: 'Complete',
  flex: 'Flex',
  missed: 'Missed',
  partial: 'Partial',
  open: 'Open',
}

const accentClassNames = {
  green: 'accent-green',
  blue: 'accent-blue',
  orange: 'accent-orange',
  purple: 'accent-purple',
}

const themeColors = {
  dark: '#071014',
  light: '#eef3f8',
}

function cleanFlags(flags = {}) {
  return Object.fromEntries(
    Object.entries(flags).filter(([, value]) => Boolean(value)),
  )
}

function countFlags(flags = {}) {
  return Object.keys(cleanFlags(flags)).length
}

function matchesShoppingFilter(filterId, item) {
  if (filterId === 'all') {
    return true
  }

  if (filterId === 'need') {
    return item.status === 'urgent' || item.status === 'soon'
  }

  return item.status === filterId
}

function cleanAmounts(amounts = {}, consumedItems = {}) {
  return Object.keys(consumedItems).reduce((nextAmounts, itemId) => {
    const parsedAmount = Number(amounts[itemId])

    nextAmounts[itemId] =
      Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0

    return nextAmounts
  }, {})
}

function createEmptyDay(date) {
  return {
    date,
    status: null,
    checkedItems: {},
    consumedItems: {},
    consumedAmounts: {},
  }
}

function finalizeDay(day, totalItems, forcedStatus = day.status) {
  const checkedItems = cleanFlags(day.checkedItems)
  const consumedItems = cleanFlags(day.consumedItems)
  const consumedAmounts = cleanAmounts(day.consumedAmounts, consumedItems)
  const checkedCount = countFlags(checkedItems)
  let status = forcedStatus ?? null

  if (status === 'flex') {
    return {
      ...day,
      checkedItems,
      consumedItems,
      consumedAmounts,
      status: 'flex',
    }
  }

  if (status === 'missed' && checkedCount === 0) {
    return {
      ...day,
      checkedItems,
      consumedItems,
      consumedAmounts,
      status: 'missed',
    }
  }

  if (checkedCount === totalItems) {
    status = 'complete'
  } else if (checkedCount > 0) {
    status = 'partial'
  } else {
    status = null
  }

  return { ...day, checkedItems, consumedItems, consumedAmounts, status }
}

function shouldKeepDay(day) {
  return Boolean(day.status) || countFlags(day.checkedItems) > 0
}

function sortDays(days) {
  return [...days].sort((a, b) => a.date.localeCompare(b.date))
}

function saveDayRecord(history, nextDay) {
  const remaining = history.filter((day) => day.date !== nextDay.date)

  if (!shouldKeepDay(nextDay)) {
    return sortDays(remaining)
  }

  return sortDays([...remaining, nextDay])
}

function getDayRecord(history, date) {
  return history.find((day) => day.date === date) ?? createEmptyDay(date)
}

function normalizeHistory(history, totalItems, itemMap) {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .map((day) => {
      const checkedItems = day?.checkedItems ?? day?.consumedItems ?? {}
      const consumedItems = day?.consumedItems ?? {}
      const consumedAmounts = Object.keys(consumedItems).reduce(
        (nextAmounts, itemId) => {
          const parsedAmount = Number(day?.consumedAmounts?.[itemId])

          nextAmounts[itemId] =
            Number.isFinite(parsedAmount) && parsedAmount >= 0
              ? parsedAmount
              : itemMap[itemId]?.amountPerUse ?? 0

          return nextAmounts
        },
        {},
      )

      return finalizeDay(
        {
          date: day?.date ?? '',
          status: day?.status ?? null,
          checkedItems,
          consumedItems,
          consumedAmounts,
        },
        totalItems,
        day?.status ?? null,
      )
    })
    .filter((day) => day.date)
    .filter(shouldKeepDay)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function getStatusTone(status) {
  if (status === 'complete') {
    return 'good'
  }

  if (status === 'flex') {
    return 'warm'
  }

  if (status === 'missed') {
    return 'danger'
  }

  if (status === 'partial') {
    return 'cool'
  }

  return 'neutral'
}

function toPercent(value) {
  return `${Math.round(value)}%`
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function SetupCard({ onGoToShopping }) {
  return (
    <article className="setup-card">
      <div>
        <p className="eyebrow">Set up your inventory</p>
        <h3>Add what food you currently have so the shopping list can track what is running low.</h3>
      </div>
      <button type="button" className="btn btn-primary" onClick={onGoToShopping}>
        Go to Shopping
      </button>
    </article>
  )
}

function App() {
  const totalItems = mealItems.length
  const itemMap = Object.fromEntries(mealItems.map((item) => [item.id, item]))
  const todayKey = getDateKey()
  const toastTimersRef = useRef(new Map())
  const toastIdRef = useRef(0)
  const completionRef = useRef(0)

  const [activeTab, setActiveTab] = useState('today')
  const [activeShoppingFilter, setActiveShoppingFilter] = useState('all')
  const [amountInputs, setAmountInputs] = useState({})
  const [toasts, setToasts] = useState([])
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const [completionPulse, setCompletionPulse] = useState(false)
  const [dayHistory, setDayHistory] = useState(() =>
    normalizeHistory(loadDayHistory(), totalItems, itemMap),
  )
  const [inventory, setInventory] = useState(() =>
    mergeInventory(mealItems, loadInventory()),
  )
  const [shoppingChecks, setShoppingChecks] = useState(() =>
    cleanFlags(loadShoppingChecks()),
  )
  const [settings, setSettings] = useState(() =>
    sanitizeSettings(loadSettings()),
  )

  const resolvedTheme = resolveTheme(settings.theme, systemTheme)

  useEffect(() => {
    saveDayHistory(dayHistory)
  }, [dayHistory])

  useEffect(() => {
    saveInventory(inventory)
  }, [inventory])

  useEffect(() => {
    saveShoppingChecks(shoppingChecks)
  }, [shoppingChecks])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return undefined
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    syncTheme(media)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncTheme)
      return () => media.removeEventListener('change', syncTheme)
    }

    media.addListener(syncTheme)
    return () => media.removeListener(syncTheme)
  }, [])

  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-light')
    document.documentElement.classList.add(`theme-${resolvedTheme}`)
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(`theme-${resolvedTheme}`)
    document.documentElement.style.colorScheme = resolvedTheme

    const themeColorMeta = document.querySelector('meta[name="theme-color"]')

    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', themeColors[resolvedTheme])
    }
  }, [resolvedTheme])

  useEffect(() => {
    const activeTimers = toastTimersRef.current

    return () => {
      activeTimers.forEach((timer) => window.clearTimeout(timer))
      activeTimers.clear()
    }
  }, [])

  const todayRecord = getDayRecord(dayHistory, todayKey)
  const checkedToday = countFlags(todayRecord.checkedItems)
  const completionPercent = Math.round((checkedToday / totalItems) * 100)
  const currentStreak = calculateCurrentStreak(dayHistory)
  const bestStreak = calculateBestStreak(dayHistory)
  const weekStats = getWeekStats(dayHistory, todayKey)
  const allTimeStats = calculateAllTimeStats(dayHistory, totalItems)
  const historyStrip = getLastNDays(dayHistory, 14, todayKey)
  const shoppingItems = buildShoppingItems(
    mealItems,
    inventory,
    shoppingChecks,
    settings,
  )
  const shoppingGroups = groupShoppingItems(shoppingItems)
  const urgentCount = shoppingGroups.urgent.length
  const soonCount = shoppingGroups.soon.length
  const shoppingFilterCounts = {
    all: shoppingItems.length,
    need: urgentCount + soonCount,
    urgent: urgentCount,
    soon: soonCount,
    good: shoppingGroups.good.length,
  }
  const shoppingFilterOptions = shoppingFilters.map((filter) => {
    return {
      ...filter,
      count: shoppingFilterCounts[filter.id] ?? 0,
    }
  })
  const filteredShoppingItems = shoppingItems.filter((item) =>
    matchesShoppingFilter(activeShoppingFilter, item),
  )
  const activeShoppingEmptyState =
    shoppingFilterEmptyStates[activeShoppingFilter] ?? shoppingFilterEmptyStates.all
  const isInventoryEmpty = shoppingItems.every((item) => item.currentAmount === 0)
  const isFirstRun = isInventoryEmpty && dayHistory.length === 0
  const flexUsedExcludingToday = weekStats.weekDays.filter(
    (day) => day.status === 'flex' && day.date !== todayKey,
  ).length
  const flexRemaining = Math.max(
    0,
    settings.flexDaysPerWeek - weekStats.counts.flex,
  )
  const completedMealsToday = mealSections.filter((section) =>
    mealItems
      .filter((item) => item.meal === section.id)
      .every((item) => todayRecord.checkedItems[item.id]),
  ).length

  useEffect(() => {
    if (
      completionPercent === 100 &&
      completionRef.current < 100 &&
      !settings.reducedMotion
    ) {
      setCompletionPulse(true)
      const timer = window.setTimeout(() => setCompletionPulse(false), 1200)

      return () => window.clearTimeout(timer)
    }

    completionRef.current = completionPercent
    return undefined
  }, [completionPercent, settings.reducedMotion])

  useEffect(() => {
    completionRef.current = completionPercent
  }, [completionPercent])

  function dismissToast(id) {
    const timer = toastTimersRef.current.get(id)

    if (timer) {
      window.clearTimeout(timer)
      toastTimersRef.current.delete(id)
    }

    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function showToast(title, message = '', tone = 'neutral') {
    toastIdRef.current += 1
    const id = `toast-${toastIdRef.current}`
    const timer = window.setTimeout(() => dismissToast(id), 2600)

    toastTimersRef.current.set(id, timer)
    setToasts((current) => [...current, { id, title, message, tone }])
  }

  function patchSettings(nextPartial, toastTitle = 'Settings saved') {
    setSettings((current) => sanitizeSettings({ ...current, ...nextPartial }))

    if (toastTitle) {
      showToast(toastTitle, '', 'neutral')
    }
  }

  function handleThresholdChange(key, value) {
    setSettings((current) => sanitizeSettings({ ...current, [key]: value }))
  }

  function handleThresholdBlur() {
    showToast('Settings saved', '', 'neutral')
  }

  function clearAmountInput(itemId) {
    setAmountInputs((current) => {
      const next = { ...current }
      delete next[itemId]
      return next
    })
  }

  function commitDay(nextDay, nextInventory = inventory, inventoryChanged = false) {
    setDayHistory((current) => saveDayRecord(current, nextDay))

    if (inventoryChanged) {
      setInventory(nextInventory)
    }
  }

  function toggleSingleItem(item, checked) {
    const day = getDayRecord(dayHistory, todayKey)
    const nextCheckedItems = { ...day.checkedItems }
    const nextConsumedItems = { ...day.consumedItems }
    const nextConsumedAmounts = { ...day.consumedAmounts }
    let nextInventory = inventory
    let inventoryChanged = false

    if (checked) {
      nextCheckedItems[item.id] = true

      if (item.trackInventory !== false && !nextConsumedItems[item.id]) {
        const deductedAmount = Math.min(
          getInventoryAmount(nextInventory, item.id),
          item.amountPerUse,
        )

        nextConsumedItems[item.id] = true
        nextConsumedAmounts[item.id] = deductedAmount
        nextInventory = adjustInventoryAmount(
          nextInventory,
          item.id,
          -deductedAmount,
        )
        inventoryChanged = true
      }
    } else {
      delete nextCheckedItems[item.id]

      if (item.trackInventory !== false && nextConsumedItems[item.id]) {
        const deductedAmount = nextConsumedAmounts[item.id] ?? 0

        delete nextConsumedItems[item.id]
        delete nextConsumedAmounts[item.id]
        nextInventory = adjustInventoryAmount(
          nextInventory,
          item.id,
          deductedAmount,
        )
        inventoryChanged = true
      }
    }

    const nextStatus = day.status === 'missed' && checked ? null : day.status
    const nextDay = finalizeDay(
      {
        ...day,
        status: nextStatus,
        checkedItems: nextCheckedItems,
        consumedItems: nextConsumedItems,
        consumedAmounts: nextConsumedAmounts,
      },
      totalItems,
      nextStatus,
    )

    commitDay(nextDay, nextInventory, inventoryChanged)
    showToast(
      checked ? 'Inventory updated' : 'Item unchecked',
      checked ? `${item.name} logged` : `${item.name} removed`,
      checked ? 'good' : 'neutral',
    )
  }

  function toggleMeal(mealId) {
    const mealGroup = mealItems.filter((item) => item.meal === mealId)
    const section = mealSections.find((meal) => meal.id === mealId)
    const day = getDayRecord(dayHistory, todayKey)
    const nextCheckedItems = { ...day.checkedItems }
    const nextConsumedItems = { ...day.consumedItems }
    const nextConsumedAmounts = { ...day.consumedAmounts }
    const everyItemChecked = mealGroup.every((item) => nextCheckedItems[item.id])
    let nextInventory = inventory
    let inventoryChanged = false

    mealGroup.forEach((item) => {
      if (everyItemChecked) {
        delete nextCheckedItems[item.id]

        if (item.trackInventory !== false && nextConsumedItems[item.id]) {
          const deductedAmount = nextConsumedAmounts[item.id] ?? 0

          delete nextConsumedItems[item.id]
          delete nextConsumedAmounts[item.id]
          nextInventory = adjustInventoryAmount(
            nextInventory,
            item.id,
            deductedAmount,
          )
          inventoryChanged = true
        }
      } else {
        nextCheckedItems[item.id] = true

        if (item.trackInventory !== false && !nextConsumedItems[item.id]) {
          const deductedAmount = Math.min(
            getInventoryAmount(nextInventory, item.id),
            item.amountPerUse,
          )

          nextConsumedItems[item.id] = true
          nextConsumedAmounts[item.id] = deductedAmount
          nextInventory = adjustInventoryAmount(
            nextInventory,
            item.id,
            -deductedAmount,
          )
          inventoryChanged = true
        }
      }
    })

    const nextStatus =
      day.status === 'missed' && !everyItemChecked ? null : day.status
    const nextDay = finalizeDay(
      {
        ...day,
        status: nextStatus,
        checkedItems: nextCheckedItems,
        consumedItems: nextConsumedItems,
        consumedAmounts: nextConsumedAmounts,
      },
      totalItems,
      nextStatus,
    )

    commitDay(nextDay, nextInventory, inventoryChanged)
    showToast(
      everyItemChecked ? `${section?.title ?? 'Meal'} cleared` : `${section?.title ?? 'Meal'} logged`,
      everyItemChecked
        ? 'Inventory returned for this meal.'
        : `${mealGroup.length} items updated.`,
      everyItemChecked ? 'neutral' : 'good',
    )
  }

  function handleCompleteDay() {
    const day = getDayRecord(dayHistory, todayKey)
    const nextCheckedItems = { ...day.checkedItems }
    const nextConsumedItems = { ...day.consumedItems }
    const nextConsumedAmounts = { ...day.consumedAmounts }
    let nextInventory = inventory
    let inventoryChanged = false

    mealItems.forEach((item) => {
      nextCheckedItems[item.id] = true

      if (item.trackInventory !== false && !nextConsumedItems[item.id]) {
        const deductedAmount = Math.min(
          getInventoryAmount(nextInventory, item.id),
          item.amountPerUse,
        )

        nextConsumedItems[item.id] = true
        nextConsumedAmounts[item.id] = deductedAmount
        nextInventory = adjustInventoryAmount(
          nextInventory,
          item.id,
          -deductedAmount,
        )
        inventoryChanged = true
      }
    })

    const nextDay = finalizeDay(
      {
        ...day,
        status: 'complete',
        checkedItems: nextCheckedItems,
        consumedItems: nextConsumedItems,
        consumedAmounts: nextConsumedAmounts,
      },
      totalItems,
      'complete',
    )

    commitDay(nextDay, nextInventory, inventoryChanged)
    showToast('Marked complete', 'Full day logged.', 'good')
  }

  function handleFlexDay() {
    if (settings.flexDaysPerWeek === 0 && todayRecord.status !== 'flex') {
      showToast('Flex days disabled', 'Change the limit in Settings.', 'warm')
      return
    }

    if (
      todayRecord.status !== 'flex' &&
      flexUsedExcludingToday >= settings.flexDaysPerWeek
    ) {
      showToast(
        'Flex limit reached',
        `You already used ${settings.flexDaysPerWeek} flex day${settings.flexDaysPerWeek === 1 ? '' : 's'} this week.`,
        'warm',
      )
      return
    }

    const day = getDayRecord(dayHistory, todayKey)
    const nextDay = finalizeDay(
      {
        ...day,
        status: 'flex',
      },
      totalItems,
      'flex',
    )

    commitDay(nextDay)
    showToast('Marked as flex day', 'Your streak stays paused.', 'warm')
  }

  function handleMissedDay() {
    const day = getDayRecord(dayHistory, todayKey)
    const hasChecks = countFlags(day.checkedItems) > 0

    if (
      hasChecks &&
      !window.confirm('Mark today as missed and clear the checked items?')
    ) {
      return
    }

    let nextInventory = inventory
    let inventoryChanged = false

    Object.keys(day.consumedItems).forEach((itemId) => {
      const item = itemMap[itemId]
      const deductedAmount = day.consumedAmounts?.[itemId] ?? 0

      if (item && item.trackInventory !== false && deductedAmount > 0) {
        nextInventory = adjustInventoryAmount(
          nextInventory,
          item.id,
          deductedAmount,
        )
        inventoryChanged = true
      }
    })

    const nextDay = finalizeDay(
      {
        ...day,
        status: 'missed',
        checkedItems: {},
        consumedItems: {},
        consumedAmounts: {},
      },
      totalItems,
      'missed',
    )

    commitDay(nextDay, nextInventory, inventoryChanged)
    showToast('Marked missed', 'Today breaks the streak.', 'danger')
  }

  function handleSetCurrentAmount(item) {
    const rawValue = amountInputs[item.id] ?? `${getInventoryAmount(inventory, item.id)}`
    const parsedValue = Number(rawValue)

    if (!Number.isFinite(parsedValue)) {
      showToast('Enter a valid amount', '', 'danger')
      return
    }

    setInventory((current) => setInventoryAmount(current, item.id, parsedValue))
    clearAmountInput(item.id)
    showToast('Inventory updated', `${item.name} saved.`, 'good')
  }

  function handleAddRestock(item) {
    setInventory((current) =>
      adjustInventoryAmount(current, item.id, item.restockAmount),
    )
    clearAmountInput(item.id)
    showToast('Inventory updated', `${item.name} restocked.`, 'good')
  }

  function handleMarkBought(item) {
    setInventory((current) =>
      adjustInventoryAmount(current, item.id, item.restockAmount),
    )
    setShoppingChecks((current) => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
    clearAmountInput(item.id)
    showToast('Shopping item restocked', `${item.name} added.`, 'good')
  }

  function handleClearInventoryItem(item) {
    if (!window.confirm(`Set ${item.name} to 0?`)) {
      return
    }

    setInventory((current) => setInventoryAmount(current, item.id, 0))
    clearAmountInput(item.id)
    showToast('Item cleared', `${item.name} set to 0.`, 'neutral')
  }

  function handleFillInventory() {
    if (!window.confirm('Fill inventory with the default amounts?')) {
      return
    }

    setInventory(createFilledInventory(mealItems))
    setAmountInputs({})
    showToast('Default amounts added', 'Inventory filled from the meal plan.', 'good')
  }

  function handleClearInventory() {
    if (!window.confirm('Clear all current inventory amounts back to 0?')) {
      return
    }

    setInventory(createEmptyInventory(mealItems))
    setAmountInputs({})
    showToast('Inventory cleared', 'All current amounts were reset to 0.', 'danger')
  }

  function handleShoppingCheck(itemId, checked) {
    setShoppingChecks((current) => {
      const next = { ...current }

      if (checked) {
        next[itemId] = true
      } else {
        delete next[itemId]
      }

      return next
    })
  }

  function handleResetShoppingChecks() {
    if (!window.confirm('Clear all shopping checkmarks?')) {
      return
    }

    setShoppingChecks({})
    showToast('Shopping checks reset', '', 'neutral')
  }

  function handleExportBackup() {
    const payload = createBackupPayload(
      dayHistory,
      inventory,
      shoppingChecks,
      settings,
    )
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `bam-backup-${todayKey}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Backup exported', 'Local backup saved as JSON.', 'good')
  }

  async function handleImportBackup(event) {
    const [file] = event.target.files ?? []

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = parseBackupPayload(text)

      setDayHistory(normalizeHistory(parsed.dayHistory, totalItems, itemMap))
      setInventory(mergeInventory(mealItems, parsed.inventory))
      setShoppingChecks(cleanFlags(parsed.shoppingChecks))
      setSettings(sanitizeSettings(parsed.settings))
      setAmountInputs({})
      showToast('Backup imported', 'Bam data restored.', 'good')
    } catch (error) {
      showToast(
        'Import failed',
        error.message || 'Could not import the backup file.',
        'danger',
      )
    } finally {
      event.target.value = ''
    }
  }

  function handleResetHistoryOnly() {
    if (!window.confirm('Reset all tracked day history?')) {
      return
    }

    resetStoredHistory()
    setDayHistory([])
    showToast('History reset', 'Tracked day history was removed.', 'danger')
  }

  function handleResetInventoryOnly() {
    if (!window.confirm('Reset inventory and shopping checks?')) {
      return
    }

    resetStoredInventory()
    setInventory(createEmptyInventory(mealItems))
    setShoppingChecks({})
    setAmountInputs({})
    showToast('Inventory cleared', 'Inventory and shopping checks were reset.', 'danger')
  }

  function handleResetAllAppData() {
    if (
      !window.confirm(
        'Reset all Bam data on this device? This will clear inventory, history, shopping checks, and settings.',
      )
    ) {
      return
    }

    resetAllStoredData()
    setDayHistory([])
    setInventory(createEmptyInventory(mealItems))
    setShoppingChecks({})
    setSettings(defaultSettings)
    setAmountInputs({})
    setActiveTab('today')
    showToast('All app data reset', 'Bam was cleared on this device.', 'danger')
  }

  function renderStatusBadge(status) {
    const statusKey = status ?? 'open'

    return (
      <span className={`status-badge tone-${getStatusTone(statusKey)}`}>
        {statusLabels[statusKey]}
      </span>
    )
  }

  function renderQuickBadge(label, value, tone = 'neutral') {
    return (
      <div className={`summary-chip tone-${tone}`}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    )
  }

  function renderSegmentedOptions(options, currentValue, onSelect, formatter) {
    return (
      <div className="segmented-group">
        {options.map((option) => {
          const isActive = option === currentValue

          return (
            <button
              type="button"
              key={option}
              className={isActive ? 'segment-btn active' : 'segment-btn'}
              onClick={() => onSelect(option)}
            >
              {formatter(option)}
            </button>
          )
        })}
      </div>
    )
  }

  function renderTodayTab() {
    return (
      <section className="page-stack">
        <article className={`panel today-hero-panel${completionPulse ? ' success-pulse' : ''}`}>
          <div className="today-hero">
            <div className="today-copy">
              <p className="eyebrow">Today</p>
              <h2>{formatLongDate(todayKey)}</h2>
              <p className="panel-copy">
                Stay close to the plan. Flex days are allowed.
              </p>
              <div className="badge-row">
                {renderStatusBadge(todayRecord.status)}
                <span className="mini-pill tone-neutral">
                  {checkedToday}/{totalItems} items checked
                </span>
                <span className="mini-pill tone-neutral">
                  {completedMealsToday}/{mealSections.length} meals done
                </span>
              </div>
            </div>

            <ProgressRing
              value={completionPercent}
              label="Today"
              reducedMotion={settings.reducedMotion}
              pulse={completionPulse}
            />
          </div>

          <div className="summary-grid">
            {renderQuickBadge('Current streak', currentStreak, 'good')}
            {renderQuickBadge('Urgent items', urgentCount, urgentCount ? 'danger' : 'neutral')}
            {renderQuickBadge(
              'Flex remaining',
              `${flexRemaining}/${settings.flexDaysPerWeek}`,
              'warm',
            )}
            {renderQuickBadge('Best streak', bestStreak, 'good')}
          </div>

          {isFirstRun ? <SetupCard onGoToShopping={() => setActiveTab('shopping')} /> : null}

          <div className="progress-inline-shell">
            <div className="progress-inline-copy">
              <strong>{completionPercent}% complete</strong>
              <span>Daily completion</span>
            </div>
            <div className="progress-bar" aria-hidden="true">
              <span style={{ width: `${completionPercent}%` }} />
            </div>
          </div>

          <div className="action-row">
            <button type="button" className="btn btn-primary" onClick={handleCompleteDay}>
              Mark complete day
            </button>
            <button type="button" className="btn btn-warm" onClick={handleFlexDay}>
              Mark flex day
            </button>
            <button type="button" className="btn btn-danger" onClick={handleMissedDay}>
              Mark missed day
            </button>
          </div>
        </article>

        <div className="dashboard-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">This week</p>
                <h3>{weekStats.strongDaysLabel}</h3>
              </div>
            </div>

            <div className="stat-grid">
              <StatCard label="Complete days" value={weekStats.counts.complete} tone="good" />
              <StatCard
                label="Flex used"
                value={`${weekStats.counts.flex}/${settings.flexDaysPerWeek}`}
                tone="warm"
              />
              <StatCard label="Missed days" value={weekStats.counts.missed} tone="danger" />
              <StatCard label="Partial days" value={weekStats.counts.partial} tone="cool" />
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Shopping watch</p>
                <h3>Inventory pressure</h3>
              </div>
            </div>

            <div className="summary-list">
              <div className="summary-line">
                <span>Out / urgent</span>
                <strong className="tone-danger">{urgentCount}</strong>
              </div>
              <div className="summary-line">
                <span>Buy soon</span>
                <strong className="tone-warm">{soonCount}</strong>
              </div>
              <div className="summary-line">
                <span>Good</span>
                <strong className="tone-good">{shoppingGroups.good.length}</strong>
              </div>
            </div>
          </article>
        </div>

        <section className="meal-card-list">
          {mealSections.map((section) => (
            <MealCard
              key={section.id}
              section={section}
              items={mealItems.filter((item) => item.meal === section.id)}
              checkedItems={todayRecord.checkedItems}
              inventory={inventory}
              onToggleItem={toggleSingleItem}
              onToggleMeal={toggleMeal}
            />
          ))}
        </section>
      </section>
    )
  }

  function renderMealsTab() {
    return (
      <section className="card-grid">
        {mealSections.map((section) => {
          const items = mealItems.filter((item) => item.meal === section.id)

          return (
            <article className="panel" key={section.id}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">{section.title}</p>
                  <h3>{section.label}</h3>
                </div>
              </div>

              <div className="meal-plan-list">
                {items.map((item) => (
                  <div className="meal-plan-row" key={item.id}>
                    <div className="meal-item-text">
                      <strong>{item.displayAmount}</strong>
                      <span>
                        {item.trackInventory === false
                          ? 'Not tracked in inventory'
                          : formatInventoryLeft(
                              item,
                              getInventoryAmount(inventory, item.id),
                            )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </section>
    )
  }

  function renderShoppingTab() {
    return (
      <section className="page-stack">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Shopping</p>
              <h2>Inventory-driven list</h2>
              <p className="panel-copy">
                Add what you currently have at home so Bam can track what is running low.
              </p>
            </div>
          </div>

          <div className="stat-grid">
            <StatCard label="Out / urgent" value={urgentCount} tone="danger" />
            <StatCard label="Buy soon" value={soonCount} tone="warm" />
            <StatCard label="Good" value={shoppingGroups.good.length} tone="good" />
            <StatCard
              label="Tracked items"
              value={shoppingItems.length}
              tone="neutral"
            />
          </div>

          {isInventoryEmpty ? (
            <div className="notice-card tone-warm">
              <strong>Inventory starts empty.</strong>
              <p>
                Most items show as urgent because nothing has been added yet. Enter
                what you currently have at home to make the list accurate.
              </p>
            </div>
          ) : null}

          <div className="action-row">
            <button type="button" className="btn btn-secondary" onClick={handleFillInventory}>
              Fill with default amounts
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClearInventory}>
              Clear inventory
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetShoppingChecks}
            >
              Reset shopping checks
            </button>
          </div>
        </article>

        <section className="shopping-list-area" aria-label="Shopping item list">
          <div className="shopping-filter-row" aria-label="Filter shopping items">
            {shoppingFilterOptions.map((filter) => (
              <button
                type="button"
                key={filter.id}
                className={
                  activeShoppingFilter === filter.id
                    ? 'shopping-filter-tab active'
                    : 'shopping-filter-tab'
                }
                aria-pressed={activeShoppingFilter === filter.id}
                onClick={() => setActiveShoppingFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <strong>{filter.count}</strong>
              </button>
            ))}
          </div>

          <div className="inventory-list">
            {filteredShoppingItems.length > 0 ? (
              filteredShoppingItems.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  checked={Boolean(shoppingChecks[item.id])}
                  draftValue={
                    amountInputs[item.id] ?? `${formatAmount(item.currentAmount)}`
                  }
                  onDraftChange={(itemId, value) =>
                    setAmountInputs((current) => ({
                      ...current,
                      [itemId]: value,
                    }))
                  }
                  onSetAmount={handleSetCurrentAmount}
                  onAddRestock={handleAddRestock}
                  onMarkBought={handleMarkBought}
                  onClearItem={handleClearInventoryItem}
                  onToggleCheck={handleShoppingCheck}
                />
              ))
            ) : (
              <EmptyState
                title={activeShoppingEmptyState.title}
                body={activeShoppingEmptyState.body}
              />
            )}
          </div>
        </section>
      </section>
    )
  }

  function renderStatsTab() {
    return (
      <section className="page-stack">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">This week</p>
              <h2>{weekStats.strongDaysLabel}</h2>
            </div>
          </div>

          <div className="stat-grid">
            <StatCard label="Current streak" value={currentStreak} tone="good" />
            <StatCard label="Best streak" value={bestStreak} tone="good" />
            <StatCard label="Complete this week" value={weekStats.counts.complete} tone="good" />
            <StatCard label="Flex this week" value={weekStats.counts.flex} tone="warm" />
            <StatCard label="Missed this week" value={weekStats.counts.missed} tone="danger" />
            <StatCard label="Partial this week" value={weekStats.counts.partial} tone="cool" />
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">All time</p>
              <h2>Full history on this device</h2>
            </div>
          </div>

          <div className="stat-grid stat-grid-large">
            <StatCard label="Total complete days" value={allTimeStats.counts.complete} tone="good" />
            <StatCard label="Total flex days" value={allTimeStats.counts.flex} tone="warm" />
            <StatCard label="Total missed days" value={allTimeStats.counts.missed} tone="danger" />
            <StatCard label="Total partial days" value={allTimeStats.counts.partial} tone="cool" />
            <StatCard label="Best streak ever" value={allTimeStats.bestStreak} tone="good" />
            <StatCard label="Current streak" value={allTimeStats.currentStreak} tone="good" />
            <StatCard
              label="Total items checked"
              value={allTimeStats.totalCheckedItems}
              tone="neutral"
            />
            <StatCard
              label="Total days tracked"
              value={allTimeStats.totalTrackedDays}
              tone="neutral"
            />
            <StatCard
              label="Completion rate"
              value={toPercent(allTimeStats.completionRate)}
              tone="cool"
            />
            <StatCard
              label="Strong days"
              value={toPercent(allTimeStats.strongDayRate)}
              tone="good"
            />
            <StatCard
              label="Flex day usage"
              value={toPercent(allTimeStats.flexUsageRate)}
              tone="warm"
            />
            <StatCard
              label="Longest missed streak"
              value={allTimeStats.longestMissedStreak}
              tone="danger"
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Last 14 days</p>
              <h2>Recent history</h2>
            </div>
          </div>

          <div className="history-strip">
            {historyStrip.map(({ date, entry }) => {
              const statusKey = entry?.status ?? 'open'

              return (
                <div className={`history-day tone-${getStatusTone(statusKey)}`} key={date}>
                  <span>{formatDateLabel(date)}</span>
                  <strong>{statusLabels[statusKey]}</strong>
                </div>
              )
            })}
          </div>
        </article>
      </section>
    )
  }

  function renderSettingsTab() {
    return (
      <section className="page-stack">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Appearance</p>
              <h2>Theme and layout</h2>
            </div>
          </div>

          <div className="settings-grid">
            <div className="setting-block">
              <span className="field-label">Theme</span>
              <p className="field-help">Default is dark mode.</p>
              {renderSegmentedOptions(
                themeOptions,
                settings.theme,
                (theme) => patchSettings({ theme }, 'Settings saved'),
                (theme) => capitalize(theme),
              )}
            </div>

            <div className="setting-block">
              <span className="field-label">Accent color</span>
              <p className="field-help">Used for tabs, primary buttons, and highlights.</p>
              {renderSegmentedOptions(
                accentOptions,
                settings.accentColor,
                (accentColor) =>
                  patchSettings({ accentColor }, 'Settings saved'),
                (accentColor) => capitalize(accentColor),
              )}
            </div>
          </div>

          <div className="settings-stack">
            <ToggleSwitch
              checked={settings.reducedMotion}
              label="Reduce animations"
              helpText="Turns off most motion and pulse effects."
              onChange={(reducedMotion) =>
                patchSettings({ reducedMotion }, 'Settings saved')
              }
            />
            <ToggleSwitch
              checked={settings.compactMode}
              label="Compact layout"
              helpText="Tighter spacing for smaller phone screens."
              onChange={(compactMode) =>
                patchSettings({ compactMode }, 'Settings saved')
              }
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Habit Rules</p>
              <h2>Flex-day settings</h2>
            </div>
          </div>

          <div className="setting-block">
            <span className="field-label">Flex days per week</span>
            <p className="field-help">Used by Today and weekly stats.</p>
            {renderSegmentedOptions(
              flexDayOptions,
              settings.flexDaysPerWeek,
              (flexDaysPerWeek) =>
                patchSettings({ flexDaysPerWeek }, 'Settings saved'),
              (value) => `${value}`,
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Inventory Rules</p>
              <h2>Low-stock thresholds</h2>
            </div>
          </div>

          <div className="settings-grid">
            <label className="field-group">
              <span>Low threshold days</span>
              <input
                type="number"
                min="0"
                max="30"
                value={settings.lowThresholdDays}
                onChange={(event) =>
                  handleThresholdChange('lowThresholdDays', event.target.value)
                }
                onBlur={handleThresholdBlur}
              />
            </label>
            <label className="field-group">
              <span>Urgent threshold days</span>
              <input
                type="number"
                min="0"
                max="30"
                value={settings.urgentThresholdDays}
                onChange={(event) =>
                  handleThresholdChange('urgentThresholdDays', event.target.value)
                }
                onBlur={handleThresholdBlur}
              />
            </label>
            <label className="field-group">
              <span>Supplement low threshold</span>
              <input
                type="number"
                min="0"
                max="60"
                value={settings.supplementLowThresholdDays}
                onChange={(event) =>
                  handleThresholdChange(
                    'supplementLowThresholdDays',
                    event.target.value,
                  )
                }
                onBlur={handleThresholdBlur}
              />
            </label>
            <label className="field-group">
              <span>Supplement urgent threshold</span>
              <input
                type="number"
                min="0"
                max="60"
                value={settings.supplementUrgentThresholdDays}
                onChange={(event) =>
                  handleThresholdChange(
                    'supplementUrgentThresholdDays',
                    event.target.value,
                  )
                }
                onBlur={handleThresholdBlur}
              />
            </label>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Data</p>
              <h2>Backup and reset</h2>
            </div>
          </div>

          <div className="settings-stack">
            <div className="action-row">
              <button type="button" className="btn btn-secondary" onClick={handleExportBackup}>
                Export backup
              </button>
              <label className="btn btn-secondary btn-label" htmlFor="backup-import">
                Import backup
              </label>
            </div>

            <div className="action-row">
              <button type="button" className="btn btn-secondary" onClick={handleFillInventory}>
                Fill with default amounts
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClearInventory}>
                Clear inventory
              </button>
            </div>

            <div className="action-row">
              <button type="button" className="btn btn-secondary" onClick={handleResetInventoryOnly}>
                Reset inventory only
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleResetHistoryOnly}>
                Reset history only
              </button>
            </div>

            <div className="action-row">
              <button type="button" className="btn btn-secondary" onClick={handleResetShoppingChecks}>
                Reset shopping checks
              </button>
              <button type="button" className="btn btn-danger" onClick={handleResetAllAppData}>
                Reset all app data
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">About</p>
              <h2>Bam</h2>
            </div>
          </div>

          <div className="about-stack">
            <div className="about-row">
              <span>Version</span>
              <strong>{APP_VERSION}</strong>
            </div>
            <div className="about-row">
              <span>Description</span>
              <strong>Meal streaks, flex days, and groceries.</strong>
            </div>
            <div className="about-row">
              <span>Storage</span>
              <strong>Local only on this device</strong>
            </div>
            <p className="about-note">
              Bam saves data locally on this device. If you clear browser data,
              your Bam data may be removed unless you export a backup.
            </p>
          </div>
        </article>
      </section>
    )
  }

  function renderActiveTab() {
    if (activeTab === 'today') {
      return renderTodayTab()
    }

    if (activeTab === 'meals') {
      return renderMealsTab()
    }

    if (activeTab === 'shopping') {
      return renderShoppingTab()
    }

    if (activeTab === 'stats') {
      return renderStatsTab()
    }

    return renderSettingsTab()
  }

  // Tab content only returns JSX and bound handlers.
  // eslint-disable-next-line react-hooks/refs
  const activeContent = renderActiveTab()

  return (
    <div
      className={`app-shell ${accentClassNames[settings.accentColor]}${settings.compactMode ? ' compact-mode' : ''}${settings.reducedMotion ? ' reduce-motion' : ''}`}
    >
      <header className="app-header">
        <div>
          <p className="eyebrow">Bam</p>
          <h1>Bam</h1>
          <p className="header-subtitle">Meal streaks, flex days, and groceries</p>
        </div>

        <div className="header-stats">
          <div>
            <span>Current streak</span>
            <strong>{currentStreak}</strong>
          </div>
          <div>
            <span>Best streak</span>
            <strong>{bestStreak}</strong>
          </div>
          <div>
            <span>Urgent items</span>
            <strong>{urgentCount}</strong>
          </div>
        </div>
      </header>

      <nav className="tab-bar" aria-label="Main tabs">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </nav>

      <main key={activeTab} className="content-shell tab-transition">
        {activeContent}
      </main>

      <input
        id="backup-import"
        type="file"
        accept="application/json"
        hidden
        onChange={handleImportBackup}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
