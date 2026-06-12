import { useEffect, useMemo, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db, exerciseLabel } from '../../../lib/db';
import type { Exercise, ExerciseBodyPart } from '../../../lib/db';
import { SheetShell } from './SheetShell';
import { ExerciseThumb } from './ExerciseThumb';

const FILTERS: { key: ExerciseBodyPart | '전체'; label: string }[] = [
  { key: '전체', label: '전체' }, { key: '하체', label: '하체' }, { key: '등', label: '등' },
  { key: '가슴', label: '가슴' }, { key: '어깨', label: '어깨' }, { key: '팔', label: '팔' },
  { key: '코어', label: '코어' }, { key: '유산소', label: '유산소' }, { key: '전신', label: '전신' },
];
const TYPE_FILTERS: { key: '전체' | '근력' | '유산소'; label: string }[] = [
  { key: '전체', label: '전체' }, { key: '근력', label: '근력' }, { key: '유산소', label: '유산소' },
];

interface Props {
  title?: string;
  loggedExerciseIds: Set<string>;     // "지난 기록 있음" 배지용
  onClose: () => void;
  onPick: (exercise: Exercise) => void;  // 채택/선택 완료 → 종목 반환
  wide?: boolean;                      // PC 넓은 모달 + 사진 그리드 4열(모바일은 동일)
}

export function ExercisePickerSheet({ title = '종목 선택', loggedExerciseIds, onClose, onPick, wide }: Props) {
  const { t } = useTheme();
  const [mine, setMine] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [bodyFilter, setBodyFilter] = useState<ExerciseBodyPart | '전체'>('전체');
  const [typeFilter, setTypeFilter] = useState<'전체' | '근력' | '유산소'>('전체');

  // 채택(한글 별칭) 오버레이 상태
  const [adopting, setAdopting] = useState<Exercise | null>(null);
  const [alias, setAlias] = useState('');

  useEffect(() => { db.workouts.listMine().then(setMine); }, []);

  // 검색 디바운스 — 입력 시 전체 카탈로그 조회
  useEffect(() => {
    const term = query.trim();
    if (!term) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      const r = await db.workouts.search(term);
      setResults(r);
      setSearching(false);
    }, 220);
    return () => clearTimeout(id);
  }, [query]);

  const isSearch = query.trim().length > 0;

  const list = useMemo(() => {
    const base = isSearch ? results : mine;
    return base.filter(e =>
      (bodyFilter === '전체' || e.bodyPart === bodyFilter) &&
      (typeFilter === '전체' || e.type === typeFilter)
    );
  }, [isSearch, results, mine, bodyFilter, typeFilter]);

  // 종목 선택: 한글명 있으면 바로, 카탈로그(name_ko=null·공용)면 채택 오버레이
  const handleTap = (ex: Exercise) => {
    if (ex.nameKo || ex.userId) { onPick(ex); return; }
    setAdopting(ex);
    setAlias('');
  };

  const confirmAdopt = async () => {
    if (!adopting) return;
    const adopted = await db.workouts.adopt(adopting, alias.trim() || null);
    setAdopting(null);
    if (adopted) { setMine(prev => [adopted, ...prev]); onPick(adopted); }
  };

  return (
    <SheetShell title={title} onClose={onClose} wide={wide}>
      <div className="px-4 py-3 space-y-3">
        {/* 검색창 */}
        <div
          className="flex items-center gap-2 px-3"
          style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 12, height: 42 }}
        >
          <Search size={16} color={t.textMuted} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="전체 종목 검색 (한글·영어·근육·장비)"
            style={{ flex: 1, fontSize: 14, color: t.text, backgroundColor: 'transparent', outline: 'none' }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="검색 지우기"><X size={16} color={t.textMuted} /></button>
          )}
        </div>

        {/* 안내 라벨 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
          {isSearch ? (searching ? '검색 중…' : `전체 카탈로그 · ${list.length}개`) : '내 운동'}
        </div>

        {/* 필터 칩 — 부위 */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => {
            const active = bodyFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setBodyFilter(f.key)}
                style={{
                  flexShrink: 0, fontSize: 12, fontWeight: 700,
                  color: active ? '#fff' : t.textSub,
                  backgroundColor: active ? t.accent : t.bgSub,
                  border: `1px solid ${active ? t.accent : t.borderLight}`,
                  padding: '5px 11px', borderRadius: 999,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {/* 필터 칩 — 타입 */}
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map(f => {
            const active = typeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                style={{
                  fontSize: 11, fontWeight: 700,
                  color: active ? t.accent : t.textMuted,
                  backgroundColor: active ? t.accentLight : 'transparent',
                  border: `1px solid ${active ? t.accent : t.borderLight}`,
                  padding: '3px 10px', borderRadius: 999,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* 그리드 */}
        {list.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '32px 0' }}>
            {isSearch
              ? (searching ? '' : '검색 결과가 없어요')
              : '아직 내 운동이 없어요.\n검색해서 종목을 추가해보세요.'}
          </div>
        ) : (
          <div className={`grid grid-cols-2 ${wide ? 'lg:grid-cols-4' : ''} gap-2.5 pb-2`}>
            {list.map(ex => {
              const hasLog = loggedExerciseIds.has(ex.id);
              const isCatalog = !ex.nameKo && !ex.userId;
              return (
                <button
                  key={ex.id}
                  onClick={() => handleTap(ex)}
                  className="flex flex-col items-start text-left"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 14, padding: 10, gap: 8 }}
                >
                  <ExerciseThumb exercise={ex} size={64} radius={10} />
                  <div className="w-full min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.25 }} className="line-clamp-2">
                      {exerciseLabel(ex)}
                    </div>
                    <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>
                      {ex.bodyPart}{isCatalog ? ' · 새 종목' : ''}
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: hasLog ? t.success : t.textMuted, marginTop: 3 }}>
                      {hasLog ? '지난 기록 있음' : '첫 기록'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 채택(한글 별칭) 오버레이 */}
      {adopting && (
        <div
          className="absolute inset-0 z-10 flex items-end lg:items-center lg:justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setAdopting(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full lg:w-[360px] lg:rounded-2xl rounded-t-2xl"
            style={{ backgroundColor: t.card, padding: 18, paddingBottom: 'max(env(safe-area-inset-bottom), 18px)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <ExerciseThumb exercise={adopting} size={48} />
              <div className="min-w-0">
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }} className="truncate">{adopting.nameEn}</div>
                <div style={{ fontSize: 11.5, color: t.textMuted }}>{adopting.bodyPart} · {adopting.type}</div>
              </div>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>한글 이름 (선택)</label>
            <input
              value={alias}
              onChange={e => setAlias(e.target.value)}
              autoFocus
              placeholder="비워두면 영어 이름으로 표시"
              onKeyDown={e => { if (e.key === 'Enter') confirmAdopt(); }}
              style={{
                width: '100%', marginTop: 6, fontSize: 14, color: t.text, backgroundColor: t.bgSub,
                border: `1px solid ${t.borderLight}`, borderRadius: 10, padding: '10px 12px', outline: 'none',
              }}
            />
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
              한글 이름은 지금 한 번만 정하면 저장돼요. (자동 번역 안 함)
            </p>
            <button
              onClick={confirmAdopt}
              className="w-full flex items-center justify-center gap-1.5 mt-3"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 700, borderRadius: 12, padding: '11px 0' }}
            >
              <Check size={16} color="#fff" /> 내 운동에 추가하고 기록
            </button>
          </div>
        </div>
      )}
    </SheetShell>
  );
}
