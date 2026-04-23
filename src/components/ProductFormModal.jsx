import { useState } from 'react'

const emptyForm = {
  product_name: '',
  flavor: '',
  sku: '',
  quantity: 0,
  unit_price: 0,
  supplier_id: 1,
  expiry_date: '',
  description: '',
}

export function ProductFormModal({ open, product, suppliers, onClose, onSubmit }) {
  const [form, setForm] = useState(
    product
      ? {
          product_name: product.product_name,
          flavor: product.flavor === '-' ? '' : product.flavor,
          sku: product.sku,
          quantity: product.quantity,
          unit_price: product.unit_price || 0,
          supplier_id: product.supplier_id || suppliers[0]?.id || 1,
          expiry_date: product.expiry_date ? product.expiry_date.slice(0, 10) : '',
          description: product.description || '',
        }
      : {
          ...emptyForm,
          supplier_id: suppliers[0]?.id || 1,
        },
  )

  if (!open) return null

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: name === 'quantity' || name === 'unit_price' || name === 'supplier_id' ? Number(value) : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-fuchsia-500/40 bg-[#121212] p-6 shadow-[0_0_35px_rgba(168,85,247,0.2)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">{product ? 'Update product' : 'Add new product'}</h2>
          <button onClick={onClose} className="rounded-full border border-cyan-500/40 px-3 py-1 text-cyan-400">
            X
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <input name="product_name" value={form.product_name} onChange={handleChange} placeholder="Product Name" className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" required />
          <input name="flavor" value={form.flavor} onChange={handleChange} placeholder="Flavor" className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" />
          <input name="sku" value={form.sku} onChange={handleChange} placeholder="Storage keeping unit" className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" required />
          <input name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange} placeholder="Quantity" className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" required />
          <input name="unit_price" type="number" min="0" value={form.unit_price} onChange={handleChange} placeholder="Unit Price" className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" />
          <input name="expiry_date" type="date" value={form.expiry_date} onChange={handleChange} className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none" />
          <select name="supplier_id" value={form.supplier_id} onChange={handleChange} className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none md:col-span-2">
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_name}
              </option>
            ))}
          </select>
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" rows="4" className="rounded-xl border border-cyan-500/30 bg-black/60 px-4 py-3 outline-none md:col-span-2" />

          <div className="mt-2 flex justify-end gap-3 md:col-span-2">
            <button type="submit" className="rounded-lg border border-fuchsia-500/40 bg-violet-700/80 px-5 py-2 font-semibold text-white">
              {product ? 'Save Product' : 'Add Product'}
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
