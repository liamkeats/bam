import ChecklistItem from './ChecklistItem'

function MealCard({
  section,
  items,
  checkedItems,
  inventory,
  onToggleItem,
  onToggleMeal,
}) {
  const completedCount = items.filter((item) => checkedItems[item.id]).length
  const totalCount = items.length
  const completionPercent = Math.round((completedCount / totalCount) * 100)
  const allChecked = completedCount === totalCount

  return (
    <article className="meal-card">
      <div className="meal-card-header">
        <div>
          <div className="meal-title-row">
            <h3>{section.title}</h3>
            <span className="meal-count">
              {completedCount}/{totalCount} items
            </span>
          </div>
          <p>{section.label}</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onToggleMeal(section.id)}
        >
          {allChecked ? 'Clear meal' : 'Mark meal eaten'}
        </button>
      </div>

      <div className="meal-progress">
        <div className="meal-progress-header">
          <span className="meal-progress-percent">{completionPercent}% complete</span>
          <span className="meal-progress-status">
            {completedCount === totalCount ? 'Meal done' : 'Keep going'}
          </span>
        </div>
        <div className="mini-progress" aria-hidden="true">
          <span style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      <div className="checklist">
        {items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            checked={Boolean(checkedItems[item.id])}
            inventory={inventory}
            onToggle={onToggleItem}
          />
        ))}
      </div>
    </article>
  )
}

export default MealCard
