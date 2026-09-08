import { useEffect, useRef, useState } from "react";
import "./OceanScrollBackground.css";

const VIEW_W = 1200;
const VIEW_H = 800;

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export default function OceanScrollBackground() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const animationFrame = useRef(null);

  useEffect(() => {
    const updateScroll = () => {
      if (animationFrame.current) return;
      animationFrame.current = requestAnimationFrame(() => {
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const maxScroll = Math.max(1, docHeight - viewHeight);
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

  /* SCROLL VALUES (giữ nguyên logic cũ) */
  const mountainX = scrollProgress * -45;
  const mountainY = scrollProgress * 35;
  const farMountainX = scrollProgress * -20;
  const boatScrollY = scrollProgress * 18;

  /* MÀU BIỂN ĐẬM DẦN KHI SCROLL XUỐNG (đúng yêu cầu) */
  const seaDepth = clamp(scrollProgress * 1.35);
  const underwaterOpacity = clamp((scrollProgress - 0.15) * 1.25);
  const deepSeaOpacity = clamp((scrollProgress - 0.5) * 2);
  const fishOpacity = clamp((scrollProgress - 0.1) * 1.5);
  const sunOpacity = clamp(1 - scrollProgress * 1.25);
  const skyOpacity = clamp(1 - scrollProgress * 0.9);

  const sceneStyle = {
    "--scroll": scrollProgress,
    "--sea-depth": seaDepth,
    "--underwater-opacity": underwaterOpacity,
    "--deep-sea-opacity": deepSeaOpacity,
    "--mountain-x": `${mountainX}px`,
    "--mountain-y": `${mountainY}px`,
    "--far-mountain-x": `${farMountainX}px`,
  };

  return (
    <div
      className="ocean-background"
      style={sceneStyle}
      aria-hidden="true"
    >
      {/* BASE */}
      <div className="ocean-base" />

      {/* SKY */}
      <svg
        className="ocean-layer ocean-sky-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="skyGradientOcean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#83ccef" />
            <stop offset="55%" stopColor="#b7e0ec" />
            <stop offset="100%" stopColor="#e0f1ef" />
          </linearGradient>
          <radialGradient id="sunGlowOcean">
            <stop offset="0%" stopColor="#fffbd2" stopOpacity="1" />
            <stop offset="35%" stopColor="#ffe68b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffe68b" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g style={{ opacity: skyOpacity }}>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#skyGradientOcean)" />

          {/* SUN */}
          <g className="ocean-sun-group">
            <circle cx="190" cy="145" r="125" fill="url(#sunGlowOcean)" />
            <circle
              className="ocean-sun"
              cx="190"
              cy="145"
              r="52"
              fill="#fff3a6"
              style={{ opacity: sunOpacity }}
            />
            <g className="ocean-sun-rays" stroke="#fff6bc" strokeWidth="8" strokeLinecap="round">
              <line x1="190" y1="65" x2="190" y2="25" />
              <line x1="250" y1="85" x2="280" y2="55" />
              <line x1="275" y1="145" x2="320" y2="145" />
              <line x1="250" y1="205" x2="280" y2="235" />
              <line x1="130" y1="85" x2="100" y2="55" />
              <line x1="105" y1="145" x2="60" y2="145" />
            </g>
          </g>

          {/* CLOUD 1 */}
          <g className="ocean-cloud ocean-cloud-one">
            <ellipse cx="520" cy="130" rx="105" ry="30" fill="#ffffff" opacity="0.75" />
            <ellipse cx="455" cy="125" rx="65" ry="27" fill="#ffffff" opacity="0.88" />
            <ellipse cx="540" cy="105" rx="65" ry="38" fill="#ffffff" />
            <ellipse cx="615" cy="125" rx="58" ry="27" fill="#ffffff" opacity="0.9" />
          </g>

          {/* CLOUD 2 */}
          <g className="ocean-cloud ocean-cloud-two">
            <ellipse cx="1000" cy="205" rx="115" ry="32" fill="#ffffff" opacity="0.65" />
            <ellipse cx="940" cy="195" rx="65" ry="30" fill="#ffffff" opacity="0.75" />
            <ellipse cx="1035" cy="175" rx="70" ry="40" fill="#ffffff" opacity="0.85" />
          </g>

          {/* BIRDS */}
          <g className="ocean-birds" fill="none" stroke="#3f5668" strokeWidth="3" strokeLinecap="round">
            <path d="M700 105 Q712 92 724 105 Q736 92 748 105" />
            <path d="M760 145 Q770 134 780 145 Q790 134 800 145" />
            <path d="M850 100 Q860 90 870 100 Q880 90 890 100" />
          </g>
        </g>
      </svg>

      {/* WATER BASE */}
      <div className="ocean-water-base" />

      {/* LIGHT RAYS */}
      <svg
        className="ocean-layer ocean-light-rays-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="ocean-water-rays" opacity={underwaterOpacity}>
          <polygon points="180,310 270,310 480,800 390,800" fill="#bff8ff" opacity="0.1" />
          <polygon points="500,300 580,300 720,800 640,800" fill="#c9fbff" opacity="0.09" />
          <polygon points="820,300 900,300 980,800 900,800" fill="#b9f6ff" opacity="0.08" />
        </g>
      </svg>

      {/* MOUNTAINS - ĐI XUỐNG DƯỚI KHI SCROLL XUỐNG */}
      <svg
        className="ocean-layer ocean-mountain-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="farMountain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d9d0b4" />
            <stop offset="100%" stopColor="#9b8d72" />
          </linearGradient>
          <linearGradient id="frontMountain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c3aa7c" />
            <stop offset="100%" stopColor="#685540" />
          </linearGradient>
        </defs>

        <g transform={`translate(${farMountainX} ${scrollProgress * 15})`}>
          <polygon points="720,410 820,155 930,290 1040,185 1200,340 1200,800 720,800" fill="url(#farMountain)" opacity="0.85" />
          <polygon points="820,155 865,265 830,235 790,310" fill="#f8f0df" opacity="0.75" />
        </g>

        <g transform={`translate(${mountainX} ${mountainY})`}>
          <polygon points="840,800 930,300 1010,385 1120,250 1200,390 1200,800" fill="url(#frontMountain)" />
          <polygon points="930,300 970,380 945,360 900,460" fill="#efe3c9" opacity="0.5" />
        </g>
      </svg>

      {/* WAVE 1 */}
      <svg
        className="ocean-layer ocean-wave-one-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="wave-one-motion">
          <path d="M-100 470 Q0 410 100 465 T300 455 T500 445 T700 465 T900 440 T1100 460 T1300 445 L1300 800 L-100 800 Z" fill="#278eb8" opacity="0.8" />
          <path d="M-100 475 Q0 425 100 470 T300 460 T500 450 T700 470 T900 445 T1100 465 T1300 450" fill="none" stroke="#9be8f2" strokeWidth="10" opacity="0.3" />
        </g>
      </svg>

      {/* BOAT - LÊN CAO KHI SCROLL XUỐNG */}
      <svg
        className="ocean-layer ocean-boat-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(390 ${310 + boatScrollY})`}>
          <g className="ocean-boat-motion">
            <ellipse cx="0" cy="215" rx="155" ry="17" fill="#164b67" opacity="0.22" />
            <path d="M-12 -250 L-180 95 L-12 95 Z" fill="#fff7e5" />
            <path d="M-12 -245 L-145 95 L-95 95 Z" fill="#f0c5ce" opacity="0.8" />
            <path d="M15 -220 L155 95 L15 95 Z" fill="#fffdf3" />
            <path d="M15 -220 L70 95 L15 95 Z" fill="#e8e2d2" opacity="0.7" />
            <rect x="-9" y="-270" width="18" height="385" rx="4" fill="#6c472c" />
            <rect x="-5" y="-265" width="5" height="375" fill="#8c6542" opacity="0.8" />
            <path d="M8 -270 L85 -245 L8 -220 Z" fill="#dc5246" />
            <path d="M-175 100 L180 100 L160 128 L-155 128 Z" fill="#c94339" />
            <path d="M-165 125 L165 125 L115 205 L-110 205 Z" fill="#9f2f2b" />
            <path d="M-145 128 L145 128 L115 155 L-125 155 Z" fill="#d34d42" />
            <circle cx="-80" cy="155" r="11" fill="#203f4f" />
            <circle cx="-30" cy="155" r="11" fill="#203f4f" />
            <circle cx="20" cy="155" r="11" fill="#203f4f" />
            <circle cx="70" cy="155" r="11" fill="#203f4f" />
          </g>
        </g>
      </svg>

      {/* WAVE 2 */}
      <svg
        className="ocean-layer ocean-wave-two-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="wave-two-motion">
          <path d="M-100 500 Q0 465 100 505 T300 495 T500 510 T700 485 T900 505 T1100 490 T1300 510 L1300 800 L-100 800 Z" fill="#38b7d3" opacity="0.93" />
          <path d="M-100 500 Q0 465 100 505 T300 495 T500 510 T700 485 T900 505 T1100 490 T1300 510" fill="none" stroke="#c8f8ff" strokeWidth="13" opacity="0.52" />
        </g>
      </svg>

      {/* FISH */}
      <svg
        className="ocean-layer ocean-fish-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ opacity: fishOpacity }}
      >
        <g transform="translate(260 590)" className="fish fish-a">
          <g className="fish-swim fish-swim-a">
            <ellipse cx="0" cy="0" rx="48" ry="21" fill="#176f95" />
            <path d="M-40 0 L-78 -28 L-78 28 Z" fill="#125b7c" />
            <path d="M-5 5 Q10 28 Q25 20 Q12 4 Z" fill="#155f81" />
            <circle cx="28" cy="-6" r="4" fill="#0b2635" />
          </g>
        </g>
        <g transform="translate(620 670)" className="fish fish-b">
          <g className="fish-swim fish-swim-b">
            <ellipse cx="0" cy="0" rx="38" ry="17" fill="#3c95b4" />
            <path d="M-32 0 L-62 -22 L-62 22 Z" fill="#287894" />
            <path d="M-5 5 Q10 24 Q20 17 Q10 3 Z" fill="#277993" />
            <circle cx="22" cy="-5" r="3.5" fill="#092737" />
          </g>
        </g>
        <g transform="translate(980 610)" className="fish fish-c">
          <g className="fish-swim fish-swim-c">
            <ellipse cx="0" cy="0" rx="27" ry="13" fill="#2b7e9e" />
            <path d="M-23 0 L-48 -17 L-48 17 Z" fill="#1e617c" />
            <circle cx="16" cy="-4" r="3" fill="#0a2634" />
          </g>
        </g>
      </svg>

      {/* BUBBLES */}
      <div className="ocean-bubbles" style={{ opacity: underwaterOpacity }}>
        <span className="ocean-bubble bubble-1" />
        <span className="ocean-bubble bubble-2" />
        <span className="ocean-bubble bubble-3" />
        <span className="ocean-bubble bubble-4" />
        <span className="ocean-bubble bubble-5" />
        <span className="ocean-bubble bubble-6" />
      </div>

      {/* DEEP SEA DARKNESS */}
      <div className="ocean-deep-overlay" style={{ opacity: deepSeaOpacity }} />

      {/* SHIMMER */}
      <div className="ocean-shimmer" />
    </div>
  );
}
