// 살림 — 소모품 교체주기 카드 (Stage 4, 모바일).
//  · 도넛 링(주기 소진율 = daysSince/cycleDays) + 이름 + "N일 / M일 주기".
//  · status 'over' → 코랄(t.danger), 아니면 그린(t.success). (careUtils.careStatus 결과 사용)
//  · "교체함" → onReplace(restart) / 설정 아이콘 → 주기(일수) setCycle 인라인 편집 / 삭제.
//  · 파생값·액션은 전부 useHousekeeping 훅에서 받은 것을 호출만 한다.
import { useState } from 'react';
import { RotateCcw, Settings2, Trash2, Check } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { CycleDerived } from './useHousekeeping';

interface Props {
  cycle: CycleDerived;
  onReplace: (id: string) => void;
  onSetCycle: (id: string, days: number) => void;
  onDelete: (id: string) => void;
}

export function ConsumableCycleCard({ cycle, onReplace, onSetCycle, onDelete }: Props) {
  const { t } = useTheme();
  const [editing, setEditing] = useState(false);
  const [daysInput, setDaysInput] = useState<string>(String(cycle.cycleDays || ''));

  const ds = cycle.daysSince;
  const cd = cycle.cycleDays || 0;
  const over = cycle.status === 'over';
  const ringColor = over ? t.danger : t.success;
  // 소진율 — 한 번도 안 함(ds=null) 이면 가득 찬 것으로 본다(교체 필요).
  const pct = cd > 0 && ds != null ? Math.min(1, ds / cd) : (ds == null ? 1 : 0);

  // 도넛 링 SVG
  const R = 20, STROKE = 5, C = 2 * Math.PI * R;
  const dash = C * pct;

  const saveDays = () => {
    const n = Math.round(Number(daysInput));
    if (n > 0) onSetCycle(cycle.id, n);
    setEditing(false);
  };

  return (
    <div className="rounded-2xl px-3 py-3"
      style={{
        backgroundColor: over ? t.dangerLight : t.card,
        border: `1px solid ${over ? `${t.danger}55` : t.border}`,
        boxShadow: t.shadow,
      }}>
      <div className="flex items-center gap-3">
        {/* 도넛 링 */}
        <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
          <svg width={52} height={52} viewBox="0 0 52 52">
            <circle cx={26} cy={26} r={R} fill="none" stroke={t.bgSub} strokeWidth={STROKE} />
            <circle cx={26} cy={26} r={R} fill="none" stroke={ringColor} strokeWidth={STROKE}
              strokeLinecap="round" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 26 26)" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center"
            style={{ fontSize: 13, fontWeight: 800, color: ringColor }}>
            {ds == null ? '–' : ds}
          </span>
        </div>

        {/* 이름 + 주기 */}
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{cycle.name}</p>
          <p style={{ fontSize: 12, color: over ? t.danger : t.textMuted, marginTop: 2 }}>
            {ds == null ? '아직 교체 안 함' : `교체한 지 ${ds}일`} · {cd}일 주기
          </p>
        </div>

        {/* 액션 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onReplace(cycle.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
            style={{ fontSize: 12, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
            <RotateCcw size={13} /> 교체함
          </button>
          <button onClick={() => { setDaysInput(String(cycle.cycleDays || '')); setEditing(v => !v); }}
            className="rounded-lg flex items-center justify-center"
            style={{ width: 32, height: 32, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
            aria-label="주기 설정">
            <Settings2 size={15} />
          </button>
        </div>
      </div>

      {/* 주기 설정 인라인 편집 */}
      {editing && (
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${t.borderLight}` }}>
          <span style={{ fontSize: 13, color: t.textSub }}>교체 주기</span>
          <input type="number" inputMode="numeric" min={1} value={daysInput}
            onChange={e => setDaysInput(e.target.value)}
            style={{ width: 70, borderRadius: 8, padding: '6px 8px', fontSize: 14, textAlign: 'center',
              border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none' }} />
          <span style={{ fontSize: 13, color: t.textSub }}>일</span>
          <button onClick={saveDays}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
            style={{ fontSize: 12, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight }}>
            <Check size={13} /> 저장
          </button>
          <div className="flex-1" />
          <button onClick={() => onDelete(cycle.id)}
            className="rounded-lg flex items-center justify-center"
            style={{ width: 32, height: 32, color: t.danger, backgroundColor: t.dangerLight, border: `1px solid ${t.danger}55` }}
            aria-label="삭제">
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
