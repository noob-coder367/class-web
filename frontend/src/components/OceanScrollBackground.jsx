import { useEffect, useRef, useState } from "react";
import "./OceanScrollBackground.css";

/**
 * OceanScrollBackground
 * A fixed, full-viewport decorative background that transitions
 * from bright sky/surface to deep-sea colors as the user scrolls.
 * Drop it once near the top of your app (e.g. in App.jsx), it stays
 * fixed behind all page content.
 *
 * Usage:
 *   <OceanScrollBackground />
 *   <div className="page-content"> ...rest of your site... </div>
 */
export default function OceanScrollBackground() {
  const [progress, setProgress] = useState(0); // 0 = surface, 1 = deep abyss
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        setProgress(p);
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Parallax offsets: things further "back" move slower
  const cloudY = progress * -40;
  const mountainY = progress * 60;
  const boatY = progress * 220;
  const boatOpacity = Math.max(0, 1 - progress * 3.2);
  const lighthouseY = progress * 90;
  const rayOpacity = Math.max(0, 1 - progress * 2.2);
  const fishOpacity = Math.min(1, Math.max(0, (progress - 0.35) * 2.4));
  const bubbleOpacity = Math.min(1, progress * 1.6);
  const deepGlowOpacity = Math.min(0.9, Math.max(0, (progress - 0.6) * 2.5));

  return (
    <div className="osb-root" aria-hidden="true">
      <svg
        className="osb-sky-layer"
        style={{ transform: `translateY(${cloudY}px)`, opacity: Math.max(0, 1 - progress * 2) }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <linearGradient id="osb-sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5ec2ea" />
            <stop offset="55%" stopColor="#8fd8f0" />
            <stop offset="100%" stopColor="#bfe8f5" />
          </linearGradient>
          <radialGradient id="osb-sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff8d8" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff8d8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="400" height="300" fill="url(#osb-sky-grad)" />
        <circle cx="330" cy="55" r="60" fill="url(#osb-sun-glow)" />
        <circle cx="330" cy="55" r="22" fill="#fff3b8" />
        <g opacity="0.95">
          <ellipse cx="70" cy="60" rx="55" ry="18" fill="#ffffff" />
          <ellipse cx="105" cy="50" rx="40" ry="16" fill="#ffffff" opacity="0.9" />
          <ellipse cx="150" cy="120" rx="45" ry="15" fill="#ffffff" opacity="0.8" />
          <ellipse cx="185" cy="112" rx="30" ry="12" fill="#ffffff" opacity="0.7" />
        </g>
        <g style={{ opacity: rayOpacity }}>
          <path d="M300 20 L360 20 L260 300 Z" fill="#fff8d8" opacity="0.18" />
          <path d="M330 20 L380 20 L310 300 Z" fill="#fff8d8" opacity="0.12" />
        </g>
      </svg>

      <svg
        className="osb-mountain-layer"
        style={{ transform: `translateY(${mountainY}px)` }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMin slice"
      >
        <polygon points="245,300 335,75 425,300" fill="#7a8ea6" opacity="0.75" />
        <polygon points="230,300 300,130 390,300" fill="#5b7089" opacity="0.85" />
        <polygon points="300,130 335,75 365,140" fill="#9fb4c4" opacity="0.6" />
        <g transform="translate(340,55)">
          <rect x="-7" y="0" width="14" height="62" fill="#e0574a" />
          <rect x="-7" y="0" width="14" height="10" fill="#ffffff" />
          <rect x="-7" y="20" width="14" height="10" fill="#ffffff" />
          <rect x="-7" y="40" width="14" height="10" fill="#ffffff" />
          <polygon points="-11,0 11,0 0,-15" fill="#e0574a" />
          <circle cx="0" cy="-6" r="4" fill="#fff6cf" />
          <circle cx="0" cy="-6" r="9" fill="#fff6cf" opacity="0.35" />
        </g>
      </svg>

      <svg
        className="osb-boat-layer"
        style={{ transform: `translateY(${boatY}px)`, opacity: boatOpacity }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMin slice"
      >
        <g transform="translate(150,170)">
          <path d="M-40 40 L40 40 L28 57 L-28 57 Z" fill="#d1483f" />
          <path d="M-40 40 L40 40 L28 48 L-28 48 Z" fill="#e0574a" />
          <line x1="0" y1="40" x2="0" y2="-72" stroke="#8a5a34" strokeWidth="2.5" />
          <path d="M0 -70 L-34 30 L0 30 Z" fill="#fdf6e8" />
          <path d="M0 -52 L26 30 L0 30 Z" fill="#fffaf0" />
          <path d="M-2 -10 L-18 26 L-2 26 Z" fill="#f0dfc4" opacity="0.6" />
        </g>
      </svg>

      <svg
        className="osb-lighthouse-layer"
        style={{ transform: `translateY(${lighthouseY}px)` }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMin slice"
      >
        <g transform="translate(355,150)">
          <polygon points="-10,80 10,80 6,0 -6,0" fill="#e8e6df" />
          <rect x="-10" y="55" width="20" height="10" fill="#c4746b" />
          <rect x="-10" y="35" width="20" height="10" fill="#c4746b" />
          <rect x="-8" y="-6" width="16" height="10" fill="#4a5568" />
          <polygon points="-9,-6 9,-6 0,-18" fill="#c4746b" />
        </g>
      </svg>

      <div
        className="osb-water"
        style={{
          background: `linear-gradient(to bottom,
            hsl(189, 88%, ${68 - progress * 52}%) 0%,
            hsl(196, 85%, ${58 - progress * 46}%) 22%,
            hsl(204, 82%, ${44 - progress * 36}%) 45%,
            hsl(212, 80%, ${30 - progress * 24}%) 68%,
            hsl(220, 78%, ${17 - progress * 14}%) 88%,
            hsl(226, 70%, ${8 - progress * 6}%) 100%)`,
        }}
      >
        <div className="osb-wave-shimmer" />

        <svg className="osb-fish-layer" style={{ opacity: fishOpacity }} viewBox="0 0 400 300">
          <g transform="translate(90,60)">
            <path d="M0 0 Q14 -9 28 0 Q14 9 0 0 Z" fill="#ffb02e" />
            <polygon points="-2,0 -11,-7 -11,7" fill="#ff8c1a" />
            <circle cx="20" cy="-1" r="1.6" fill="#1c2438" />
          </g>
          <g transform="translate(260,140) scale(0.85)">
            <path d="M0 0 Q14 -9 28 0 Q14 9 0 0 Z" fill="#3ecbe0" />
            <polygon points="-2,0 -11,-7 -11,7" fill="#1fa8c2" />
            <circle cx="20" cy="-1" r="1.6" fill="#08303a" />
          </g>
          <g transform="translate(180,220) scale(0.65)">
            <path d="M0 0 Q14 -9 28 0 Q14 9 0 0 Z" fill="#ff6f61" />
            <polygon points="-2,0 -11,-7 -11,7" fill="#e5493a" />
            <circle cx="20" cy="-1" r="1.6" fill="#3a0f0a" />
          </g>
          <g transform="translate(320,240) scale(0.5)">
            <path d="M0 0 Q14 -9 28 0 Q14 9 0 0 Z" fill="#ffd23f" />
            <polygon points="-2,0 -11,-7 -11,7" fill="#f5a623" />
          </g>
        </svg>

        <svg className="osb-bubbles" style={{ opacity: bubbleOpacity }} viewBox="0 0 400 400">
          <circle cx="60" cy="360" r="4" fill="#ffffff" opacity="0.5" />
          <circle cx="90" cy="300" r="3" fill="#ffffff" opacity="0.4" />
          <circle cx="320" cy="380" r="5" fill="#ffffff" opacity="0.5" />
          <circle cx="300" cy="310" r="3" fill="#ffffff" opacity="0.35" />
          <circle cx="200" cy="350" r="2.5" fill="#ffffff" opacity="0.4" />
        </svg>

        <div className="osb-abyss-glow" style={{ opacity: deepGlowOpacity }} />
      </div>
    </div>
  );
}
