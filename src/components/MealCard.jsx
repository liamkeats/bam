import ChecklistItem from './ChecklistItem'
import { formatMacro } from '../utils/nutrition'

function MealCard({
  section,
  items,
  checkedItems,
  inventory,
  plannedMeal,
  products,
  productLinks,
  onOpenMealItem,
  onOpenProduct,
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

      {plannedMeal ? (
        <div className="meal-macro-strip" aria-label={`${section.title} planned macros`}>
          <span>{formatMacro(plannedMeal.totals.calories, ' cal')}</span>
          <span>P {formatMacro(plannedMeal.totals.protein)}</span>
          <span>C {formatMacro(plannedMeal.totals.carbs)}</span>
          <span>F {formatMacro(plannedMeal.totals.fat)}</span>
        </div>
      ) : null}

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
            linkedProduct={products[productLinks[item.id]?.productId]}
            productLink={productLinks[item.id]}
            onOpenMealItem={onOpenMealItem}
            onOpenProduct={onOpenProduct}
            onToggle={onToggleItem}
          />
        ))}
      </div>
    </article>
  )
}

export default MealCard
