import { useCallback, useMemo, useState } from 'react'
import BarcodeScanner from './BarcodeScanner'
import {
  calculateServingsNeeded,
  createManualProduct,
  createProductLink,
  formatProductAmount,
  getProductDisplayName,
  inferProductAmountForTarget,
  inferProductUnitForTarget,
  lookupOpenFoodFactsProduct,
  normalizeUnit,
  sanitizeProduct,
  searchOpenFoodFactsProducts,
} from '../utils/products'

function firstNutrient(product, item) {
  const [key, nutrient] = Object.entries(product?.nutrients ?? {})[0] ?? []

  if (nutrient) {
    return {
      key,
      label: nutrient.label,
      amount: nutrient.amount,
      unit: nutrient.unit,
    }
  }

  if (item?.thresholdGroup === 'supplement') {
    return {
      key: 'manualNutrient',
      label: item.name,
      amount: item.targetAmount ?? 0,
      unit: item.targetUnit ?? item.unit ?? 'unit',
    }
  }

  return {
    key: 'manualNutrient',
    label: '',
    amount: '',
    unit: '',
  }
}

function productToForm(item, product, link) {
  const targetAmount = link?.targetAmount ?? item.targetAmount ?? item.amountPerUse ?? 1
  const targetUnit = normalizeUnit(link?.targetUnit ?? item.targetUnit ?? item.unit) ?? 'serving'
  const inferredProductUnit = inferProductUnitForTarget(item, product, targetUnit)
  const linkedProductUnit = normalizeUnit(link?.productUnit)
  const productUnit = linkedProductUnit ?? inferredProductUnit
  const shouldRepairCountServing =
    product.source === 'open_food_facts' &&
    linkedProductUnit === normalizeUnit(product.servingUnit) &&
    normalizeUnit(targetUnit) === normalizeUnit(product.servingUnit) &&
    product.servingSize > 0
  const productAmountPerServing = shouldRepairCountServing
    ? product.servingSize
    : link?.productAmountPerServing ??
      inferProductAmountForTarget(item, product, targetUnit)
  const nutrient = firstNutrient(product, item)

  return {
    barcode: product.barcode ?? '',
    name: product.name ?? '',
    brand: product.brand ?? '',
    servingSize: product.servingSize ?? 1,
    servingUnit: product.servingUnit ?? 'serving',
    caloriesPerServing: product.caloriesPerServing ?? 0,
    proteinPerServing: product.proteinPerServing ?? 0,
    carbsPerServing: product.carbsPerServing ?? 0,
    fatPerServing: product.fatPerServing ?? 0,
    fiberPerServing: product.fiberPerServing ?? 0,
    sugarPerServing: product.sugarPerServing ?? 0,
    nutrientKey: nutrient.key,
    nutrientLabel: nutrient.label,
    nutrientAmount: nutrient.amount,
    nutrientUnit: nutrient.unit,
    targetAmount,
    targetUnit,
    productAmountPerServing,
    productUnit,
  }
}

function numberFromForm(value, fallback = 0) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return Math.max(0, parsedValue)
}

function ProductLinkModal({
  item,
  existingProduct,
  existingLink,
  currentInventoryAmount,
  onClose,
  onSave,
}) {
  const initialProduct = existingProduct ?? createManualProduct(item)
  const initialLink = existingLink ?? createProductLink(item, initialProduct)
  const initialInventoryAmount =
    currentInventoryAmount > 0 ? currentInventoryAmount : item.restockAmount

  const [sourceProduct, setSourceProduct] = useState(initialProduct)
  const [form, setForm] = useState(() =>
    productToForm(item, initialProduct, initialLink),
  )
  const [barcodeInput, setBarcodeInput] = useState(initialProduct.barcode ?? '')
  const [searchTerm, setSearchTerm] = useState(item.name)
  const [searchResults, setSearchResults] = useState([])
  const [lookupState, setLookupState] = useState('idle')
  const [message, setMessage] = useState(
    existingProduct ? 'Linked product loaded.' : '',
  )
  const [scannerActive, setScannerActive] = useState(false)
  const [markAsHave, setMarkAsHave] = useState(true)
  const [inventoryAmount, setInventoryAmount] = useState(initialInventoryAmount)

  const previewLink = useMemo(() => {
    if (!item || !sourceProduct || !form) {
      return null
    }

    return {
      ...createProductLink(item, sourceProduct, {
        targetAmount: form.targetAmount,
        targetUnit: form.targetUnit,
        productAmountPerServing: form.productAmountPerServing,
        productUnit: form.productUnit,
      }),
      servingsNeeded: calculateServingsNeeded({
        targetAmount: form.targetAmount,
        targetUnit: form.targetUnit,
        productAmountPerServing: form.productAmountPerServing,
        productUnit: form.productUnit,
      }),
    }
  }, [form, item, sourceProduct])

  const applyProductToForm = useCallback(
    (product) => {
      const nextLink = createProductLink(item, product)

      setSourceProduct(product)
      setForm(productToForm(item, product, nextLink))
      setBarcodeInput(product.barcode ?? '')
      setLookupState('success')
      setMessage(
        product.missingNutrition
          ? 'Product found, but nutrition is missing. Add the label values before linking.'
          : 'Product found. Review the values before linking.',
      )
    },
    [item],
  )

  const handleLookupBarcode = useCallback(
    async (barcode) => {
      setLookupState('loading')
      setMessage('Looking up product...')

      try {
        const product = await lookupOpenFoodFactsProduct(barcode)
        applyProductToForm(product)
      } catch (error) {
        setLookupState('error')
        setMessage(error.message || 'Product lookup failed.')
      }
    },
    [applyProductToForm],
  )

  const handleDetected = useCallback(
    (barcode) => {
      setScannerActive(false)
      setBarcodeInput(barcode)
      handleLookupBarcode(barcode)
    },
    [handleLookupBarcode],
  )

  const handleScannerError = useCallback((errorMessage) => {
    setMessage(errorMessage)
    setLookupState('error')
  }, [])

  async function handleSearch() {
    setLookupState('loading')
    setMessage('Searching products...')

    try {
      const products = await searchOpenFoodFactsProducts(searchTerm)
      setSearchResults(products)
      setLookupState(products.length ? 'success' : 'error')
      setMessage(
        products.length
          ? 'Choose the closest product from the results.'
          : 'No matching products found. Enter it manually.',
      )
    } catch (error) {
      setLookupState('error')
      setMessage(error.message || 'Search failed.')
    }
  }

  function handleManualEntry() {
    const product = createManualProduct(item)

    setSourceProduct(product)
    setForm(productToForm(item, product, createProductLink(item, product)))
    setLookupState('idle')
    setMessage('Manual product entry ready.')
    setScannerActive(false)
  }

  function patchForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nutrientAmount = numberFromForm(form.nutrientAmount)
    const nutrientLabel = `${form.nutrientLabel ?? ''}`.trim()
    const nutrients =
      nutrientAmount > 0 && nutrientLabel
        ? {
            [form.nutrientKey || 'manualNutrient']: {
              label: nutrientLabel,
              amount: nutrientAmount,
              unit: `${form.nutrientUnit ?? ''}`.trim() || 'unit',
            },
          }
        : {}
    const product = sanitizeProduct({
      ...sourceProduct,
      barcode: form.barcode,
      name: form.name,
      brand: form.brand,
      servingSize: form.servingSize,
      servingUnit: form.servingUnit,
      caloriesPerServing: form.caloriesPerServing,
      proteinPerServing: form.proteinPerServing,
      carbsPerServing: form.carbsPerServing,
      fatPerServing: form.fatPerServing,
      fiberPerServing: form.fiberPerServing,
      sugarPerServing: form.sugarPerServing,
      nutrients,
      source: sourceProduct?.source ?? 'manual',
    })
    const link = createProductLink(item, product, {
      targetAmount: form.targetAmount,
      targetUnit: form.targetUnit,
      productAmountPerServing: form.productAmountPerServing,
      productUnit: form.productUnit,
    })

    onSave({
      product,
      link,
      inventoryAmount: numberFromForm(inventoryAmount),
      markAsHave,
    })
  }

  if (!item || !form) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Product link</p>
            <h2 id="product-modal-title">{item.name}</h2>
            <p className="panel-copy">{item.displayAmount}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="scanner-actions">
          <div className="barcode-entry">
            <label className="field-group">
              <span>Barcode</span>
              <input
                inputMode="numeric"
                value={barcodeInput}
                onChange={(event) => {
                  setBarcodeInput(event.target.value)
                  patchForm('barcode', event.target.value)
                }}
                placeholder="Scan or enter barcode"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleLookupBarcode(barcodeInput)}
            >
              Lookup
            </button>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScannerActive((current) => !current)}
            >
              {scannerActive ? 'Stop camera' : 'Scan product'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleManualEntry}>
              Enter manually
            </button>
          </div>
        </div>

        {scannerActive ? (
          <BarcodeScanner
            active={scannerActive}
            onDetected={handleDetected}
            onError={handleScannerError}
          />
        ) : null}

        <div className={`lookup-message lookup-${lookupState}`}>
          {message || 'Scan a barcode, search, or enter the product manually.'}
        </div>

        <div className="manual-search-row">
          <label className="field-group">
            <span>Search product manually</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Greek yogurt, frozen vegetables..."
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={handleSearch}>
            Search
          </button>
        </div>

        {searchResults.length > 0 ? (
          <div className="product-results">
            {searchResults.map((product) => (
              <button
                type="button"
                className="product-result"
                key={product.id}
                onClick={() => applyProductToForm(product)}
              >
                <strong>{getProductDisplayName(product)}</strong>
                <span>
                  {formatProductAmount(product.caloriesPerServing)} cal · {product.servingText}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="product-form-grid">
            <label className="field-group">
              <span>Product name</span>
              <input
                value={form.name}
                onChange={(event) => patchForm('name', event.target.value)}
                required
              />
            </label>
            <label className="field-group">
              <span>Brand</span>
              <input
                value={form.brand}
                onChange={(event) => patchForm('brand', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span>Serving size</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.servingSize}
                onChange={(event) => patchForm('servingSize', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span>Serving unit</span>
              <input
                value={form.servingUnit}
                onChange={(event) => patchForm('servingUnit', event.target.value)}
              />
            </label>
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
                onChange={(event) => patchForm('fatPerServing', event.target.value)}
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
            <label className="field-group">
              <span>Nutrient label</span>
              <input
                value={form.nutrientLabel}
                onChange={(event) => patchForm('nutrientLabel', event.target.value)}
                placeholder="Vitamin D"
              />
            </label>
            <label className="field-group">
              <span>Nutrient amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.nutrientAmount}
                onChange={(event) => patchForm('nutrientAmount', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span>Nutrient unit</span>
              <input
                value={form.nutrientUnit}
                onChange={(event) => patchForm('nutrientUnit', event.target.value)}
                placeholder="IU"
              />
            </label>
          </div>

          <div className="amount-match-panel">
            <div>
              <p className="eyebrow">Amount match</p>
              <strong>
                {formatProductAmount(previewLink?.servingsNeeded ?? 1)} {form.servingUnit}
                /day
              </strong>
            </div>
            <div className="product-form-grid">
              <label className="field-group">
                <span>Target amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={(event) => patchForm('targetAmount', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Target unit</span>
                <input
                  value={form.targetUnit}
                  onChange={(event) => patchForm('targetUnit', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Product amount per serving</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.productAmountPerServing}
                  onChange={(event) =>
                    patchForm('productAmountPerServing', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Product unit</span>
                <input
                  value={form.productUnit}
                  onChange={(event) => patchForm('productUnit', event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="inventory-link-options">
            <label className="toggle-inline">
              <input
                type="checkbox"
                checked={markAsHave}
                onChange={(event) => setMarkAsHave(event.target.checked)}
              />
              <span>Mark this as bought / have</span>
            </label>
            <label className="field-group">
              <span>Current inventory amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={inventoryAmount}
                onChange={(event) => setInventoryAmount(event.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Link to this item
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ProductLinkModal
