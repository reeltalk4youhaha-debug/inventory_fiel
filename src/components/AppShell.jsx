import { NavLink, Outlet } from 'react-router-dom'

function LogoMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-fuchsia-500/40 bg-white/5">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 3h4" />
        <path d="M11 3v3" />
        <path d="M13 3v3" />
        <rect x="9" y="6" width="6" height="13" rx="1.5" />
        <path d="M10 11h4" />
        <path d="M10 15h4" />
      </svg>
    </span>
  )
}

function navLinkClass({ isActive }) {
  return isActive
    ? 'rounded-full bg-violet-700/80 px-4 py-2 text-white shadow-[0_0_24px_rgba(109,40,217,0.35)]'
    : 'px-2 py-2 text-fuchsia-400/90 transition hover:text-white'
}

export function AppShell({ contextValue, onOpenProductModal, onOpenStockLogModal }) {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <div className="relative mx-auto min-h-screen max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] border border-cyan-500/70 bg-black shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_0_60px_rgba(29,78,216,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_28%),radial-gradient(circle_at_78%_40%,rgba(56,189,248,0.12),transparent_22%),linear-gradient(135deg,rgba(34,197,94,0.03),transparent_35%)]" />

          <header className="relative z-10 flex flex-col gap-6 px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
            <div className="flex items-center gap-3">
              <LogoMark />
              <span className="bg-gradient-to-r from-fuchsia-400 to-blue-500 bg-clip-text text-xl font-semibold text-transparent">
                Vapor HQ
              </span>
            </div>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium uppercase tracking-[0.25em] sm:gap-x-10">
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/stock-logs" className={navLinkClass}>
                Stock Logs
              </NavLink>
              <NavLink to="/reports" className={navLinkClass}>
                Reports
              </NavLink>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-violet-700/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_0_24px_rgba(109,40,217,0.35)]"
              >
                <span>Settings</span>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3.75l1.02 2.07 2.28.33-1.65 1.6.39 2.26L12 8.94l-2.04 1.07.39-2.26-1.65-1.6 2.28-.33L12 3.75Z" />
                  <path d="M19.5 12l1.56 1.12-1.5 2.6-1.84-.39a6.7 6.7 0 0 1-1.35.78l-.24 1.86h-3l-.24-1.86a6.7 6.7 0 0 1-1.35-.78l-1.84.39-1.5-2.6L4.5 12l1.56-1.12-.06-1.82 1.5-2.6 1.84.39c.42-.3.87-.56 1.35-.78l.24-1.86h3l.24 1.86c.48.22.93.48 1.35.78l1.84-.39 1.5 2.6-.06 1.82Z" />
                  <circle cx="12" cy="12" r="2.25" />
                </svg>
              </button>
            </nav>
          </header>

          <div className="relative z-10 px-6 pb-8 sm:px-8 lg:px-12">
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onOpenProductModal}
                className="rounded-xl border border-fuchsia-500/40 bg-violet-700/80 px-4 py-2 text-sm font-semibold text-white"
              >
                Add Product
              </button>
              <button
                type="button"
                onClick={() => onOpenStockLogModal()}
                className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-400"
              >
                Update Stock
              </button>
            </div>

            <Outlet context={contextValue} />
          </div>
        </div>
      </div>
    </main>
  )
}
