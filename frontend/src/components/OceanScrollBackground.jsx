import { useEffect, useRef, useState } from "react";
import "./OceanScrollBackground.css";

const WAVE_A =
  "M0,92 L52,64 L96,108 L156,52 L214,102 L268,60 L328,114 L392,50 L456,100 L518,58 L578,112 L640,54 L700,98 L760,62 L820,110 L880,56 L940,104 L1000,66 L1060,108 L1120,58 L1200,92 V160 H0 Z";

const WAVE_B =
  "M0,86 L70,50 L130,112 L200,46 L270,104 L340,58 L410,118 L490,44 L560,96 L630,52 L700,114 L780,48 L850,100 L920,60 L990,116 L1070,50 L1140,98 L1200,86 V160 H0 Z";

const FOAM =
  "M0,92 L52,64 L96,88 L156,52 L214,82 L268,60 L328,90 L392,50 L456,80 L518,58 L578,88 L640,54 L700,78 L760,62 L820,86 L880,56 L940,82 L1000,66 L1060,86 L1120,58 L1200,92 V102 L1120,72 L1060,98 L1000,80 L940,96 L880,70 L820,98 L760,76 L700,92 L640,68 L578,100 L518,72 L456,94 L392,64 L328,102 L268,74 L214,96 L156,66 L96,100 L52,78 L0,102 Z";

function WaveStrip({ className, fill, d, foam }) {
  return (
    <svg
      className={`osb-wave ${className}`}
      viewBox="0 0 2400 160"
      preserveAspectRatio="none"
    >
      <path d={d} fill={fill} />
      <path d={d} fill={fill} transform="translate(1200 0)" />

      {foam && (
        <>
          <path d={FOAM} fill="rgba(255,255,255,0.55)" />
          <path
            d={FOAM}
            fill="rgba(255,255,255,0.45)"
            transform="translate(1200 0)"
          />
        </>
      )}
    </svg>
  );
}

function useViewportUnit() {
  useEffect(() => {
    let raf = null;

    const setViewport = () => {
      if (raf) cancelAnimationFrame(raf);

      raf = requestAnimationFrame(() => {
        const width =
          window.visualViewport?.width || window.innerWidth;

        const height =
          window.visualViewport?.height || window.innerHeight;

        document.documentElement.style.setProperty(
          "--osb-vh",
          `${height * 0.01}px`
        );

        document.documentElement.style.setProperty(
          "--osb-vw",
          `${width * 0.01}px`
        );
      });
    };

    setViewport();

    window.addEventListener("resize", setViewport);
    window.addEventListener("orientationchange", setViewport);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setViewport);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);

      window.removeEventListener("resize", setViewport);
      window.removeEventListener("orientationchange", setViewport);

      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          setViewport
        );
      }
    };
  }, []);
}

export default function OceanScrollBackground() {
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);

  useViewportUnit();

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;

      ticking.current = true;

      requestAnimationFrame(() => {
        const doc = document.documentElement;

        const max =
          doc.scrollHeight - doc.clientHeight;

        const nextProgress =
          max > 0
            ? Math.min(
                1,
                Math.max(
                  0,
                  window.scrollY / max
                )
              )
            : 0;

        setProgress(nextProgress);

        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    onScroll();

    return () => {
      window.removeEventListener(
        "scroll",
        onScroll
      );
    };
  }, []);

  // Parallax
  const cloudY = progress * -40;
  const mountainY = progress * 60;
  const boatY = progress * 180;
  const lighthouseY = progress * 90;

  // Opacity
  const boatOpacity = Math.max(
    0,
    1 - progress * 3.2
  );

  const rayOpacity = Math.max(
    0,
    1 - progress * 2.2
  );

  const waveOpacity = Math.max(
    0,
    1 - progress * 1.8
  );

  const fishOpacity = Math.min(
    1,
    Math.max(
      0,
      (progress - 0.35) * 2.4
    )
  );

  const bubbleOpacity = Math.min(
    1,
    progress * 1.6
  );

  const deepGlowOpacity = Math.min(
    0.9,
    Math.max(
      0,
      (progress - 0.6) * 2.5
    )
  );

  const skyFade = Math.max(
    0,
    1 - progress * 2
  );

  const whaleOpacity = Math.min(
    1,
    Math.max(
      0,
      (progress - 0.5) * 2.6
    )
  );

  const sharkOpacity = Math.min(
    1,
    Math.max(
      0,
      (progress - 0.68) * 3.2
    )
  );

  const seabedOpacity = Math.min(
    1,
    Math.max(
      0,
      (progress - 0.55) * 2.6
    )
  );

  return (
    <div className="osb-root" aria-hidden="true">

      {/* ================= SKY ================= */}

      <svg
        className="osb-sky-layer"
        style={{
          transform: `translateY(${cloudY}px)`,
          opacity: skyFade,
        }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id="osb-sky-grad"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#7ec8ff"
            />

            <stop
              offset="38%"
              stopColor="#9ad4f5"
            />

            <stop
              offset="72%"
              stopColor="#c9e9fb"
            />

            <stop
              offset="100%"
              stopColor="#e7f6ff"
            />
          </linearGradient>

          <radialGradient
            id="osb-sun-core"
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop
              offset="0%"
              stopColor="#fffdf2"
            />

            <stop
              offset="55%"
              stopColor="#ffe58a"
            />

            <stop
              offset="100%"
              stopColor="#ffc14a"
              stopOpacity="0"
            />
          </radialGradient>

          <linearGradient
            id="osb-ray"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#fff6c4"
              stopOpacity="0.55"
            />

            <stop
              offset="100%"
              stopColor="#fff6c4"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        <rect
          width="400"
          height="300"
          fill="url(#osb-sky-grad)"
        />

        {/* Sun */}

        <g
          className="osb-sun"
          style={{
            opacity: rayOpacity,
          }}
        >
          <circle
            cx="78"
            cy="42"
            r="70"
            fill="url(#osb-sun-core)"
          />

          <circle
            cx="78"
            cy="42"
            r="18"
            fill="#fff8d2"
          />

          <g className="osb-sun-rays">
            <polygon
              points="78,42 28,-20 52,-28"
              fill="url(#osb-ray)"
            />

            <polygon
              points="78,42 70,-40 92,-42"
              fill="url(#osb-ray)"
            />

            <polygon
              points="78,42 118,-26 138,-14"
              fill="url(#osb-ray)"
            />

            <polygon
              points="78,42 -10,80 6,108"
              fill="url(#osb-ray)"
              opacity="0.55"
            />

            <polygon
              points="78,42 40,120 62,160"
              fill="url(#osb-ray)"
              opacity="0.4"
            />
          </g>
        </g>

        {/* Clouds */}

        <g className="osb-clouds osb-clouds--slow">
          <ellipse
            cx="210"
            cy="48"
            rx="52"
            ry="16"
            fill="#ffffff"
          />

          <ellipse
            cx="246"
            cy="42"
            rx="34"
            ry="14"
            fill="#ffffff"
            opacity="0.92"
          />

          <ellipse
            cx="178"
            cy="46"
            rx="28"
            ry="12"
            fill="#f4fbff"
            opacity="0.9"
          />
        </g>

        <g
          className="osb-clouds osb-clouds--fast"
          opacity="0.85"
        >
          <ellipse
            cx="40"
            cy="88"
            rx="46"
            ry="14"
            fill="#ffffff"
          />

          <ellipse
            cx="72"
            cy="82"
            rx="28"
            ry="12"
            fill="#ffffff"
          />

          <ellipse
            cx="330"
            cy="110"
            rx="40"
            ry="13"
            fill="#ffffff"
            opacity="0.8"
          />

          <ellipse
            cx="358"
            cy="104"
            rx="22"
            ry="10"
            fill="#ffffff"
            opacity="0.75"
          />
        </g>

        {/* Birds */}

        <g className="osb-birds">
          <path
            d="M18 28 q6 -6 12 0 q6 -6 12 0"
            fill="none"
            stroke="#2c3e50"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          <path
            d="M52 40 q5 -5 10 0 q5 -5 10 0"
            fill="none"
            stroke="#2c3e50"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          <path
            d="M300 36 q5 -5 10 0 q5 -5 10 0"
            fill="none"
            stroke="#2c3e50"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* ================= MOUNTAINS ================= */}

      <svg
        className="osb-mountain-layer"
        style={{
          transform: `translateY(${mountainY}px)`,
        }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id="osb-rock-a"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#d7c4a3"
            />

            <stop
              offset="100%"
              stopColor="#8b7355"
            />
          </linearGradient>

          <linearGradient
            id="osb-rock-b"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#cbb28a"
            />

            <stop
              offset="100%"
              stopColor="#6e5740"
            />
          </linearGradient>
        </defs>

        {/* Giới hạn núi trong viewBox để tránh crop kỳ lạ */}

        <polygon
          points="190,300 268,118 318,168 360,96 400,230 400,300"
          fill="url(#osb-rock-a)"
        />

        <polygon
          points="230,300 300,150 348,190 390,112 400,155 400,300"
          fill="url(#osb-rock-b)"
          opacity="0.95"
        />

        <polygon
          points="300,150 360,96 372,150"
          fill="#efe4c8"
          opacity="0.7"
        />
      </svg>

      {/* ================= LIGHTHOUSE ================= */}

      <svg
        className="osb-lighthouse-layer"
        style={{
          transform: `translateY(${lighthouseY}px)`,
        }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <g transform="translate(352,128)">

          <polygon
            points="-22,92 26,92 18,38 -14,38"
            fill="#c9b48a"
          />

          <polygon
            points="-18,92 8,92 4,50 -12,50"
            fill="#8a7354"
          />

          <g className="osb-lighthouse">

            <polygon
              points="-9,58 9,58 7,-2 -7,-2"
              fill="#f3eee6"
            />

            <rect
              x="-9"
              y="42"
              width="18"
              height="10"
              fill="#d94b3d"
            />

            <rect
              x="-8.5"
              y="22"
              width="17"
              height="10"
              fill="#d94b3d"
            />

            <rect
              x="-8"
              y="4"
              width="16"
              height="9"
              fill="#d94b3d"
            />

            <rect
              x="-8"
              y="-12"
              width="16"
              height="12"
              fill="#3d4654"
            />

            <rect
              x="-3"
              y="-8"
              width="6"
              height="6"
              fill="#fff4c0"
              className="osb-lamp"
            />

            <polygon
              points="-10,-12 10,-12 0,-24"
              fill="#d94b3d"
            />

            <g className="osb-beam">
              <polygon
                points="5,-6 130,-40 130,28"
                fill="#fff4c0"
                opacity="0.22"
              />
            </g>

          </g>
        </g>
      </svg>

      {/* ================= WATER ================= */}

      <div
        className="osb-water"
        style={{
          background: `linear-gradient(
            to bottom,
            hsl(189, 88%, ${68 - progress * 52}%) 0%,
            hsl(196, 85%, ${58 - progress * 46}%) 22%,
            hsl(204, 82%, ${44 - progress * 36}%) 45%,
            hsl(212, 80%, ${30 - progress * 24}%) 68%,
            hsl(220, 78%, ${17 - progress * 14}%) 88%,
            hsl(226, 70%, ${8 - progress * 6}%) 100%
          )`,
        }}
      >

        <div
          className="osb-caustics"
          style={{
            opacity: Math.max(
              0.12,
              0.55 - progress * 0.4
            ),
          }}
        />

        {/* Waves */}

        <div
          className="osb-wave-stack"
          style={{
            opacity: waveOpacity,
          }}
        >
          <WaveStrip
            className="osb-wave--far"
            fill="#1a6fb8"
            d={WAVE_B}
          />

          <WaveStrip
            className="osb-wave--mid"
            fill="#1f9ad4"
            d={WAVE_A}
          />

          <WaveStrip
            className="osb-wave--near"
            fill="#3ec6ee"
            d={WAVE_B}
          />

          <WaveStrip
            className="osb-wave--foam"
            fill="#56d4f6"
            d={WAVE_A}
            foam
          />
        </div>

        {/* Fish */}

        <svg
          className="osb-fish-layer"
          style={{
            opacity: fishOpacity,
          }}
          viewBox="0 0 400 300"
          preserveAspectRatio="xMidYMid slice"
        >

          <g transform="translate(70,70)">
            <g className="osb-fish osb-fish--a">
              <path
                d="M0 0 Q14 -9 28 0 Q14 9 0 0 Z"
                fill="#ffb02e"
              />

              <polygon
                points="-2,0 -11,-7 -11,7"
                fill="#ff8c1a"
              />

              <circle
                cx="20"
                cy="-1"
                r="1.6"
                fill="#1c2438"
              />
            </g>
          </g>

          <g transform="translate(250,130) scale(0.85)">
            <g className="osb-fish osb-fish--b">

              <path
                d="M0 0 Q14 -9 28 0 Q14 9 0 0 Z"
                fill="#3ecbe0"
              />

              <polygon
                points="-2,0 -11,-7 -11,7"
                fill="#1fa8c2"
              />

              <circle
                cx="20"
                cy="-1"
                r="1.6"
                fill="#08303a"
              />

            </g>
          </g>

          <g transform="translate(170,210) scale(0.65)">
            <g className="osb-fish osb-fish--c">

              <path
                d="M0 0 Q14 -9 28 0 Q14 9 0 0 Z"
                fill="#ff6f61"
              />

              <polygon
                points="-2,0 -11,-7 -11,7"
                fill="#e5493a"
              />

              <circle
                cx="20"
                cy="-1"
                r="1.6"
                fill="#3a0f0a"
              />

            </g>
          </g>

          <g transform="translate(240,250)">
            <g className="osb-school">

              {[
                [0, 0, 0.55],
                [18, 6, 0.45],
                [10, -8, 0.4],
                [32, -2, 0.38],
                [26, 10, 0.34],
                [44, 4, 0.3],
                [-12, 8, 0.32],
                [52, -6, 0.28],
              ].map(([x, y, s], i) => (

                <g
                  key={i}
                  transform={`translate(${x} ${y}) scale(${s})`}
                >

                  <g
                    className={`osb-minnow osb-minnow--${i}`}
                  >
                    <ellipse
                      cx="8"
                      cy="0"
                      rx="10"
                      ry="4"
                      fill="#4ec4e0"
                    />

                    <polygon
                      points="-2,0 -8,-4 -8,4"
                      fill="#2a9bb8"
                    />
                  </g>

                </g>
              ))}

            </g>
          </g>

        </svg>

        {/* Deep sea */}

        <svg
          className="osb-deep-layer"
          viewBox="0 0 400 300"
          preserveAspectRatio="xMidYMax slice"
        >

          {/* Whale */}

          <g
            className="osb-whale"
            style={{
              opacity: whaleOpacity,
            }}
            transform="translate(60,60)"
          >

            <path
              d="M0 10 C14 -6 46 -8 74 0 C92 5 104 10 118 8 C108 16 88 19 72 15 C46 27 14 25 0 12 C-6 8 -6 2 0 10 Z"
              fill="#3f6a8a"
            />

            <path
              d="M112 6 L134 -8 L134 20 Z"
              fill="#345a78"
            />

            <ellipse
              cx="18"
              cy="6"
              rx="34"
              ry="9"
              fill="#4d7fa1"
              opacity="0.55"
            />

            <circle
              cx="20"
              cy="6"
              r="1.8"
              fill="#0e2230"
            />

            <path
              className="osb-whale-spout"
              d="M22 -6 Q22 -18 16 -26 M22 -6 Q22 -18 28 -26"
              stroke="#dff3ff"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
            />

          </g>

          {/* Shark */}

          <g
            className="osb-shark"
            style={{
              opacity: sharkOpacity,
            }}
            transform="translate(260,150) scale(0.8)"
          >

            <path
              d="M0 6 C22 -6 62 -6 92 4 C64 12 22 14 0 6 Z"
              fill="#8493a1"
            />

            <path
              d="M34 -4 L44 -22 L54 -4 Z"
              fill="#8493a1"
            />

            <path
              d="M86 2 L104 -12 L104 16 Z"
              fill="#71828f"
            />

            <circle
              cx="12"
              cy="4"
              r="1.4"
              fill="#1c2530"
            />

          </g>

          {/* Seabed */}

          <g
            className="osb-seabed"
            style={{
              opacity: seabedOpacity,
            }}
          >

            <g
              className="osb-seaweed osb-seaweed--1"
              transform="translate(40,300)"
            >

              <path
                d="M0 0 Q10 -22 0 -44 Q-10 -66 2 -90"
                stroke="#2f8f5b"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />

              <path
                d="M14 0 Q22 -18 12 -36 Q4 -54 14 -72"
                stroke="#3aa868"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />

            </g>

            <g
              className="osb-seaweed osb-seaweed--2"
              transform="translate(330,300)"
            >

              <path
                d="M0 0 Q-10 -24 0 -48 Q10 -72 -2 -96"
                stroke="#2a7f4f"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />

              <path
                d="M-16 0 Q-24 -20 -14 -40 Q-6 -60 -16 -80"
                stroke="#3aa868"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />

            </g>

            <g
              className="osb-seaweed osb-seaweed--3"
              transform="translate(200,300) scale(0.8)"
            >

              <path
                d="M0 0 Q8 -20 0 -40 Q-8 -60 4 -84"
                stroke="#2f8f5b"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />

            </g>

            <g
              className="osb-starfish osb-starfish--1"
              transform="translate(96,286) scale(1.1)"
            >

              <path
                d="M12 0 L15.5 8 L24 8.5 L17 13.5 L19.5 22 L12 17 L4.5 22 L7 13.5 L0 8.5 L8.5 8 Z"
                fill="#ff8a5c"
              />

            </g>

            <g
              className="osb-starfish osb-starfish--2"
              transform="translate(268,292) scale(0.85)"
            >

              <path
                d="M12 0 L15.5 8 L24 8.5 L17 13.5 L19.5 22 L12 17 L4.5 22 L7 13.5 L0 8.5 L8.5 8 Z"
                fill="#ff5f7e"
              />

            </g>

          </g>

        </svg>

        {/* Bubbles */}

        <svg
          className="osb-bubbles"
          style={{
            opacity: bubbleOpacity,
          }}
          viewBox="0 0 400 400"
        >

          <circle
            className="osb-bubble"
            cx="60"
            cy="360"
            r="4"
            fill="#ffffff"
            opacity="0.5"
          />

          <circle
            className="osb-bubble"
            cx="90"
            cy="300"
            r="3"
            fill="#ffffff"
            opacity="0.4"
          />

          <circle
            className="osb-bubble"
            cx="320"
            cy="380"
            r="5"
            fill="#ffffff"
            opacity="0.5"
          />

          <circle
            className="osb-bubble"
            cx="300"
            cy="310"
            r="3"
            fill="#ffffff"
            opacity="0.35"
          />

          <circle
            className="osb-bubble"
            cx="200"
            cy="350"
            r="2.5"
            fill="#ffffff"
            opacity="0.4"
          />

        </svg>

        <div
          className="osb-abyss-glow"
          style={{
            opacity: deepGlowOpacity,
          }}
        />

      </div>

      {/* =========================================
          BOAT

          QUAN TRỌNG:
          Thuyền được đưa RA NGOÀI .osb-water.

          Vì .osb-water có overflow: hidden.
          Đây là nguyên nhân thuyền bị cắt/che.
      ========================================= */}

      <svg
        className="osb-boat-layer"
        style={{
          transform: `translateY(${boatY}px)`,
          opacity: boatOpacity,
        }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
      >

        <g transform="translate(148,168)">

          <g className="osb-boat-bob">

            <ellipse
              cx="0"
              cy="58"
              rx="46"
              ry="8"
              fill="#0a4a72"
              opacity="0.28"
              className="osb-boat-wake"
            />

            {/* Boat body */}

            <path
              d="M-48 38 L50 38 L36 62 L-34 62 Z"
              fill="#9c2b28"
            />

            <path
              d="M-48 38 L50 38 L42 48 L-40 48 Z"
              fill="#c43b36"
            />

            <path
              d="M-44 40 L-28 40 L-24 58 L-38 58 Z"
              fill="#6e1c1c"
              opacity="0.35"
            />

            {/* Mast */}

            <line
              x1="-2"
              y1="38"
              x2="-2"
              y2="-78"
              stroke="#6b4226"
              strokeWidth="2.4"
            />

            <line
              x1="-36"
              y1="30"
              x2="32"
              y2="30"
              stroke="#6b4226"
              strokeWidth="1.6"
            />

            {/* Main sail */}

            <path
              className="osb-sail osb-sail--main"
              d="M-2 -76 L-40 28 L-2 28 Z"
              fill="#f7edd8"
            />

            <path
              d="M-2 -48 L-28 28"
              stroke="#e8a0b0"
              strokeWidth="3.2"
              opacity="0.85"
            />

            {/* Front sail */}

            <path
              className="osb-sail osb-sail--jib"
              d="M-2 -58 L32 28 L-2 28 Z"
              fill="#fff8ec"
            />

            {/* People */}

            <path
              d="M-18 8 L-18 36"
              stroke="#6b4226"
              strokeWidth="1.2"
            />

            <circle
              cx="-18"
              cy="6"
              r="3.2"
              fill="#3a2a22"
            />

            <rect
              x="-20"
              y="8"
              width="4"
              height="12"
              fill="#4a6fa8"
            />

            <rect
              x="8"
              y="20"
              width="4.5"
              height="14"
              fill="#2d2a28"
            />

            <circle
              cx="10"
              cy="18"
              r="3.4"
              fill="#3a2a22"
            />

            <rect
              x="7"
              y="10"
              width="6"
              height="9"
              fill="#e8d2a8"
            />

          </g>

        </g>

      </svg>

    </div>
  );
}