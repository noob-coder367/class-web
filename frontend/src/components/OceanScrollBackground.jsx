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

  // Biến đổi độ cao theo cuộn trang
  const skyY = scrollProgress * -200;
  const boatY = scrollProgress * -150;
  const wavesY = scrollProgress * -100;
  const seabedY = Math.max(0, (1 - scrollProgress) * 300);

  // Mức độ hiển thị: Giúp mặt nước luôn hiện ở đầu và Đáy biển hiện mượt từ giữa trang
  const surfaceOpacity = clamp(1 - scrollProgress * 1.5);
  const deepOpacity = clamp((scrollProgress - 0.15) * 2);
  const seabedOpacity = clamp((scrollProgress - 0.3) * 2);

  return (
    <div className="ocean-background" style={{ "--sea-depth": scrollProgress }} aria-hidden="true">
      {/* Dynamic Ocean Gradient */}
      <div className="ocean-base-gradient" />

      <div className="ocean-content-wrapper">
        {/* =====================================================
            1. BẦU TRỜI & NÚI (Cố định đỉnh màn hình)
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMin slice"
          style={{
            transform: `translate3d(0, ${skyY}px, 0)`,
            opacity: surfaceOpacity,
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

          {/* Dãy núi */}
          <polygon points="100,480 350,260 600,480" fill="#8cb3a2" opacity="0.7" />
          <polygon points="450,480 750,210 1050,480" fill="#6d9987" opacity="0.85" />
        </svg>

        {/* =====================================================
            2. SÓNG MẶT BIỂN & THUYỀN (SÂN ĐẦU LẠI XUẤT HIỆN)
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMin slice"
          style={{
            transform: `translate3d(0, ${wavesY}px, 0)`,
            opacity: surfaceOpacity,
          }}
        >
          {/* Sóng tầng sau */}
          <path
            d="M0 380 Q300 350 600 375 T1200 380 L1200 800 L0 800 Z"
            fill="#31a2c9"
            opacity="0.85"
          />

          {/* CON THUYỀN - Đặt vị trí vừa tầm mắt */}
          <g transform={`translate(0, ${boatY - wavesY})`}>
            <g transform="translate(600, 310)" className="ocean-boat-motion">
              <path d="M-8 -140 L-100 40 L-8 40 Z" fill="#ffffff" />
              <path d="M8 -120 L80 40 L8 40 Z" fill="#ffe2e2" />
              <rect x="-5" y="-155" width="10" height="200" rx="2" fill="#5c3a21" />
              <path d="M5 -155 L45 -140 L5 -125 Z" fill="#ff4d4d" />
              <path d="M-100 40 L100 40 L75 95 L-75 95 Z" fill="#a8322a" />
              <path d="M-85 60 L85 60 L70 90 L-70 90 Z" fill="#d6453d" />
              <circle cx="-35" cy="72" r="6" fill="#1b3947" />
              <circle cx="0" cy="72" r="6" fill="#1b3947" />
              <circle cx="35" cy="72" r="6" fill="#1b3947" />
            </g>
          </g>

          {/* Sóng tầng trước phủ xuống toàn bộ thân dưới */}
          <path
            d="M0 420 Q300 390 600 420 T1200 415 L1200 800 L0 800 Z"
            fill="#2382a6"
          />
        </svg>

        {/* =====================================================
            3. CÁ VÀ SINH VẬT TẦNG GIỮA
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid slice"
          style={{ opacity: deepOpacity }}
        >
          {/* Rùa biển */}
          <g transform="translate(380, 380)" className="turtle-swim">
            <ellipse cx="0" cy="0" rx="36" ry="25" fill="#2d7a53" />
            <circle cx="32" cy="-8" r="10" fill="#2d7a53" />
            <path d="M10 -15 Q35 -45 55 -30 Q35 -8 8 -12" fill="#256644" />
            <path d="M10 15 Q35 45 55 30 Q35 8 8 12" fill="#256644" />
          </g>

          {/* Bạch tuộc */}
          <g transform="translate(780, 420)" className="octopus-float">
            <path d="M-30 0 C-30 -40 30 -40 30 0 C30 15 15 22 0 22 C-15 22 -30 15 -30 0 Z" fill="#d9534f" />
            <circle cx="-10" cy="-8" r="4" fill="#fff" />
            <circle cx="10" cy="-8" r="4" fill="#fff" />
          </g>
        </svg>

        {/* =====================================================
            4. ĐÁY BIỂN VÀ RONG RÊU (GẮN CHẶT DƯỚI ĐÁY MÀN HÌNH)
        ===================================================== */}
        <svg
          className="ocean-layer"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMax slice"
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

          {/* Đồi cát Đáy biển */}
          <path d="M0 600 Q300 540 600 580 T1200 560 L1200 800 L0 800 Z" fill="url(#sandGrad)" />

          {/* RONG RÊU GPU Smooth */}
          <g stroke="#10ac84" strokeWidth="10" strokeLinecap="round" fill="none">
            <g className="seaweed-group sway-1" style={{ transformOrigin: "150px 720px" }}>
              <path d="M150 720 Q120 630 160 530 T140 410" />
              <path d="M170 720 Q200 640 170 540 T190 430" stroke="#1dd1a1" strokeWidth="8" />
            </g>
            <g className="seaweed-group sway-2" style={{ transformOrigin: "600px 730px" }}>
              <path d="M600 730 Q630 650 600 550 T630 440" stroke="#1dd1a1" />
            </g>
            <g className="seaweed-group sway-1" style={{ transformOrigin: "1020px 710px" }}>
              <path d="M1020 710 Q980 620 1030 510 T990 400" />
            </g>
          </g>

          {/* Sao biển */}
          <path d="M420 660 L424 670 L435 670 L426 677 L429 688 L420 681 L411 688 L414 677 L405 670 L416 670 Z" fill="#ff9ff3" />
        </svg>
      </div>

      {/* Bong bóng khí */}
      <div className="ocean-bubbles-container">
        <span className="bubble b1" />
        <span className="bubble b2" />
        <span className="bubble b3" />
        <span className="bubble b4" />
      </div>
    </div>
  );
}
