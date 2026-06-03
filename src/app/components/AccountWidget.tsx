import { useState, useEffect } from 'react';
import { LogOut, X, Check, Mail, Lock } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';

// 계정 정보 수정 모달 — 트리거(아바타 메뉴 "프로필")에서 open/onClose로 제어
export function AccountWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const { session, signOut, updateEmail, updatePassword } = useAuth();

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // 모달 열 때 이전 메시지 초기화
  useEffect(() => { if (open) setMsg(null); }, [open]);

  const currentEmail = session?.user?.email ?? '';

  const handleEmail = async () => {
    if (!newEmail.trim() || busy) return;
    setBusy(true); setMsg(null);
    const { error } = await updateEmail(newEmail);
    setBusy(false);
    if (error) setMsg({ kind: 'err', text: '이메일 변경 실패: ' + error });
    else { setMsg({ kind: 'ok', text: '이메일 변경 요청됨. 확인 메일이 필요할 수 있어요.' }); setNewEmail(''); }
  };

  const handlePassword = async () => {
    if (newPassword.length < 6 || busy) { setMsg({ kind: 'err', text: '비밀번호는 6자 이상이어야 해요.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await updatePassword(newPassword);
    setBusy(false);
    if (error) setMsg({ kind: 'err', text: '비밀번호 변경 실패: ' + error });
    else { setMsg({ kind: 'ok', text: '비밀번호가 변경되었어요.' }); setNewPassword(''); }
  };

  if (!open) return null;

  return (
    <>
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onMouseDown={onClose}
        >
          <div
            className="relative w-full lg:max-w-sm rounded-t-3xl lg:rounded-3xl p-6 flex flex-col gap-5"
            style={{ background: t.bg, maxHeight: '90dvh', overflowY: 'auto' }}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* 모바일 드래그 핸들 */}
            <div className="flex justify-center lg:hidden -mt-2">
              <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
            </div>

            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: t.accent }}>계정</p>
                <p className="text-sm font-semibold break-all" style={{ color: t.text }}>{currentEmail}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textSub }}>
                <X size={18} />
              </button>
            </div>

            {msg && (
              <p className="text-xs" style={{ color: msg.kind === 'ok' ? t.success : t.danger }}>
                {msg.text}
              </p>
            )}

            {/* 이메일 변경 */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold" style={{ color: t.textSub }}>이메일 변경</span>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ background: t.card, border: `1.5px solid ${t.border}` }}>
                  <Mail size={15} style={{ color: t.textSub }} />
                  <input
                    type="email"
                    className="flex-1 bg-transparent py-2 text-sm outline-none"
                    style={{ color: t.text }}
                    placeholder="새 이메일"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleEmail}
                  disabled={busy || !newEmail.trim()}
                  className="px-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: t.accent, color: '#fff' }}
                >
                  <Check size={15} />
                </button>
              </div>
            </div>

            {/* 비밀번호 변경 */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold" style={{ color: t.textSub }}>비밀번호 변경</span>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ background: t.card, border: `1.5px solid ${t.border}` }}>
                  <Lock size={15} style={{ color: t.textSub }} />
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="flex-1 bg-transparent py-2 text-sm outline-none"
                    style={{ color: t.text }}
                    placeholder="새 비밀번호 (6자 이상)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <button
                  onClick={handlePassword}
                  disabled={busy || !newPassword}
                  className="px-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: t.accent, color: '#fff' }}
                >
                  <Check size={15} />
                </button>
              </div>
            </div>

            {/* 로그아웃 */}
            <button
              onClick={async () => { await signOut(); }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mt-1"
              style={{ background: t.card, color: t.danger, border: `1.5px solid ${t.border}` }}
            >
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        </div>
    </>
  );
}
