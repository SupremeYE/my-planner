// 산책 기록 카드 상세 — 사진 배경 + 경로 미니맵 + 지표 + 손글씨가 한 장의 카드로(일기 느낌).
// 메모 수정 / 삭제 가능. (저장된 walk_sessions 한 건을 보여준다)
import { useState } from 'react';
import { X, Trash2, Pencil, Check, Loader2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { WalkSession } from '../../../lib/db';
import { RouteGlyph } from './RouteGlyph';
import { formatDistance, formatDuration, formatPace } from './walkUtils';
import { withAlpha } from '../places/placeHelpers';
import ConfirmModal from '../ConfirmModal';

const MODE_LABEL: Record<WalkSession['mode'], string> = { free: '자유 산책', course: '코스 산책', repeat: '내 코스 다시' };

export function WalkRecordDetail({ session, onClose, onChanged }: { session: WalkSession; onClose: () => void; onChanged: () => void }) {
  const { t } = useTheme();
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(session.memo ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const photo = session.photoUrl;
  const dateLabel = session.startedAt ? new Date(session.startedAt).toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' }) : new Date(session.createdAt).toLocaleDateString('ko-KR');

  const saveMemo = async () => {
    setSaving(true);
    await db.walkSessions.update(session.id, { memo: memo.trim() || null });
    setSaving(false);
    setEditing(false);
    onChanged();
  };

  const doDelete = async () => {
    await db.walkSessions.delete(session.id);
    setConfirmDel(false);
    onChanged();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: t.bg, display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between" style={{ padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{MODE_LABEL[session.mode]}</span>
        <button onClick={() => setConfirmDel(true)} style={{ color: t.danger, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={19} /></button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px calc(24px + env(safe-area-inset-bottom))' }}>
        <p style={{ fontSize: 12.5, color: t.textSub, marginBottom: 10 }}>{dateLabel}</p>

        {/* 카드 */}
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', backgroundColor: t.card, border: `1px solid ${t.border}`, minHeight: 300 }}>
          {photo && <img src={photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          <div style={{ position: 'absolute', inset: 0, background: photo ? `linear-gradient(180deg, ${withAlpha(t.text, 0.12)} 0%, ${withAlpha(t.text, 0.58)} 100%)` : 'transparent' }} />

          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <RouteGlyph path={session.path} size={92} stroke={photo ? '#fff' : t.accent} bg={photo ? withAlpha('#000', 0.25) : t.bgSub} />
          </div>

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 }}>
            <div className="flex items-end gap-5" style={{ marginBottom: session.memo || editing ? 8 : 0 }}>
              <Stat label="거리" value={formatDistance(session.distanceM)} light={!!photo} t={t} big />
              <Stat label="시간" value={formatDuration(session.durationS)} light={!!photo} t={t} />
              <Stat label="페이스" value={formatPace(session.avgPaceSPerKm)} light={!!photo} t={t} />
            </div>
            {editing ? (
              <textarea
                value={memo} onChange={e => setMemo(e.target.value)} autoFocus rows={2}
                placeholder="메모…"
                style={{ width: '100%', background: withAlpha(photo ? '#000' : t.bgSub, photo ? 0.25 : 1), borderRadius: 10, border: 'none', outline: 'none', resize: 'none', padding: 8, fontFamily: 'var(--font-nanum-pen)', fontSize: 24, lineHeight: 1.2, color: photo ? '#fff' : t.text }}
              />
            ) : session.memo ? (
              <p style={{ fontFamily: 'var(--font-nanum-pen)', fontSize: 26, lineHeight: 1.2, color: photo ? '#fff' : t.text, whiteSpace: 'pre-wrap' }}>{session.memo}</p>
            ) : null}
          </div>
        </div>

        {/* 메모 수정 컨트롤 */}
        <div className="flex justify-end" style={{ marginTop: 12 }}>
          {editing ? (
            <button onClick={saveMemo} disabled={saving} className="flex items-center gap-1.5" style={{ padding: '9px 16px', borderRadius: 10, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 메모 저장
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5" style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Pencil size={13} /> 메모 {session.memo ? '수정' : '추가'}
            </button>
          )}
        </div>
      </div>

      {confirmDel && (
        <ConfirmModal
          message="이 산책 기록을 삭제할까요?"
          description="경로·사진·메모가 모두 삭제돼요."
          confirmText="삭제" confirmDanger
          onConfirm={doDelete} onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, light, t, big }: { label: string; value: string; light: boolean; t: any; big?: boolean }) {
  const c = light ? '#fff' : t.text;
  const sub = light ? withAlpha('#fff', 0.8) : t.textSub;
  return (
    <div>
      <div style={{ fontSize: 10.5, color: sub, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 16, fontWeight: 800, color: c, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
