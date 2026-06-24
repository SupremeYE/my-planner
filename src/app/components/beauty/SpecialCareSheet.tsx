// 뷰티 케어 — 스페셜케어 추가/수정 바텀시트 (Stage 5, 모바일).
//  · 시트 UI 관습(바텀시트/PC 모달, 헤더, 필드)은 HouseholdStockSheet 와 동일하게 맞춤.
//  · 저장은 부모(useBeauty 액션 addCare/editCare)로만. 여기선 폼만 — 로직 재구현 X.
//  · 필드: 이름 / 아이콘(이모지 프리셋 + 직접입력) / 권장주기(cycle_days). 수정 모드 삭제 제공.
import React, { useState } from 'react';
import { X, ChevronLeft, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { BeautySpecialCare } from '../../store';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ICONS = ['🧖‍♀️', '💆‍♀️', '🧴', '💅', '🦶', '👣', '🪥', '🌿', '✨', '🛁', '💇‍♀️', '🧦'];

interface Props {
  care: BeautySpecialCare | null;          // null = 신규
  onSave: (item: BeautySpecialCare) => void;
  onDelete?: (id: string) => void;          // 수정 모드만
  onClose: () => void;
}

export function SpecialCareSheet({ care, onSave, onDelete, onClose }: Props) {
  const { t } = useTheme();
  const isEdit = !!care;

  const [name, setName] = useState(care?.name ?? '');
  const [icon, setIcon] = useState(care?.icon ?? '🧖‍♀️');
  const [cycleDays, setCycleDays] = useState<string>(care?.cycleDays != null ? String(care.cycleDays) : '7');
  const [submitting, setSubmitting] = useState(false);

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 10, padding: '9px 11px', fontSize: 14,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    const days = Math.round(Number(cycleDays));
    onSave({
      id: care?.id ?? newId(),
      name: name.trim(),
      icon: icon || null,
      cycleDays: days > 0 ? days : null,
      doneDates: care?.doneDates ?? [],
      createdAt: care?.createdAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes bcSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.bc-care-sheet{animation:bcSheetUp .26s ease-out}}`}</style>
      <div className="bc-care-sheet shadow-2xl overflow-y-auto w-full max-w-full max-h-[90vh] rounded-t-2xl
          lg:w-[440px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="취소">
            <ChevronLeft size={22} />
          </button>
          <h2 className="flex-1 text-center lg:flex-none lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {isEdit ? '스페셜케어 수정' : '스페셜케어 추가'}
          </h2>
          <button type="submit" form="bc-care-form" disabled={submitting} className="lg:hidden px-3 py-1.5 rounded-lg"
            style={{ fontSize: 14, fontWeight: 700, color: submitting ? t.textMuted : t.accent, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? '저장 중…' : '저장'}
          </button>
          <button type="button" onClick={onClose} className="hidden lg:block p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form id="bc-care-form" onSubmit={handleSubmit}
          className="px-4 lg:px-5 pb-5 space-y-4"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* 아이콘 프리셋 */}
          <div>
            <label style={labelStyle}>아이콘</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className="rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    width: 40, height: 40, fontSize: 20,
                    backgroundColor: icon === ic ? t.accentLight : t.card,
                    border: `1.5px solid ${icon === ic ? t.accent : t.border}`,
                  }}>{ic}</button>
              ))}
            </div>
          </div>

          {/* 이름 */}
          <div>
            <label style={labelStyle}>이름 *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예: 모공팩, 발각질" style={fieldStyle} />
          </div>

          {/* 권장주기 */}
          <div>
            <label style={labelStyle}>권장 주기 (일)</label>
            <input type="number" inputMode="numeric" min={1} value={cycleDays} onChange={e => setCycleDays(e.target.value)} placeholder="예: 7" style={fieldStyle} />
            <p style={{ fontSize: 11.5, color: t.textMuted, marginTop: 5 }}>비워두면 재촉하지 않고 기록만 해요</p>
          </div>

          {/* 수정 모드: 삭제 */}
          {isEdit && onDelete && (
            <button type="button" onClick={() => onDelete(care!.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
              <Trash2 size={16} /> 삭제
            </button>
          )}

          {/* PC 저장 */}
          <div className="hidden lg:flex items-center gap-2 pt-1">
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>취소</button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
