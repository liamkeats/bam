import { formatInventoryLeft, getInventoryAmount } from '../utils/inventory'
import { formatProductLinkSummary } from '../utils/products'

function ChecklistItem({
  item,
  checked,
  inventory,
  linkedProduct,
  productLink,
  onOpenProduct,
  onToggle,
}) {
  const inventoryAmount = getInventoryAmount(inventory, item.id)
  const helperText =
    productLink && linkedProduct
      ? formatProductLinkSummary(productLink, linkedProduct)
      : item.trackInventory === false
      ? 'Not tracked in inventory'
      : formatInventoryLeft(item, inventoryAmount)

  return (
    <div className={checked ? 'check-item checked' : 'check-item'}>
      <label className="check-main">
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
      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={() => onOpenProduct(item)}
      >
        {productLink ? 'Product' : 'Scan product'}
      </button>
    </div>
  )
}

export default ChecklistItem
