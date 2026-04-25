import { useEffect, useState } from 'react'
import { clearSessionToken, getSessionToken, inventoryApi, persistSessionToken } from './lib/api'
import vaporLogo from './images/Vapor.png'

const navigationItems = ['Dashboard', 'Inventory', 'Reports', 'Profile']
const navigationIconPaths = {
  Dashboard:
    'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-11h6V4h-6v5Z',
  Inventory:
    'M12 2 4 6.5v11L12 22l8-4.5v-11L12 2Zm0 2.3 5.4 3.05L12 10.4 6.6 7.35 12 4.3Zm-6 4.8 5 2.82v6.86l-5-2.82V9.1Zm12 0v6.86l-5 2.82v-6.86l5-2.82Z',
  Reports:
    'M5 19V5h14v14H5Zm3-3h2V9H8v7Zm4 0h2v-4h-2v4Zm4 0h2v-8h-2v8Z',
  Profile:
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z',
}
const columns = ['Product', 'Flavor', 'SKU', 'Quantity', 'Description', 'Updates', 'Actions']
const PAGE_SIZE = 10
const SESSION_STORAGE_KEY = 'vapor-hq-session'
const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1280
const MAX_IMAGE_DATA_URL_LENGTH = 2_000_000

const emptyProductForm = {
  name: '',
  flavor: '',
  sku: '',
  description: '',
  items: '',
  imageUrl: '',
  imageName: '',
}

const emptySignInForm = {
  email: '',
  password: '',
}

function getStoredSession() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.localStorage.getItem(SESSION_STORAGE_KEY) === 'active' || Boolean(getSessionToken())
  )
}

function readFileAsDataUrlRaw(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read image file.'))

    reader.readAsDataURL(file)
  })
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to process image file.'))
    image.src = source
  })
}

async function readFileAsDataUrl(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Select a valid image file.')
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('Use an image smaller than 5 MB.')
  }

  const sourceDataUrl = await readFileAsDataUrlRaw(file)
  const image = await loadImageElement(sourceDataUrl)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (!sourceWidth || !sourceHeight) {
    return sourceDataUrl
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to process image file.')
  }

  context.drawImage(image, 0, 0, width, height)

  let optimizedDataUrl =
    file.type === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/webp', 0.82)

  if (optimizedDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.76)
  }

  if (optimizedDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error('Image is too large to upload. Use a smaller image.')
  }

  return optimizedDataUrl
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'VH'
}

function formatItemCount(value) {
  const amount = Number(value || 0)
  return `${amount} ${amount === 1 ? 'item' : 'items'}`
}

function normalizeProduct(product) {
  if (!product || typeof product !== 'object') {
    return null
  }

  if (product.id === undefined || product.id === null) {
    return null
  }

  return {
    id: product.id,
    name: String(product.name ?? '').trim() || 'Untitled product',
    flavor: String(product.flavor ?? '').trim(),
    sku: String(product.sku ?? '').trim(),
    description: String(product.description ?? '').trim(),
    items: Number(product.items ?? 0),
    updates: String(product.updates ?? '').trim() || 'Recently added product',
    imageUrl: String(product.imageUrl ?? '').trim(),
    createdAt: product.createdAt ?? null,
    updatedAt: product.updatedAt ?? null,
  }
}

function normalizeProductList(products) {
  if (!Array.isArray(products)) {
    return []
  }

  return products.map(normalizeProduct).filter(Boolean)
}

function buildUpdateMessage({ previousProduct, nextValues, mode }) {
  if (mode === 'add') {
    return 'Recently added product'
  }

  if (!previousProduct) {
    return 'Product updated'
  }

  const updates = []
  const nextItems = Number(nextValues.items || 0)
  const previousItems = Number(previousProduct.items || 0)
  const itemDelta = nextItems - previousItems

  if (itemDelta !== 0) {
    updates.push(
      `${itemDelta > 0 ? '+' : ''}${itemDelta} ${
        Math.abs(itemDelta) === 1 ? 'item' : 'items'
      } updated`,
    )
  }

  if (previousProduct.description.trim() !== nextValues.description.trim()) {
    updates.push('Description updated')
  }

  const previousImage = previousProduct.imageUrl.trim()
  const nextImage = nextValues.imageUrl.trim()

  if (previousImage && !nextImage) {
    updates.push('Image deleted')
  } else if (!previousImage && nextImage) {
    updates.push('Image added')
  } else if (previousImage !== nextImage) {
    updates.push('Image updated')
  }

  const detailsChanged =
    previousProduct.name.trim() !== nextValues.name.trim() ||
    previousProduct.flavor.trim() !== nextValues.flavor.trim() ||
    previousProduct.sku.trim() !== nextValues.sku.trim()

  if (!updates.length && detailsChanged) {
    updates.push('Product details updated')
  }

  if (!updates.length) {
    updates.push(previousProduct.updates || 'No recent changes')
  }

  return updates.slice(0, 2).join(' / ')
}

function filterProducts(products, searchQuery) {
  const keyword = searchQuery.trim().toLowerCase()

  if (!keyword) {
    return products
  }

  return products.filter((product) =>
    [
      product.name,
      product.flavor,
      product.sku,
      product.description,
      product.updates,
      String(product.items),
      formatItemCount(product.items),
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword),
  )
}

function getStockStatus(items) {
  const quantity = Number(items || 0)
  if (quantity <= 0) return 'Out of Stock'
  if (quantity <= 20) return 'Low Stock'
  return 'Healthy'
}

function getTotalPages(totalItems) {
  return Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
}

function paginateProducts(products, page) {
  const startIndex = (page - 1) * PAGE_SIZE
  return products.slice(startIndex, startIndex + PAGE_SIZE)
}

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [products, setProducts] = useState([])
  const [editor, setEditor] = useState({ open: false, mode: 'add', productId: null })
  const [formValues, setFormValues] = useState(emptyProductForm)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageByView, setPageByView] = useState({ Dashboard: 1, Inventory: 1 })
  const [account, setAccount] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(getStoredSession)
  const [isAuthLoading, setIsAuthLoading] = useState(getStoredSession)
  const [isProductsLoading, setIsProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [signInForm, setSignInForm] = useState(emptySignInForm)
  const [signInError, setSignInError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (isAuthenticated) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'active')
      return
    }

    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAuthLoading(false)
      setAccount(null)
      setProducts([])
      return
    }

    let isCancelled = false

    async function bootstrap() {
      setIsAuthLoading(true)
      setIsProductsLoading(true)

      try {
        const [profileResponse, productsResponse] = await Promise.all([
          inventoryApi.getProfile(),
          inventoryApi.getProducts(),
        ])

        if (isCancelled) return

        setAccount(profileResponse.user)
        setProducts(normalizeProductList(productsResponse.products))
        setProductsError('')
      } catch {
        if (isCancelled) return

        clearSessionToken()
        setIsAuthenticated(false)
        setSignInError('Unable to restore your session. Please sign in again.')
        setProductsError('')
      }

      if (!isCancelled) {
        setIsAuthLoading(false)
        setIsProductsLoading(false)
      }
    }

    bootstrap()

    return () => {
      isCancelled = true
    }
  }, [isAuthenticated])

  const normalizedProducts = normalizeProductList(products)
  const filteredProducts = filterProducts(normalizedProducts, searchQuery)
  const dashboardTotalPages = getTotalPages(filteredProducts.length)
  const inventoryTotalPages = getTotalPages(filteredProducts.length)
  const dashboardPage = Math.min(pageByView.Dashboard, dashboardTotalPages)
  const inventoryPage = Math.min(pageByView.Inventory, inventoryTotalPages)
  const dashboardProducts = paginateProducts(filteredProducts, dashboardPage)
  const inventoryProducts = paginateProducts(filteredProducts, inventoryPage)

  const refreshProducts = async () => {
    const productsResponse = await inventoryApi.getProducts()
    const nextProducts = normalizeProductList(productsResponse.products)
    setProducts(nextProducts)
    return nextProducts
  }

  const closeEditor = () => {
    setEditor({ open: false, mode: 'add', productId: null })
    setFormValues(emptyProductForm)
    setIsImageLoading(false)
    setIsSavingProduct(false)
  }

  const openAddModal = () => {
    setEditor({ open: true, mode: 'add', productId: null })
    setFormValues(emptyProductForm)
    setIsImageLoading(false)
    setProductsError('')
  }

  const openEditModal = (product) => {
    setEditor({ open: true, mode: 'edit', productId: product.id })
    setFormValues({
      name: product.name,
      flavor: product.flavor,
      sku: product.sku,
      description: product.description,
      items: String(product.items),
      imageUrl: product.imageUrl,
      imageName: product.imageUrl ? `${product.name} image` : '',
    })
    setIsImageLoading(false)
    setProductsError('')
  }

  const closeOverlays = () => {
    setDeleteTarget(null)
    setViewTarget(null)
    closeEditor()
  }

  const handleNavigate = (page) => {
    setActivePage(page)
    closeOverlays()
  }

  const handleProductFieldChange = (field, value) => {
    setProductsError('')
    setFormValues((current) => ({ ...current, [field]: value }))
  }

  const handleImageSelect = async (file) => {
    if (!file) return

    setIsImageLoading(true)

    try {
      const imageUrl = await readFileAsDataUrl(file)

      setFormValues((current) => ({
        ...current,
        imageUrl,
        imageName: file.name,
      }))
      setProductsError('')
    } catch (error) {
      setProductsError(error.message)
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleImageRemove = () => {
    setProductsError('')
    setFormValues((current) => ({
      ...current,
      imageUrl: '',
      imageName: '',
    }))
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    setPageByView({ Dashboard: 1, Inventory: 1 })
  }

  const handlePageChange = (pageName, nextPage) => {
    setPageByView((current) => ({
      ...current,
      [pageName]: Math.max(1, nextPage),
    }))
  }

  const handleProductSubmit = async (event) => {
    event.preventDefault()

    if (isImageLoading || isSavingProduct) {
      return
    }

    const previousProduct =
      editor.mode === 'edit'
        ? normalizedProducts.find((product) => product.id === editor.productId) ?? null
        : null

    const payload = {
      name: formValues.name.trim(),
      flavor: formValues.flavor.trim(),
      sku: formValues.sku.trim(),
      description: formValues.description.trim(),
      items: Number(formValues.items),
      imageUrl: formValues.imageUrl.trim(),
      updates: buildUpdateMessage({ previousProduct, nextValues: formValues, mode: editor.mode }),
    }

    if (!payload.name || !payload.flavor || !payload.sku || !payload.description) {
      setProductsError('Complete all product fields before saving.')
      return
    }

    if (!Number.isFinite(payload.items) || payload.items < 0) {
      setProductsError('Quantity must be zero or more.')
      return
    }

    setIsSavingProduct(true)

    try {
      if (editor.mode === 'edit') {
        await inventoryApi.updateProduct(editor.productId, payload)
      } else {
        await inventoryApi.createProduct(payload)
      }

      await refreshProducts()
      setProductsError('')
      closeEditor()
    } catch (error) {
      setProductsError(error.message)
      setIsSavingProduct(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      await inventoryApi.deleteProduct(deleteTarget.id)
      await refreshProducts()
      setProductsError('')
      setDeleteTarget(null)
    } catch (error) {
      setProductsError(error.message)
    }
  }

  const handleSignInFieldChange = (field, value) => {
    setSignInForm((current) => ({ ...current, [field]: value }))
    setSignInError('')
  }

  const handleSignIn = async (event) => {
    event.preventDefault()

    try {
      const response = await inventoryApi.login(signInForm)
      persistSessionToken(response.token || '')
      setAccount(response.user)
      setSignInForm(emptySignInForm)
      setSignInError('')
      setIsAuthenticated(true)
      setActivePage('Dashboard')
    } catch (error) {
      setSignInError(error.message)
    }
  }

  const handleSignOut = () => {
    clearSessionToken()
    setIsAuthenticated(false)
    setAccount(null)
    setProducts([])
    setProductsError('')
    setSearchQuery('')
    setPageByView({ Dashboard: 1, Inventory: 1 })
    setActivePage('Dashboard')
    closeOverlays()
  }

  const handleProfileSave = async ({ name }) => {
    const response = await inventoryApi.updateProfile({
      name,
    })

    setAccount(response.user)
    return { ok: true, message: 'Username updated successfully.' }
  }

  const handlePasswordSave = async ({ currentPassword, nextPassword }) => {
    await inventoryApi.updatePassword({
      currentPassword,
      nextPassword,
    })

    return { ok: true, message: 'Password updated successfully.' }
  }

  const renderPage = () => {
    if (activePage === 'Inventory') {
      return (
        <CatalogPanel
          eyebrow="Inventory"
          title="Manage Products"
          description="Create, update, and delete inventory items stored in your PostgreSQL database."
          products={inventoryProducts}
          totalCount={normalizedProducts.length}
          filteredCount={filteredProducts.length}
          currentPage={inventoryPage}
          totalPages={inventoryTotalPages}
          isLoading={isProductsLoading}
          errorMessage={productsError}
          onPreviousPage={() => handlePageChange('Inventory', inventoryPage - 1)}
          onNextPage={() => handlePageChange('Inventory', inventoryPage + 1)}
          manageMode
          actions={
            <button type="button" className="primary-button" onClick={openAddModal}>
              Add Product
            </button>
          }
          onEdit={openEditModal}
          onDelete={setDeleteTarget}
        />
      )
    }

    if (activePage === 'Reports') {
      return <ReportsPanel products={normalizedProducts} />
    }

    if (activePage === 'Profile') {
      if (!account) {
        return (
          <section className="inventory-panel" aria-label="Profile">
            <div className="panel-toolbar">
              <div className="panel-copy">
                <p className="panel-kicker">Profile</p>
                <h1 className="panel-title">Account Settings</h1>
                <p className="panel-description">Loading your account settings...</p>
              </div>
            </div>
          </section>
        )
      }

      return (
        <ProfilePanel
          key={`${account.id}-${account.name}`}
          account={account}
          onProfileSave={handleProfileSave}
          onPasswordSave={handlePasswordSave}
          onSignOut={handleSignOut}
        />
      )
    }

    return (
      <CatalogPanel
        eyebrow="Dashboard"
        title="Product Overview"
        description="This dashboard reflects the latest product records stored in your PostgreSQL inventory database."
        products={dashboardProducts}
        totalCount={normalizedProducts.length}
        filteredCount={filteredProducts.length}
        currentPage={dashboardPage}
        totalPages={dashboardTotalPages}
        isLoading={isProductsLoading}
        errorMessage={productsError}
        onPreviousPage={() => handlePageChange('Dashboard', dashboardPage - 1)}
        onNextPage={() => handlePageChange('Dashboard', dashboardPage + 1)}
        displayMode="shop"
        onView={setViewTarget}
      />
    )
  }

  if (isAuthLoading) {
    return <LoadingScreen message="Loading your workspace..." />
  }

  if (!isAuthenticated) {
    return (
      <SignInScreen
        formValues={signInForm}
        error={signInError}
        onChange={handleSignInFieldChange}
        onSubmit={handleSignIn}
      />
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />

          <div className="topbar-actions">
            {activePage === 'Dashboard' || activePage === 'Inventory' ? (
              <SearchField
                className="topbar-search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search inventory..."
                label="Search products"
              />
            ) : null}

            <nav className="nav-tabs" aria-label="Primary navigation">
              {navigationItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === activePage ? 'nav-button is-active' : 'nav-button'}
                  onClick={() => handleNavigate(item)}
                >
                  <NavIcon name={item} />
                  {item}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <section className="page-wrap">{renderPage()}</section>

      {editor.open ? (
        <ProductModal
          mode={editor.mode}
          formValues={formValues}
          onChange={handleProductFieldChange}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          onClose={closeEditor}
          onSubmit={handleProductSubmit}
          isImageLoading={isImageLoading}
          isSaving={isSavingProduct}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          product={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {viewTarget ? <ProductDetailsModal product={viewTarget} onClose={() => setViewTarget(null)} /> : null}
    </main>
  )
}

function NavIcon({ name }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={navigationIconPaths[name]} />
    </svg>
  )
}

function SearchField({ value, onChange, placeholder, label, className = '' }) {
  return (
    <label className={`search-field ${className}`.trim()}>
      <span className="search-label">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function LoadingScreen({ message }) {
  return (
    <main className="auth-shell auth-shell-loading">
      <section className="auth-card auth-card-loading">
        <div className="auth-copy">
          <p className="panel-kicker">Loading</p>
          <h1 className="auth-title">Connecting to Inventory HQ</h1>
          <p className="auth-description">{message}</p>
        </div>
      </section>
    </main>
  )
}

function Brand({ auth = false }) {
  return (
    <div className={auth ? 'brand brand-auth' : 'brand'}>
      <img
        className={auth ? 'brand-logo brand-logo-auth' : 'brand-logo'}
        src={vaporLogo}
        alt="Vapor HQ"
      />
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, showPassword, onToggle, required = true }) {
  return (
    <div className="password-input-wrap">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
      <button type="button" className="password-visibility-toggle" onClick={onToggle}>
        {showPassword ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

function SignInScreen({ formValues, error, onChange, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-copy">
          <Brand auth />
          <p className="panel-kicker">Secure Access</p>
          <h1 className="auth-title">Sign in to Vapor HQ</h1>
          <p className="auth-description">
            Sign in with your PostgreSQL-backed admin account to manage products, reports, and profile settings.
          </p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="form-field">
            Email
            <input
              type="email"
              value={formValues.email}
              onChange={(event) => onChange('email', event.target.value)}
              placeholder="Enter your email"
              required
            />
          </label>

          <label className="form-field">
            Password
            <PasswordInput
              value={formValues.password}
              onChange={(event) => onChange('password', event.target.value)}
              placeholder="Enter your password"
              showPassword={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />
          </label>

          {error ? <p className="form-feedback form-feedback-error">{error}</p> : null}

          <button type="submit" className="primary-button auth-submit">
            Sign In
          </button>
        </form>
      </section>
    </main>
  )
}

function CatalogPanel({
  eyebrow,
  title,
  description,
  products,
  totalCount,
  filteredCount,
  currentPage,
  totalPages,
  isLoading,
  errorMessage,
  onPreviousPage,
  onNextPage,
  summaryCards = null,
  actions = null,
  manageMode = false,
  displayMode = 'table',
  onEdit = null,
  onDelete = null,
  onView = null,
}) {
  const hasProducts = products.length > 0
  const showPagination = Boolean(filteredCount) && !isLoading

  return (
    <section className="inventory-panel" aria-label={title}>
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">{eyebrow}</p>
          <h1 className="panel-title">{title}</h1>
          <p className="panel-description">{description}</p>
        </div>
        {actions ? (
          <div className="panel-utility">
            <div className="panel-actions">{actions}</div>
          </div>
        ) : null}
      </div>

      {errorMessage ? <p className="panel-status panel-status-error">{errorMessage}</p> : null}

      {summaryCards?.length ? (
        <section className="dashboard-summary-grid" aria-label="Dashboard product summary">
          {summaryCards.map((card) => (
            <article key={card.label} className="dashboard-summary-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>
      ) : null}

      {displayMode === 'shop' ? (
        <div className="shop-product-area">
          {isLoading ? (
            <ProductEmptyState loading />
          ) : hasProducts ? (
            <div className="shop-product-grid">
              {products.map((product) => (
                <ProductShopCard key={product.id} product={product} onView={onView} />
              ))}
            </div>
          ) : (
            <ProductEmptyState totalCount={totalCount} />
          )}
        </div>
      ) : (
        <InventoryTable
          products={products}
          totalCount={totalCount}
          isLoading={isLoading}
          manageMode={manageMode}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      )}

      {showPagination ? (
        <div className="table-footer">
          <span className="pagination-status">
            Page {currentPage} of {totalPages}
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              className="pagination-button"
              onClick={onPreviousPage}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <button
              type="button"
              className="pagination-button"
              onClick={onNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ProductEmptyState({ loading = false, totalCount = 0 }) {
  if (loading) {
    return (
      <div className="empty-state">
        <strong>Loading products from the database...</strong>
        <p>Your latest inventory records are being fetched.</p>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <strong>{totalCount ? 'No matching products found.' : 'No products in the database yet.'}</strong>
      <p>
        {totalCount
          ? 'Try a different search term or clear the search field.'
          : 'Use the Inventory page to add your first product.'}
      </p>
    </div>
  )
}

function InventoryTable({ products, totalCount, isLoading, manageMode, onEdit, onDelete, onView }) {
  return (
    <div className="inventory-grid">
      <div className="inventory-header" role="row">
        {columns.map((column) => (
          <div key={column} className="inventory-heading" role="columnheader">
            {column}
          </div>
        ))}
      </div>

      {isLoading ? (
        <ProductEmptyState loading />
      ) : products.length ? (
        <div className="inventory-body">
          {products.map((product) => (
            <article key={product.id} className="inventory-row" role="row">
              <div className="inventory-cell product-cell" role="cell">
                <ProductImage name={product.name} imageUrl={product.imageUrl} />
                <div className="product-meta">
                  <strong>{product.name}</strong>
                  <span>{manageMode ? 'Saved in inventory database' : 'Database snapshot'}</span>
                </div>
              </div>
              <div className="inventory-cell" role="cell">
                {product.flavor}
              </div>
              <div className="inventory-cell" role="cell">
                {product.sku}
              </div>
              <div className="inventory-cell quantity-cell" role="cell">
                {formatItemCount(product.items)}
              </div>
              <div className="inventory-cell description-cell" role="cell">
                {product.description}
              </div>
              <div className="inventory-cell updates-cell" role="cell">
                {product.updates}
              </div>
              <div className="inventory-cell" role="cell">
                {manageMode ? (
                  <div className="action-group">
                    <button type="button" className="inline-button" onClick={() => onEdit(product)}>
                      Update
                    </button>
                    <button
                      type="button"
                      className="inline-button inline-button-danger"
                      onClick={() => onDelete(product)}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <button type="button" className="inline-button" onClick={() => onView(product)}>
                    View
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ProductEmptyState totalCount={totalCount} />
      )}
    </div>
  )
}

function ProductShopCard({ product, onView }) {
  const status = getStockStatus(product.items)
  const shouldShowStatus = status !== 'Healthy'

  return (
    <article className="shop-product-card">
      <div className="shop-product-media">
        <ProductImage name={product.name} imageUrl={product.imageUrl} />
      </div>
      <div className="shop-product-copy">
        <div>
          <p className="shop-product-flavor">{product.flavor}</p>
          <h2 className="shop-product-name">{product.name}</h2>
        </div>
        <p className="shop-product-description">{product.description}</p>
        <div className="shop-product-meta">
          <span>{product.sku}</span>
          <strong>{formatItemCount(product.items)}</strong>
        </div>
        <div className="shop-product-actions">
          {shouldShowStatus ? (
            <span className={`stock-pill stock-pill-${status.toLowerCase().replace(/\s+/g, '-')}`}>
              {status}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          <button type="button" className="inline-button" onClick={() => onView(product)}>
            View
          </button>
        </div>
      </div>
    </article>
  )
}

function ReportsPanel({ products }) {
  const totalProducts = products.length
  const totalStock = products.reduce((sum, product) => sum + Number(product.items || 0), 0)
  const averageStock = totalProducts ? Math.round(totalStock / totalProducts) : 0
  const lowStockProducts = products.filter((product) => getStockStatus(product.items) === 'Low Stock')
  const outOfStockProducts = products.filter((product) => getStockStatus(product.items) === 'Out of Stock')
  const alertProducts = [...outOfStockProducts, ...lowStockProducts]
  const recentlyAddedProducts = products.filter((product) =>
    product.updates.toLowerCase().includes('recently added'),
  )
  const highestStockProducts = [...products].sort((left, right) => right.items - left.items).slice(0, 5)
  const latestActivity = [...products].slice(0, 5)
  const maxStock = Math.max(...highestStockProducts.map((product) => Number(product.items || 0)), 1)

  return (
    <section className="reports-page" aria-label="Reports">
      <div className="reports-hero">
        <div>
          <p className="panel-kicker">Reports</p>
          <h1 className="reports-title">Inventory Intelligence</h1>
          <p className="reports-description">
            Review stock health, recent changes, and product movement from the current database records.
          </p>
        </div>
        <div className="reports-hero-metric">
          <span>Total Stock</span>
          <strong>{formatItemCount(totalStock)}</strong>
          <small>{totalProducts} products tracked</small>
        </div>
      </div>

      <section className="reports-kpi-strip" aria-label="Report summary">
        <article>
          <span>Average Quantity</span>
          <strong>{formatItemCount(averageStock)}</strong>
        </article>
        <article>
          <span>Low Stock</span>
          <strong>{lowStockProducts.length}</strong>
        </article>
        <article>
          <span>Out Of Stock</span>
          <strong>{outOfStockProducts.length}</strong>
        </article>
        <article>
          <span>Recently Added</span>
          <strong>{recentlyAddedProducts.length}</strong>
        </article>
      </section>

      <section className="reports-grid">
        <article className="reports-panel reports-panel-wide">
          <div className="reports-section-heading">
            <span>Stock Ranking</span>
            <h2>Highest Quantity Products</h2>
          </div>
          <div className="stock-bars">
            {highestStockProducts.length ? (
              highestStockProducts.map((product) => (
                <div key={product.id} className="stock-bar-row">
                  <div className="stock-bar-label">
                    <strong>{product.name}</strong>
                    <span>
                      {product.sku} / {product.flavor}
                    </span>
                  </div>
                  <div className="stock-bar-track" aria-hidden="true">
                    <span style={{ width: `${Math.max(8, (Number(product.items || 0) / maxStock) * 100)}%` }} />
                  </div>
                  <strong>{formatItemCount(product.items)}</strong>
                </div>
              ))
            ) : (
              <p className="report-empty">No products available yet.</p>
            )}
          </div>
        </article>

        <article className="reports-panel reports-alert-panel">
          <div className="reports-section-heading">
            <span>Attention</span>
            <h2>Stock Alerts</h2>
          </div>
          <div className="alert-list">
            {alertProducts.length ? (
              alertProducts.map((product) => {
                const status = getStockStatus(product.items)

                return (
                  <div key={product.id} className="alert-row">
                    <span className={`stock-pill stock-pill-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {status}
                    </span>
                    <strong>{product.name}</strong>
                    <small>{formatItemCount(product.items)}</small>
                  </div>
                )
              })
            ) : (
              <p className="report-empty">No critical stock alerts right now.</p>
            )}
          </div>
        </article>

        <article className="reports-panel reports-panel-wide">
          <div className="reports-section-heading">
            <span>Activity</span>
            <h2>Recent Product Updates</h2>
          </div>
          <div className="activity-timeline">
            {latestActivity.length ? (
              latestActivity.map((product) => (
                <div key={product.id} className="activity-row">
                  <span className="activity-dot" aria-hidden="true" />
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.updates}</span>
                  </div>
                  <small>{formatItemCount(product.items)}</small>
                </div>
              ))
            ) : (
              <p className="report-empty">No product activity yet.</p>
            )}
          </div>
        </article>
      </section>
    </section>
  )
}

function ProfilePanel({ account, onProfileSave, onPasswordSave, onSignOut }) {
  const [profileForm, setProfileForm] = useState({
    name: account.name,
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  })
  const [profileFeedback, setProfileFeedback] = useState(null)
  const [passwordFeedback, setPasswordFeedback] = useState(null)
  const [passwordVisibility, setPasswordVisibility] = useState({
    passwordCurrent: false,
    passwordNext: false,
    passwordConfirm: false,
  })

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }))
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()

    if (!profileForm.name.trim()) {
      setProfileFeedback({ tone: 'error', message: 'Enter a username before saving.' })
      return
    }

    try {
      const result = await onProfileSave(profileForm)
      setProfileFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })
    } catch (error) {
      setProfileFeedback({ tone: 'error', message: error.message })
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()

    if (!passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: 'error', message: 'Complete all password fields before saving.' })
      return
    }

    if (passwordForm.nextPassword.length < 4) {
      setPasswordFeedback({ tone: 'error', message: 'Use at least 4 characters for the new password.' })
      return
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    try {
      const result = await onPasswordSave(passwordForm)
      setPasswordFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })

      if (result.ok) {
        setPasswordForm({
          currentPassword: '',
          nextPassword: '',
          confirmPassword: '',
        })
      }
    } catch (error) {
      setPasswordFeedback({ tone: 'error', message: error.message })
    }
  }

  return (
    <section className="inventory-panel" aria-label="Profile">
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">Profile</p>
          <h1 className="panel-title">Account Settings</h1>
          <p className="panel-description">
            Keep things simple here: update your username and password for the admin account.
          </p>
        </div>
      </div>

      <section className="profile-grid">
        <article className="profile-card profile-card--account">
          <div className="profile-account-heading">
            <div className="profile-avatar">{getInitials(account.name)}</div>
            <div className="profile-identity">
              <h2>{account.name}</h2>
              <p>{account.email}</p>
            </div>
          </div>
          <p className="report-empty">Signed in as the active admin for this inventory workspace.</p>
          <div className="profile-form-actions">
            <button type="button" className="secondary-button" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        </article>

        <article className="profile-card">
          <div className="report-card-header">
            <p className="panel-kicker">Manage Username</p>
            <h2 className="report-title">Username</h2>
          </div>
          <p className="report-empty">Change the name shown across the dashboard and profile.</p>
          <div className="profile-detail">
            <span>Sign-In Email</span>
            <strong>{account.email}</strong>
          </div>

          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <div className="form-grid">
              <label className="form-field form-field--full">
                Username
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(event) => {
                    setProfileForm((current) => ({ ...current, name: event.target.value }))
                    setProfileFeedback(null)
                  }}
                  placeholder="Enter your username"
                  required
                />
              </label>
            </div>

            {profileFeedback ? (
              <p
                className={
                  profileFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {profileFeedback.message}
              </p>
            ) : null}

            <div className="profile-form-actions">
              <button type="submit" className="primary-button">
                Save Username
              </button>
            </div>
          </form>
        </article>

        <article className="profile-card">
          <div className="report-card-header">
            <p className="panel-kicker">Manage Password</p>
            <h2 className="report-title">Password</h2>
          </div>
          <p className="report-empty">Use your current password to set a new one.</p>

          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <div className="form-grid">
              <label className="form-field form-field--full">
                Current Password
                <PasswordInput
                  value={passwordForm.currentPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Enter your current password"
                  showPassword={passwordVisibility.passwordCurrent}
                  onToggle={() => togglePasswordVisibility('passwordCurrent')}
                />
              </label>

              <label className="form-field">
                New Password
                <PasswordInput
                  value={passwordForm.nextPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Enter a new password"
                  showPassword={passwordVisibility.passwordNext}
                  onToggle={() => togglePasswordVisibility('passwordNext')}
                />
              </label>

              <label className="form-field">
                Confirm Password
                <PasswordInput
                  value={passwordForm.confirmPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Confirm the new password"
                  showPassword={passwordVisibility.passwordConfirm}
                  onToggle={() => togglePasswordVisibility('passwordConfirm')}
                />
              </label>
            </div>

            {passwordFeedback ? (
              <p
                className={
                  passwordFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {passwordFeedback.message}
              </p>
            ) : null}

            <div className="profile-form-actions">
              <button type="submit" className="primary-button">
                Update Password
              </button>
            </div>
          </form>
        </article>
      </section>
    </section>
  )
}

function ProductImage({ name, imageUrl }) {
  if (imageUrl) {
    return (
      <div className="product-artwork">
        <img src={imageUrl} alt={name} />
      </div>
    )
  }

  return <div className="product-artwork product-artwork--placeholder">Image</div>
}

function ProductModal({
  mode,
  formValues,
  onChange,
  onImageSelect,
  onImageRemove,
  onClose,
  onSubmit,
  isImageLoading,
  isSaving,
}) {
  const isEditMode = mode === 'edit'

  return (
    <div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <div className="modal-header">
          <div>
            <p className="panel-kicker">Inventory</p>
            <h2 id="product-modal-title" className="modal-title">
              {isEditMode ? 'Update Product' : 'Add Product'}
            </h2>
            <p className="modal-description">
              {isEditMode
                ? 'Update the selected product details.'
                : 'Create a new product and save it to PostgreSQL.'}
            </p>
          </div>
        </div>

        <form className="modal-form" onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="form-field">
              Product Name
              <input
                type="text"
                value={formValues.name}
                onChange={(event) => onChange('name', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              Flavor
              <input
                type="text"
                value={formValues.flavor}
                onChange={(event) => onChange('flavor', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              SKU
              <input
                type="text"
                value={formValues.sku}
                onChange={(event) => onChange('sku', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              Quantity
              <input
                type="number"
                min="0"
                value={formValues.items}
                onChange={(event) => onChange('items', event.target.value)}
                required
              />
            </label>

            <div className="form-field form-field--full">
              <span>Product Image</span>
              <div className="image-upload-field">
                <label className="file-input-button" htmlFor="product-image-upload">
                  <input
                    id="product-image-upload"
                    className="file-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      onImageSelect(file)
                      event.target.value = ''
                    }}
                  />
                  {formValues.imageUrl ? 'Replace Image' : 'Upload Image'}
                </label>

                <div className="image-upload-copy">
                  <strong>{isImageLoading ? 'Reading image...' : formValues.imageName || 'No image selected'}</strong>
                  <span>Use JPG, PNG, or WEBP files from your device.</span>
                </div>

                {formValues.imageUrl ? (
                  <button
                    type="button"
                    className="secondary-button secondary-button-muted"
                    onClick={onImageRemove}
                  >
                    Remove Image
                  </button>
                ) : null}
              </div>

              {formValues.imageUrl ? (
                <div className="image-upload-preview">
                  <ProductImage name={formValues.name || 'Product image'} imageUrl={formValues.imageUrl} />
                </div>
              ) : null}
            </div>

            <label className="form-field form-field--full">
              Description
              <textarea
                rows="4"
                value={formValues.description}
                onChange={(event) => onChange('description', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isImageLoading || isSaving}>
              {isImageLoading ? 'Uploading Image...' : isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function DeleteModal({ product, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card modal-card--compact" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
        <div className="modal-header">
          <div>
            <p className="panel-kicker">Inventory</p>
            <h2 id="delete-modal-title" className="modal-title">
              Delete Product
            </h2>
            <p className="modal-description">
              Remove <strong>{product.name}</strong> from the inventory database?
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </section>
    </div>
  )
}

function ProductDetailsModal({ product, onClose }) {
  const status = getStockStatus(product.items)

  return (
    <div className="modal-backdrop">
      <section
        className="modal-card modal-card--details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
      >
        <div className="details-hero">
          <div className="details-hero-media">
            <ProductImage name={product.name} imageUrl={product.imageUrl} />
          </div>

          <div className="details-hero-copy">
            <div>
              <p className="panel-kicker">Product Preview</p>
              <h2 id="product-details-title" className="modal-title">
                {product.name}
              </h2>
              <p className="modal-description">
                {product.flavor} flavor with SKU {product.sku}.
              </p>
            </div>
            <div className="details-hero-meta">
              <span className={`stock-pill stock-pill-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                {status}
              </span>
              <strong>{formatItemCount(product.items)}</strong>
            </div>
          </div>
        </div>

        <div className="details-grid">
          <article className="details-card">
            <span>Flavor</span>
            <strong>{product.flavor}</strong>
          </article>
          <article className="details-card">
            <span>SKU</span>
            <strong>{product.sku}</strong>
          </article>
          <article className="details-card details-card--wide">
            <span>Latest Update</span>
            <strong>{product.updates}</strong>
          </article>
        </div>

        <article className="details-description">
          <span>Description</span>
          <p>{product.description}</p>
        </article>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

export default App
