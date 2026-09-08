import { useEffect, useRef, useState } from "react";
import "./OceanScrollBackground.css";

const VIEW_W = 1200;
const VIEW_H = 800;
const WORLD_H = 2600; // Tổng chiều cao thế giới đại dương (từ bầu trời đến đáy biển)

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

  // Vị trí Camera Y trượt từ 0 (Mặt nước) xuống 1800 (Đáy biển)
  const maxCameraY = WORLD_H - VIEW_H;
  const cameraY = scrollProgress * maxCameraY;

  // Parallax nhẹ cho bầu trời và núi phía xa
  const skyParallaxY = cameraY * 0.4;
  const mountainParallaxY = cameraY * 0.25;

  // Độ mờ đục theo độ sâu
  const sunOpacity = clamp(1 - scrollProgress * 2.2);
  const skyOpacity = clamp(1 - scrollProgress * 1.8);
  const bubblesOpacity = clamp((scrollProgress - 0.1) * 2);

  return (
    <div className="ocean-background" aria-hidden="true">
      {/* Nền đệm màu chuyển mượt theo độ sâu */}
      <div
        className="ocean-base-gradient"
        style={{
          opacity: 1,
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
        viewBox={`0 ${cameraY} ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gradients */}
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

        {/* =========================================================
            1. BẦU TRỜI & NÚI (Có Parallax)
        ========================================================= */}
        <g transform={`translate(0, ${skyParallaxY})`}>
          {/* Bầu trời */}
          <rect x="0" y="0" width={VIEW_W} height="520" fill="url(#skyGrad)" opacity={skyOpacity} />

          {/* Mặt trời */}
          <g opacity={sunOpacity}>
            <circle cx="300" cy="160" r="110" fill="url(#sunGlow)" />
            <circle cx="300" cy="160" r="48" fill="#fff5b3" className="ocean-sun" />
          </g>

          {/* Mây */}
          <g className="ocean-cloud ocean-cloud-one" opacity={skyOpacity * 0.85}>
            <ellipse cx="500" cy="130" rx="90" ry="28" fill="#ffffff" />
            <ellipse cx="440" cy="125" rx="50" ry="22" fill="#ffffff" />
            <ellipse cx="550" cy="120" rx="55" ry="32" fill="#ffffff" />
          </g>
          <g className="ocean-cloud ocean-cloud-two" opacity={skyOpacity * 0.75}>
            <ellipse cx="880" cy="180" rx="100" ry="30" fill="#ffffff" />
            <ellipse cx="830" cy="175" rx="55" ry="25" fill="#ffffff" />
          </g>

          {/* Chim hải âu */}
          <g className="ocean-birds" stroke="#3f5668" strokeWidth="3" fill="none" opacity={skyOpacity}>
            <path d="M680 110 Q690 100 700 110 Q710 100 720 110" />
            <path d="M740 140 Q748 132 756 140 Q764 132 772 140" />
          </g>
        </g>

        <g transform={`translate(0, ${mountainParallaxY})`} opacity={skyOpacity}>
          {/* Núi xa */}
          <polygon points="600,520 750,220 900,380 1050,190 1200,520" fill="url(#farMountain)" opacity="0.7" />
          {/* Núi gần */}
          <polygon points="780,520 900,280 980,360 1100,230 1200,520" fill="#4d647a" />
        </g>

        {/* =========================================================
            2. KHỐI NƯỚC BIỂN LIÊN TỤC (TỪ MẶT NƯỚC XUỐNG ĐÁY)
        ========================================================= */}
        <rect x="0" y="500" width={VIEW_W} height={WORLD_H - 500} fill="url(#oceanWaterGrad)" />

        {/* Vệt sáng chiếu xuống nước */}
        <g className="ocean-light-rays" opacity={clamp(1 - scrollProgress * 1.5)}>
          <polygon points="250,500 380,500 580,1300 420,1300" fill="#c3f5ff" opacity="0.12" />
          <polygon points="550,500 650,500 820,1300 700,1300" fill="#c3f5ff" opacity="0.09" />
        </g>

        {/* =========================================================
            3. MẶT NƯỚC, SÓNG & THUYỀN (Sóng 1 -> Thuyền -> Sóng 2)
        ========================================================= */}
        {/* Sóng sau */}
        <g className="wave-motion-back">
          <path
            d="M-100 510 Q150 470 400 510 T900 500 T1400 515 L1400 700 L-100 700 Z"
            fill="#29a3c4"
            opacity="0.7"
          />
        </g>

        {/* Con thuyền */}
        <g transform="translate(520, 360)" opacity={skyOpacity} className="ocean-boat-motion">
          <ellipse cx="80" cy="155" rx="120" ry="14" fill="#0d3b52" opacity="0.25" />
          {/* Cánh buồm */}
          <path d="M70 -130 L-50 120 L70 120 Z" fill="#fff8eb" />
          <path d="M90 -110 L190 120 L90 120 Z" fill="#ffffff" />
          {/* Cột buồm & Cờ */}
          <rect x="75" y="-150" width="10" height="280" fill="#5c3a21" />
          <path d="M85 -150 L140 -132 L85 -115 Z" fill="#e63946" />
          {/* Thân thuyền */}
          <path d="M-60 120 L220 120 L190 160 L-30 160 Z" fill="#d62828" />
          <path d="M-45 138 L205 138 L185 160 L-30 160 Z" fill="#003049" opacity="0.3" />
          {/* Cửa sổ thuyền */}
          <circle cx="20" cy="142" r="7" fill="#fdf0d5" />
          <circle cx="60" cy="142" r="7" fill="#fdf0d5" />
          <circle cx="100" cy="142" r="7" fill="#fdf0d5" />
          <circle cx="140" cy="142" r="7" fill="#fdf0d5" />
        </g>

        {/* Sóng trước (che chân thuyền) */}
        <g className="wave-motion-front">
          <path
            d="M-100 525 Q200 490 500 530 T1100 515 T1400 530 L1400 700 L-100 700 Z"
            fill="#38b7d3"
            opacity="0.9"
          />
        </g>

        {/* =========================================================
            4. SINH VẬT TẦNG NÔNG (Y: 650 - 1100)
        ========================================================= */}
        {/* Rùa biển */}
        <g transform="translate(380, 780)" className="sea-turtle-anim">
          <ellipse cx="0" cy="0" rx="35" ry="25" fill="#2a9d8f" />
          <ellipse cx="0" cy="0" rx="28" ry="20" fill="#e9c46a" opacity="0.8" />
          <circle cx="38" cy="-5" r="9" fill="#2a9d8f" />
          {/* Vây rùa */}
          <path d="M15 -20 Q40 -45 5 -10" fill="#264653" />
          <path d="M15 20 Q40 45 5 10" fill="#264653" />
        </g>

        {/* Đàn cá hề & cá nhỏ */}
        <g transform="translate(720, 850)" className="fish-swim-right">
          <ellipse cx="0" cy="0" rx="22" ry="12" fill="#f4a261" />
          <path d="M-18 0 L-32 -10 L-32 10 Z" fill="#e76f51" />
          <rect x="-5" y="-11" width="6" height="22" fill="#ffffff" />
          <circle cx="12" cy="-3" r="2.5" fill="#000000" />
        </g>
        <g transform="translate(780, 890)" className="fish-swim-right-slow">
          <ellipse cx="0" cy="0" rx="16" ry="9" fill="#f4a261" />
          <path d="M-12 0 L-22 -7 L-22 7 Z" fill="#e76f51" />
          <rect x="-3" y="-8" width="4" height="16" fill="#ffffff" />
        </g>

        {/* Cá heo */}
        <g transform="translate(260, 1050)" className="dolphin-anim">
          <path d="M-50 0 Q0 -30 60 -5 Q30 20 -50 0 Z" fill="#4ea8de" />
          <path d="M60 -5 Q75 -8 85 -2 Q70 10 60 -5 Z" fill="#4ea8de" />
          <path d="M0 -18 L12 -38 L22 -14 Z" fill="#4895ef" />
          <circle cx="62" cy="-6" r="2" fill="#03045e" />
        </g>

        {/* =========================================================
            5. SINH VẬT TẦNG TRUNG & SÂU (Y: 1200 - 1800)
        ========================================================= */}
        {/* Cá đuối Manta */}
        <g transform="translate(680, 1320)" className="manta-anim">
          <path d="M0 -10 Q-90 -40 -120 10 Q-40 20 0 40 Q40 20 120 10 Q90 -40 0 -10 Z" fill="#1d3557" />
          <path d="M0 40 Q-5 90 -2 120" stroke="#1d3557" strokeWidth="4" fill="none" />
        </g>

        {/* Đàn sứa phát quang */}
        <g transform="translate(320, 1450)" className="jelly-float">
          <path d="M-25 0 Q-25 -30 0 -30 Q25 -30 25 0 Q12 8 0 3 Q-12 8 -25 0 Z" fill="#b8c0ff" opacity="0.75" />
          <path d="M-12 5 Q-15 30 -8 50" stroke="#e7c6ff" strokeWidth="2" fill="none" />
          <path d="M0 5 Q0 35 3 55" stroke="#e7c6ff" strokeWidth="2" fill="none" />
          <path d="M12 5 Q15 30 8 50" stroke="#e7c6ff" strokeWidth="2" fill="none" />
        </g>
        <g transform="translate(400, 1520)" className="jelly-float-delayed">
          <path d="M-18 0 Q-18 -22 0 -22 Q18 -22 18 0 Q9 6 0 2 Q-9 6 -18 0 Z" fill="#c8b6ff" opacity="0.7" />
          <path d="M-8 4 Q-10 25 -5 40" stroke="#e7c6ff" strokeWidth="1.5" fill="none" />
          <path d="M8 4 Q10 25 5 40" stroke="#e7c6ff" strokeWidth="1.5" fill="none" />
        </g>

        {/* Cá lồng đèn (Anglerfish) tầng tối */}
        <g transform="translate(780, 1820)" className="angler-anim">
          <path d="M-35 0 Q-35 -25 0 -20 Q30 -15 35 10 Q10 30 -35 0 Z" fill="#111d27" />
          {/* Cần phát sáng */}
          <path d="M15 -18 Q35 -40 45 -25" stroke="#4cc9f0" strokeWidth="2" fill="none" />
          <circle cx="46" cy="-23" r="6" fill="#72efdd" className="angler-light" />
          {/* Mắt & Mồm răng nhọn */}
          <circle cx="20" cy="-8" r="3" fill="#ff0054" />
          <path d="M10 8 L15 0 L20 8 L25 0 L30 8" stroke="#ffffff" strokeWidth="1.5" fill="none" />
        </g>

        {/* =========================================================
            6. ĐÁY BIỂN, RONG RÊU, SAN HÔ & KHO BÁU (Y: 2000 - 2600)
        ========================================================= */}
        {/* Nền đất đáy biển */}
        <path
          d="M0 2250 Q250 2180 500 2220 T1000 2190 Q1120 2210 1200 2230 L1200 2600 L0 2600 Z"
          fill="url(#seabedGrad)"
        />
        <path
          d="M0 2320 Q350 2270 700 2330 T1200 2300 L1200 2600 L0 2600 Z"
          fill="url(#sandGrad)"
        />

        {/* Rạn san hô (Corals) */}
        <g transform="translate(180, 2260)">
          {/* San hô sừng hươu */}
          <path d="M0 60 L-10 20 L-25 0 L-12 15 L0 30 L15 5 L10 25 L25 0 L15 35 Z" fill="#f72585" />
          <path d="M40 70 L30 30 L15 10 L28 25 L40 40 L55 15 L50 35 L65 10 L55 45 Z" fill="#7209b7" />
          {/* San hô quạt */}
          <path d="M100 80 Q130 10 160 80 Z" fill="#4cc9f0" opacity="0.8" />
        </g>

        <g transform="translate(920, 2250)">
          <path d="M0 80 Q30 20 60 80 Z" fill="#ff9e00" opacity="0.85" />
          <path d="M40 90 L25 40 L10 15 L25 30 L40 50 L55 20 L50 45 Z" fill="#f72585" />
        </g>

        {/* Rừng rong rêu đung đưa (Kelp Forest) */}
        <g className="kelp-group">
          {/* Dải rong rêu 1 */}
          <path
            d="M 120 2380 Q 140 2280 110 2180 T 130 1980"
            stroke="#2d6a4f"
            strokeWidth="18"
            fill="none"
            strokeLinecap="round"
            className="kelp-sway-1"
          />
          <path
            d="M 120 2380 Q 140 2280 110 2180 T 130 1980"
            stroke="#52b788"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className="kelp-sway-1"
          />

          {/* Dải rong rêu 2 */}
          <path
            d="M 260 2400 Q 230 2300 270 2180 T 240 2020"
            stroke="#1b4332"
            strokeWidth="22"
            fill="none"
            strokeLinecap="round"
            className="kelp-sway-2"
          />

          {/* Dải rong rêu 3 */}
          <path
            d="M 850 2390 Q 880 2280 840 2150 T 870 1990"
            stroke="#2d6a4f"
            strokeWidth="20"
            fill="none"
            strokeLinecap="round"
            className="kelp-sway-3"
          />

          {/* Dải rong rêu 4 */}
          <path
            d="M 1020 2380 Q 990 2260 1030 2140 T 1000 2000"
            stroke="#40916c"
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
            className="kelp-sway-2"
          />
        </g>

        {/* Mỏ neo cổ & Rương kho báu */}
        <g transform="translate(680, 2330)">
          {/* Mỏ neo chìm */}
          <path
            d="M0 0 L0 60 M-25 45 Q0 65 25 45 M-10 0 L10 0"
            stroke="#4a5568"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          {/* Rương kho báu */}
          <rect x="40" y="25" width="50" height="35" rx="4" fill="#7f4f24" />
          <path d="M40 25 Q65 10 90 25 Z" fill="#936639" />
          <rect x="61" y="37" width="8" height="10" fill="#e9c46a" />
          {/* Vàng phát sáng xung quanh */}
          <circle cx="35" cy="55" r="4" fill="#e9c46a" />
          <circle cx="45" cy="58" r="3" fill="#f4a261" />
          <circle cx="95" cy="56" r="3.5" fill="#e9c46a" />
        </g>

        {/* Cua đỏ & Sao biển trên cát */}
        <g transform="translate(460, 2370)">
          {/* Cua */}
          <ellipse cx="0" cy="0" rx="14" ry="9" fill="#e63946" />
          <circle cx="-5" cy="-10" r="2" fill="#000" />
          <circle cx="5" cy="-10" r="2" fill="#000" />
          {/* Càng cua */}
          <path d="M-10 -4 Q-20 -15 -12 -20 Q-5 -12 -8 -4" fill="#e63946" />
          <path d="M10 -4 Q20 -15 12 -20 Q5 -12 8 -4" fill="#e63946" />
        </g>

        {/* Sao biển */}
        <g transform="translate(580, 2385)" fill="#ff70a6">
          <path d="M0 -12 L3 -4 L11 -4 L5 1 L7 9 L0 4 L-7 9 L-5 1 L-11 -4 L-3 -4 Z" />
        </g>
      </svg>

      {/* Bong bóng khí nổi lên liên tục */}
      <div
        className="ocean-bubbles-container"
        style={{ opacity: bubblesOpacity }}
      >
        <span className="bubble b1" />
        <span className="bubble b2" />
        <span className="bubble b3" />
        <span className="bubble b4" />
        <span className="bubble b5" />
        <span className="bubble b6" />
        <span className="bubble b7" />
        <span className="bubble b8" />
      </div>

      {/* Lớp bóng tối mờ ảo tầng cực sâu */}
      <div
        className="ocean-abyss-darkness"
        style={{ opacity: clamp((scrollProgress - 0.65) * 2.5) }}
      />
    </div>
  );
}
