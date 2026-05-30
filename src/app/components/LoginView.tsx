import { useState } from 'react';
import { Mail, Lock, LogIn } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';

export function LoginView() {
  const { t } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: t.bg }}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-6">
        {/* 로고 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: t.text }}>
            My Planner
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textSub }}>
            로그인이 필요합니다
          </p>
        </div>

        {/* 카드 */}
        <div
          className="rounded-2xl p-6 shadow-sm flex flex-col gap-4"
          style={{ background: t.card }}
        >
          {/* 이메일 */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold" style={{ color: t.textSub }}>이메일</span>
            <div
              className="flex items-center gap-2 rounded-xl px-3"
              style={{ background: t.bg, border: `1.5px solid ${t.border}` }}
            >
              <Mail size={16} style={{ color: t.textSub }} />
              <input
                type="email"
                autoComplete="username"
                className="flex-1 bg-transparent py-2.5 text-sm outline-none"
                style={{ color: t.text }}
                placeholder="haon@planner.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </label>

          {/* 비밀번호 */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold" style={{ color: t.textSub }}>비밀번호</span>
            <div
              className="flex items-center gap-2 rounded-xl px-3"
              style={{ background: t.bg, border: `1.5px solid ${t.border}` }}
            >
              <Lock size={16} style={{ color: t.textSub }} />
              <input
                type="password"
                autoComplete="current-password"
                className="flex-1 bg-transparent py-2.5 text-sm outline-none"
                style={{ color: t.text }}
                placeholder="비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </label>

          {error && (
            <p className="text-xs" style={{ color: t.danger }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: t.accent, color: '#fff' }}
          >
            <LogIn size={16} /> {loading ? '로그인 중...' : '로그인'}
          </button>
        </div>
      </form>
    </div>
  );
}
