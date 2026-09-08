import { useEffect, useState } from "react";
import "./OceanScrollBackground.css";

const VIEW_W = 1000;
const VIEW_H = 700;

export default function OceanScrollBackground() {
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const max =
        document.documentElement.scrollHeight -
        window.innerHeight;

      const progress =
        max > 0 ? window.scrollY / max : 0;

      setScroll(Math.min(1, Math.max(0, progress)));
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    handleScroll();

    return () =>
      window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="osb-root" aria-hidden="true">

      {/* =====================================================
          LAYER 0 — SKY + SUN
      ===================================================== */}

      <svg
        className="osb-layer osb-sky"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient
            id="skyGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#7bc8f6" />
            <stop offset="45%" stopColor="#a9d9ef" />
            <stop offset="100%" stopColor="#d9f1f5" />
          </linearGradient>

          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#fffbd7" />
            <stop offset="35%" stopColor="#ffe992" />
            <stop
              offset="100%"
              stopColor="#ffd057"
              stopOpacity="0"
            />
          </radialGradient>
        </defs>

        {/* SKY */}

        <rect
          width={VIEW_W}
          height={VIEW_H}
          fill="url(#skyGradient)"
        />

        {/* SUN GLOW */}

        <circle
          cx="145"
          cy="130"
          r="135"
          fill="url(#sunGlow)"
          opacity="0.9"
        />

        {/* SUN */}

        <circle
          className="osb-sun"
          cx="145"
          cy="130"
          r="48"
          fill="#fff4b0"
        />

        {/* SUN RAYS */}

        <g className="osb-sun-rays">

          <line
            x1="145"
            y1="45"
            x2="145"
            y2="5"
          />

          <line
            x1="215"
            y1="60"
            x2="245"
            y2="25"
          />

          <line
            x1="225"
            y1="130"
            x2="275"
            y2="130"
          />

          <line
            x1="75"
            y1="60"
            x2="45"
            y2="25"
          />

          <line
            x1="65"
            y1="130"
            x2="15"
            y2="130"
          />

        </g>

        {/* CLOUDS */}

        <g className="osb-cloud osb-cloud-1">

          <ellipse
            cx="390"
            cy="120"
            rx="85"
            ry="25"
            fill="white"
            opacity="0.9"
          />

          <ellipse
            cx="450"
            cy="105"
            rx="55"
            ry="28"
            fill="white"
          />

          <ellipse
            cx="330"
            cy="110"
            rx="50"
            ry="22"
            fill="#f5fcff"
          />

        </g>

        <g className="osb-cloud osb-cloud-2">

          <ellipse
            cx="760"
            cy="185"
            rx="100"
            ry="30"
            fill="white"
            opacity="0.75"
          />

          <ellipse
            cx="825"
            cy="170"
            rx="55"
            ry="25"
            fill="white"
            opacity="0.8"
          />

        </g>

        {/* SMALL BIRDS */}

        <g
          fill="none"
          stroke="#34495e"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M250 90 Q260 80 270 90 Q280 80 290 90" />

          <path d="M310 125 Q320 115 330 125 Q340 115 350 125" />

          <path d="M680 80 Q690 70 700 80 Q710 70 720 80" />
        </g>

      </svg>


      {/* =====================================================
          WATER BASE
      ===================================================== */}

      <div
        className="osb-water-base"
        style={{
          opacity: 1,
        }}
      />


      {/* =====================================================
          LAYER 1 — WAVE 1 (BEHIND BOAT)
      ===================================================== */}

      <svg
        className="osb-layer osb-wave-one"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >

        <path
          d="
            M0 360
            L60 320
            L120 370
            L190 300
            L260 360
            L330 310
            L400 375
            L470 295
            L540 355
            L610 310
            L680 365
            L750 300
            L820 360
            L890 310
            L1000 360
            L1000 700
            L0 700
            Z
          "
          fill="#218ab8"
          opacity="0.82"
        />

      </svg>


      {/* =====================================================
          LAYER 2 — BOAT
      ===================================================== */}

      <svg
        className="osb-layer osb-boat-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `translateY(${scroll * 40}px)`,
        }}
      >

        <g
          className="osb-boat"
          transform="translate(330 330)"
        >

          {/* Shadow */}

          <ellipse
            cx="0"
            cy="150"
            rx="145"
            ry="20"
            fill="#123f5a"
            opacity="0.25"
          />


          {/* BOAT BODY */}

          <path
            d="
              M-155 80
              L160 80
              L115 155
              L-105 155
              Z
            "
            fill="#a92e2a"
          />

          <path
            d="
              M-155 80
              L160 80
              L145 105
              L-140 105
              Z
            "
            fill="#d34b40"
          />


          {/* Mast */}

          <rect
            x="-8"
            y="-270"
            width="16"
            height="350"
            fill="#704628"
          />


          {/* LEFT SAIL */}

          <path
            d="
              M-12 -250
              L-170 55
              L-12 55
              Z
            "
            fill="#fff6df"
          />

          <path
            d="
              M-12 -230
              L-135 55
            "
            stroke="#e7a0b2"
            strokeWidth="12"
            opacity="0.8"
          />


          {/* RIGHT SAIL */}

          <path
            d="
              M15 -210
              L145 55
              L15 55
              Z
            "
            fill="#fffaf0"
          />


          {/* FLAG */}

          <path
            d="
              M8 -270
              L80 -245
              L8 -220
              Z
            "
            fill="#e74c3c"
          />


          {/* WINDOWS */}

          <circle
            cx="-70"
            cy="110"
            r="12"
            fill="#243d4b"
          />

          <circle
            cx="-25"
            cy="110"
            r="12"
            fill="#243d4b"
          />

          <circle
            cx="20"
            cy="110"
            r="12"
            fill="#243d4b"
          />

          <circle
            cx="65"
            cy="110"
            r="12"
            fill="#243d4b"
          />

        </g>

      </svg>


      {/* =====================================================
          LAYER 3 — WAVE 2 (IN FRONT OF BOAT)
      ===================================================== */}

      <svg
        className="osb-layer osb-wave-two"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >

        <path
          d="
            M0 430
            L50 380
            L110 455
            L175 370
            L245 440
            L320 385
            L385 460
            L455 375
            L530 445
            L600 385
            L675 455
            L745 370
            L820 450
            L895 385
            L1000 440
            L1000 700
            L0 700
            Z
          "
          fill="#39b6d5"
          opacity="0.92"
        />

        {/* FOAM */}

        <path
          d="
            M0 430
            L50 380
            L110 455
            L175 370
            L245 440
            L320 385
            L385 460
            L455 375
            L530 445
            L600 385
            L675 455
            L745 370
            L820 450
            L895 385
            L1000 440
          "
          fill="none"
          stroke="#c9f7ff"
          strokeWidth="18"
          opacity="0.55"
        />

      </svg>


      {/* =====================================================
          LAYER 4 — MOUNTAINS (FOREGROUND)
      ===================================================== */}

      <svg
        className="osb-layer osb-mountain-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >

        <defs>

          <linearGradient
            id="mountainA"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#d5c19b"
            />

            <stop
              offset="100%"
              stopColor="#8c7658"
            />
          </linearGradient>

          <linearGradient
            id="mountainB"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#c0a87d"
            />

            <stop
              offset="100%"
              stopColor="#6d5943"
            />
          </linearGradient>

        </defs>


        {/* RIGHT MOUNTAIN */}

        <polygon
          points="
            700,390
            780,120
            900,250
            970,180
            1000,250
            1000,700
            700,700
          "
          fill="url(#mountainA)"
        />


        {/* FRONT MOUNTAIN */}

        <polygon
          points="
            760,700
            860,270
            940,350
            1000,240
            1000,700
          "
          fill="url(#mountainB)"
        />


        {/* SNOW / LIGHT */}

        <polygon
          points="
            780,120
            830,220
            800,190
            760,300
          "
          fill="#f5ecd8"
          opacity="0.55"
        />

      </svg>


      {/* =====================================================
          UNDERWATER / FISH
      ===================================================== */}

      <svg
        className="osb-layer osb-fish-layer"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          opacity:
            Math.min(1, Math.max(0, scroll * 2)),
        }}
      >

        {/* FISH 1 */}

        <g
          className="osb-fish osb-fish-a"
          transform="translate(250 520)"
        >

          <ellipse
            cx="0"
            cy="0"
            rx="42"
            ry="18"
            fill="#1d6c94"
          />

          <polygon
            points="-38,0 -75,-25 -75,25"
            fill="#175675"
          />

          <circle
            cx="25"
            cy="-5"
            r="4"
            fill="#111"
          />

        </g>


        {/* FISH 2 */}

        <g
          className="osb-fish osb-fish-b"
          transform="translate(560 550)"
        >

          <ellipse
            cx="0"
            cy="0"
            rx="32"
            ry="14"
            fill="#3b8eaf"
          />

          <polygon
            points="-28,0 -55,-18 -55,18"
            fill="#286b86"
          />

          <circle
            cx="20"
            cy="-4"
            r="3"
            fill="#111"
          />

        </g>

      </svg>


      {/* =====================================================
          DEEP WATER OVERLAY
      ===================================================== */}

      <div
        className="osb-deep-overlay"
        style={{
          opacity: scroll * 0.45,
        }}
      />

    </div>
  );
}