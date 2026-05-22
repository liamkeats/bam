import { formatAmount } from '../utils/inventory'

const shoppingStatusLabels = {
  urgent: 'Out / urgent',
  soon: 'Buy soon',
  good: 'Good',
}

function InventoryCard({
  item,
  draftValue,
  checked,
  onDraftChange,
  onSetAmount,
  onAddRestock,
  onMarkBought,
  onClearItem,
  onToggleCheck,
}) {
  return (
    <article
      className={`inventory-card inventory-${item.status}${checked ? ' is-checked' : ''}`}
    >
      <div className="inventory-card-top">
        <label className="inventory-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onToggleCheck(item.id, event.target.checked)}
          />
          <span className="inventory-heading">
            <strong>{item.name}</strong>
            <span>{item.displayAmount}</span>
          </span>
        </label>
        <div className="inventory-badges">
          <span className={`pill pill-${item.status}`}>
            {shoppingStatusLabels[item.status]}
          </span>
          <span className="pill pill-neutral">
            {formatAmount(item.daysLeft)} days left
          </span>
        </div>
      </div>

      <div className="inventory-meta">
        <div className="inventory-meta-item">
          <span className="meta-label">Current amount</span>
          <strong className="meta-value">
            {formatAmount(item.currentAmount)} {item.unit}
          </strong>
        </div>
        <div className="inventory-meta-item">
          <span className="meta-label">Used per day</span>
          <strong className="meta-value">
            {formatAmount(item.amountPerUse)} {item.unit}
          </strong>
        </div>
        <div className="inventory-meta-item">
          <span className="meta-label">Restock amount</span>
          <strong className="meta-value">
            {formatAmount(item.restockAmount)} {item.unit}
          </strong>
        </div>
        <div className="inventory-meta-item">
          <span className="meta-label">Status</span>
          <strong className="meta-value">{shoppingStatusLabels[item.status]}</strong>
        </div>
      </div>

      <div className="inventory-actions">
        <label className="field-group">
          <span>Set current amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draftValue}
            onChange={(event) => onDraftChange(item.id, event.target.value)}
          />
        </label>

        <div className="action-row">
          <button type="button" className="btn btn-secondary" onClick={() => onSetAmount(item)}>
            Save amount
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onAddRestock(item)}>
            Add restock amount
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onMarkBought(item)}>
            Mark bought
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onClearItem(item)}>
            Set to 0
          </button>
        </div>
      </div>
    </article>
  )
}

export default InventoryCard
