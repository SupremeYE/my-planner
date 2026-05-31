import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';

const SUNRISE = 'linear-gradient(155deg, #FFD89A 0%, #F4A582 50%, #A8C8E8 100%)';

function HaonLogo({ size = 88 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: SUNRISE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow:
          '0 20px 44px rgba(244,165,130,0.30), inset 0 1px 0 rgba(255,255,255,0.55)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: size * 0.14,
          right: size * 0.18,
          width: size * 0.22,
          height: size * 0.22,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 35%, #FFF6C2 0%, #FFD262 70%, rgba(255,210,98,0) 100%)',
        }}
      />
      <span
        style={{
          fontFamily: "'Gowun Batang', serif",
          fontSize: size * 0.38,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-1px',
          textShadow:
            '0 2px 6px rgba(45,42,58,0.20), 0 1px 0 rgba(255,255,255,0.4)',
          zIndex: 1,
        }}
      >
        하온
      </span>
    </div>
  );
}

export function LoginView() {
  const { t } = useTheme();
  const { signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) setError('재설정 메일 발송 실패: ' + error);
    else setInfo('재설정 링크를 메일로 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.');
  };

  const switchMode = (next: 'login' | 'reset') => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: `1px solid ${t.border}`,
    background: '#fff',
    fontSize: 14,
    color: t.text,
    outline: 'none',
    fontFamily: t.font,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(160deg, #FFF5EE 0%, #FFFFFF 45%, #EAF2FB 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: t.font,
      }}
    >
      {/* Floating soft blobs */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: '-120px',
          left: '-80px',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,216,154,0.55) 0%, rgba(255,216,154,0) 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: '-160px',
          right: '-120px',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(168,200,232,0.5) 0%, rgba(168,200,232,0) 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="haon-login-card"
        style={{
          width: '100%',
          maxWidth: 980,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 0,
          background: '#fff',
          borderRadius: 28,
          boxShadow:
            '0 30px 80px rgba(45,42,58,0.10), 0 4px 12px rgba(244,165,130,0.08)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Left brand panel (desktop only) */}
        <div
          className="haon-login-brand"
          style={{
            display: 'none',
            padding: '56px 48px',
            background: SUNRISE,
            color: '#fff',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 580,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 60,
              right: 50,
              width: 110,
              height: 110,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 35% 35%, #FFF6C2 0%, #FFD262 60%, rgba(255,210,98,0) 100%)',
              filter: 'blur(2px)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <HaonLogo size={72} />
            <h1
              style={{
                marginTop: 28,
                fontFamily: "'Gowun Batang', serif",
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: '-1px',
                lineHeight: 1.2,
                textShadow: '0 2px 8px rgba(45,42,58,0.15)',
              }}
            >
              하루를<br />온전히, 나에게
            </h1>
            <p style={{ marginTop: 18, fontSize: 15, opacity: 0.95, lineHeight: 1.65 }}>
              오늘의 작은 계획부터 한 달의 목표까지,<br />
              하온과 함께 차곡차곡 쌓아가요.
            </p>
          </div>
          <div style={{ position: 'relative', zIndex: 1, fontSize: 12, opacity: 0.85 }}>
            © {new Date().getFullYear()} 하온 · Haon
          </div>
        </div>

        {/* Right form panel */}
        <div
          className="haon-login-form"
          style={{
            padding: '48px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              className="haon-login-mobile-logo"
              style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}
            >
              <HaonLogo size={68} />
            </div>
            <h2
              style={{
                fontFamily: "'Gowun Batang', serif",
                fontSize: 24,
                fontWeight: 700,
                color: t.text,
                letterSpacing: '-0.5px',
              }}
            >
              {mode === 'login' ? '다시 만나서 반가워요' : '비밀번호 찾기'}
            </h2>
            <p style={{ marginTop: 8, fontSize: 13, color: t.textSub }}>
              {mode === 'login'
                ? '오늘 하루도 온전히 채워볼까요?'
                : '가입한 이메일로 재설정 링크를 보내드려요.'}
            </p>
          </div>

          <form
            onSubmit={mode === 'login' ? handleSubmit : handleReset}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div>
              <label style={{ fontSize: 12, color: t.textSub, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                이메일
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="가입한 이메일"
                style={inputStyle}
                required
              />
            </div>
            {mode === 'login' && (
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: t.textSub, fontWeight: 500, display: 'block' }}>
                    비밀번호
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    style={{ fontSize: 12, color: t.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                  required
                />
              </div>
            )}

            {error && (
              <p style={{ fontSize: 12, color: t.danger, marginTop: 2 }}>{error}</p>
            )}
            {info && (
              <p style={{ fontSize: 12, color: t.success, marginTop: 2 }}>{info}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || (mode === 'login' && !password)}
              style={{
                marginTop: 8,
                padding: '14px 16px',
                borderRadius: 14,
                border: 'none',
                background: SUNRISE,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.2px',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading || !email.trim() || (mode === 'login' && !password) ? 0.6 : 1,
                boxShadow: '0 10px 24px rgba(244,165,130,0.35)',
                fontFamily: t.font,
                transition: 'transform 0.1s, opacity 0.2s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.99)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {loading
                ? (mode === 'login' ? '로그인 중...' : '발송 중...')
                : (mode === 'login' ? '로그인' : '재설정 링크 보내기')}
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{ fontSize: 13, color: t.textSub, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}
              >
                ← 로그인으로 돌아가기
              </button>
            )}
          </form>
        </div>
      </div>

      <style>{`
        @media (min-width: 880px) {
          .haon-login-card {
            grid-template-columns: 1.05fr 1fr !important;
          }
          .haon-login-brand {
            display: flex !important;
          }
          .haon-login-mobile-logo {
            display: none !important;
          }
          .haon-login-form {
            padding: 56px 56px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default LoginView;
