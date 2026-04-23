export function VapeDevice({ className = 'h-48 w-auto' }) {
  return (
    <svg
      viewBox="0 0 280 560"
      className={className}
      role="img"
      aria-label="Vape device illustration"
    >
      <defs>
        <linearGradient id="bodyGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="55%" stopColor="#082f49" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="bodyFill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#071c2d" />
          <stop offset="55%" stopColor="#0c2236" />
          <stop offset="100%" stopColor="#180818" />
        </linearGradient>
        <linearGradient id="glassFill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0.72" />
        </linearGradient>
      </defs>

      <rect x="105" y="28" width="70" height="26" rx="8" fill="#07111f" stroke="url(#bodyGlow)" strokeWidth="3" />
      <rect x="94" y="52" width="92" height="78" rx="18" fill="#050b12" stroke="url(#bodyGlow)" strokeWidth="3" />
      <rect x="116" y="72" width="16" height="42" rx="4" fill="url(#glassFill)" />
      <rect x="136" y="66" width="24" height="54" rx="6" fill="url(#glassFill)" opacity="0.8" />
      <rect x="95" y="126" width="90" height="26" rx="10" fill="#08111e" stroke="url(#bodyGlow)" strokeWidth="3" />
      <rect x="61" y="148" width="126" height="294" rx="14" fill="url(#bodyFill)" stroke="url(#bodyGlow)" strokeWidth="3" />
      <circle cx="95" cy="246" r="20" fill="#08111e" stroke="url(#bodyGlow)" strokeWidth="3" />
      <rect x="82" y="394" width="26" height="9" rx="4.5" fill="#08111e" stroke="url(#bodyGlow)" strokeWidth="2" />
      <rect x="67" y="154" width="12" height="282" rx="6" fill="#0ea5e9" opacity="0.26" />
      <rect x="171" y="154" width="8" height="282" rx="4" fill="#d946ef" opacity="0.45" />
      <path d="M175 28v414" stroke="#d946ef" strokeOpacity="0.8" strokeWidth="4" />
    </svg>
  )
}
