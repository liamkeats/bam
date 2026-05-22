import { formatInventoryLeft, getInventoryAmount } from '../utils/inventory'

function ChecklistItem({ item, checked, inventory, onToggle }) {
  const inventoryAmount = getInventoryAmount(inventory, item.id)
  const helperText =
    item.trackInventory === false
      ? 'Not tracked in inventory'
      : formatInventoryLeft(item, inventoryAmount)

  return (
    <label className={checked ? 'check-item checked' : 'check-item'}>
      <input
        className="check-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(item, event.target.checked)}
      />
      <span className="check-box" aria-hidden="true">
        <span className="check-icon">✓</span>
      </span>
      <span className="check-content meal-item-text">
        <strong>{item.displayAmount}</strong>
        <span>{helperText}</span>
      </span>
    </label>
  )
}

export default ChecklistItem
