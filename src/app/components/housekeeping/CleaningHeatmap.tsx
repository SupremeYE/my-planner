// 살림 — 청소구역 먼지 히트맵 (Stage 4, 모바일).
//  · 2열 그리드. 경과일(daysSince)이 클수록 배경 코랄 틴트가 진해진다.
//  · 먼지 메타포: 최근=✨(≤3일) / 중간=💨(4~9일) / 오래됨=🕸️(≥10일 또는 한 번도 안 함).
//  · 카드 탭 → onClean(오늘 청소 완료, 즉시 리셋). 길게 누르지 않고 우상단 휴지통으로 삭제.
//  · 파생값(daysSince)·액션은 useHousekeeping 훅에서 받은 것을 호출만 한다.
import { Trash2, Plus, Sparkles } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { ZoneDerived } from './useHousekeeping';

// 경과일 → 먼지 단계. null(한 번도 안 함)은 가장 오래된 단계로 본다.
export function zoneDust(ds: number | null): { emoji: string; tier: 'fresh' | 'mid' | 'old' } {
  if (ds == null) return { emoji: '🕸️', tier: 'old' };
  if (ds <= 3) return { emoji: '✨', tier: 'fresh' };
  if (ds <= 9) return { emoji: '💨', tier: 'mid' };
  return { emoji: '🕸️', tier: 'old' };
}

function ZoneCard({ zone, onClean, onDelete }: {
  zone: ZoneDerived; onClean: (id: string) => void; onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const ds = zone.daysSince;
  const { emoji, tier } = zoneDust(ds);

  // 틴트 — 경과일 클수록 코랄 진하게(8자리 hex alpha, FridgeTab 관습 동일)
  const bg = tier === 'fresh' ? t.card : tier === 'mid' ? `${t.danger}14` : `${t.danger}26`;
  const border = tier === 'fresh' ? t.border : tier === 'mid' ? `${t.danger}33` : `${t.danger}55`;
  const label = ds == null ? '아직 안 했어요' : ds === 0 ? '오늘 했어요' : `${ds}일 전`;

  return (
    <button onClick={() => onClean(zone.id)}
      className="relative text-left rounded-2xl px-3 py-3.5 active:scale-[0.98] transition-transform"
      style={{ backgroundColor: bg, border: `1px solid ${border}`, boxShadow: t.shadow }}>
      <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
      <p className="truncate mt-1.5" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{zone.name}</p>
      <p style={{ fontSize: 11.5, color: tier === 'old' ? t.danger : t.textMuted, marginTop: 2 }}>
        마지막 청소 {label}
      </p>
      {/* 삭제 */}
      <span role="button" tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onDelete(zone.id); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(zone.id); } }}
        className="absolute top-2 right-2 rounded-md flex items-center justify-center"
        style={{ width: 24, height: 24, color: t.textMuted }}
        aria-label="구역 삭제">
        <Trash2 size={13} />
      </span>
    </button>
  );
}

interface Props {
  zones: ZoneDerived[];
  onClean: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function CleaningHeatmap({ zones, onClean, onDelete, onAdd }: Props) {
  const { t } = useTheme();

  if (zones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center rounded-2xl"
        style={{ padding: '28px 20px', backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-center mb-2.5"
          style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.accentLight }}>
          <Sparkles size={22} style={{ color: t.accent }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>청소구역을 추가해 보세요</p>
        <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>화장실·주방처럼 챙길 곳을 만들면 먼지를 추적해요</p>
        <button onClick={onAdd} className="mt-3.5 flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
          <Plus size={15} /> 구역 추가
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {zones.map(z => (
        <ZoneCard key={z.id} zone={z} onClean={onClean} onDelete={onDelete} />
      ))}
    </div>
  );
}
