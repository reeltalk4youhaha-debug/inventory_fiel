import { useEffect, useState } from 'react'
import { clearSessionToken, getSessionToken, inventoryApi, persistSessionToken } from './lib/api'
import vaporLogo from './images/Vapor.png'

const navigationItems = ['Dashboard', 'Inventory', 'Reports', 'Profile']
const columns = ['Product', 'Flavor', 'SKU', 'Quantity', 'Description', 'Updates', 'Actions']
const PAGE_SIZE = 10
const SESSION_STORAGE_KEY = 'vapor-hq-session'

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read image file.'))

    reader.readAsDataURL(file)
  })
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

function getDashboardStats(products) {
  const totalProducts = products.length
  const totalStock = products.reduce((sum, product) => sum + Number(product.items || 0), 0)
  const lowStock = products.filter((product) => {
    const quantity = Number(product.items || 0)
    return quantity > 0 && quantity <= 20
  }).length
  const outOfStock = products.filter((product) => Number(product.items || 0) <= 0).length

  return [
    { label: 'Total Products', value: totalProducts },
    { label: 'Total Stock', value: formatItemCount(totalStock) },
    { label: 'Low Stock \u26A0\uFE0F', value: `${lowStock} products` },
    { label: 'Out of Stock \u274C', value: `${outOfStock} products` },
  ]
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
  const dashboardStats = getDashboardStats(normalizedProducts)
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
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleImageRemove = () => {
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
          searchQuery={searchQuery}
          filteredCount={filteredProducts.length}
          currentPage={inventoryPage}
          totalPages={inventoryTotalPages}
          isLoading={isProductsLoading}
          errorMessage={productsError}
          onSearchChange={handleSearchChange}
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
        searchQuery={searchQuery}
        filteredCount={filteredProducts.length}
        currentPage={dashboardPage}
        totalPages={dashboardTotalPages}
        isLoading={isProductsLoading}
        errorMessage={productsError}
        onSearchChange={handleSearchChange}
        onPreviousPage={() => handlePageChange('Dashboard', dashboardPage - 1)}
        onNextPage={() => handlePageChange('Dashboard', dashboardPage + 1)}
        summaryCards={dashboardStats}
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
            <nav className="nav-tabs" aria-label="Primary navigation">
              {navigationItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === activePage ? 'nav-button is-active' : 'nav-button'}
                  onClick={() => handleNavigate(item)}
                >
                  {item}
                </button>
              ))}
            </nav>

            {account ? (
              <div className="topbar-account">
                <div className="topbar-avatar">{getInitials(account.name)}</div>
                <div className="topbar-account-copy">
                  <strong>{account.name}</strong>
                  <span>{account.email}</span>
                </div>
                <button type="button" className="secondary-button topbar-signout" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            ) : null}
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
  searchQuery,
  filteredCount,
  currentPage,
  totalPages,
  isLoading,
  errorMessage,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  summaryCards = null,
  actions = null,
  manageMode = false,
  onEdit = null,
  onDelete = null,
  onView = null,
}) {
  return (
    <section className="inventory-panel" aria-label={title}>
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">{eyebrow}</p>
          <h1 className="panel-title">{title}</h1>
          <p className="panel-description">{description}</p>
        </div>
        <div className="panel-utility">
          <label className="search-field">
            <span className="search-label">Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search product, SKU, flavor, quantity..."
            />
          </label>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
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

      <div className="inventory-grid">
        <div className="inventory-header" role="row">
          {columns.map((column) => (
            <div key={column} className="inventory-heading" role="columnheader">
              {column}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="empty-state">
            <strong>Loading products from the database...</strong>
            <p>Your latest inventory records are being fetched.</p>
          </div>
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
          <div className="empty-state">
            <strong>{totalCount ? 'No matching products found.' : 'No products in the database yet.'}</strong>
            <p>
              {totalCount
                ? `Try a different search term or clear "${searchQuery}".`
                : 'Use the Inventory page to add your first product.'}
            </p>
          </div>
        )}

        {filteredCount && !isLoading ? (
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
      </div>
    </section>
  )
}

function ReportsPanel({ products }) {
  const totalProducts = products.length
  const totalStock = products.reduce((sum, product) => sum + Number(product.items || 0), 0)
  const averageStock = totalProducts ? Math.round(totalStock / totalProducts) : 0
  const lowStockProducts = products.filter((product) => getStockStatus(product.items) === 'Low Stock')
  const outOfStockProducts = products.filter((product) => getStockStatus(product.items) === 'Out of Stock')
  const recentlyAddedProducts = products.filter((product) =>
    product.updates.toLowerCase().includes('recently added'),
  )
  const highestStockProducts = [...products].sort((left, right) => right.items - left.items).slice(0, 4)
  const latestActivity = [...products].slice(0, 5)

  return (
    <section className="inventory-panel" aria-label="Reports">
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">Reports</p>
          <h1 className="panel-title">Inventory Reports</h1>
          <p className="panel-description">
            Review stock health, recent changes, and product movement from the current database records.
          </p>
        </div>
      </div>

      <section className="report-summary-grid" aria-label="Report summary">
        <article className="dashboard-summary-card">
          <span>Total Products</span>
          <strong>{totalProducts}</strong>
        </article>
        <article className="dashboard-summary-card">
          <span>Total Stock</span>
          <strong>{formatItemCount(totalStock)}</strong>
        </article>
        <article className="dashboard-summary-card">
          <span>Average Quantity</span>
          <strong>{formatItemCount(averageStock)}</strong>
        </article>
        <article className="dashboard-summary-card">
          <span>Recently Added</span>
          <strong>{recentlyAddedProducts.length} products</strong>
        </article>
      </section>

      <section className="report-content-grid">
        <article className="report-card report-card--wide">
          <div className="report-card-header">
            <p className="panel-kicker">Stock Ranking</p>
            <h2 className="report-title">Highest Quantity Products</h2>
          </div>
          <div className="report-list">
            {highestStockProducts.length ? (
              highestStockProducts.map((product) => (
                <div key={product.id} className="report-item">
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      {product.sku} / {product.flavor}
                    </span>
                  </div>
                  <strong>{formatItemCount(product.items)}</strong>
                </div>
              ))
            ) : (
              <p className="report-empty">No products available yet.</p>
            )}
          </div>
        </article>

        <article className="report-card">
          <div className="report-card-header">
            <p className="panel-kicker">Attention</p>
            <h2 className="report-title">Low And Out Of Stock</h2>
          </div>
          <div className="report-list">
            {[...lowStockProducts, ...outOfStockProducts].length ? (
              [...lowStockProducts, ...outOfStockProducts].map((product) => (
                <div key={product.id} className="report-item">
                  <div>
                    <strong>{product.name}</strong>
                    <span>{getStockStatus(product.items)}</span>
                  </div>
                  <strong>{formatItemCount(product.items)}</strong>
                </div>
              ))
            ) : (
              <p className="report-empty">No critical stock alerts right now.</p>
            )}
          </div>
        </article>

        <article className="report-card">
          <div className="report-card-header">
            <p className="panel-kicker">Activity</p>
            <h2 className="report-title">Recent Product Updates</h2>
          </div>
          <div className="report-list">
            {latestActivity.length ? (
              latestActivity.map((product) => (
                <div key={product.id} className="report-item">
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.updates}</span>
                  </div>
                  <strong>{formatItemCount(product.items)}</strong>
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

function ProfilePanel({ account, onProfileSave, onPasswordSave }) {
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
  return (
    <div className="modal-backdrop">
      <section
        className="modal-card modal-card--details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
      >
        <div className="modal-header">
          <div>
            <p className="panel-kicker">Dashboard</p>
            <h2 id="product-details-title" className="modal-title">
              {product.name}
            </h2>
            <p className="modal-description">
              Product details and latest activity for the selected item.
            </p>
          </div>
        </div>

        <div className="details-layout">
          <div className="details-visual">
            <ProductImage name={product.name} imageUrl={product.imageUrl} />
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
            <article className="details-card">
              <span>Quantity</span>
              <strong>{formatItemCount(product.items)}</strong>
            </article>
            <article className="details-card">
              <span>Latest Update</span>
              <strong>{product.updates}</strong>
            </article>
          </div>
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
