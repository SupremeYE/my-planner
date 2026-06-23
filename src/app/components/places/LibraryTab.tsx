// 보관함 탭 — 모바일(전체/폴더 서브탭) + PC(폴더 레일 + 3열 그리드)
// Stage 1 의 db hooks + 상수만 사용. Realtime 4테이블 구독으로 PC↔모바일 즉시 반영.
import React, { useCallback, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ArrowUpRight, Pencil, Trash2, CheckSquare, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { Place, PlaceFolder } from '../../../lib/db';
import { REGION_LABELS } from '../../../constants/places';
import { placeEmoji, sourceLabel, colorFromKey, withAlpha } from './placeHelpers';
import { usePlacesData } from './usePlacesData';
import { PlaceFormSheet } from './PlaceFormSheet';
import { useFabAction } from '../../FabContext';
import { FolderFormSheet } from './FolderFormSheet';
import { FolderPickerSheet } from './FolderPickerSheet';
import ConfirmModal from '../ConfirmModal';

export function LibraryTab() {
  const { t } = useTheme();

  // ── 데이터 (공용 훅) ──────────────────────────────────────────────────────
  const { folders, places, linkMap, visitedIds, loading, refresh } = usePlacesData();

  // ── 파생 ───────────────────────────────────────────────────────────────
  const foldersById = useMemo(() => {
    const m = new Map<string, PlaceFolder>();
    folders.forEach(f => m.set(f.id, f));
    return m;
  }, [folders]);

  const folderStats = useMemo(() => {
    const m = new Map<string, { total: number; visited: number }>();
    folders.forEach(f => m.set(f.id, { total: 0, visited: 0 }));
    places.forEach(p => {
      (linkMap.get(p.id) ?? []).forEach(fid => {
        const s = m.get(fid);
        if (s) { s.total++; if (visitedIds.has(p.id)) s.visited++; }
      });
    });
    return m;
  }, [folders, places, linkMap, visitedIds]);

  const placesInFolder = useCallback(
    (folderId: string) => places.filter(p => (linkMap.get(p.id) ?? []).includes(folderId)),
    [places, linkMap],
  );

  // ── UI 상태 ─────────────────────────────────────────────────────────────
  const [mobileSub, setMobileSub] = useState<'all' | 'fold'>('all');
  const [mobileFolder, setMobileFolder] = useState<PlaceFolder | null>(null); // 모바일 폴더 드릴다운
  const [pcFolder, setPcFolder] = useState<string>('all');                    // PC 선택 폴더('all'|id)

  // 시트
  const [addPlaceFor, setAddPlaceFor] = useState<string | null | undefined>(undefined); // undefined=닫힘, null=폴더없음, id=기본폴더
  const [editPlace, setEditPlace] = useState<Place | null>(null);

  // 전역 FAB — 장소 추가 (폴더는 폼에서 선택)
  useFabAction({ kind: 'action', label: '장소 추가', icon: Plus, onPress: () => setAddPlaceFor(null) });
  const [addFolder, setAddFolder] = useState(false);
  const [editFolder, setEditFolder] = useState<PlaceFolder | null>(null);
  const [pickerPlace, setPickerPlace] = useState<Place | null>(null);

  // 다중 선택 삭제
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const enterSelectMode = () => { setSelectMode(true); setSelected(new Set()); };
  const selectAll = (list: Place[]) => setSelected(new Set(list.map(p => p.id)));
  const doBulkDelete = async () => {
    const ids = Array.from(selected);
    await Promise.all(ids.map(id => db.places.delete(id)));
    setConfirmBulkDel(false);
    exitSelectMode();
    refresh();
  };

  const metaLine = (p: Place) => {
    const region = p.regionCode ? REGION_LABELS[p.regionCode] : null;
    return [p.category, region].filter(Boolean).join(' · ');
  };

  // ── 조각: 폴더 칩 줄 (장소) ──────────────────────────────────────────────
  const FolderChips = ({ p, compact }: { p: Place; compact?: boolean }) => {
    const ids = linkMap.get(p.id) ?? [];
    if (ids.length === 0) {
      return (
        <button
          onClick={e => { e.stopPropagation(); setPickerPlace(p); }}
          style={{ fontSize: 10.5, color: t.textSub, border: `1px dashed ${t.border}`, borderRadius: 7, padding: '2px 7px', background: 'transparent', cursor: 'pointer' }}
        >
          ＋ 폴더 지정
        </button>
      );
    }
    return (
      <>
        {ids.map(fid => {
          const f = foldersById.get(fid);
          if (!f) return null;
          const c = colorFromKey(f.color, t);
          return (
            <button
              key={fid}
              onClick={e => { e.stopPropagation(); setPickerPlace(p); }}
              style={{ fontSize: 10.5, color: c, backgroundColor: withAlpha(c, 0.13), borderRadius: 7, padding: '2px 7px', border: 'none', cursor: 'pointer', maxWidth: compact ? 96 : 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={f.name}
            >
              {f.icon ? `${f.icon} ` : ''}{f.name}
            </button>
          );
        })}
      </>
    );
  };

  // ── 조각: 모바일 장소 행 ──────────────────────────────────────────────────
  const PlaceRow = ({ p }: { p: Place }) => {
    const emo = placeEmoji({ concept: p.concept, category: p.category });
    const src = sourceLabel(p.source);
    const went = visitedIds.has(p.id);
    const isSelected = selected.has(p.id);
    return (
      <div
        onClick={() => selectMode ? toggleSelect(p.id) : setEditPlace(p)}
        className="flex items-center gap-3"
        style={{ padding: '11px 4px', borderBottom: `1px solid ${t.borderLight}`, cursor: 'pointer', backgroundColor: isSelected ? withAlpha(t.accent, 0.08) : undefined, borderRadius: isSelected ? 10 : undefined }}
      >
        {selectMode && (
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? t.accent : t.border}`, backgroundColor: isSelected ? t.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
            {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </div>
        )}
        <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 11, fontSize: 22, flexShrink: 0, backgroundColor: withAlpha(colorFromKey(p.concept ? CONCEPT_COLOR(p.concept) : 'gold', t), 0.14) }}>
          {emo}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          {metaLine(p) && <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 1 }}>{metaLine(p)}</div>}
          <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 5 }}>
            <FolderChips p={p} compact />
            {src && <span style={{ fontSize: 10, color: t.textMuted, display: 'inline-flex', alignItems: 'center', gap: 1 }}><ArrowUpRight size={11} />{src}</span>}
            {went && <span style={{ fontSize: 10.5, color: t.success, fontWeight: 700 }}>✓ 다녀옴</span>}
          </div>
        </div>
      </div>
    );
  };

  // 장소 추가 dashed 행
  const AddPlaceRow = ({ folderId }: { folderId?: string | null }) => (
    <button
      onClick={() => setAddPlaceFor(folderId ?? null)}
      className="flex items-center justify-center gap-1.5 w-full"
      style={{ padding: '12px 0', borderRadius: 12, border: `1.5px dashed ${t.border}`, backgroundColor: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', margin: '6px 0 10px' }}
    >
      <Plus size={15} /> 장소 추가
    </button>
  );

  // 빈 상태
  const EmptyPlaces = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 22, color: t.textSub }}>
        아직 모아둔 곳이 없어요
      </div>
      <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 4 }}>마음에 드는 장소를 하나씩 담아볼까요?</div>
      <button
        onClick={() => setAddPlaceFor(null)}
        className="inline-flex items-center gap-1.5 mt-4"
        style={{ padding: '10px 18px', borderRadius: 12, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
      >
        <Plus size={16} /> 첫 장소 담기
      </button>
    </div>
  );

  // ── 조각: PC 장소 카드 ────────────────────────────────────────────────────
  const PlaceCard = ({ p }: { p: Place }) => {
    const emo = placeEmoji({ concept: p.concept, category: p.category });
    const src = sourceLabel(p.source);
    const went = visitedIds.has(p.id);
    const coverColor = colorFromKey(p.concept ? CONCEPT_COLOR(p.concept) : 'gold', t);
    const isSelected = selected.has(p.id);
    return (
      <div
        onClick={() => selectMode ? toggleSelect(p.id) : setEditPlace(p)}
        className="places-card"
        style={{ backgroundColor: t.card, border: `2px solid ${isSelected ? t.accent : t.borderLight}`, borderRadius: 13, overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }}
      >
        <div className="flex items-center justify-center" style={{ height: 84, fontSize: 30, position: 'relative', backgroundColor: withAlpha(coverColor, 0.14) }}>
          {emo}
          {selectMode && (
            <div style={{ position: 'absolute', top: 8, left: 9, width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? t.accent : 'rgba(255,255,255,0.8)'}`, backgroundColor: isSelected ? t.accent : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', zIndex: 1 }}>
              {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
            </div>
          )}
          {src && (
            <span style={{ position: 'absolute', top: 8, right: 9, fontSize: 9.5, backgroundColor: withAlpha(t.card, 0.9), borderRadius: 5, padding: '2px 6px', color: t.textSub, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <ArrowUpRight size={10} />{src}
            </span>
          )}
          {went && !selectMode && (
            <span style={{ position: 'absolute', top: 8, left: 9, fontSize: 9.5, backgroundColor: t.success, color: '#fff', borderRadius: 5, padding: '2px 6px', fontWeight: 700 }}>✓</span>
          )}
        </div>
        <div style={{ padding: '10px 12px 12px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          {metaLine(p) && <div style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>{metaLine(p)}</div>}
          <div className="flex items-center gap-1 flex-wrap" style={{ marginTop: 7 }}>
            <FolderChips p={p} />
          </div>
        </div>
      </div>
    );
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────────
  const hasPlaces = places.length > 0;

  return (
    <>
      {/* ===================== 모바일 ===================== */}
      <div className="lg:hidden px-[18px] pb-6">
        {mobileFolder ? (
          /* 폴더 드릴다운 */
          <div className="pt-2">
            <button onClick={() => { setMobileFolder(null); exitSelectMode(); }} className="flex items-center gap-1" style={{ fontSize: 13, color: t.textSub, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 8px' }}>
              <ChevronLeft size={16} /> 폴더
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: 22 }}>{mobileFolder.icon || '📁'}</span>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: t.text }}>{mobileFolder.name}</span>
              <button onClick={() => setEditFolder(mobileFolder)} style={{ marginLeft: 'auto', color: t.textSub, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Pencil size={15} /></button>
            </div>
            {!selectMode ? (
              <div className="flex items-center gap-2">
                <div style={{ flex: 1 }}><AddPlaceRow folderId={mobileFolder.id} /></div>
                {placesInFolder(mobileFolder.id).length > 0 && (
                  <button onClick={enterSelectMode} style={{ flexShrink: 0, padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 4 }}>
                    <CheckSquare size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 3 }} />선택
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => selectAll(placesInFolder(mobileFolder.id))} style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>전체 선택</button>
                <span style={{ flex: 1, fontSize: 12.5, color: t.textSub, textAlign: 'center' }}>{selected.size}개 선택됨</span>
                <button onClick={exitSelectMode} style={{ padding: '5px', borderRadius: 8, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer' }}><X size={18} /></button>
              </div>
            )}
            {placesInFolder(mobileFolder.id).length === 0
              ? <div style={{ textAlign: 'center', padding: '28px 0', color: t.textSub, fontSize: 13 }}>아직 비어있어요</div>
              : placesInFolder(mobileFolder.id).map(p => <PlaceRow key={p.id} p={p} />)}
          </div>
        ) : (
          <>
            {/* 서브탭 */}
            <div className="flex gap-5" style={{ borderBottom: `1px solid ${t.borderLight}`, marginBottom: 8, paddingTop: 6 }}>
              {([['all', `전체 ${places.length}`], ['fold', `폴더 ${folders.length}`]] as const).map(([k, label]) => {
                const on = mobileSub === k;
                return (
                  <button key={k} onClick={() => { setMobileSub(k); exitSelectMode(); }} style={{ padding: '8px 0 10px', fontSize: 14, fontWeight: 700, color: on ? t.accent : t.textSub, borderBottom: `2px solid ${on ? t.accent : 'transparent'}`, marginBottom: -1, background: 'none', cursor: 'pointer' }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {mobileSub === 'all' && (
              loading ? null : !hasPlaces ? <EmptyPlaces /> : (
                <div className="pt-1">
                  {!selectMode ? (
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1 }}><AddPlaceRow /></div>
                      <button onClick={enterSelectMode} style={{ flexShrink: 0, padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 4 }}>
                        <CheckSquare size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 3 }} />선택
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => selectAll(places)} style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>전체 선택</button>
                      <span style={{ flex: 1, fontSize: 12.5, color: t.textSub, textAlign: 'center' }}>{selected.size}개 선택됨</span>
                      <button onClick={exitSelectMode} style={{ padding: '5px', borderRadius: 8, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                  )}
                  {places.map(p => <PlaceRow key={p.id} p={p} />)}
                </div>
              )
            )}

            {mobileSub === 'fold' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {folders.map(f => {
                  const s = folderStats.get(f.id) ?? { total: 0, visited: 0 };
                  const c = colorFromKey(f.color, t);
                  return (
                    <div key={f.id} onClick={() => setMobileFolder(f)} style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer' }}>
                      <div className="flex items-center justify-center" style={{ height: 66, fontSize: 28, backgroundColor: withAlpha(c, 0.16) }}>{f.icon || '📁'}</div>
                      <div style={{ padding: '8px 12px 10px' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>{s.total}곳{s.visited > 0 ? ` · ${s.visited}곳 다녀옴` : ''}</div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setAddFolder(true)} className="flex items-center justify-center" style={{ minHeight: 104, borderRadius: 16, border: `1.5px dashed ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 700, background: 'transparent', cursor: 'pointer' }}>
                  ＋ 폴더 추가
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===================== PC ===================== */}
      <div className="hidden lg:flex" style={{ height: '100%' }}>
        {/* 폴더 레일 */}
        <div style={{ width: 200, borderRight: `1px solid ${t.borderLight}`, padding: '14px 12px', overflowY: 'auto', flexShrink: 0 }}>
          <RailItem label="전체" icon="🗂" count={places.length} active={pcFolder === 'all'} onClick={() => setPcFolder('all')} t={t} />
          {folders.map(f => {
            const s = folderStats.get(f.id) ?? { total: 0, visited: 0 };
            return (
              <RailItem
                key={f.id}
                label={f.name}
                icon={f.icon || '📁'}
                count={s.total}
                active={pcFolder === f.id}
                color={colorFromKey(f.color, t)}
                onClick={() => setPcFolder(f.id)}
                onEdit={() => setEditFolder(f)}
                t={t}
              />
            );
          })}
          <button onClick={() => setAddFolder(true)} className="flex items-center justify-center gap-1 w-full" style={{ marginTop: 7, padding: '9px 0', borderRadius: 10, border: `1.5px dashed ${t.border}`, color: t.textSub, fontSize: 12.5, fontWeight: 700, background: 'transparent', cursor: 'pointer' }}>
            ＋ 새 폴더 · 테마
          </button>
        </div>

        {/* 그리드 */}
        <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
          {(() => {
            const list = pcFolder === 'all' ? places : placesInFolder(pcFolder);
            if (loading) return null;
            if (pcFolder !== 'all' && list.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '50px 0', color: t.textSub }}>
                  <div style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 21 }}>아직 비어있어요</div>
                  <button onClick={() => setAddPlaceFor(pcFolder)} className="inline-flex items-center gap-1.5 mt-3" style={{ padding: '9px 16px', borderRadius: 11, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={15} /> 이 폴더에 장소 담기
                  </button>
                </div>
              );
            }
            if (!hasPlaces) {
              return <EmptyPlaces />;
            }
            return (
              <>
                {!selectMode ? (
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{ flex: 1 }} />
                    <button onClick={enterSelectMode} style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      <CheckSquare size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />선택 삭제
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => selectAll(list)} style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>전체 선택</button>
                    <span style={{ flex: 1, fontSize: 13, color: t.textSub, textAlign: 'center' }}>{selected.size}개 선택됨</span>
                    {selected.size > 0 && (
                      <button onClick={() => setConfirmBulkDel(true)} className="flex items-center gap-1" style={{ padding: '7px 14px', borderRadius: 9, border: 'none', backgroundColor: '#E53E3E', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                        <Trash2 size={14} />삭제 ({selected.size})
                      </button>
                    )}
                    <button onClick={exitSelectMode} style={{ padding: '5px', borderRadius: 8, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer' }}><X size={20} /></button>
                  </div>
                )}
                <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)', alignContent: 'start' }}>
                  {!selectMode && (
                    <button
                      onClick={() => setAddPlaceFor(pcFolder === 'all' ? null : pcFolder)}
                      className="flex flex-col items-center justify-center gap-1"
                      style={{ minHeight: 150, borderRadius: 13, border: `1.5px dashed ${t.border}`, color: t.textSub, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      <Plus size={20} /> 장소 추가
                    </button>
                  )}
                  {list.map(p => <PlaceCard key={p.id} p={p} />)}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ===================== 시트/모달 ===================== */}
      {addPlaceFor !== undefined && (
        <PlaceFormSheet
          folders={folders}
          defaultFolderId={addPlaceFor}
          onClose={() => setAddPlaceFor(undefined)}
          onSaved={refresh}
        />
      )}
      {editPlace && (
        <PlaceFormSheet
          place={editPlace}
          folders={folders}
          currentFolderIds={linkMap.get(editPlace.id) ?? []}
          onClose={() => setEditPlace(null)}
          onSaved={refresh}
        />
      )}
      {addFolder && (
        <FolderFormSheet folders={folders} onClose={() => setAddFolder(false)} onSaved={refresh} />
      )}
      {editFolder && (
        <FolderFormSheet folder={editFolder} folders={folders} onClose={() => setEditFolder(null)} onSaved={refresh} />
      )}
      {pickerPlace && (
        <FolderPickerSheet
          place={pickerPlace}
          folders={folders}
          currentFolderIds={linkMap.get(pickerPlace.id) ?? []}
          onClose={() => setPickerPlace(null)}
          onSaved={refresh}
          onCreateFolder={() => { setPickerPlace(null); setAddFolder(true); }}
        />
      )}

      {/* 모바일 하단 삭제 바 */}
      {selectMode && selected.size > 0 && (
        <div className="lg:hidden fixed left-0 right-0 flex items-center justify-between" style={{ bottom: 60, padding: '10px 18px', backgroundColor: 'rgba(229,62,62,0.95)', backdropFilter: 'blur(6px)', zIndex: 50 }}>
          <span style={{ color: '#fff', fontSize: 13.5, fontWeight: 700 }}>{selected.size}개 선택됨</span>
          <button onClick={() => setConfirmBulkDel(true)} className="flex items-center gap-1.5" style={{ padding: '8px 16px', borderRadius: 9, border: 'none', backgroundColor: '#fff', color: '#E53E3E', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Trash2 size={15} />삭제
          </button>
        </div>
      )}

      {confirmBulkDel && (
        <ConfirmModal
          message={`선택한 ${selected.size}개 장소를 삭제할까요?`}
          description="보관함에서 사라지고, 폴더 연결도 해제돼요. 방문 기록은 남아요."
          confirmText="삭제"
          confirmDanger
          onConfirm={doBulkDelete}
          onCancel={() => setConfirmBulkDel(false)}
        />
      )}

      <style>{`.places-card{transition:transform .12s, box-shadow .12s;}
        .places-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px -14px ${withAlpha(t.text, 0.4)};}
        .places-rail:hover{background:${withAlpha(t.text, 0.04)};}
        .places-rail:hover .places-rail-edit{opacity:1 !important;}`}</style>
    </>
  );
}

// concept → 색 키 (커버 틴트용)
function CONCEPT_COLOR(concept: string): string {
  // CONCEPTS 의 color 키를 그대로 쓰되, 모르는 값은 gold
  const map: Record<string, string> = { cafe: 'gold', charge: 'green', date: 'coral', friend: 'gold', culture: 'green', food: 'coral' };
  return map[concept] ?? 'gold';
}

// ── PC 폴더 레일 아이템 ──
function RailItem({ label, icon, count, active, color, onClick, onEdit, t }: {
  label: string; icon: string; count: number; active: boolean; color?: string;
  onClick: () => void; onEdit?: () => void; t: ReturnType<typeof useTheme>['t'];
}) {
  return (
    <div
      onClick={onClick}
      className="places-rail flex items-center gap-2.5"
      style={{ padding: '9px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, marginBottom: 1, backgroundColor: active ? withAlpha(color ?? t.accent, 0.12) : 'transparent', color: active ? (color ?? t.accent) : t.text, fontWeight: active ? 700 : 500 }}
    >
      <span className="flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 7, fontSize: 13, backgroundColor: withAlpha(color ?? t.accent, 0.14), flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {onEdit && (
        <button onClick={e => { e.stopPropagation(); onEdit(); }} className="places-rail-edit" style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0 }}>
          <Pencil size={13} />
        </button>
      )}
      <span style={{ fontSize: 11, color: t.textMuted }}>{count}</span>
    </div>
  );
}
