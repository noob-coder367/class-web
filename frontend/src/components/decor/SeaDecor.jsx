/**
 * Các component trang trí (đại dương, cá, bong bóng...) được tách
 * ra từ App.jsx gốc. Thuần hiển thị, không chứa logic nghiệp vụ.
 */

export function IslandScene() {
  return (
    <svg
      className="decor-svg island-scene"
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <path
        d="M0,180 Q200,90 460,130 Q650,160 820,110 Q1000,70 1200,140 L1200,260 L0,260 Z"
        fill="#5c8a4a"
      />

      <path
        d="M0,200 Q220,150 480,175 Q680,195 860,160 Q1040,130 1200,175 L1200,260 L0,260 Z"
        fill="#4a7440"
      />

      <g transform="translate(180,55)">
        <rect x="-4" y="0" width="8" height="80" fill="#7a5230" />

        <g fill="#3f7d3a">
          <ellipse
            cx="-28"
            cy="-6"
            rx="30"
            ry="10"
            transform="rotate(-25 -28 -6)"
          />
          <ellipse
            cx="28"
            cy="-6"
            rx="30"
            ry="10"
            transform="rotate(25 28 -6)"
          />
          <ellipse cx="0" cy="-16" rx="14" ry="30" />
          <ellipse
            cx="-20"
            cy="-24"
            rx="26"
            ry="9"
            transform="rotate(-45 -20 -24)"
          />
          <ellipse
            cx="20"
            cy="-24"
            rx="26"
            ry="9"
            transform="rotate(45 20 -24)"
          />
        </g>
      </g>

      <g
        stroke="#2c3e50"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      >
        <path d="M950,40 q12,-14 24,0 q12,-14 24,0" />
        <path d="M1020,70 q10,-11 20,0 q10,-11 20,0" />
      </g>

      <g transform="translate(620,168)">
        <ellipse cx="0" cy="0" rx="26" ry="14" fill="#8a5a34" />
        <circle cx="24" cy="-8" r="11" fill="#8a5a34" />
        <path d="M30,-16 l6,-10 l2,10 Z" fill="#8a5a34" />
        <rect x="-20" y="10" width="6" height="14" fill="#8a5a34" />
        <rect x="8" y="10" width="6" height="14" fill="#8a5a34" />
      </g>
    </svg>
  )
}

export function Fish({ style, flip }) {
  return (
    <svg
      className="decor-svg fish"
      style={style}
      viewBox="0 0 60 30"
      aria-hidden="true"
      transform={flip ? 'scale(-1,1)' : undefined}
    >
      <path
        d="M4,15 Q18,0 40,8 L34,15 L40,22 Q18,30 4,15 Z"
        fill="currentColor"
      />

      <path
        d="M0,15 L10,9 L10,21 Z"
        fill="currentColor"
      />

      <circle
        cx="30"
        cy="12"
        r="1.6"
        fill="#0a2c3d"
      />
    </svg>
  )
}

export function Jellyfish({ style }) {
  return (
    <svg
      className="decor-svg jellyfish"
      style={style}
      viewBox="0 0 60 80"
      aria-hidden="true"
    >
      <path
        d="M10,30 Q10,0 30,0 Q50,0 50,30 Q30,42 10,30 Z"
        fill="currentColor"
        opacity="0.85"
      />

      <g
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      >
        <path d="M16,32 Q14,55 18,76" />
        <path d="M28,34 Q26,58 30,78" />
        <path d="M40,32 Q42,55 38,76" />
      </g>
    </svg>
  )
}

export function Anglerfish({ style }) {
  return (
    <svg
      className="decor-svg anglerfish"
      style={style}
      viewBox="0 0 100 60"
      aria-hidden="true"
    >
      <path
        d="M8,30 Q20,8 55,14 Q80,18 88,30 Q80,42 55,46 Q20,52 8,30 Z"
        fill="currentColor"
      />

      <path
        d="M4,30 L14,22 L14,38 Z"
        fill="currentColor"
      />

      <path
        d="M55,14 Q40,-6 34,-10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />

      <circle
        cx="33"
        cy="-11"
        r="4.5"
        className="lure"
      />

      <circle
        cx="66"
        cy="27"
        r="2"
        fill="#0a1620"
      />
    </svg>
  )
}

export function Bubbles({ count = 6, className = '' }) {
  return (
    <div
      className={`bubbles ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="bubble"
          style={{ '--i': i }}
        />
      ))}
    </div>
  )
}

export function Glow({ count = 5, className = '' }) {
  return (
    <div
      className={`glow-dots ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="glow-dot"
          style={{ '--i': i }}
        />
      ))}
    </div>
  )
}

