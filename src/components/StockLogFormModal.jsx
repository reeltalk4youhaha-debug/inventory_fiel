import { useState } from 'react'

const emptyForm = {
  product_id: '',
  action_type: 'Added',
  quantity_change: 1,
  notes: '',
  logged_at: '',
}

export function StockLogFormModal({ open, products, stockLog, defaultProductId, onClose, onSubmit }) {
  const [form, setForm] = useState(
    stockLog
      ? {
          product_id: stockLog.product_id,
          action_type: stockLog.action_type,
          quantity_change: stockLog.quantity_change,
          notes: stockLog.notes || '',
          logged_at: stockLog.logged_at.slice(0, 16),
        }
      : {
          ...emptyForm,
          product_id: defaultProductId || products[0]?.id || '',
          logged_at: new Date().toISOString().slice(0, 16),
        },
  )

  if (!open) return null

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: name === 'product_id' || name === 'quantity_change' ? Number(value) : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-cyan-500/40 bg-[#121212] p-6 shadow-[0_0_35px_rgba(34,211,238,0.16)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">{stockLog ? 'Update Stock Log' : 'Update Stock'}</h2>
          <button onClick={onClose} className="rounded-full border border-fuchsia-500/40 px-3 py-1 text-fuchsia-400">
            X
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <select name="product_id" value={form.product_id} onChange={handleChange} className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" required>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>

          <div className="grid gap-4 md:grid-cols-2">
            <select name="action_type" value={form.action_type} onChange={handleChange} className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none">
              <option>Added</option>
              <option>Adjusted</option>
              <option>Removed</option>
            </select>
            <input name="quantity_change" type="number" min="1" value={form.quantity_change} onChange={handleChange} className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" required />
          </div>

          <input name="logged_at" type="datetime-local" value={form.logged_at} onChange={handleChange} className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" required />
          <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Notes" rows="4" className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" />

          <div className="mt-2 flex justify-end gap-3">
            <button type="submit" className="rounded-lg border border-fuchsia-500/40 bg-violet-700/80 px-5 py-2 font-semibold text-white">
              {stockLog ? 'Save Log' : 'Add Log'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-cyan-500/40 px-5 py-2 font-semibold text-cyan-400">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
