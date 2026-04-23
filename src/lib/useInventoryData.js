import { useCallback, useEffect, useMemo, useState } from 'react'
import { inventoryApi } from './api'
import { mockProducts, mockStockLogs, mockSuppliers } from './mockData'

function normalizeStatus(quantity, expiryDate) {
  if (quantity <= 0) return 'Out of Stock'
  if (expiryDate) {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
    if (diffDays <= 30) return 'Expiring soon'
  }
  if (quantity <= 50) return 'Low Stock'
  return 'In Stock'
}

function buildSummary(products, stockLogs) {
  return {
    totalProducts: products.length,
    inStock: products.filter((item) => item.status === 'In Stock').length,
    lowStock: products.filter((item) => item.status === 'Low Stock').length,
    expiringSoon: products.filter((item) => item.status === 'Expiring soon').length,
    totalUnits: products.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    totalMovements: stockLogs.length,
  }
}

function cloneMockProducts() {
  return mockProducts.map((item) => ({ ...item }))
}

function cloneMockLogs() {
  return mockStockLogs.map((item) => ({ ...item }))
}

function cloneMockSuppliers() {
  return mockSuppliers.map((item) => ({ ...item }))
}

function stockDelta(actionType, quantityChange) {
  const qty = Number(quantityChange)
  if (actionType === 'Removed') return -qty
  return qty
}

export function useInventoryData() {
  const [products, setProducts] = useState([])
  const [stockLogs, setStockLogs] = useState([])
  const [suppliers] = useState(cloneMockSuppliers())
  const [summary, setSummary] = useState(buildSummary([], []))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isMockMode, setIsMockMode] = useState(false)

  const refreshSummary = useCallback((nextProducts, nextLogs) => {
    setSummary(buildSummary(nextProducts, nextLogs))
  }, [])

  const loadLiveData = useCallback(async () => {
    const [productsResponse, stockLogsResponse, summaryResponse] = await Promise.all([
      inventoryApi.getProducts(),
      inventoryApi.getStockLogs(),
      inventoryApi.getDashboardSummary(),
    ])

    const nextProducts = productsResponse.products || []
    const nextLogs = stockLogsResponse.stockLogs || []
    setProducts(nextProducts)
    setStockLogs(nextLogs)
    setSummary(summaryResponse.summary || buildSummary(nextProducts, nextLogs))
    setError('')
    setIsMockMode(false)
  }, [])

  const loadMockData = useCallback(() => {
    const nextProducts = cloneMockProducts().map((item) => ({
      ...item,
      status: normalizeStatus(item.quantity, item.expiry_date),
    }))
    const nextLogs = cloneMockLogs()
    setProducts(nextProducts)
    setStockLogs(nextLogs)
    refreshSummary(nextProducts, nextLogs)
    setError('Using mock data until the backend is connected.')
    setIsMockMode(true)
  }, [refreshSummary])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      await loadLiveData()
    } catch {
      loadMockData()
    } finally {
      setLoading(false)
    }
  }, [loadLiveData, loadMockData])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  const productMap = useMemo(
    () =>
      products.reduce((acc, product) => {
        acc[product.id] = product
        return acc
      }, {}),
    [products],
  )

  const upsertLocalProduct = useCallback(
    (payload, existingId = null) => {
      const supplier =
        suppliers.find((item) => Number(item.id) === Number(payload.supplier_id)) || suppliers[0]
      const record = {
        id: existingId ?? Date.now(),
        product_name: payload.product_name,
        flavor: payload.flavor || '-',
        sku: payload.sku,
        quantity: Number(payload.quantity),
        unit_price: Number(payload.unit_price || 0),
        description: payload.description || '',
        expiry_date: payload.expiry_date || null,
        supplier_id: Number(payload.supplier_id),
        supplier_name: supplier?.supplier_name || 'Unassigned',
        status: normalizeStatus(payload.quantity, payload.expiry_date),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setProducts((current) => {
        const exists = current.some((item) => item.id === record.id)
        const next = exists
          ? current.map((item) => (item.id === record.id ? { ...item, ...record } : item))
          : [record, ...current]
        refreshSummary(next, stockLogs)
        return next
      })

      return record
    },
    [refreshSummary, stockLogs, suppliers],
  )

  const createProduct = useCallback(
    async (payload) => {
      if (isMockMode) {
        return upsertLocalProduct(payload)
      }

      const response = await inventoryApi.createProduct(payload)
      await refreshAll()
      return response.product
    },
    [isMockMode, refreshAll, upsertLocalProduct],
  )

  const updateProduct = useCallback(
    async (id, payload) => {
      if (isMockMode) {
        return upsertLocalProduct(payload, id)
      }

      const response = await inventoryApi.updateProduct(id, payload)
      await refreshAll()
      return response.product
    },
    [isMockMode, refreshAll, upsertLocalProduct],
  )

  const deleteProduct = useCallback(
    async (id) => {
      if (isMockMode) {
        setProducts((current) => {
          const nextProducts = current.filter((item) => item.id !== id)
          setStockLogs((currentLogs) => {
            const nextLogs = currentLogs.filter((log) => log.product_id !== id)
            refreshSummary(nextProducts, nextLogs)
            return nextLogs
          })
          return nextProducts
        })
        return
      }

      await inventoryApi.deleteProduct(id)
      await refreshAll()
    },
    [isMockMode, refreshAll, refreshSummary],
  )

  const mutateLocalLog = useCallback(
    (payload, existingLog = null) => {
      const product = productMap[payload.product_id]
      if (!product) {
        throw new Error('Product not found')
      }

      const nextLog = {
        id: existingLog?.id ?? Date.now(),
        product_id: Number(payload.product_id),
        product_name: product.product_name,
        action_type: payload.action_type,
        quantity_change: Number(payload.quantity_change),
        notes: payload.notes || '',
        logged_at: payload.logged_at || new Date().toISOString(),
      }

      const oldDelta = existingLog ? stockDelta(existingLog.action_type, existingLog.quantity_change) : 0
      const newDelta = stockDelta(nextLog.action_type, nextLog.quantity_change)

      const nextProducts = products.map((item) => {
        if (item.id !== nextLog.product_id) return item
        const nextQuantity = Number(item.quantity) - oldDelta + newDelta
        return {
          ...item,
          quantity: nextQuantity,
          status: normalizeStatus(nextQuantity, item.expiry_date),
          updated_at: new Date().toISOString(),
        }
      })

      const nextLogs = existingLog
        ? stockLogs.map((item) => (item.id === existingLog.id ? nextLog : item))
        : [nextLog, ...stockLogs]

      setProducts(nextProducts)
      setStockLogs(nextLogs)
      refreshSummary(nextProducts, nextLogs)
      return nextLog
    },
    [productMap, products, refreshSummary, stockLogs],
  )

  const createStockLog = useCallback(
    async (payload) => {
      if (isMockMode) {
        return mutateLocalLog(payload)
      }

      const response = await inventoryApi.createStockLog(payload)
      await refreshAll()
      return response.stockLog
    },
    [isMockMode, mutateLocalLog, refreshAll],
  )

  const updateStockLog = useCallback(
    async (id, payload) => {
      if (isMockMode) {
        const existing = stockLogs.find((item) => item.id === id)
        return mutateLocalLog(payload, existing)
      }

      const response = await inventoryApi.updateStockLog(id, payload)
      await refreshAll()
      return response.stockLog
    },
    [isMockMode, mutateLocalLog, refreshAll, stockLogs],
  )

  const deleteStockLog = useCallback(
    async (id) => {
      if (isMockMode) {
        const existing = stockLogs.find((item) => item.id === id)
        if (!existing) return

        const nextLogs = stockLogs.filter((item) => item.id !== id)
        const delta = stockDelta(existing.action_type, existing.quantity_change)
        const nextProducts = products.map((item) =>
          item.id === existing.product_id
            ? {
                ...item,
                quantity: Number(item.quantity) - delta,
                status: normalizeStatus(Number(item.quantity) - delta, item.expiry_date),
              }
            : item,
        )

        setProducts(nextProducts)
        setStockLogs(nextLogs)
        refreshSummary(nextProducts, nextLogs)
        return
      }

      await inventoryApi.deleteStockLog(id)
      await refreshAll()
    },
    [isMockMode, products, refreshAll, refreshSummary, stockLogs],
  )

  const getProductDetails = useCallback(
    async (id) => {
      if (isMockMode) {
        const product = products.find((item) => Number(item.id) === Number(id))
        return {
          product,
          stockLogs: stockLogs.filter((item) => Number(item.product_id) === Number(id)),
        }
      }

      return inventoryApi.getProduct(id)
    },
    [isMockMode, products, stockLogs],
  )

  return {
    products,
    stockLogs,
    suppliers,
    summary,
    loading,
    error,
    isMockMode,
    refreshAll,
    createProduct,
    updateProduct,
    deleteProduct,
    createStockLog,
    updateStockLog,
    deleteStockLog,
    getProductDetails,
  }
}
