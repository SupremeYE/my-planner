import { BRAND_FONT_SERIF, BRAND_FONT_SOFT } from '../app/styles/brand';

interface SplashScreenProps {
  isFadingOut: boolean;
}

export default function SplashScreen({ isFadingOut }: SplashScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(160deg, #FFF5EE 0%, #FFFFFF 45%, #EAF2FB 100%)',
        transition: 'opacity 0.4s ease',
        opacity: isFadingOut ? 0 : 1,
        zIndex: 9999,
        gap: 14,
        fontFamily: BRAND_FONT_SOFT, // 스플래시 컨테이너 — 테마 독립 브랜드
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background:
            'linear-gradient(155deg, #FFD89A 0%, #F4A582 45%, #A8C8E8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          boxShadow:
            '0 18px 40px rgba(244,165,130,0.30), inset 0 1px 0 rgba(255,255,255,0.6)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* sun */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 18,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 35%, #FFF6C2 0%, #FFD262 70%, rgba(255,210,98,0) 100%)',
            filter: 'blur(0.3px)',
          }}
        />
        <span
          style={{
            fontFamily: BRAND_FONT_SERIF, // 브랜드 타이틀 — 테마 독립 고정
            fontSize: 38,
            fontWeight: 700,
            color: '#FFFFFF',
            textShadow:
              '0 2px 6px rgba(45,42,58,0.18), 0 1px 0 rgba(255,255,255,0.4)',
            letterSpacing: '-1px',
            zIndex: 1,
          }}
        >
          하온
        </span>
      </div>
      <div
        style={{
          fontFamily: BRAND_FONT_SERIF, // 브랜드 서브타이틀 — 테마 독립 고정
          fontSize: 26,
          fontWeight: 700,
          color: '#2D2A3A',
          letterSpacing: '-0.5px',
        }}
      >
        하온
      </div>
      <div style={{ fontSize: 13, color: '#6F6A80', letterSpacing: '0.02em' }}>
        하루를 온전히, 나에게
      </div>
      <div style={{ marginTop: 24, display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, #FFD89A 0%, #F4A582 100%)',
              animation: `splash-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes splash-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
