import { useEffect, useRef, useState } from "react";
import "./OceanScrollBackground.css";

const VIEW_W = 1200;
const VIEW_H = 800;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export default function OceanScrollBackground() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const animationFrame = useRef(null);

  useEffect(() => {
    const updateScroll = () => {
      if (animationFrame.current) return;
      animationFrame.current = requestAnimationFrame(() => {
        const documentHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const maxScroll = Math.max(1, documentHeight - viewportHeight);
        const progress = clamp(window.scrollY / maxScroll);
        setScrollProgress(progress);
        animationFrame.current = null;
      });
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  // Giới hạn biên độ di chuyển để thuyền không bị bay mất khỏi màn hình
  const skyY = scrollProgress * -280;
  const boatY = scrollProgress * -200;
  const wavesY = scrollProgress * -180;
  const seabedY = Math.max(0, (1 - scrollProgress) * 400);

  // Mức độ ẩn/hiện mượt mà theo từng độ sâu
  const skyOpacity = clamp(1 - scrollProgress * 1.8);
  const shallowOpacity = clamp(scrollProgress * 2) * clamp((0.7 - scrollProgress) * 3);
  const deepOpacity = clamp((scrollProgress - 0.3) * 2);
  const seabedOpacity = clamp((scrollProgress - 0.5) * 2);

  return (
    <div className="ocean-background" style={{ "--sea-depth": scrollProgress }} aria-hidden="true">
      {/* Nền gradient chuyển màu biển */}
      <div className="ocean-base-gradient" />

      <div className="ocean-content-wrapper">
        {/* =====================================================
            1. BẦU TRỜI, MẶT TRỜI, NÚI
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate3d(0, ${skyY}px, 0)`,
            opacity: skyOpacity,
          }}
        >
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7ad0f5" />
              <stop offset="60%" stopColor="#b1e4f3" />
              <stop offset="100%" stopColor="#e4f5f3" />
            </linearGradient>
            <radialGradient id="sunGlow">
              <stop offset="0%" stopColor="#fffde0" stopOpacity="1" />
              <stop offset="40%" stopColor="#ffd875" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffd875" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#skyGrad)" />
          <circle cx="600" cy="140" r="110" fill="url(#sunGlow)" />
          <circle cx="600" cy="140" r="48" fill="#fff5b3" />

          {/* Mây */}
          <g className="ocean-cloud cloud-1">
            <ellipse cx="320" cy="120" rx="80" ry="24" fill="#ffffff" opacity="0.85" />
            <ellipse cx="270" cy="115" rx="45" ry="18" fill="#ffffff" opacity="0.9" />
          </g>
          <g className="ocean-cloud cloud-2">
            <ellipse cx="880" cy="150" rx="90" ry="26" fill="#ffffff" opacity="0.8" />
            <ellipse cx="930" cy="145" rx="50" ry="20" fill="#ffffff" opacity="0.85" />
          </g>

          {/* Dãy núi */}
          <polygon points="100,520 350,280 600,520" fill="#8cb3a2" opacity="0.7" />
          <polygon points="450,520 750,230 1050,520" fill="#6d9987" opacity="0.85" />
        </svg>

        {/* =====================================================
            2. THUYỀN VÀ SÓNG MẶT BIỂN
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate3d(0, ${wavesY}px, 0)`,
            opacity: skyOpacity,
          }}
        >
          {/* Sóng tầng sau */}
          <path
            d="M0 450 Q300 420 600 445 T1200 450 L1200 800 L0 800 Z"
            fill="#31a2c9"
            opacity="0.8"
          />

          {/* THUYỀN: Khống chế tọa độ không cho bay vọt khỏi khung */}
          <g transform={`translate(0, ${boatY - wavesY})`}>
            <g transform="translate(600, 360)" className="ocean-boat-motion">
              {/* Cánh buồm */}
              <path d="M-8 -140 L-100 40 L-8 40 Z" fill="#ffffff" />
              <path d="M8 -120 L80 40 L8 40 Z" fill="#ffe2e2" />
              {/* Cột buồm */}
              <rect x="-5" y="-155" width="10" height="200" rx="2" fill="#5c3a21" />
              {/* Cờ */}
              <path d="M5 -155 L45 -140 L5 -125 Z" fill="#ff4d4d" />
              {/* Thân thuyền */}
              <path d="M-100 40 L100 40 L75 95 L-75 95 Z" fill="#a8322a" />
              <path d="M-85 60 L85 60 L70 90 L-70 90 Z" fill="#d6453d" />
              {/* Ô cửa sổ con */}
              <circle cx="-35" cy="72" r="6" fill="#1b3947" />
              <circle cx="0" cy="72" r="6" fill="#1b3947" />
              <circle cx="35" cy="72" r="6" fill="#1b3947" />
            </g>
          </g>

          {/* Sóng tầng trước */}
          <path
            d="M0 480 Q300 450 600 480 T1200 475 L1200 800 L0 800 Z"
            fill="#2382a6"
          />
        </svg>

        {/* =====================================================
            3. SINH VẬT NÔNG (RÙA, BẠCH TUỘC, ĐÀN CÁ)
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Rùa biển */}
          <g transform="translate(380, 320)" opacity={shallowOpacity} className="turtle-swim">
            <ellipse cx="0" cy="0" rx="36" ry="25" fill="#2d7a53" />
            <circle cx="32" cy="-8" r="10" fill="#2d7a53" />
            <circle cx="35" cy="-10" r="2" fill="#ffffff" />
            <path d="M10 -15 Q35 -45 55 -30 Q35 -8 8 -12" fill="#256644" />
            <path d="M10 15 Q35 45 55 30 Q35 8 8 12" fill="#256644" />
          </g>

          {/* Bạch tuộc */}
          <g transform="translate(760, 440)" opacity={deepOpacity} className="octopus-float">
            <path d="M-30 0 C-30 -40 30 -40 30 0 C30 15 15 22 0 22 C-15 22 -30 15 -30 0 Z" fill="#d9534f" />
            <circle cx="-10" cy="-8" r="4" fill="#ffffff" />
            <circle cx="10" cy="-8" r="4" fill="#ffffff" />
            <circle cx="-10" cy="-8" r="2" fill="#000000" />
            <circle cx="10" cy="-8" r="2" fill="#000000" />
            <path d="M-20 20 Q-25 40 -15 55 M-10 22 Q-10 45 -5 58 M5 22 Q5 45 10 58 M20 20 Q25 40 15 55" stroke="#d9534f" strokeWidth="6" strokeLinecap="round" fill="none" />
          </g>

          {/* Đàn cá bơi */}
          <g opacity={shallowOpacity} className="fish-school">
            <path d="M 200 250 Q 215 242 230 250 Q 215 258 200 250 Z M 195 245 L 195 255 L 202 250 Z" fill="#ff9f43" />
            <path d="M 240 280 Q 255 272 270 280 Q 255 288 240 280 Z M 235 275 L 235 285 L 242 280 Z" fill="#ff9f43" />
            <path d="M 220 310 Q 235 302 250 310 Q 235 318 220 310 Z M 215 305 L 215 315 L 222 310 Z" fill="#ee5253" />
          </g>
        </svg>

        {/* =====================================================
            4. SINH VẬT SÂU (CÁ ĐỦOI, CÁ ĐÈN)
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ opacity: deepOpacity }}
        >
          {/* Cá đuối Manta */}
          <g transform="translate(520, 280)" className="manta-glide">
            <path d="M0 -20 C80 -15 150 20 190 50 C120 40 50 50 0 80 C-50 50 -120 40 -190 50 C-150 20 -80 -15 0 -20 Z" fill="#1e2d42" opacity="0.75" />
            <path d="M0 80 Q-5 140 0 180" stroke="#1e2d42" strokeWidth="3" fill="none" opacity="0.75" />
          </g>

          {/* Cá đèn phát sáng */}
          <g transform="translate(880, 360)" className="angler-fish">
            <path d="M -30 -10 C -10 -25 20 -20 30 0 C 35 15 20 25 -10 25 C -25 25 -35 10 -30 -10 Z" fill="#2c3e50" />
            <path d="M 30 0 L 45 -10 L 45 10 Z" fill="#2c3e50" />
            <circle cx="-15" cy="-5" r="3" fill="#f1c40f" />
            <path d="M -10 -20 Q 0 -40 -20 -40" stroke="#f1c40f" strokeWidth="2" fill="none" />
            <circle cx="-20" cy="-40" r="5" fill="#f39c12" className="angler-light" />
          </g>
        </svg>

        {/* =====================================================
            5. ĐÁY BIỂN VÀ RONG RÊU (ĐÃ FIX GIẬT/LAG)
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMax meet"
          style={{
            transform: `translate3d(0, ${seabedY}px, 0)`,
            opacity: seabedOpacity,
          }}
        >
          <defs>
            <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2c3e50" />
              <stop offset="100%" stopColor="#0d1117" />
            </linearGradient>
          </defs>

          {/* Cát đáy biển */}
          <path d="M0 640 Q300 580 600 620 T1200 600 L1200 800 L0 800 Z" fill="url(#sandGrad)" />

          {/* Cụm San Hô */}
          <g fill="#e74c3c" opacity="0.9">
            <path d="M 280 650 Q 270 600 285 570 Q 290 560 300 575 Q 305 550 320 560 Q 325 580 315 650 Z" />
            <path d="M 310 650 Q 330 590 345 580 Q 355 595 340 650 Z" fill="#c0392b" />
          </g>

          {/* RONG RÊU (Xoay bằng GPU transform, không đổi đường d để chống giật) */}
          <g stroke="#10ac84" strokeWidth="10" strokeLinecap="round" fill="none">
            {/* Cụm 1 */}
            <g className="seaweed-group sway-1" style={{ transformOrigin: "150px 720px" }}>
              <path d="M150 720 Q120 630 160 550 T140 450" />
              <path d="M170 720 Q200 640 170 560 T190 470" stroke="#1dd1a1" strokeWidth="8" />
            </g>

            {/* Cụm 2 */}
            <g className="seaweed-group sway-2" style={{ transformOrigin: "600px 730px" }}>
              <path d="M600 730 Q630 650 600 570 T630 480" stroke="#1dd1a1" />
              <path d="M620 730 Q590 660 625 580 T595 500" stroke="#10ac84" strokeWidth="8" />
            </g>

            {/* Cụm 3 */}
            <g className="seaweed-group sway-3" style={{ transformOrigin: "1020px 710px" }}>
              <path d="M1020 710 Q980 620 1030 530 T990 440" />
              <path d="M1040 710 Q1070 630 1035 550 T1060 470" stroke="#1dd1a1" strokeWidth="7" />
            </g>
          </g>

          {/* Sao biển */}
          <path d="M420 680 L424 690 L435 690 L426 697 L429 708 L420 701 L411 708 L414 697 L405 690 L416 690 Z" fill="#ff9ff3" />
          <path d="M820 670 L823 678 L832 678 L825 683 L827 691 L820 686 L813 691 L815 683 L808 678 L817 678 Z" fill="#fabca1" />
        </svg>
      </div>

      {/* Bong bóng khí nổi lên */}
      <div className="ocean-bubbles-container">
        <span className="bubble b1" />
        <span className="bubble b2" />
        <span className="bubble b3" />
        <span className="bubble b4" />
        <span className="bubble b5" />
      </div>
    </div>
  );
}
