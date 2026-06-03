import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { CulturePlatform, CultureContentType } from '../../store';
import {
  PLATFORM_META, PLATFORM_ORDER, CONTENT_TYPE_META, CONTENT_TYPE_ORDER,
  SORT_LABELS, type CultureSortKey,
} from './cultureMeta';

export interface CultureFilterValue {
  platform: CulturePlatform | 'all';
  type: CultureContentType | 'all';
  sort: CultureSortKey;
}

interface CultureFilterSheetProps {
  value: CultureFilterValue;
  onApply: (next: CultureFilterValue) => void;
  onClose: () => void;
}

/** 모바일 전용 필터 bottom sheet — 플랫폼/유형/정렬. 임시 상태로 담았다가 "적용" 시 커밋 */
export function CultureFilterSheet({ value, onApply, onClose }: CultureFilterSheetProps) {
  const { t } = useTheme();
  const [platform, setPlatform] = useState(value.platform);
  const [type, setType] = useState(value.type);
  const [sort, setSort] = useState(value.sort);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const reset = () => { setPlatform('all'); setType('all'); setSort('created'); };

  const chip = (active: boolean) => ({
    fontSize: 13, fontWeight: active ? 600 : 400,
    backgroundColor: active ? t.accent : t.bgSub,
    color: active ? '#fff' : t.textSub,
    border: `1px solid ${active ? t.accent : t.border}`,
    minHeight: 36,
  } as React.CSSProperties);

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: '0.04em',
        textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-t-3xl flex flex-col" style={{ backgroundColor: t.bg, maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}>
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>
        <p className="px-5 pb-2" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>필터</p>

        <div className="px-5 pb-2 space-y-5 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Section label="플랫폼">
            <button onClick={() => setPlatform('all')} className="px-3 rounded-full" style={chip(platform === 'all')}>전체</button>
            {PLATFORM_ORDER.map(p => (
              <button key={p} onClick={() => setPlatform(p)} className="px-3 rounded-full" style={chip(platform === p)}>
                {PLATFORM_META[p].label}
              </button>
            ))}
          </Section>

          <Section label="유형">
            <button onClick={() => setType('all')} className="px-3 rounded-full" style={chip(type === 'all')}>전체</button>
            {CONTENT_TYPE_ORDER.map(c => (
              <button key={c} onClick={() => setType(c)} className="px-3 rounded-full" style={chip(type === c)}>
                {CONTENT_TYPE_META[c].label}
              </button>
            ))}
          </Section>

          <Section label="정렬">
            {(Object.keys(SORT_LABELS) as CultureSortKey[]).map(k => (
              <button key={k} onClick={() => setSort(k)} className="px-3 rounded-full" style={chip(sort === k)}>
                {SORT_LABELS[k]}
              </button>
            ))}
          </Section>
        </div>

        {/* 하단 액션 */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-5"
          style={{ borderTop: `1px solid ${t.border}`, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          <button onClick={reset}
            className="flex items-center justify-center gap-1.5 px-4 rounded-xl"
            style={{ minHeight: 46, backgroundColor: t.bgSub, color: t.textSub, fontSize: 14, fontWeight: 600,
              border: `1px solid ${t.border}` }}>
            <RotateCcw size={15} /> 초기화
          </button>
          <button onClick={() => { onApply({ platform, type, sort }); onClose(); }}
            className="flex-1 rounded-xl"
            style={{ minHeight: 46, backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 700 }}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
