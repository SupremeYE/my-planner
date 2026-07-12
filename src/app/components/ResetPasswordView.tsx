import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';

const SUNRISE = 'linear-gradient(155deg, #FFD89A 0%, #F4A582 50%, #A8C8E8 100%)';

function HaonLogo({ size = 72 }: { size?: number }) {
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
        boxShadow: '0 20px 44px rgba(244,165,130,0.30), inset 0 1px 0 rgba(255,255,255,0.55)',
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
          background: 'radial-gradient(circle at 35% 35%, #FFF6C2 0%, #FFD262 70%, rgba(255,210,98,0) 100%)',
        }}
      />
      <span
        style={{
          fontFamily: "'Gowun Batang', serif",
          fontSize: size * 0.38,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-1px',
          textShadow: '0 2px 6px rgba(45,42,58,0.20), 0 1px 0 rgba(255,255,255,0.4)',
          zIndex: 1,
        }}
      >
        하온
      </span>
    </div>
  );
}

// 비밀번호 재설정 메일 링크로 진입했을 때 새 비밀번호를 설정하는 화면
export function ResetPasswordView() {
  const { t } = useTheme();
  const { updatePassword, clearRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return; }
    if (password !== confirm) { setError('두 비밀번호가 일치하지 않아요.'); return; }
    setLoading(true);
    setError(null);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) { setError('변경 실패: ' + error); return; }
    setDone(true);
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
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #FFF5EE 0%, #FFFFFF 45%, #EAF2FB 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: t.font,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 28,
          boxShadow: '0 30px 80px rgba(45,42,58,0.10), 0 4px 12px rgba(244,165,130,0.08)',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <HaonLogo size={64} />

        {done ? (
          <>
            <h2 style={{ marginTop: 20, fontFamily: t.fontBrand, fontSize: 22, fontWeight: 700, color: t.text }}>
              비밀번호가 변경되었어요
            </h2>
            <p style={{ marginTop: 8, fontSize: 13, color: t.textSub, textAlign: 'center' }}>
              새 비밀번호로 다시 로그인해 주세요.
            </p>
            <button
              onClick={async () => { clearRecovery(); await signOut(); }}
              style={{
                marginTop: 24,
                width: '100%',
                padding: '14px 16px',
                borderRadius: 14,
                border: 'none',
                background: SUNRISE,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 10px 24px rgba(244,165,130,0.35)',
                fontFamily: t.font,
              }}
            >
              로그인 화면으로
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 20, fontFamily: t.fontBrand, fontSize: 22, fontWeight: 700, color: t.text }}>
              새 비밀번호 설정
            </h2>
            <p style={{ marginTop: 8, fontSize: 13, color: t.textSub, textAlign: 'center' }}>
              사용할 새 비밀번호를 입력해 주세요.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: 24, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                style={inputStyle}
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="새 비밀번호 확인"
                style={inputStyle}
                required
              />

              {error && <p style={{ fontSize: 12, color: t.danger }}>{error}</p>}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                style={{
                  marginTop: 4,
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: SUNRISE,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading || !password || !confirm ? 0.6 : 1,
                  boxShadow: '0 10px 24px rgba(244,165,130,0.35)',
                  fontFamily: t.font,
                }}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordView;
