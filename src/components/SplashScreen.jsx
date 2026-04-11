export default function SplashScreen({ isFadingOut = false }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(160deg, #ECF4FF 0%, #E5F0FF 52%, #DCEBFF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: isFadingOut ? 'splashFadeOut 0.4s ease forwards' : undefined,
      }}
      aria-hidden
    >
      <style>
        {`
          @keyframes splashFadeInUp {
            from {
              opacity: 0;
              transform: translateY(24px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes splashFadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }
        `}
      </style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          animation: 'splashFadeInUp 0.65s ease-out both',
          padding: '0 20px',
          textAlign: 'center',
        }}
      >
        <img
          src="/assets/splash-character.png"
          alt="My Planner 캐릭터"
          style={{
            width: 'min(58vw, 260px)',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
        <h1
          style={{
            margin: 0,
            fontFamily: '"DM Serif Display", serif',
            fontSize: 'clamp(34px, 8vw, 48px)',
            color: '#C4A882',
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: '0.01em',
          }}
        >
          My Planner
        </h1>
      </div>
    </div>
  );
}
