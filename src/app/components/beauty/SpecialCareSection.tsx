// 뷰티 케어 — 스페셜케어 섹션 (Stage 5, 모바일).
//  · 2열 카드 그리드. 카드: 아이콘·이름·"마지막 N일 전"·status 배지·"오늘 했어요".
//  · status 배지(careUtils.careStatus): fresh='최근'(그린)/soon='곧'(골드)/over='지남'(코랄).
//  · "오늘 했어요" → onDone(markCareDone): 즉시 '방금'으로, 게이지 자동 반영(selfCareScore 재계산).
//  · 카드 탭 → onEdit(수정/삭제 시트). 파생값·액션은 useBeauty 훅 것을 호출만.
import { Check, Plus, Sparkles } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { CareDerived } from './useBeauty';
import type { CareStatus } from '../../../lib/careUtils';

const STATUS_META: Record<CareStatus, { label: string; key: 'success' | 'accent' | 'danger' }> = {
  fresh: { label: '최근', key: 'success' },
  soon: { label: '곧', key: 'accent' },
  over: { label: '지남', key: 'danger' },
};

function CareCard({ care, onDone, onEdit }: {
  care: CareDerived; onDone: (id: string) => void; onEdit: (care: CareDerived) => void;
}) {
  const { t } = useTheme();
  const ds = care.daysSince;
  const meta = STATUS_META[care.status];
  const badgeColor = meta.key === 'success' ? t.success : meta.key === 'accent' ? t.accent : t.danger;
  const doneToday = ds === 0;
  const lastLabel = ds == null ? '아직 안 했어요' : ds === 0 ? '방금 했어요' : `마지막 ${ds}일 전`;

  return (
    <button onClick={() => onEdit(care)}
      className="relative text-left rounded-2xl px-3 py-3 flex flex-col active:scale-[0.98] transition-transform"
      style={{
        backgroundColor: care.status === 'over' ? t.dangerLight : t.card,
        border: `1px solid ${care.status === 'over' ? `${t.danger}55` : t.border}`,
        boxShadow: t.shadow, minHeight: 132,
      }}>
      <div className="flex items-start justify-between gap-1.5">
        <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>{care.icon || '🧖‍♀️'}</span>
        <span className="px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ fontSize: 10.5, fontWeight: 700, color: badgeColor, backgroundColor: `${badgeColor}1A`, border: `1px solid ${badgeColor}55` }}>
          {meta.label}
        </span>
      </div>
      <p className="truncate mt-2" style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>{care.name}</p>
      <p style={{ fontSize: 11.5, color: care.status === 'over' ? t.danger : t.textMuted, marginTop: 2 }}>
        {lastLabel}{care.cycleDays ? ` · ${care.cycleDays}일 주기` : ''}
      </p>

      <div className="flex-1" />
      {/* 오늘 했어요 — 카드 탭(수정)과 분리되도록 stopPropagation */}
      <span role="button" tabIndex={0}
        onClick={(e) => { e.stopPropagation(); if (!doneToday) onDone(care.id); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); if (!doneToday) onDone(care.id); } }}
        className="mt-2.5 flex items-center justify-center gap-1 rounded-xl py-2 active:scale-95 transition-transform"
        style={{
          fontSize: 12.5, fontWeight: 700,
          color: doneToday ? t.success : '#fff',
          backgroundColor: doneToday ? `${t.success}1A` : t.accent,
          border: doneToday ? `1px solid ${t.success}55` : 'none',
          cursor: doneToday ? 'default' : 'pointer',
        }}>
        <Check size={14} /> {doneToday ? '오늘 완료' : '오늘 했어요'}
      </span>
    </button>
  );
}

interface Props {
  cares: CareDerived[];
  onDone: (id: string) => void;
  onEdit: (care: CareDerived) => void;
  onAdd: () => void;
}

export function SpecialCareSection({ cares, onDone, onEdit, onAdd }: Props) {
  const { t } = useTheme();

  if (cares.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center rounded-2xl"
        style={{ padding: '28px 20px', backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-center mb-2.5"
          style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.accentLight }}>
          <Sparkles size={22} style={{ color: t.accent }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>스페셜케어를 추가해 보세요</p>
        <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>모공팩·발각질처럼 가끔 챙기는 케어를 주기로 관리해요</p>
        <button onClick={onAdd} className="mt-3.5 flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
          <Plus size={15} /> 케어 추가
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cares.map(c => <CareCard key={c.id} care={c} onDone={onDone} onEdit={onEdit} />)}
    </div>
  );
}
