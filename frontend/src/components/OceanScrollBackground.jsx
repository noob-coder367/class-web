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
        <ellipse cx="70" cy="60" rx="55" ry="18" fill="#ffffff" opacity="0.85" />
        <ellipse cx="105" cy="50" rx="40" ry="16" fill="#ffffff" opacity="0.75" />
        <ellipse cx="320" cy="90" rx="60" ry="20" fill="#ffffff" opacity="0.7" />
        <ellipse cx="280" cy="75" rx="35" ry="14" fill="#ffffff" opacity="0.6" />
        <g style={{ opacity: rayOpacity }}>
          <path d="M60 0 L120 0 L40 300 Z" fill="#ffffff" opacity="0.06" />
          <path d="M140 0 L190 0 L90 300 Z" fill="#ffffff" opacity="0.05" />
        </g>
      </svg>

      <svg
        className="osb-mountain-layer"
        style={{ transform: `translateY(${mountainY}px)` }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMin slice"
      >
        <polygon points="250,300 330,90 410,300" fill="#8a95a6" opacity="0.55" />
        <polygon points="240,300 300,140 380,300" fill="#6d7a8f" opacity="0.6" />
        <g transform="translate(340,60)">
          <rect x="-6" y="0" width="12" height="60" fill="#c4746b" />
          <rect x="-6" y="0" width="12" height="10" fill="#ffffff" />
          <rect x="-6" y="20" width="12" height="10" fill="#ffffff" />
          <rect x="-6" y="40" width="12" height="10" fill="#ffffff" />
          <polygon points="-10,0 10,0 0,-14" fill="#c4746b" />
          <circle cx="0" cy="-6" r="3" fill="#fff6cf" />
        </g>
      </svg>

      <svg
        className="osb-boat-layer"
        style={{ transform: `translateY(${boatY}px)`, opacity: boatOpacity }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMin slice"
      >
        <g transform="translate(150,170)">
          <path d="M-40 40 L40 40 L28 55 L-28 55 Z" fill="#b23a48" />
          <line x1="0" y1="40" x2="0" y2="-70" stroke="#7a4a2b" strokeWidth="2" />
          <path d="M0 -68 L-34 30 L0 30 Z" fill="#f4e3c1" />
          <path d="M0 -50 L26 30 L0 30 Z" fill="#f7ecd8" />
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
            hsl(198, 70%, ${72 - progress * 55}%) 0%,
            hsl(202, 65%, ${55 - progress * 42}%) 35%,
            hsl(210, 70%, ${34 - progress * 26}%) 70%,
            hsl(215, 75%, ${14 - progress * 11}%) 100%)`,
        }}
      >
        <div className="osb-wave-shimmer" />

        <svg className="osb-fish-layer" style={{ opacity: fishOpacity }} viewBox="0 0 400 300">
          <g transform="translate(90,60)">
            <path d="M0 0 Q14 -8 28 0 Q14 8 0 0 Z" fill="#ffd27a" />
            <polygon points="-2,0 -10,-6 -10,6" fill="#ffd27a" />
          </g>
          <g transform="translate(260,140) scale(0.8)">
            <path d="M0 0 Q14 -8 28 0 Q14 8 0 0 Z" fill="#7ad0ff" />
            <polygon points="-2,0 -10,-6 -10,6" fill="#7ad0ff" />
          </g>
          <g transform="translate(180,220) scale(0.6)">
            <path d="M0 0 Q14 -8 28 0 Q14 8 0 0 Z" fill="#ffd27a" />
            <polygon points="-2,0 -10,-6 -10,6" fill="#ffd27a" />
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
