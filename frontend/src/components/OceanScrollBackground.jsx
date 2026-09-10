import { useEffect, useRef, useState } from "react";
import "./OceanScrollBackground.css";

const DESIGN_W = 1200;
const DESIGN_H = 800;
const WORLD_H = 2600;
const WATER_Y = 500;

/** Coi là "đầu trang" nếu scrollY nhỏ hơn ngưỡng này (px). */
const TOP_EPSILON = 8;
/** Nếu trang còn quá thấp (chưa layout xong) thì không tin maxScroll. */
const MIN_SCROLLABLE = 120;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function getOceanLayout() {
  if (typeof window === "undefined") {
    return { viewW: DESIGN_W, viewH: DESIGN_H, sx: 1, offsetX: 0 };
  }

  const vw = window.innerWidth;
  const vh = Math.max(1, window.visualViewport?.height ?? window.innerHeight);
  const viewH = DESIGN_H;
  const viewW = Math.max(240, (vw / vh) * viewH);
  const sx = Math.min(1, viewW / DESIGN_W);
  const offsetX = (viewW - DESIGN_W * sx) / 2;
  return { viewW, viewH, sx, offsetX };
}

/** Giữ một điểm localY của vật thể đúng vị trí thế giới khi scale. */
function SceneObject({ x, y, sx, ox, localY = 0, className, children }) {
  const wx = ox + x * sx;
  const wy = y + localY * (1 - sx);
  return (
    <g transform={`translate(${wx}, ${wy}) scale(${sx})`}>
      {className ? <g className={className}>{children}</g> : children}
    </g>
  );
}

function wavePath(width, y, rise) {
  const extra = Math.max(160, width * 0.12);
  return [
    `M${-extra} ${y}`,
    `Q${width * 0.18} ${y - rise} ${width * 0.38} ${y}`,
    `T${width * 0.72} ${y - rise * 0.3}`,
    `T${width + extra} ${y + 6}`,
    `L${width + extra} ${y + 240}`,
    `L${-extra} ${y + 240} Z`,
  ].join(" ");
}

function seabedPath(width, y, dip) {
  return [
    `M0 ${y}`,
    `Q${width * 0.21} ${y - dip} ${width * 0.42} ${y - dip * 0.4}`,
    `T${width * 0.83} ${y - dip * 0.85}`,
    `Q${width * 0.93} ${y - dip * 0.55} ${width} ${y - dip * 0.25}`,
    `L${width} ${WORLD_H} L0 ${WORLD_H} Z`,
  ].join(" ");
}

function readScrollMetrics() {
  const doc = document.documentElement;
  const body = document.body;
  const documentHeight = Math.max(
    doc.scrollHeight,
    body?.scrollHeight || 0,
    doc.offsetHeight,
    body?.offsetHeight || 0
  );
  // Ưu tiên visualViewport trên mobile (iPad/Safari) vì innerHeight nhảy khi thanh địa chỉ co/giãn.
  const viewportHeight = Math.max(
    1,
    window.visualViewport?.height ?? window.innerHeight
  );
  const scrollY = Math.max(
    0,
    window.scrollY ||
      window.pageYOffset ||
      doc.scrollTop ||
      body?.scrollTop ||
      0
  );
  const maxScroll = Math.max(0, documentHeight - viewportHeight);
  return { scrollY, maxScroll, documentHeight, viewportHeight };
}

function computeProgress() {
  const { scrollY, maxScroll } = readScrollMetrics();

  // Đang ở (gần) đầu trang → luôn mặt nước, không bị nhảy xuống đáy.
  if (scrollY <= TOP_EPSILON) return 0;

  // Trang chưa đủ cao (ảnh/content chưa load xong, hoặc modal no-scroll):
  // đừng tin maxScroll nhỏ, giữ nguyên mặt nước.
  if (maxScroll < MIN_SCROLLABLE) return 0;

  return clamp(scrollY / maxScroll);
}

export default function OceanScrollBackground() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [layout, setLayout] = useState(getOceanLayout);
  const animationFrame = useRef(null);
  const lastProgress = useRef(0);

  useEffect(() => {
    const applyProgress = (next) => {
      // Tránh re-render liên tục khi số gần như không đổi.
      if (Math.abs(next - lastProgress.current) < 0.001) return;
      lastProgress.current = next;
      setScrollProgress(next);
    };

    const updateScroll = () => {
      if (animationFrame.current) return;
      animationFrame.current = requestAnimationFrame(() => {
        applyProgress(computeProgress());
        animationFrame.current = null;
      });
    };

    const updateLayout = () => {
      setLayout(getOceanLayout());
      updateScroll();
    };

    updateLayout();

    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("scroll", updateLayout);

    // Khi ảnh / content động làm trang cao thêm → tính lại progress.
    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateScroll());
      resizeObserver.observe(document.documentElement);
      if (document.body) resizeObserver.observe(document.body);
    }

    // Sau khi ảnh load xong cũng cập nhật (iPad hay load chậm).
    const onLoad = () => updateScroll();
    window.addEventListener("load", onLoad);

    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("load", onLoad);
      window.visualViewport?.removeEventListener("resize", updateLayout);
      window.visualViewport?.removeEventListener("scroll", updateLayout);
      resizeObserver?.disconnect();
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  const { viewW, viewH, sx, offsetX } = layout;
  const maxCameraY = Math.max(0, WORLD_H - viewH);
  const cameraY = scrollProgress * maxCameraY;
  const skyParallaxY = cameraY * 0.4;
  const mountainParallaxY = cameraY * 0.25;
  const spanX = viewW / DESIGN_W;

  const sunOpacity = clamp(1 - scrollProgress * 2.2);
  const skyOpacity = clamp(1 - scrollProgress * 1.8);
  const bubblesOpacity = clamp((scrollProgress - 0.1) * 2);

  return (
    <div className="ocean-background" aria-hidden="true">
      <div
        className="ocean-base-gradient"
        style={{
          background: `linear-gradient(to bottom,
            #83ccef 0%,
            #38b7d3 20%,
            #1d85b8 45%,
            #0d4e8a 70%,
            #031638 100%)`,
        }}
      />

      <svg
        className="ocean-svg-canvas"
        viewBox={`0 ${cameraY} ${viewW} ${viewH}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ac2ed" />
            <stop offset="60%" stopColor="#b5e2fa" />
            <stop offset="100%" stopColor="#e0f1ef" />
          </linearGradient>
          <linearGradient id="oceanWaterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38b7d3" stopOpacity="0.85" />
            <stop offset="15%" stopColor="#1d85b8" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#0d4e8a" stopOpacity="0.95" />
            <stop offset="75%" stopColor="#052352" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#020a1f" stopOpacity="1" />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#fffbd2" stopOpacity="1" />
            <stop offset="40%" stopColor="#ffe68b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffe68b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="farMountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b3c4d4" />
            <stop offset="100%" stopColor="#70889e" />
          </linearGradient>
          <linearGradient id="seabedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c2d42" />
            <stop offset="30%" stopColor="#142132" />
            <stop offset="100%" stopColor="#080e17" />
          </linearGradient>
          <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2a675" />
            <stop offset="100%" stopColor="#6e5732" />
          </linearGradient>
        </defs>

        <g transform={`translate(0, ${skyParallaxY})`}>
          <rect
            x={-4}
            y="0"
            width={viewW + 8}
            height="520"
            fill="url(#skyGrad)"
            opacity={skyOpacity}
          />

          <g opacity={sunOpacity}>
            <SceneObject x={300} y={160} sx={sx} ox={offsetX}>
              <circle cx="0" cy="0" r="110" fill="url(#sunGlow)" />
              <circle cx="0" cy="0" r="48" fill="#fff5b3" className="ocean-sun" />
            </SceneObject>
          </g>

          <SceneObject x={500} y={130} sx={sx} ox={offsetX} className="ocean-cloud ocean-cloud-one">
            <g opacity={skyOpacity * 0.85}>
              <ellipse cx="0" cy="0" rx="90" ry="28" fill="#ffffff" />
              <ellipse cx="-60" cy="-5" rx="50" ry="22" fill="#ffffff" />
              <ellipse cx="50" cy="-10" rx="55" ry="32" fill="#ffffff" />
            </g>
          </SceneObject>

          <SceneObject x={880} y={180} sx={sx} ox={offsetX} className="ocean-cloud ocean-cloud-two">
            <g opacity={skyOpacity * 0.75}>
              <ellipse cx="0" cy="0" rx="100" ry="30" fill="#ffffff" />
              <ellipse cx="-50" cy="-5" rx="55" ry="25" fill="#ffffff" />
            </g>
          </SceneObject>

          <SceneObject x={700} y={125} sx={sx} ox={offsetX}>
            <g className="ocean-birds" stroke="#3f5668" strokeWidth="3" fill="none" opacity={skyOpacity}>
              <path d="M-20 -15 Q-10 -25 0 -15 Q10 -25 20 -15" />
              <path d="M40 15 Q48 7 56 15 Q64 7 72 15" />
            </g>
          </SceneObject>
        </g>

        <g
          transform={`translate(0, ${mountainParallaxY}) scale(${spanX}, 1)`}
          opacity={skyOpacity}
        >
          <polygon points="600,520 750,220 900,380 1050,190 1200,520" fill="url(#farMountain)" opacity="0.7" />
          <polygon points="780,520 900,280 980,360 1100,230 1200,520" fill="#4d647a" />
        </g>

        <rect
          x={-4}
          y={WATER_Y}
          width={viewW + 8}
          height={WORLD_H - WATER_Y}
          fill="url(#oceanWaterGrad)"
        />

        <g
          className="ocean-light-rays"
          transform={`scale(${spanX}, 1)`}
          opacity={clamp(1 - scrollProgress * 1.5)}
        >
          <polygon points="250,500 380,500 580,1300 420,1300" fill="#c3f5ff" opacity="0.12" />
          <polygon points="550,500 650,500 820,1300 700,1300" fill="#c3f5ff" opacity="0.09" />
        </g>

        <g className="wave-motion-back">
          <path d={wavePath(viewW, 510, 40)} fill="#29a3c4" opacity="0.7" />
        </g>

        <SceneObject
          x={520}
          y={360}
          sx={sx}
          ox={offsetX}
          localY={155}
          className="ocean-boat-motion"
        >
          <g opacity={skyOpacity}>
            <ellipse cx="80" cy="155" rx="120" ry="14" fill="#0d3b52" opacity="0.25" />
            <path d="M70 -130 L-50 120 L70 120 Z" fill="#fff8eb" />
            <path d="M90 -110 L190 120 L90 120 Z" fill="#ffffff" />
            <rect x="75" y="-150" width="10" height="280" fill="#5c3a21" />
            <path d="M85 -150 L140 -132 L85 -115 Z" fill="#e63946" />
            <path d="M-60 120 L220 120 L190 160 L-30 160 Z" fill="#d62828" />
            <path d="M-45 138 L205 138 L185 160 L-30 160 Z" fill="#003049" opacity="0.3" />
            <circle cx="20" cy="142" r="7" fill="#fdf0d5" />
            <circle cx="60" cy="142" r="7" fill="#fdf0d5" />
            <circle cx="100" cy="142" r="7" fill="#fdf0d5" />
            <circle cx="140" cy="142" r="7" fill="#fdf0d5" />
          </g>
        </SceneObject>

        <g className="wave-motion-front">
          <path d={wavePath(viewW, 525, 35)} fill="#38b7d3" opacity="0.9" />
        </g>

        <SceneObject x={380} y={780} sx={sx} ox={offsetX} className="sea-turtle-anim">
          <ellipse cx="0" cy="0" rx="35" ry="25" fill="#2a9d8f" />
          <ellipse cx="0" cy="0" rx="28" ry="20" fill="#e9c46a" opacity="0.8" />
          <circle cx="38" cy="-5" r="9" fill="#2a9d8f" />
          <path d="M15 -20 Q40 -45 5 -10" fill="#264653" />
          <path d="M15 20 Q40 45 5 10" fill="#264653" />
        </SceneObject>

        <SceneObject x={720} y={850} sx={sx} ox={offsetX} className="fish-swim-right">
          <ellipse cx="0" cy="0" rx="22" ry="12" fill="#f4a261" />
          <path d="M-18 0 L-32 -10 L-32 10 Z" fill="#e76f51" />
          <rect x="-5" y="-11" width="6" height="22" fill="#ffffff" />
          <circle cx="12" cy="-3" r="2.5" fill="#000000" />
        </SceneObject>
        <SceneObject x={780} y={890} sx={sx} ox={offsetX} className="fish-swim-right-slow">
          <ellipse cx="0" cy="0" rx="16" ry="9" fill="#f4a261" />
          <path d="M-12 0 L-22 -7 L-22 7 Z" fill="#e76f51" />
          <rect x="-3" y="-8" width="4" height="16" fill="#ffffff" />
        </SceneObject>

        <SceneObject x={260} y={1050} sx={sx} ox={offsetX} className="dolphin-anim">
          <path d="M-50 0 Q0 -30 60 -5 Q30 20 -50 0 Z" fill="#4ea8de" />
          <path d="M60 -5 Q75 -8 85 -2 Q70 10 60 -5 Z" fill="#4ea8de" />
          <path d="M0 -18 L12 -38 L22 -14 Z" fill="#4895ef" />
          <circle cx="62" cy="-6" r="2" fill="#03045e" />
        </SceneObject>

        <SceneObject x={680} y={1320} sx={sx} ox={offsetX} className="manta-anim">
          <path d="M0 -10 Q-90 -40 -120 10 Q-40 20 0 40 Q40 20 120 10 Q90 -40 0 -10 Z" fill="#1d3557" />
          <path d="M0 40 Q-5 90 -2 120" stroke="#1d3557" strokeWidth="4" fill="none" />
        </SceneObject>

        <SceneObject x={320} y={1450} sx={sx} ox={offsetX} className="jelly-float">
          <path d="M-25 0 Q-25 -30 0 -30 Q25 -30 25 0 Q12 8 0 3 Q-12 8 -25 0 Z" fill="#b8c0ff" opacity="0.75" />
          <path d="M-12 5 Q-15 30 -8 50" stroke="#e7c6ff" strokeWidth="2" fill="none" />
          <path d="M0 5 Q0 35 3 55" stroke="#e7c6ff" strokeWidth="2" fill="none" />
          <path d="M12 5 Q15 30 8 50" stroke="#e7c6ff" strokeWidth="2" fill="none" />
        </SceneObject>
        <SceneObject x={400} y={1520} sx={sx} ox={offsetX} className="jelly-float-delayed">
          <path d="M-18 0 Q-18 -22 0 -22 Q18 -22 18 0 Q9 6 0 2 Q-9 6 -18 0 Z" fill="#c8b6ff" opacity="0.7" />
          <path d="M-8 4 Q-10 25 -5 40" stroke="#e7c6ff" strokeWidth="1.5" fill="none" />
          <path d="M8 4 Q10 25 5 40" stroke="#e7c6ff" strokeWidth="1.5" fill="none" />
        </SceneObject>

        <SceneObject x={780} y={1820} sx={sx} ox={offsetX} className="angler-anim">
          <path d="M-35 0 Q-35 -25 0 -20 Q30 -15 35 10 Q10 30 -35 0 Z" fill="#111d27" />
          <path d="M15 -18 Q35 -40 45 -25" stroke="#4cc9f0" strokeWidth="2" fill="none" />
          <circle cx="46" cy="-23" r="6" fill="#72efdd" className="angler-light" />
          <circle cx="20" cy="-8" r="3" fill="#ff0054" />
          <path d="M10 8 L15 0 L20 8 L25 0 L30 8" stroke="#ffffff" strokeWidth="1.5" fill="none" />
        </SceneObject>

        <path d={seabedPath(viewW, 2250, 70)} fill="url(#seabedGrad)" />
        <path d={seabedPath(viewW, 2320, 50)} fill="url(#sandGrad)" />

        <SceneObject x={180} y={2260} sx={sx} ox={offsetX} localY={80}>
          <path d="M0 60 L-10 20 L-25 0 L-12 15 L0 30 L15 5 L10 25 L25 0 L15 35 Z" fill="#f72585" />
          <path d="M40 70 L30 30 L15 10 L28 25 L40 40 L55 15 L50 35 L65 10 L55 45 Z" fill="#7209b7" />
          <path d="M100 80 Q130 10 160 80 Z" fill="#4cc9f0" opacity="0.8" />
        </SceneObject>
        <SceneObject x={920} y={2250} sx={sx} ox={offsetX} localY={90}>
          <path d="M0 80 Q30 20 60 80 Z" fill="#ff9e00" opacity="0.85" />
          <path d="M40 90 L25 40 L10 15 L25 30 L40 50 L55 20 L50 45 Z" fill="#f72585" />
        </SceneObject>

        <g transform={`translate(${offsetX}, 2380) scale(${sx}) translate(0, -2380)`} className="kelp-group">
          <path d="M 120 2380 Q 140 2280 110 2180 T 130 1980" stroke="#2d6a4f" strokeWidth="18" fill="none" strokeLinecap="round" className="kelp-sway-1" />
          <path d="M 120 2380 Q 140 2280 110 2180 T 130 1980" stroke="#52b788" strokeWidth="8" fill="none" strokeLinecap="round" className="kelp-sway-1" />
          <path d="M 260 2400 Q 230 2300 270 2180 T 240 2020" stroke="#1b4332" strokeWidth="22" fill="none" strokeLinecap="round" className="kelp-sway-2" />
          <path d="M 850 2390 Q 880 2280 840 2150 T 870 1990" stroke="#2d6a4f" strokeWidth="20" fill="none" strokeLinecap="round" className="kelp-sway-3" />
          <path d="M 1020 2380 Q 990 2260 1030 2140 T 1000 2000" stroke="#40916c" strokeWidth="16" fill="none" strokeLinecap="round" className="kelp-sway-2" />
        </g>

        <SceneObject x={680} y={2330} sx={sx} ox={offsetX} localY={60}>
          <path d="M0 0 L0 60 M-25 45 Q0 65 25 45 M-10 0 L10 0" stroke="#4a5568" strokeWidth="7" fill="none" strokeLinecap="round" />
          <rect x="40" y="25" width="50" height="35" rx="4" fill="#7f4f24" />
          <path d="M40 25 Q65 10 90 25 Z" fill="#936639" />
          <rect x="61" y="37" width="8" height="10" fill="#e9c46a" />
          <circle cx="35" cy="55" r="4" fill="#e9c46a" />
          <circle cx="45" cy="58" r="3" fill="#f4a261" />
          <circle cx="95" cy="56" r="3.5" fill="#e9c46a" />
        </SceneObject>

        <SceneObject x={460} y={2370} sx={sx} ox={offsetX} className="crab-scuttle">
          <ellipse cx="0" cy="0" rx="14" ry="9" fill="#e63946" />
          <circle cx="-5" cy="-10" r="2" fill="#000" />
          <circle cx="5" cy="-10" r="2" fill="#000" />
          <path d="M-10 -4 Q-20 -15 -12 -20 Q-5 -12 -8 -4" fill="#e63946" />
          <path d="M10 -4 Q20 -15 12 -20 Q5 -12 8 -4" fill="#e63946" />
        </SceneObject>

        <SceneObject x={580} y={2385} sx={sx} ox={offsetX}>
          <path d="M0 -12 L3 -4 L11 -4 L5 1 L7 9 L0 4 L-7 9 L-5 1 L-11 -4 L-3 -4 Z" fill="#ff70a6" />
        </SceneObject>
      </svg>

      <div className="ocean-bubbles-container" style={{ opacity: bubblesOpacity }}>
        <span className="bubble b1" />
        <span className="bubble b2" />
        <span className="bubble b3" />
        <span className="bubble b4" />
        <span className="bubble b5" />
        <span className="bubble b6" />
        <span className="bubble b7" />
        <span className="bubble b8" />
      </div>

      <div
        className="ocean-abyss-darkness"
        style={{ opacity: clamp((scrollProgress - 0.65) * 2.5) }}
      />
    </div>
  );
}
