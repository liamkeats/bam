import { useMemo, useState } from 'react'

function toFormValue(value, fallback = '') {
  return value ?? fallback
}

function numberValue(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function MealItemEditorModal({ item, hasOverride, onClose, onReset, onSave }) {
  const initialForm = useMemo(
    () => ({
      name: item.name,
      displayAmount: item.displayAmount,
      targetAmount: toFormValue(item.targetAmount, item.amountPerUse),
      targetUnit: item.targetUnit ?? item.unit,
      amountPerUse: item.amountPerUse,
      unit: item.unit,
      startingAmount: item.startingAmount ?? item.restockAmount ?? 0,
      restockAmount: item.restockAmount ?? item.startingAmount ?? 0,
      trackInventory: item.trackInventory !== false,
      caloriesPerServing: item.defaultNutrition?.caloriesPerServing ?? 0,
      proteinPerServing: item.defaultNutrition?.proteinPerServing ?? 0,
      carbsPerServing: item.defaultNutrition?.carbsPerServing ?? 0,
      fatPerServing: item.defaultNutrition?.fatPerServing ?? 0,
      fiberPerServing: item.defaultNutrition?.fiberPerServing ?? 0,
      sugarPerServing: item.defaultNutrition?.sugarPerServing ?? 0,
    }),
    [item],
  )
  const [form, setForm] = useState(initialForm)

  function patchForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    onSave(item, {
      name: form.name,
      displayAmount: form.displayAmount,
      targetAmount: numberValue(form.targetAmount),
      targetUnit: form.targetUnit,
      amountPerUse: numberValue(form.amountPerUse),
      unit: form.unit,
      startingAmount: numberValue(form.startingAmount),
      restockAmount: numberValue(form.restockAmount),
      trackInventory: form.trackInventory,
      defaultNutrition: {
        caloriesPerServing: numberValue(form.caloriesPerServing),
        proteinPerServing: numberValue(form.proteinPerServing),
        carbsPerServing: numberValue(form.carbsPerServing),
        fatPerServing: numberValue(form.fatPerServing),
        fiberPerServing: numberValue(form.fiberPerServing),
        sugarPerServing: numberValue(form.sugarPerServing),
        nutrients: item.defaultNutrition?.nutrients ?? {},
      },
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="product-modal meal-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-edit-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Meal item</p>
            <h2 id="meal-edit-title">{item.name}</h2>
            <p className="panel-copy">{item.displayAmount}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="amount-match-panel">
            <div>
              <p className="eyebrow">Practical amount</p>
              <strong>{form.displayAmount || item.displayAmount}</strong>
            </div>

            <div className="product-form-grid">
              <label className="field-group">
                <span>Item name</span>
                <input
                  value={form.name}
                  onChange={(event) => patchForm('name', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Meal display amount</span>
                <input
                  value={form.displayAmount}
                  onChange={(event) =>
                    patchForm('displayAmount', event.target.value)
                  }
                  placeholder="3 slices bacon"
                />
              </label>
              <label className="field-group">
                <span>Target amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={(event) =>
                    patchForm('targetAmount', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Target unit</span>
                <input
                  value={form.targetUnit}
                  onChange={(event) =>
                    patchForm('targetUnit', event.target.value)
                  }
                  placeholder="slices"
                />
              </label>
              <label className="field-group">
                <span>Inventory used per day</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountPerUse}
                  onChange={(event) =>
                    patchForm('amountPerUse', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Inventory unit</span>
                <input
                  value={form.unit}
                  onChange={(event) => patchForm('unit', event.target.value)}
                  placeholder="slices"
                />
              </label>
              <label className="field-group">
                <span>Default starting amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.startingAmount}
                  onChange={(event) =>
                    patchForm('startingAmount', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Restock amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.restockAmount}
                  onChange={(event) =>
                    patchForm('restockAmount', event.target.value)
                  }
                />
              </label>
            </div>

            <label className="toggle-inline">
              <input
                type="checkbox"
                checked={form.trackInventory}
                onChange={(event) =>
                  patchForm('trackInventory', event.target.checked)
                }
              />
              <span>Track this in shopping and inventory</span>
            </label>
          </div>

          <div className="amount-match-panel">
            <div>
              <p className="eyebrow">Fallback macros</p>
              <strong>Used when no barcode product is linked</strong>
            </div>

            <div className="product-form-grid">
              <label className="field-group">
                <span>Calories</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.caloriesPerServing}
                  onChange={(event) =>
                    patchForm('caloriesPerServing', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Protein g</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.proteinPerServing}
                  onChange={(event) =>
                    patchForm('proteinPerServing', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Carbs g</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.carbsPerServing}
                  onChange={(event) =>
                    patchForm('carbsPerServing', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Fat g</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.fatPerServing}
                  onChange={(event) =>
                    patchForm('fatPerServing', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Fiber g</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.fiberPerServing}
                  onChange={(event) =>
                    patchForm('fiberPerServing', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Sugar g</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.sugarPerServing}
                  onChange={(event) =>
                    patchForm('sugarPerServing', event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="modal-actions">
            {hasOverride ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onReset(item)}
              >
                Reset item
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save meal item
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default MealItemEditorModal
