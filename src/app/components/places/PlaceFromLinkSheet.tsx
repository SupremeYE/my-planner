// 가고싶은 곳 — 링크·SNS/스크린샷으로 장소 담기 (트립게더식)
//
// 흐름: 링크(인스타/유튜브) 붙여넣기 or 스크린샷 업로드
//   → extract-places(gpt-4o-mini) 로 장소 후보 추출
//   → 후보별로 카카오 keywordSearch 자동 검색 + 사용자 확인/수정/제외 ("저장 시점 1회" 지오코딩)
//   → db.places.create + enrich 로 저장(출처·썸네일 포함). 여러 장소 일괄 저장.
//
// 재사용: fetch-link-metadata(캡션·커버), kakaoMap(keywordSearch/geocodeFromKakao), db.places.*
// 제약: 인스타는 공개 게시물 OG 만 best-effort → 실패 시 스크린샷 업로드로 폴백.
import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Image as ImageIcon, Loader2, Search, MapPin, Check, Sparkles } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { PlaceFolder } from '../../../lib/db';
import { keywordSearch, geocodeFromKakao, shortCategory, hasKakaoKey, type KakaoPlace } from '../../../lib/kakaoMap';
import { PlaceSheet, Field } from './PlaceSheet';
import { withAlpha } from './placeHelpers';

type ExtractedPlace = { name: string; category?: string; addressHint?: string; note?: string; confidence: number };

interface RowState {
  id: string;
  cand: ExtractedPlace;
  included: boolean;
  picked: KakaoPlace | null;
}

interface Props {
  folders: PlaceFolder[];
  defaultFolderId?: string | null; // 특정 폴더에서 열었을 때 저장한 장소를 그 폴더에 넣음
  onClose: () => void;
  onSaved: () => void;
}

// ── 후보 1개 행 — 자체 카카오 검색/확인 상태를 가짐 ──────────────────────────
function CandidateRow({
  row, onToggle, onPick,
}: {
  row: RowState;
  onToggle: () => void;
  onPick: (k: KakaoPlace | null) => void;
}) {
  const { t } = useTheme();
  const { cand, included, picked } = row;
  const [query, setQuery] = useState(`${cand.name}${cand.addressHint ? ' ' + cand.addressHint : ''}`);
  const [candidates, setCandidates] = useState<KakaoPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false); // 카카오 후보 목록 펼침(확정 전/변경 시)

  const run = useCallback(async (q: string, autoPick: boolean) => {
    const query = q.trim();
    if (!query) return;
    setSearching(true); setError(null);
    try {
      const results = await keywordSearch(query);
      if (autoPick && results.length > 0) {
        onPick(results[0]); // 상단 매치를 자동 선택(사용자가 변경 가능)
        setOpen(false); setCandidates(null);
      } else {
        setCandidates(results); setOpen(true);
        if (results.length === 0) setError('검색 결과가 없어요. 검색어를 바꿔보세요.');
      }
    } catch {
      setError('카카오 지도를 불러오지 못했어요.');
    } finally {
      setSearching(false);
    }
  }, [onPick]);

  // 최초 1회 자동 검색 → 상단 매치 자동 확정
  useEffect(() => {
    if (hasKakaoKey()) run(query, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowBg = included ? t.card : withAlpha(t.textMuted, 0.06);

  return (
    <div style={{ border: `1px solid ${included ? t.borderLight : t.border}`, borderRadius: 12, padding: 10, marginBottom: 8, backgroundColor: rowBg, opacity: included ? 1 : 0.6 }}>
      <div className="flex items-start gap-2.5">
        {/* 포함 체크박스 */}
        <button
          onClick={onToggle}
          aria-label={included ? '제외' : '포함'}
          style={{ flexShrink: 0, marginTop: 1, width: 22, height: 22, borderRadius: 6, border: `2px solid ${included ? t.accent : t.border}`, backgroundColor: included ? t.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s' }}
        >
          {included && <Check size={13} color="#fff" strokeWidth={3} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 추출된 이름 + 카테고리/노트 */}
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cand.name}</div>
          {(cand.category || cand.note) && (
            <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[cand.category, cand.note].filter(Boolean).join(' · ')}
            </div>
          )}

          {included && (
            <div style={{ marginTop: 7 }}>
              {picked && !open ? (
                // 카카오 확정됨
                <div className="flex items-center gap-2" style={{ padding: '7px 10px', borderRadius: 9, border: `1.5px solid ${t.success}`, backgroundColor: withAlpha(t.success, 0.08) }}>
                  <MapPin size={13} color={t.success} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {picked.place_name} · {picked.road_address_name || picked.address_name}
                  </span>
                  <button onClick={() => run(query, false)} style={{ flexShrink: 0, fontSize: 11, color: t.textSub, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>변경</button>
                </div>
              ) : (
                // 검색/후보 선택
                <>
                  {!hasKakaoKey() && <p style={{ fontSize: 11, color: t.danger, marginBottom: 5 }}>카카오 지도 키가 없어 위치 확정을 못 해요(이름만 저장 가능).</p>}
                  <div className="flex gap-1.5">
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(query, false); } }}
                      placeholder="카카오에서 검색"
                      disabled={!hasKakaoKey()}
                      style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.text, fontSize: 12.5 }}
                    />
                    <button
                      onClick={() => run(query, false)}
                      disabled={!query.trim() || searching || !hasKakaoKey()}
                      className="flex items-center justify-center"
                      style={{ flexShrink: 0, padding: '0 12px', borderRadius: 9, border: 'none', background: t.accent, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: !query.trim() || searching || !hasKakaoKey() ? 0.5 : 1 }}
                    >
                      {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </div>
                  {error && <p style={{ fontSize: 11, color: t.textSub, marginTop: 5 }}>{error}</p>}
                  {candidates && candidates.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1.5" style={{ maxHeight: 168, overflowY: 'auto' }}>
                      {candidates.map(c => {
                        const on = picked?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { onPick(c); setOpen(false); }}
                            className="text-left"
                            style={{ padding: '7px 9px', borderRadius: 8, border: `1px solid ${on ? t.accent : t.borderLight}`, background: on ? withAlpha(t.accent, 0.08) : t.card, cursor: 'pointer' }}
                          >
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{c.place_name}</div>
                            <div style={{ fontSize: 10.5, color: t.textSub, marginTop: 1 }}>{c.road_address_name || c.address_name}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlaceFromLinkSheet({ folders, defaultFolderId, onClose, onSaved }: Props) {
  const { t } = useTheme();

  const [mode, setMode] = useState<'link' | 'shot'>('link');
  const [url, setUrl] = useState('');
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 추출 결과 + 공통 출처/썸네일
  const [rows, setRows] = useState<RowState[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyPlaces = (places: ExtractedPlace[] | null) => {
    if (!places || places.length === 0) {
      setErr('장소를 찾지 못했어요. 캡션에 장소가 없으면 스크린샷으로 다시 시도해 주세요.');
      setRows([]);
      return;
    }
    setErr(null);
    setRows(places.map((p, i) => ({ id: `${i}-${p.name}`, cand: p, included: true, picked: null })));
  };

  // 링크 → 메타 수집 → 장소 추출
  const handleFetchLink = async () => {
    const u = url.trim();
    if (!u || extracting) return;
    setExtracting(true); setErr(null); setRows([]);
    try {
      const meta = await db.scraps.fetchLinkMetadata(u);
      const cover = meta?.thumbnail_url ?? null;
      const src = meta?.source ?? null;
      setSource(src); setThumb(cover);
      const places = await db.places.extractFromLink({
        caption: meta?.description ?? null,
        title: meta?.title ?? null,
        image_url: cover,
        source: src,
      });
      applyPlaces(places);
    } catch {
      setErr('가져오기에 실패했어요. 잠시 후 다시 시도하거나 스크린샷을 써주세요.');
    } finally {
      setExtracting(false);
    }
  };

  // 스크린샷 → 업로드 → 장소 추출
  const handlePickShot = async (file: File | null) => {
    if (!file || extracting) return;
    setExtracting(true); setErr(null); setRows([]);
    if (shotPreview) URL.revokeObjectURL(shotPreview);
    setShotPreview(URL.createObjectURL(file));
    try {
      const key = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}`;
      const uploaded = await db.places.uploadThumb(file, key);
      if (!uploaded) { setErr('사진 업로드에 실패했어요.'); return; }
      setThumb(uploaded); setSource(null);
      const places = await db.places.extractFromLink({ image_url: uploaded });
      applyPlaces(places);
    } finally {
      setExtracting(false);
    }
  };

  const toggleRow = (id: string) => setRows(prev => prev.map(r => r.id === id ? { ...r, included: !r.included } : r));
  const pickRow = useCallback((id: string, k: KakaoPlace | null) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, picked: k } : r));
  }, []);

  const includedCount = rows.filter(r => r.included).length;

  const save = async (close: () => void) => {
    const chosen = rows.filter(r => r.included);
    if (chosen.length === 0 || saving) return;
    setSaving(true);
    try {
      for (const r of chosen) {
        const kp = r.picked;
        const geo = kp ? await geocodeFromKakao(kp) : null;
        const created = await db.places.create({
          name: kp?.place_name || r.cand.name,
          category: r.cand.category ?? (kp ? shortCategory(kp.category_name) : null),
          source,
          sourceUrl: mode === 'link' ? (url.trim() || null) : null,
          thumbnailUrl: thumb,
          memo: r.cand.note ?? null,
          ...(geo ? {
            address: geo.address, lat: geo.lat, lng: geo.lng,
            kakaoPlaceId: geo.kakaoPlaceId, phone: geo.phone, regionCode: geo.regionCode,
          } : {}),
        });
        if (created?.id) {
          if (defaultFolderId) await db.placeFolderItems.setFoldersForPlace(created.id, [defaultFolderId]);
          if (geo) void db.places.enrich(created.id); // 위치 확정된 것만 인리치(보조, 실패 무시)
        }
      }
      onSaved();
      close();
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = (m: 'link' | 'shot', label: string, Icon: typeof Link2) => {
    const on = mode === m;
    return (
      <button
        onClick={() => setMode(m)}
        className="flex-1 flex items-center justify-center gap-1.5"
        style={{ padding: '9px 0', borderRadius: 10, border: `1.5px solid ${on ? t.accent : t.border}`, backgroundColor: on ? withAlpha(t.accent, 0.1) : t.bg, color: on ? t.accent : t.textSub, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer' }}
      >
        <Icon size={15} /> {label}
      </button>
    );
  };

  return (
    <PlaceSheet
      title="링크·SNS로 장소 담기"
      onClose={onClose}
      footer={rows.length > 0 ? close => (
        <button
          onClick={() => save(close)}
          disabled={includedCount === 0 || saving}
          className="w-full"
          style={{ padding: '14px 0', borderRadius: 13, border: 'none', cursor: 'pointer', backgroundColor: t.accent, color: '#fff', fontSize: 15, fontWeight: 700, opacity: includedCount === 0 || saving ? 0.45 : 1 }}
        >
          {saving ? '저장 중…' : `${includedCount}곳 담기`}
        </button>
      ) : undefined}
    >
      {() => (
        <div className="pt-1">
          {/* 입력 방식 토글 */}
          <div className="flex gap-2 mb-4">
            {tabBtn('link', '링크', Link2)}
            {tabBtn('shot', '스크린샷', ImageIcon)}
          </div>

          {mode === 'link' ? (
            <Field label="인스타·유튜브 링크">
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleFetchLink(); } }}
                  placeholder="https://..."
                  inputMode="url"
                  style={{ flex: 1, minWidth: 0, padding: '11px 12px', borderRadius: 11, border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.text, fontSize: 14 }}
                />
                <button
                  onClick={handleFetchLink}
                  disabled={!url.trim() || extracting}
                  className="flex items-center justify-center gap-1"
                  style={{ flexShrink: 0, padding: '0 16px', borderRadius: 11, border: 'none', background: t.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !url.trim() || extracting ? 0.5 : 1 }}
                >
                  {extracting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  가져오기
                </button>
              </div>
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>공개 게시물만 가능해요. 비공개·로그인 벽이면 스크린샷을 써주세요.</p>
            </Field>
          ) : (
            <Field label="게시물 스크린샷 (카드뉴스·릴스 캡처)">
              <label
                className="flex flex-col items-center justify-center gap-2"
                style={{ padding: '22px 0', borderRadius: 13, border: `1.5px dashed ${t.border}`, backgroundColor: t.bg, cursor: extracting ? 'default' : 'pointer', color: t.textSub }}
              >
                {shotPreview ? (
                  <img src={shotPreview} alt="" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
                ) : (
                  <>
                    {extracting ? <Loader2 size={22} className="animate-spin" /> : <ImageIcon size={22} />}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>사진 선택 / 촬영</span>
                  </>
                )}
                <input type="file" accept="image/*" hidden disabled={extracting} onChange={e => handlePickShot(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
          )}

          {/* 진행/에러 */}
          {extracting && (
            <div className="flex items-center justify-center gap-2" style={{ padding: '10px 0', color: t.textSub, fontSize: 12.5 }}>
              <Loader2 size={15} className="animate-spin" /> 장소를 찾는 중…
            </div>
          )}
          {err && !extracting && (
            <p style={{ fontSize: 12.5, color: t.textSub, textAlign: 'center', padding: '10px 8px', lineHeight: 1.5 }}>{err}</p>
          )}

          {/* 후보 목록 */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between" style={{ margin: '4px 2px 8px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>찾은 장소 {rows.length}곳</span>
                <span style={{ fontSize: 11.5, color: t.textMuted }}>카카오로 확인 후 담아요</span>
              </div>
              {rows.map(r => (
                <CandidateRow
                  key={r.id}
                  row={r}
                  onToggle={() => toggleRow(r.id)}
                  onPick={k => pickRow(r.id, k)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </PlaceSheet>
  );
}
