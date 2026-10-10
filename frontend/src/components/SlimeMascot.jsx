export default function SlimeMascot({ isRegister }) {
  return (
    <div className={`slime-mascot ${isRegister ? 'is-register' : 'is-login'}`} aria-hidden="true">
      <svg viewBox="0 0 180 150" role="presentation">
        <defs>
          <linearGradient id="slime-body" x1="30" y1="20" x2="145" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#b9f8ff" />
            <stop offset=".38" stopColor="#4fdcf5" />
            <stop offset="1" stopColor="#168edb" />
          </linearGradient>
          <linearGradient id="slime-shine" x1="45" y1="25" x2="105" y2="110" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff" stopOpacity=".92" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="slime-eye" cx="35%" cy="25%">
            <stop stopColor="#8ff5ff" />
            <stop offset=".55" stopColor="#247edb" />
            <stop offset="1" stopColor="#173a9e" />
          </radialGradient>
          <filter id="slime-glow"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        <ellipse cx="90" cy="140" rx="58" ry="7" fill="#4bcff2" opacity=".22" filter="url(#slime-glow)" />
        <path d="M25 126c-2-39 17-78 65-82 48-4 69 32 65 82-3 24-25 34-65 34-41 0-62-10-65-34Z" fill="url(#slime-body)" stroke="#168edb" strokeOpacity=".45" strokeWidth="2" />
        <path d="M43 70c10-22 28-29 47-30 17-1 27-8 34-20-3 17-14 28-30 33-21 7-36 20-43 39-4 10-11 2-8-22Z" fill="url(#slime-shine)" opacity=".82" />
        <ellipse cx="61" cy="55" rx="11" ry="5" fill="#fff" opacity=".78" transform="rotate(-35 61 55)" />
        <ellipse cx="126" cy="81" rx="7" ry="14" fill="#fff" opacity=".5" transform="rotate(-35 126 81)" />
        <ellipse cx="62" cy="101" rx="15" ry="21" fill="url(#slime-eye)" stroke="#2063bd" strokeOpacity=".5" />
        <ellipse cx="117" cy="101" rx="15" ry="21" fill="url(#slime-eye)" stroke="#2063bd" strokeOpacity=".5" />
        <circle cx="57" cy="94" r="5" fill="#fff" /><circle cx="112" cy="94" r="5" fill="#fff" />
        <circle cx="68" cy="111" r="3" fill="#8ff5ff" /><circle cx="123" cy="111" r="3" fill="#8ff5ff" />
        <path d="M83 113c5 5 10 5 15 0" fill="none" stroke="#145bb8" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 116l-7 3m9 3-7 4m104-10 7 3m-9 3 7 4" stroke="#f79cb8" strokeWidth="3" strokeLinecap="round" opacity=".85" />
      </svg>
    </div>
  )
}

SlimeMascot.displayName = 'SlimeMascot'

export { SlimeMascot }
