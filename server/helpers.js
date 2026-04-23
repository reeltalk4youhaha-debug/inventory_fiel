export function normalizeStatus(quantity, expiryDate) {
  const qty = Number(quantity)

  if (qty <= 0) return 'Out of Stock'

  if (expiryDate) {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
    if (diffDays <= 30) return 'Expiring soon'
  }

  if (qty <= 50) return 'Low Stock'
  return 'In Stock'
}

export function stockDelta(actionType, quantityChange) {
  const qty = Number(quantityChange)
  if (actionType === 'Removed') return -qty
  return qty
}
