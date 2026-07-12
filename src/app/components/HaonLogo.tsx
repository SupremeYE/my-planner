import React from 'react';
import { BRAND_FONT_WORDMARK, BRAND_FONT_SUBTEXT } from '../styles/brand';

interface HaonLogoProps {
  height?: number;
  showSubtitle?: boolean;
}

export function HaonLogo({ height = 44, showSubtitle = false }: HaonLogoProps) {
  const markSize = height * 0.92;
  const fontSize = height * 0.62;
  // 한 페이지에 로고가 여러 번 렌더될 때(예: PC 사이드바 + 모바일 상단바) SVG id 충돌 방지
  const uid = React.useId().replace(/:/g, '');
  const skyId = `haonSky-${uid}`;
  const sunId = `haonSunFill-${uid}`;
  const horizonId = `haonHorizon-${uid}`;
  const clipId = `haonClip-${uid}`;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.18 }}>
        {/* Sunrise logomark */}
        <svg
          width={markSize}
          height={markSize}
          viewBox="0 0 48 48"
          fill="none"
          style={{ display: 'block', flexShrink: 0 }}
        >
          <defs>
            <linearGradient id={skyId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFE9B8" />
              <stop offset="50%" stopColor="#F4A582" />
              <stop offset="100%" stopColor="#A8C8E8" />
            </linearGradient>
            <radialGradient id={sunId} cx="50%" cy="55%" r="55%">
              <stop offset="0%" stopColor="#FFF4D6" />
              <stop offset="55%" stopColor="#FFD89A" />
              <stop offset="100%" stopColor="#F4A582" />
            </radialGradient>
            <linearGradient id={horizonId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F4A582" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#F4A582" stopOpacity="1" />
              <stop offset="100%" stopColor="#A8C8E8" stopOpacity="0.35" />
            </linearGradient>
            <clipPath id={clipId}>
              <rect x="0" y="0" width="48" height="29" />
            </clipPath>
          </defs>

          {/* soft ambient halo */}
          <circle cx="24" cy="26" r="22" fill={`url(#${skyId})`} opacity="0.12" />

          {/* sun above horizon (clipped so only top half shows) */}
          <g clipPath={`url(#${clipId})`}>
            {/* rays */}
            {[-60, -30, 0, 30, 60].map((deg) => (
              <rect
                key={deg}
                x="23"
                y="6"
                width="2"
                height="5"
                rx="1"
                fill="#F4A582"
                opacity="0.75"
                transform={`rotate(${deg} 24 27)`}
              />
            ))}
            <circle
              cx="24"
              cy="27"
              r="10"
              fill={`url(#${sunId})`}
              filter="drop-shadow(0 1px 3px rgba(244,165,130,0.35))"
            />
          </g>

          {/* horizon line */}
          <rect x="4" y="28.5" width="40" height="2" rx="1" fill={`url(#${horizonId})`} />

          {/* gentle hill silhouette */}
          <path
            d="M 4 36 Q 16 30 24 33 T 44 36 L 44 40 L 4 40 Z"
            fill="#A8C8E8"
            opacity="0.28"
          />
          <path
            d="M 4 38 Q 14 34 22 36 T 44 37"
            stroke="#A8C8E8"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
        </svg>

        {/* Wordmark */}
        <span
          style={{
            fontFamily: BRAND_FONT_WORDMARK, // 브랜드 워드마크 — 테마 독립 고정
            fontWeight: 800,
            fontSize,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #FFD89A 0%, #F4A582 45%, #A8C8E8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 1px 2px rgba(244,165,130,0.22))',
          }}
        >
          하온
        </span>
      </div>
      {showSubtitle && (
        <p
          style={{
            fontSize: Math.max(10, fontSize * 0.3),
            color: '#9CA3AF',
            marginTop: 6,
            marginLeft: markSize + height * 0.18,
            letterSpacing: '0.02em',
            fontFamily: BRAND_FONT_SUBTEXT, // 브랜드 태그라인 — 테마 독립 고정
          }}
        >
          하루를 온전히, 나에게
        </p>
      )}
    </div>
  );
}
