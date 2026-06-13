// 장소 추가/수정 시트
// Stage 3A: 카카오 키워드 검색 → 후보 선택 → "저장 시점 1회" 지오코딩(좌표·주소·region_code·전화).
import React, { useState } from 'react';
import { Trash2, Search, MapPin, Loader2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { Place, PlaceFolder } from '../../../lib/db';
import { CONCEPTS } from '../../../constants/places';
import { keywordSearch, geocodeFromKakao, shortCategory, hasKakaoKey, type KakaoPlace } from '../../../lib/kakaoMap';
import ConfirmModal from '../ConfirmModal';
import { PlaceSheet, Field } from './PlaceSheet';
import { SOURCE_OPTIONS, colorFromKey, withAlpha } from './placeHelpers';

interface Props {
  place?: Place | null;             // 있으면 편집
  folders: PlaceFolder[];
  currentFolderIds?: string[];      // 편집 시 현재 소속 폴더
  defaultFolderId?: string | null;  // 특정 폴더에서 추가할 때 기본 선택
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

const ENERGY_OPTS = [
  { v: 1, label: '가볍게' },
  { v: 2, label: '보통' },
  { v: 3, label: '제대로' },
];

export function PlaceFormSheet({ place, folders, currentFolderIds, defaultFolderId, onClose, onSaved, onDeleted }: Props) {
  const { t } = useTheme();
  const isEdit = !!place;

  const [name, setName] = useState(place?.name ?? '');
  const [category, setCategory] = useState(place?.category ?? '');
  const [source, setSource] = useState(place?.source ?? '');
  const [sourceUrl, setSourceUrl] = useState(place?.sourceUrl ?? '');
  const [memo, setMemo] = useState(place?.memo ?? '');
  const [concept, setConcept] = useState<string | null>(place?.concept ?? null);
  const [energy, setEnergy] = useState<number | null>(place?.energy ?? null);
  const [selFolders, setSelFolders] = useState<Set<string>>(
    new Set(currentFolderIds ?? (defaultFolderId ? [defaultFolderId] : [])),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // ── 위치 검색(지오코딩) 상태 ──────────────────────────────────────────────
  const [selectedKakao, setSelectedKakao] = useState<KakaoPlace | null>(null);
  const [candidates, setCandidates] = useState<KakaoPlace[] | null>(null); // null=미검색
  const [searching, setSearching] = useState(false);
  // 편집 시 기존 좌표가 있으면 '확정된 위치'로 취급(주소 표시). 재검색하면 selectedKakao 로 갱신.
  const [locAddress, setLocAddress] = useState<string | null>(place?.address ?? null);
  const hasLocation = !!selectedKakao || (isEdit && place?.lat != null);

  const runSearch = async () => {
    const q = name.trim();
    if (!q || searching) return;
    setSearching(true);
    const results = await keywordSearch(q);
    setCandidates(results);
    setSearching(false);
  };

  const pickCandidate = (c: KakaoPlace) => {
    setSelectedKakao(c);
    setLocAddress(c.road_address_name || c.address_name || null);
    setCandidates(null);
    // 카카오 이름/카테고리로 보정 (사용자가 이후 수정 가능)
    if (c.place_name) setName(c.place_name);
    const cat = shortCategory(c.category_name);
    if (cat && !category.trim()) setCategory(cat);
  };

  const clearLocation = () => {
    setSelectedKakao(null);
    setLocAddress(isEdit ? place?.address ?? null : null);
    setCandidates(null);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px', borderRadius: 11,
    border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.text, fontSize: 14,
  };

  const toggleFolder = (id: string) => {
    setSelFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async (close: () => void) => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      category: category.trim() || null,
      source: source.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      memo: memo.trim() || null,
      concept,
      energy,
    };
    // 새 후보를 골랐으면 "저장 시점 1회" 지오코딩 → 좌표·주소·region_code·전화 확정
    if (selectedKakao) {
      const geo = await geocodeFromKakao(selectedKakao);
      payload.address = geo.address;
      payload.lat = geo.lat;
      payload.lng = geo.lng;
      payload.kakaoPlaceId = geo.kakaoPlaceId;
      payload.phone = geo.phone;
      payload.regionCode = geo.regionCode;
    }
    let placeId = place?.id;
    if (isEdit && place) {
      await db.places.update(place.id, payload as Partial<Place>);
    } else {
      const created = await db.places.create(payload as Partial<Place> & { name: string });
      placeId = created?.id;
    }
    // 폴더 연결 동기화 (다대다)
    if (placeId) await db.placeFolderItems.setFoldersForPlace(placeId, [...selFolders]);
    // 위치를 새로 확정했으면 인리치먼트(블로그 후기) 저장 시점 1회 — 보조 처리(await 안 함, 실패 무시)
    if (placeId && selectedKakao) void db.places.enrich(placeId);
    onSaved();
    close();
  };

  const doDelete = async () => {
    if (!place) return;
    await db.places.delete(place.id);
    setConfirmDel(false);
    (onDeleted ?? onSaved)();
    onClose();
  };

  const chipStyle = (on: boolean, c: string): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5,
    border: `1.5px solid ${on ? c : t.border}`,
    backgroundColor: on ? withAlpha(c, 0.12) : t.bg,
    color: on ? c : t.textSub, fontWeight: on ? 700 : 500,
  });

  return (
    <>
      <PlaceSheet
        title={isEdit ? '장소 수정' : '장소 추가'}
        onClose={onClose}
        footer={close => (
          <button
            onClick={() => save(close)}
            disabled={!name.trim() || saving}
            className="w-full"
            style={{ padding: '14px 0', borderRadius: 13, border: 'none', cursor: 'pointer', backgroundColor: t.accent, color: '#fff', fontSize: 15, fontWeight: 700, opacity: !name.trim() || saving ? 0.45 : 1 }}
          >
            {isEdit ? '저장' : '추가하기'}
          </button>
        )}
      >
        {() => (
          <div className="pt-1">
            <Field label="이름">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 브라운핸즈 송도" style={inputStyle} autoFocus />
            </Field>

            <Field label="카테고리">
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 카페 · 맛집·냉면" style={inputStyle} />
            </Field>

            <Field label="위치 (카카오 검색)">
              {hasLocation ? (
                <div className="flex items-center gap-2" style={{ padding: '10px 12px', borderRadius: 11, border: `1.5px solid ${t.success}`, backgroundColor: withAlpha(t.success, 0.08) }}>
                  <MapPin size={15} color={t.success} />
                  <span style={{ flex: 1, fontSize: 12.5, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locAddress || '위치 확정됨'}</span>
                  <button onClick={clearLocation} style={{ fontSize: 12, color: t.textSub, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>변경</button>
                </div>
              ) : (
                <>
                  {!hasKakaoKey() && (
                    <p style={{ fontSize: 11.5, color: t.danger, marginBottom: 6 }}>카카오 지도 키가 없어 검색을 쓸 수 없어요 (위치 없이 저장은 가능).</p>
                  )}
                  <button
                    onClick={runSearch}
                    disabled={!name.trim() || searching || !hasKakaoKey()}
                    className="flex items-center justify-center gap-1.5 w-full"
                    style={{ padding: '10px 0', borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !name.trim() || !hasKakaoKey() ? 0.5 : 1 }}
                  >
                    {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    카카오에서 위치 찾기
                  </button>
                  {candidates && (
                    candidates.length === 0 ? (
                      <p style={{ fontSize: 12, color: t.textSub, marginTop: 8, textAlign: 'center' }}>검색 결과가 없어요. 이름을 바꿔보세요.</p>
                    ) : (
                      <div className="flex flex-col gap-1 mt-2" style={{ maxHeight: 210, overflowY: 'auto' }}>
                        {candidates.map(c => (
                          <button key={c.id} onClick={() => pickCandidate(c)} className="text-left" style={{ padding: '9px 11px', borderRadius: 10, border: `1px solid ${t.borderLight}`, background: t.card, cursor: 'pointer' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.place_name}</div>
                            <div style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>{c.road_address_name || c.address_name}</div>
                            {shortCategory(c.category_name) && <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 1 }}>{shortCategory(c.category_name)}</div>}
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </Field>

            <Field label="출처">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SOURCE_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSource(s)} style={chipStyle(source === s, t.accent)}>{s}</button>
                ))}
              </div>
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="직접 입력도 가능" style={inputStyle} />
            </Field>

            <Field label="링크 (선택)">
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." inputMode="url" style={inputStyle} />
            </Field>

            <Field label="뽑기 분류 (선택)">
              <div className="flex flex-wrap gap-1.5">
                {CONCEPTS.map(c => {
                  const col = colorFromKey(c.color, t);
                  const on = concept === c.key;
                  return (
                    <button key={c.key} onClick={() => setConcept(on ? null : c.key)} style={chipStyle(on, col)}>
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="에너지 (선택)">
              <div className="flex gap-2">
                {ENERGY_OPTS.map(o => {
                  const on = energy === o.v;
                  return (
                    <button key={o.v} onClick={() => setEnergy(on ? null : o.v)} className="flex-1" style={{ ...chipStyle(on, t.success), textAlign: 'center', borderRadius: 11 }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="메모 (선택)">
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="기억해 둘 한 줄" style={{ ...inputStyle, resize: 'none' }} />
            </Field>

            {folders.length > 0 && (
              <Field label="폴더 (여러 개 가능)">
                <div className="flex flex-wrap gap-1.5">
                  {folders.map(f => {
                    const on = selFolders.has(f.id);
                    const c = colorFromKey(f.color, t);
                    return (
                      <button key={f.id} onClick={() => toggleFolder(f.id)} style={chipStyle(on, c)}>
                        {f.icon ? `${f.icon} ` : ''}{f.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {isEdit && (
              <button
                onClick={() => setConfirmDel(true)}
                className="flex items-center justify-center gap-1.5 w-full mt-2"
                style={{ padding: '11px 0', borderRadius: 11, border: `1.5px solid ${t.dangerLight}`, backgroundColor: t.dangerLight, color: t.danger, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
              >
                <Trash2 size={15} /> 장소 삭제
              </button>
            )}
          </div>
        )}
      </PlaceSheet>

      {confirmDel && (
        <ConfirmModal
          message="이 장소를 삭제할까요?"
          description="보관함에서 사라지고, 폴더 연결도 해제돼요. 방문 기록은 남아요."
          confirmText="삭제"
          confirmDanger
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}
