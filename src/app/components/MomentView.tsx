import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronRight, ImagePlus, Star, Trash2, X } from 'lucide-react';
import { useTheme, type ThemeTokens } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// ── WMO 날씨 코드 → 이모지 + 한국어 레이블 ──────────────────────────────────
function weatherInfo(code: number): { emoji: string; label: string } {
  if (code === 0)                        return { emoji: '☀️',  label: '맑음' };
  if (code === 1)                        return { emoji: '🌤️', label: '대체로 맑음' };
  if (code === 2)                        return { emoji: '⛅',  label: '구름 조금' };
  if (code === 3)                        return { emoji: '☁️',  label: '흐림' };
  if (code === 45 || code === 48)        return { emoji: '🌫️', label: '안개' };
  if (code >= 51 && code <= 55)          return { emoji: '🌦️', label: '이슬비' };
  if (code === 56 || code === 57)        return { emoji: '🌨️', label: '어는 이슬비' };
  if (code >= 61 && code <= 65)          return { emoji: '🌧️', label: '비' };
  if (code === 66 || code === 67)        return { emoji: '🌨️', label: '어는 비' };
  if (code >= 71 && code <= 75)          return { emoji: '❄️',  label: '눈' };
  if (code === 77)                       return { emoji: '🌨️', label: '싸락눈' };
  if (code >= 80 && code <= 82)          return { emoji: '🌦️', label: '소나기' };
  if (code === 85 || code === 86)        return { emoji: '🌨️', label: '눈 소나기' };
  if (code >= 95 && code <= 99)          return { emoji: '⛈️',  label: '뇌우' };
  return { emoji: '🌡️', label: '날씨 정보' };
}

// ── 현재 위치 → Open-Meteo 날씨 가져오기 ─────────────────────────────────────
async function fetchWeatherImpl(): Promise<{ temp: number; code: number } | null> {
  // 1) Geolocation — maximumAge로 캐시 허용, timeout은 위치 획득 제한
  const coords = await new Promise<GeolocationCoordinates | null>(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      ()  => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
  if (!coords) return null;

  // 2) Open-Meteo (API 키 불필요)
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${coords.latitude}&longitude=${coords.longitude}` +
      `&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const temp = json?.current?.temperature_2m;
    const code = json?.current?.weather_code;
    if (temp == null || code == null) return null;
    return { temp: Math.round(temp * 10) / 10, code: Number(code) };
  } catch {
    return null;
  }
}

// 권한 다이얼로그 무한 대기 방지: 전체를 6초 타임아웃으로 감쌈
function fetchCurrentWeather(): Promise<{ temp: number; code: number } | null> {
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 6000));
  return Promise.race([fetchWeatherImpl(), timeout]).catch(() => null);
}

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Moment {
  id: string;
  created_at: string;
  content: string;
  photos: string[];
  weather_temp: number | null;
  weather_code: number | null;
  is_highlight: boolean;
  sort_order: number | null;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export function MomentView() {
  const { t } = useTheme();
  const [moments, setMoments]         = useState<Moment[]>([]);
  const [content, setContent]         = useState('');
  const [photoFiles, setPhotoFiles]   = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [saving, setSaving]           = useState(false);
  // 모바일 피드: 탭한 카드만 펼침 (기본 전부 접힘)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // 모바일 뷰 전환: 피드 / 모아보기(월별 그리드)
  const [mobileView, setMobileView]   = useState<'feed' | 'grid'>('feed');
  // PC 뷰 전환 — 모바일과 독립
  const [pcView, setPcView]           = useState<'feed' | 'grid'>('feed');
  // 아카이브 기준 연도 (기본 = 현재 연도). 칩으로 과거 연도 선택 가능
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  // 모아보기 순서 편집 — 어느 월 키가 편집 중인지(한 번에 하나만)
  const [reorderMonth, setReorderMonth] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 기록이 존재하는 연도 목록(distinct, 최신순) + 현재 연도는 항상 포함
  const availableYears = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const m of moments) set.add(new Date(m.created_at).getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [moments, currentYear]);

  // 선택 연도에 속한 모먼트 (created_at 기준, 최신순 유지)
  const yearMoments = useMemo(
    () => moments.filter(m => new Date(m.created_at).getFullYear() === selectedYear),
    [moments, selectedYear],
  );

  // 모아보기/피드용 월별 그룹 (선택 연도 안에서 최신월 우선)
  // 같은 월 내 정렬: sort_order(있으면 ASC) → created_at DESC
  const monthGroups = useMemo(() => {
    const map = new Map<string, Moment[]>();
    for (const m of yearMoments) {
      const key = format(new Date(m.created_at), 'yyyy-MM');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ao = a.sort_order, bo = b.sort_order;
        if (ao != null && bo != null) return ao - bo;
        if (ao != null) return -1;
        if (bo != null) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return Array.from(map.entries()); // yearMoments가 created_at DESC라 자연히 최신월 우선
  }, [yearMoments]);

  // 스탯: 이번 달 개수(현재 연도일 때만 의미) / 선택 연도 총 개수
  const monthCount = useMemo(() => {
    const key = format(new Date(), 'yyyy-MM');
    return moments.filter(m => format(new Date(m.created_at), 'yyyy-MM') === key).length;
  }, [moments]);
  const yearCount = yearMoments.length;

  const refreshMoments = useCallback(() => {
    db.moments.fetchAll().then(setMoments);
  }, []);

  useEffect(() => { refreshMoments(); }, [refreshMoments]);

  // 다기기 실시간 동기화 — PC에서 저장하면 모바일에도 즉시 반영
  useRealtimeSync('moments', refreshMoments);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles    = Array.from(files).slice(0, 5 - photoFiles.length);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setPhotoFiles(prev    => [...prev, ...newFiles]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles(prev    => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!content.trim() && photoFiles.length === 0) return;
    setSaving(true);
    try {
      const tmpId = crypto.randomUUID();

      // 날씨 + 사진 업로드 병렬 실행 (각각 독립 — 어느 쪽 실패해도 계속)
      const [weather, uploadedUrls] = await Promise.all([
        fetchCurrentWeather(),
        Promise.all(
          photoFiles.map((file, i) =>
            db.moments.uploadPhoto(file, tmpId, i).catch(() => null)
          )
        ).then(urls => urls.filter((u): u is string => u !== null)),
      ]);

      const id = await db.moments.create(
        content.trim(),
        uploadedUrls,
        weather?.temp,
        weather?.code,
      );
      if (id) {
        const fresh = await db.moments.fetchAll();
        setMoments(fresh);
        setContent('');
        photoPreviews.forEach(p => URL.revokeObjectURL(p));
        setPhotoFiles([]);
        setPhotoPreviews([]);
      }
    } catch (e) {
      console.error('[MomentView] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await db.moments.delete(id);
    setMoments(prev => prev.filter(m => m.id !== id));
  };

  // 하이라이트 토글 (낙관적 업데이트, 실패 시 롤백)
  const handleToggleHighlight = async (id: string) => {
    const target = moments.find(m => m.id === id);
    if (!target) return;
    const next = !target.is_highlight;
    setMoments(prev => prev.map(m => m.id === id ? { ...m, is_highlight: next } : m));
    const ok = await db.moments.setHighlight(id, next);
    if (!ok) {
      setMoments(prev => prev.map(m => m.id === id ? { ...m, is_highlight: !next } : m));
    }
  };

  // 선택 연도 하이라이트만
  const yearHighlights = useMemo(
    () => yearMoments.filter(m => m.is_highlight),
    [yearMoments],
  );
  const highlightCount = yearHighlights.length;

  // 같은 월 안에서 드래그로 재배치된 순서를 sort_order로 저장 (낙관적 + 실패 시 새로고침)
  const handleReorderCommit = async (monthKey: string, orderedIds: string[]) => {
    const entries = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
    setMoments(prev => prev.map(m => {
      const idx = orderedIds.indexOf(m.id);
      return idx >= 0 ? { ...m, sort_order: idx } : m;
    }));
    const ok = await db.moments.setSortOrders(entries);
    if (!ok) refreshMoments();
  };

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'M월 d일 (EEE) a h:mm', { locale: ko });
    } catch {
      return iso;
    }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      <div className="px-4 py-5 space-y-5 lg:p-0 lg:space-y-0">

        {/* 헤더 (모바일 전용) */}
        <div className="lg:hidden">
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>모먼트</h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>순간을 짧게 기록해요</p>
        </div>

        {/* 작성 카드 (모바일 전용) */}
        <div
          className="rounded-2xl p-4 space-y-3 lg:hidden"
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
        >
          {/* 사진 미리보기 */}
          {photoPreviews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover"
                    style={{ border: `1px solid ${t.border}` }}
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: t.text, color: t.bg }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 텍스트 입력 */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="지금 이 순간을 기록해보세요..."
            rows={3}
            className="w-full resize-none outline-none bg-transparent"
            style={{ fontSize: 15, color: t.text, lineHeight: 1.6 }}
          />

          {/* 하단 버튼 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2 items-center">
              {/* 카메라 */}
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={photoFiles.length >= 5}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
                style={{
                  backgroundColor: t.bgSub,
                  color: photoFiles.length >= 5 ? t.textMuted : t.textSub,
                  fontSize: 12,
                }}
              >
                <Camera size={14} />
                <span className="hidden sm:inline">카메라</span>
              </button>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
              />

              {/* 갤러리 */}
              <button
                onClick={() => galleryRef.current?.click()}
                disabled={photoFiles.length >= 5}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
                style={{
                  backgroundColor: t.bgSub,
                  color: photoFiles.length >= 5 ? t.textMuted : t.textSub,
                  fontSize: 12,
                }}
              >
                <ImagePlus size={14} />
                <span className="hidden sm:inline">갤러리</span>
              </button>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
              />

              {photoFiles.length > 0 && (
                <span style={{ fontSize: 11, color: t.textMuted }}>
                  {photoFiles.length}/5
                </span>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || (!content.trim() && photoFiles.length === 0)}
              className="px-4 py-1.5 rounded-xl font-semibold transition-all"
              style={{
                backgroundColor: t.accent,
                color: '#fff',
                fontSize: 13,
                opacity: saving || (!content.trim() && photoFiles.length === 0) ? 0.5 : 1,
              }}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* ===== PC 전용 레이아웃 (lg: 이상) ===== */}
        <div className="hidden lg:block px-8 py-8">
          {/* 페이지 헤더: 좌측 타이틀 / 우측 스탯 스트립 */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <div style={{ fontFamily: 'var(--font-gaegu)', fontSize: 16, color: t.textSub }}>
                오늘 하루, 기억하고 싶은 순간
              </div>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: t.text, lineHeight: 1.1, marginTop: 2 }}>
                모먼트
              </h1>
              <p style={{ fontSize: 14, color: t.textSub, marginTop: 4 }}>순간을 모아 한 해를 돌아봐요</p>
            </div>

            {/* 스탯 스트립 — 현재 연도 3칸 / 과거 연도 2칸 */}
            <div className="flex gap-3 shrink-0">
              {selectedYear === currentYear ? (
                <>
                  <StatCard label="이번 달" value={monthCount} t={t} />
                  <StatCard label="올해" value={yearCount} t={t} />
                  <StatCard label="✦ 하이라이트" value={highlightCount} t={t} valueColor={t.danger} />
                </>
              ) : (
                <>
                  <StatCard label={`${selectedYear}년`} value={yearCount} t={t} />
                  <StatCard label="✦ 하이라이트" value={highlightCount} t={t} valueColor={t.danger} />
                </>
              )}
            </div>
          </div>

          {/* 연도 선택 칩 행 */}
          <div className="flex gap-2 flex-wrap mt-6">
            {availableYears.map(y => {
              const sel = y === selectedYear;
              return (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className="flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all"
                  style={{
                    backgroundColor: sel ? t.text : 'transparent',
                    border: `1px solid ${sel ? t.text : t.border}`,
                    color: sel ? '#fff' : t.textSub,
                    minWidth: 60,
                  }}
                >
                  <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, lineHeight: 1.1 }}>{y}</span>
                  {y === currentYear && (
                    <span style={{ fontSize: 9, marginTop: 1, opacity: 0.85 }}>올해</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 본문 2열: 좌측 sticky 레일 + 우측 메인 */}
          <div className="mt-8" style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 24, alignItems: 'start' }}>
            {/* ── 좌측 레일 (sticky) ───────────────────────────────────── */}
            <aside className="space-y-4" style={{ position: 'sticky', top: 24 }}>
              {/* 빠른 기록 카드 (PC 전용 폼 — 동일 핸들러 재사용) */}
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>지금 이 순간을 기록해보세요</div>

                {/* 사진 미리보기 */}
                {photoPreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="relative">
                        <img
                          src={src}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover"
                          style={{ border: `1px solid ${t.border}` }}
                        />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: t.text, color: t.bg }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 텍스트 입력 — PC는 min-height 96px */}
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="짧게 한 줄, 길게 한 단락 — 그 순간을 그대로."
                  className="w-full resize-none outline-none bg-transparent"
                  style={{ fontSize: 14, color: t.text, lineHeight: 1.6, minHeight: 96 }}
                />

                {/* 하단 버튼 행 */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => cameraRef.current?.click()}
                      disabled={photoFiles.length >= 5}
                      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                      style={{
                        backgroundColor: t.bgSub,
                        color: photoFiles.length >= 5 ? t.textMuted : t.textSub,
                      }}
                      aria-label="카메라"
                    >
                      <Camera size={15} />
                    </button>
                    <button
                      onClick={() => galleryRef.current?.click()}
                      disabled={photoFiles.length >= 5}
                      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                      style={{
                        backgroundColor: t.bgSub,
                        color: photoFiles.length >= 5 ? t.textMuted : t.textSub,
                      }}
                      aria-label="갤러리"
                    >
                      <ImagePlus size={15} />
                    </button>
                    {photoFiles.length > 0 && (
                      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 2 }}>
                        {photoFiles.length}/5
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving || (!content.trim() && photoFiles.length === 0)}
                    className="px-4 py-1.5 rounded-lg font-semibold transition-all"
                    style={{
                      backgroundColor: t.accent,
                      color: '#fff',
                      fontSize: 13,
                      opacity: saving || (!content.trim() && photoFiles.length === 0) ? 0.5 : 1,
                    }}
                  >
                    {saving ? '저장 중...' : '기록하기'}
                  </button>
                </div>
              </div>

              {/* 하이라이트 카드 (선택 연도, 0개면 카드 자체 숨김) */}
              {highlightCount > 0 && (
                <div
                  className="rounded-2xl p-4 space-y-3"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-baseline justify-between">
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                      <span style={{ color: t.danger, marginRight: 4 }}>✦</span>
                      {selectedYear} 하이라이트
                    </div>
                    <span style={{ fontSize: 11, color: t.textMuted }}>{highlightCount}개</span>
                  </div>
                  {/* 3열 미니 썸네일 갤러리 (gold 링 + 제목 오버레이) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {yearHighlights.map(m => (
                      <HighlightMiniTile key={m.id} moment={m} t={t} />
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* ── 우측 메인 콘텐츠 ──────────────────────────────────── */}
            <main className="min-w-0 space-y-6">
              {/* 세그먼트 토글: 피드 / 모아보기 */}
              <div className="flex p-1 rounded-xl w-fit" style={{ backgroundColor: t.bgSub }}>
                {([['feed', '피드'], ['grid', '모아보기']] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setPcView(v)}
                    className="px-5 py-1.5 rounded-lg text-center transition-all"
                    style={{
                      backgroundColor: pcView === v ? t.accent : 'transparent',
                      color: pcView === v ? '#fff' : t.textSub,
                      fontSize: 13,
                      fontWeight: pcView === v ? 700 : 500,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 빈 상태 */}
              {yearMoments.length === 0 && (
                <div
                  className="rounded-2xl p-10 flex flex-col items-center gap-2"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
                >
                  <span style={{ fontSize: 36 }}>📸</span>
                  <p style={{ fontSize: 14, color: t.textMuted, textAlign: 'center' }}>
                    {moments.length === 0
                      ? <>아직 기록된 순간이 없어요.<br />첫 번째 모먼트를 남겨보세요!</>
                      : <>{selectedYear}년에는 기록된 순간이 없어요.</>}
                  </p>
                </div>
              )}

              {/* 월별 섹션 (피드/모아보기 공통 — 모바일과 일관) */}
              {yearMoments.length > 0 && monthGroups.map(([key, group]) => {
                const editing = reorderMonth === key;
                return (
                  <section key={key} className="space-y-3">
                    {/* 월 그룹 헤더: 영문 월(DM Serif) + 'YYYY · N개의 순간' + 우측 순서 편집 pill */}
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: t.text, lineHeight: 1.1 }}>
                          {format(new Date(`${key}-01T00:00:00`), 'MMMM')}
                        </span>
                        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: t.textSub, lineHeight: 1.1 }}>
                          {format(new Date(`${key}-01T00:00:00`), 'yyyy')}
                        </span>
                        <span style={{ fontSize: 13, color: t.textMuted }}>· {group.length}개의 순간</span>
                      </div>
                      {pcView === 'grid' && group.length > 1 && (
                        <button
                          onClick={() => setReorderMonth(editing ? null : key)}
                          className="shrink-0 rounded-full px-3 py-1 transition-all"
                          style={{
                            fontSize: 12,
                            backgroundColor: editing ? t.accent : 'transparent',
                            color: editing ? '#fff' : t.textSub,
                            border: `1px solid ${editing ? t.accent : t.border}`,
                          }}
                        >
                          {editing ? '완료' : '↕ 순서 편집'}
                        </button>
                      )}
                    </div>

                    {/* 피드 뷰 — 3열 메이슨리(CSS columns) */}
                    {pcView === 'feed' && (
                      <div style={{ columnCount: 3, columnGap: 16 }}>
                        {group.map(m => (
                          <MomentFeedCardPC
                            key={m.id}
                            moment={m}
                            t={t}
                            onToggleHighlight={() => handleToggleHighlight(m.id)}
                            onDelete={() => handleDelete(m.id)}
                            formatTime={formatTime}
                          />
                        ))}
                      </div>
                    )}

                    {/* 모아보기 뷰 — 5열 정사각 그리드 */}
                    {pcView === 'grid' && (
                      editing ? (
                        <ReorderGrid
                          monthKey={key}
                          items={group}
                          t={t}
                          dragId={dragId}
                          setDragId={setDragId}
                          onCommit={ids => handleReorderCommit(key, ids)}
                          columns={5}
                          gap={10}
                        />
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                          {group.map(m => (
                            <div
                              key={m.id}
                              className="transition-transform duration-200 hover:scale-[1.03]"
                              style={{ transformOrigin: 'center' }}
                            >
                              <MomentGridTile
                                moment={m}
                                t={t}
                                onToggleHighlight={() => handleToggleHighlight(m.id)}
                              />
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </section>
                );
              })}
            </main>
          </div>
        </div>

        {/* 모먼트 목록 — 모바일 전용 (연도 스코프 + 피드/모아보기 토글) */}
        <div className="lg:hidden space-y-3">
          {/* 연도 선택 칩 (가로 스크롤) */}
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {availableYears.map(y => {
              const sel = y === selectedYear;
              return (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className="shrink-0 flex flex-col items-center justify-center rounded-xl px-3.5 py-1.5"
                  style={{
                    backgroundColor: sel ? t.text : 'transparent',
                    border: `1px solid ${sel ? t.text : t.border}`,
                    color: sel ? '#fff' : t.textSub,
                    minWidth: 54,
                  }}
                >
                  <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, lineHeight: 1.1 }}>{y}</span>
                  {y === currentYear && (
                    <span style={{ fontSize: 9, marginTop: 1, opacity: 0.85 }}>올해</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 세그먼트 토글: 피드 / 모아보기 */}
          <div className="flex p-1 rounded-xl" style={{ backgroundColor: t.bgSub }}>
            {([['feed', '피드'], ['grid', '모아보기']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setMobileView(v)}
                className="flex-1 py-1.5 rounded-lg text-center transition-all"
                style={{
                  backgroundColor: mobileView === v ? t.accent : 'transparent',
                  color: mobileView === v ? '#fff' : t.textSub,
                  fontSize: 13,
                  fontWeight: mobileView === v ? 700 : 500,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 스탯 행 (토글 아래) — 현재 연도: 3칸 / 과거 연도: 2칸 (연도 순간 + 하이라이트) */}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: selectedYear === currentYear ? '1fr 1fr 1fr' : '1fr 1fr' }}
          >
            {selectedYear === currentYear ? (
              <>
                <StatCard label="이번 달" value={monthCount} t={t} />
                <StatCard label="올해" value={yearCount} t={t} />
                <StatCard label="✦ 하이라이트" value={highlightCount} t={t} valueColor={t.danger} />
              </>
            ) : (
              <>
                <StatCard label={`${selectedYear}년`} value={yearCount} t={t} />
                <StatCard label="✦ 하이라이트" value={highlightCount} t={t} valueColor={t.danger} />
              </>
            )}
          </div>

          {/* 하이라이트 행 (선택 연도, 0개면 숨김) — 가로 스크롤 카드 */}
          {highlightCount > 0 && (
            <div className="space-y-2">
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                <span style={{ color: t.danger, marginRight: 4 }}>✦</span>
                {selectedYear} 하이라이트
              </div>
              <div
                className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1"
                style={{ scrollbarWidth: 'none' }}
              >
                {yearHighlights.map(m => (
                  <HighlightCard key={m.id} moment={m} t={t} />
                ))}
              </div>
            </div>
          )}

          {/* 빈 상태 (선택 연도 기준) */}
          {yearMoments.length === 0 && (
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-2"
              style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
            >
              <span style={{ fontSize: 32 }}>📸</span>
              <p style={{ fontSize: 14, color: t.textMuted, textAlign: 'center' }}>
                {moments.length === 0
                  ? <>아직 기록된 순간이 없어요.<br />첫 번째 모먼트를 남겨보세요!</>
                  : <>{selectedYear}년에는 기록된 순간이 없어요.</>}
              </p>
            </div>
          )}

          {/* 피드 뷰 (선택 연도) */}
          {mobileView === 'feed' && yearMoments.length > 0 && (
            <div className="space-y-2.5">
              {yearMoments.map(moment => (
                <MomentCardMobile
                  key={moment.id}
                  moment={moment}
                  expanded={expandedIds.has(moment.id)}
                  onToggle={() => toggleExpand(moment.id)}
                  onDelete={() => handleDelete(moment.id)}
                  t={t}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}

          {/* 모아보기 뷰 (선택 연도 안에서 월별 3열 정사각 그리드) */}
          {mobileView === 'grid' && yearMoments.length > 0 && (
            <div className="space-y-5">
              {monthGroups.map(([key, group]) => {
                const editing = reorderMonth === key;
                return (
                  <div key={key} className="space-y-2">
                    {/* 월별 그룹 헤더 (예: June 2026 · 12개) + 순서 편집 pill */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: t.text, lineHeight: 1.1 }}>
                          {format(new Date(`${key}-01T00:00:00`), 'MMMM yyyy')}
                        </span>
                        <span style={{ fontSize: 12, color: t.textMuted }}>· {group.length}개</span>
                      </div>
                      {group.length > 1 && (
                        <button
                          onClick={() => setReorderMonth(editing ? null : key)}
                          className="shrink-0 rounded-full px-2.5 py-0.5"
                          style={{
                            fontSize: 11,
                            backgroundColor: editing ? t.accent : 'transparent',
                            color: editing ? '#fff' : t.textSub,
                            border: `1px solid ${editing ? t.accent : t.border}`,
                          }}
                        >
                          {editing ? '완료' : '↕ 순서 편집'}
                        </button>
                      )}
                    </div>
                    {/* 3열 정사각 사진 그리드 (gap 6, radius 10) */}
                    {editing ? (
                      <ReorderGrid
                        monthKey={key}
                        items={group}
                        t={t}
                        dragId={dragId}
                        setDragId={setDragId}
                        onCommit={ids => handleReorderCommit(key, ids)}
                      />
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {group.map(m => (
                          <MomentGridTile
                            key={m.id}
                            moment={m}
                            t={t}
                            onToggleHighlight={() => handleToggleHighlight(m.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 모아보기 순서 편집 그리드 (드래그로 같은 월 안에서 재배치) ────────────
function ReorderGrid({
  monthKey: _monthKey, items, t, dragId, setDragId, onCommit, columns = 3, gap = 6,
}: {
  monthKey: string;
  items: Moment[];
  t: ThemeTokens;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onCommit: (orderedIds: string[]) => void;
  columns?: number;
  gap?: number;
}) {
  // 편집 중에는 로컬 ids 상태로 즉시 시각 반영. 완료(편집 종료) 시 onCommit으로 저장.
  const [ids, setIds] = useState<string[]>(() => items.map(i => i.id));

  // 외부 items가 바뀌면(다른 월·새 데이터) 로컬 ids 동기화
  useEffect(() => {
    setIds(items.map(i => i.id));
  }, [items]);

  // 드롭 시점에 저장
  const handleDrop = (overId: string) => {
    if (!dragId || dragId === overId) { setDragId(null); return; }
    setIds(prev => {
      const from = prev.indexOf(dragId);
      const to   = prev.indexOf(overId);
      if (from < 0 || to < 0) return prev;
      const next = prev.slice();
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      onCommit(next);
      return next;
    });
    setDragId(null);
  };

  const map = new Map(items.map(i => [i.id, i]));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap }}>
      {ids.map(id => {
        const m = map.get(id);
        if (!m) return null;
        const isDragging = dragId === id;
        const title = m.content.trim() || '오늘의 순간';
        const hasPhoto = !!m.photos[0];
        return (
          <div
            key={id}
            draggable
            onDragStart={() => setDragId(id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(id)}
            onDragEnd={() => setDragId(null)}
            // 터치(모바일): 길게 눌러 들기 → 손가락 이동으로 다른 타일 위에서 떼면 드롭
            onTouchStart={() => setDragId(id)}
            onTouchMove={e => {
              const t0 = e.touches[0];
              const el = document.elementFromPoint(t0.clientX, t0.clientY) as HTMLElement | null;
              const overId = el?.closest<HTMLElement>('[data-reorder-id]')?.dataset.reorderId;
              if (overId && overId !== dragId) {
                setIds(prev => {
                  const from = prev.indexOf(dragId!);
                  const to   = prev.indexOf(overId);
                  if (from < 0 || to < 0 || from === to) return prev;
                  const next = prev.slice();
                  next.splice(from, 1);
                  next.splice(to, 0, dragId!);
                  return next;
                });
              }
            }}
            onTouchEnd={() => { onCommit(ids); setDragId(null); }}
            data-reorder-id={id}
            className="relative overflow-hidden"
            style={{
              aspectRatio: '1 / 1',
              borderRadius: 10,
              background: hasPhoto ? t.bgSub : `linear-gradient(135deg, ${t.bgSub} 0%, ${t.accentSoft} 100%)`,
              opacity: isDragging ? 0.5 : 1,
              boxShadow: isDragging ? `0 0 0 2px ${t.accent}` : 'none',
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            {hasPhoto ? (
              <img src={m.photos[0]} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ fontFamily: 'var(--font-gaegu)', fontSize: 13, color: t.textSub }}
              >
                📝
              </div>
            )}
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ height: '55%', background: 'linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0))' }}
            />
            <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1 pointer-events-none">
              <div className="truncate" style={{ fontFamily: 'var(--font-gaegu)', fontSize: 11, color: '#fff', lineHeight: 1.2 }}>
                {title}
              </div>
            </div>
            {/* 편집 모드 표시용 그립 아이콘 */}
            <div
              className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 pointer-events-none"
              style={{ fontSize: 9, backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}
            >
              ↕
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 모아보기 사진 타일 (scrim + 제목·날짜 오버레이 + 별 토글) ─────────────
function MomentGridTile({
  moment, t, onToggleHighlight,
}: {
  moment: Moment;
  t: ThemeTokens;
  onToggleHighlight: () => void;
}) {
  const title = moment.content.trim() || '오늘의 순간';
  const date  = (() => {
    try { return format(new Date(moment.created_at), 'M.d (EEE)', { locale: ko }); }
    catch { return ''; }
  })();
  const hasPhoto = !!moment.photos[0];
  const hi = moment.is_highlight;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: '1 / 1',
        borderRadius: 10,
        // 사진 없는 모먼트: 연한 그라데이션 placeholder (디자인 토큰 기반)
        background: hasPhoto ? t.bgSub : `linear-gradient(135deg, ${t.bgSub} 0%, ${t.accentSoft} 100%)`,
      }}
    >
      {hasPhoto ? (
        <img src={moment.photos[0]} alt="" className="w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center p-1.5 text-center"
          style={{ fontFamily: 'var(--font-gaegu)', fontSize: 13, color: t.textSub, lineHeight: 1.3 }}
        >
          📝
        </div>
      )}

      {/* 가독성용 검정 그라데이션 scrim (브랜드 색 아님 — 예외 허용) */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '55%', background: 'linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0))' }}
      />

      {/* 우상단 별 토글 (탭 이벤트 격리) */}
      <button
        onClick={e => { e.stopPropagation(); onToggleHighlight(); }}
        onPointerDown={e => e.stopPropagation()}
        className="absolute top-1 right-1 flex items-center justify-center rounded-full"
        style={{
          width: 22, height: 22,
          backgroundColor: hi ? '#fff' : 'rgba(0,0,0,0.35)',
          color: hi ? t.danger : '#fff',
          boxShadow: hi ? '0 1px 3px rgba(0,0,0,0.25)' : 'none',
        }}
        aria-label={hi ? '하이라이트 해제' : '하이라이트 지정'}
      >
        <Star size={12} fill={hi ? t.danger : 'none'} strokeWidth={hi ? 0 : 2} />
      </button>

      {/* 제목·날짜 오버레이 */}
      <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1">
        <div
          className="truncate"
          style={{ fontFamily: 'var(--font-gaegu)', fontSize: 11, color: '#fff', lineHeight: 1.2 }}
        >
          {title}
        </div>
        {date && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>
            {date}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 하이라이트 미니 썸네일 (PC 레일 3열 — 정사각, gold 링, 제목 오버레이) ─
function HighlightMiniTile({ moment, t }: { moment: Moment; t: ThemeTokens }) {
  const title = moment.content.trim() || '오늘의 순간';
  const hasPhoto = !!moment.photos[0];
  return (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: '1 / 1',
        borderRadius: 10,
        background: hasPhoto ? t.bgSub : `linear-gradient(135deg, ${t.bgSub} 0%, ${t.accentSoft} 100%)`,
        boxShadow: `0 0 0 2px ${t.accent}`,
      }}
    >
      {hasPhoto ? (
        <img src={moment.photos[0]} alt="" className="w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-center p-1"
          style={{ fontFamily: 'var(--font-gaegu)', fontSize: 12, color: t.textSub }}
        >
          📝
        </div>
      )}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '55%', background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))' }}
      />
      <div className="absolute inset-x-0 bottom-0 px-1.5 pb-1">
        <div className="truncate" style={{ fontFamily: 'var(--font-gaegu)', fontSize: 10.5, color: '#fff', lineHeight: 1.2 }}>
          {title}
        </div>
      </div>
    </div>
  );
}

// ── PC 피드 카드 (메이슨리용 — 원본 비율 사진 + 별 토글 + Gaegu 제목 + 메타) ─
function MomentFeedCardPC({
  moment, t, onToggleHighlight, onDelete, formatTime,
}: {
  moment: Moment;
  t: ThemeTokens;
  onToggleHighlight: () => void;
  onDelete: () => void;
  formatTime: (iso: string) => string;
}) {
  const weather = moment.weather_code != null ? weatherInfo(moment.weather_code) : null;
  const cover   = moment.photos[0];
  const title   = moment.content.trim() || '오늘의 순간';
  const hi      = moment.is_highlight;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 group"
      style={{
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        breakInside: 'avoid',
        marginBottom: 16,
        boxShadow: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* 사진(원본 비율 유지) */}
      {cover && (
        <div className="relative">
          <img src={cover} alt="" className="w-full h-auto block" />
          {/* 우상단 별 토글 */}
          <button
            onClick={e => { e.stopPropagation(); onToggleHighlight(); }}
            className="absolute top-2 right-2 flex items-center justify-center rounded-full"
            style={{
              width: 26, height: 26,
              backgroundColor: hi ? '#fff' : 'rgba(0,0,0,0.35)',
              color: hi ? t.danger : '#fff',
              boxShadow: hi ? '0 1px 3px rgba(0,0,0,0.25)' : 'none',
            }}
            aria-label={hi ? '하이라이트 해제' : '하이라이트 지정'}
          >
            <Star size={14} fill={hi ? t.danger : 'none'} strokeWidth={hi ? 0 : 2} />
          </button>
        </div>
      )}

      <div className="p-3.5 space-y-2">
        {/* 사진 없는 경우 — 카드 상단 자리에 별 토글만 띄움 */}
        {!cover && (
          <div className="flex justify-end">
            <button
              onClick={e => { e.stopPropagation(); onToggleHighlight(); }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 26, height: 26,
                backgroundColor: hi ? t.accentSoft : t.bgSub,
                color: hi ? t.danger : t.textMuted,
              }}
              aria-label={hi ? '하이라이트 해제' : '하이라이트 지정'}
            >
              <Star size={14} fill={hi ? t.danger : 'none'} strokeWidth={hi ? 0 : 2} />
            </button>
          </div>
        )}

        {/* 제목 (Gaegu) */}
        <p
          style={{
            fontFamily: 'var(--font-gaegu)',
            fontSize: 17,
            color: t.text,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </p>

        {/* 메타: 날씨 칩 + 날짜·시간 + 삭제 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {weather && (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: t.bgSub, fontSize: 11, color: t.textSub }}
              >
                <span>{weather.emoji}</span>
                {moment.weather_temp != null && <span>{moment.weather_temp}°C</span>}
              </span>
            )}
            <span style={{ fontSize: 11, color: t.textMuted }}>{formatTime(moment.created_at)}</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: t.textMuted }}
            aria-label="삭제"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 하이라이트 가로 스크롤 카드 (108×132, gold 링) ─────────────────────────
function HighlightCard({ moment, t }: { moment: Moment; t: ThemeTokens }) {
  const title = moment.content.trim() || '오늘의 순간';
  const hasPhoto = !!moment.photos[0];
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: 108, height: 132,
        borderRadius: 13,
        background: hasPhoto ? t.bgSub : `linear-gradient(135deg, ${t.bgSub} 0%, ${t.accentSoft} 100%)`,
        boxShadow: `0 0 0 2px ${t.accent}`,
      }}
    >
      {hasPhoto ? (
        <img src={moment.photos[0]} alt="" className="w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-center p-1.5"
          style={{ fontFamily: 'var(--font-gaegu)', fontSize: 13, color: t.textSub }}
        >
          📝
        </div>
      )}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '55%', background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))' }}
      />
      <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5">
        <div
          className="truncate"
          style={{ fontFamily: 'var(--font-gaegu)', fontSize: 12, color: '#fff', lineHeight: 1.2 }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}

// ── 스탯 카드 (숫자는 DM Serif Display) ─────────────────────────────────────
function StatCard({ label, value, t, valueColor }: { label: string; value: number; t: ThemeTokens; valueColor?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 11, color: t.textSub }}>{label}</div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: valueColor ?? t.text, lineHeight: 1.15, marginTop: 1 }}>
        {value}
        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 2, fontFamily: 'var(--font-gowun)' }}>개</span>
      </div>
    </div>
  );
}

// ── 모바일 전용 컴팩트 카드 ─────────────────────────────────────────────────
interface MomentCardMobileProps {
  moment: Moment;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  t: ThemeTokens;
  formatTime: (iso: string) => string;
}

function MomentCardMobile({ moment, expanded, onToggle, onDelete, t, formatTime }: MomentCardMobileProps) {
  const weather = moment.weather_code != null ? weatherInfo(moment.weather_code) : null;
  const cover   = moment.photos[0];
  const title   = moment.content.trim() || '오늘의 순간';

  // 날씨 칩 + 날짜·시간 메타
  const Meta = (
    <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 4 }}>
      {weather && (
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: t.bgSub, fontSize: 10.5, color: t.textSub }}
        >
          <span>{weather.emoji}</span>
          {moment.weather_temp != null && <span>{moment.weather_temp}°C</span>}
        </span>
      )}
      <span style={{ fontSize: 11, color: t.textMuted }}>{formatTime(moment.created_at)}</span>
    </div>
  );

  const Thumb = (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        width: expanded ? '100%' : 64,
        height: expanded ? undefined : 64,
        aspectRatio: expanded ? '1.25 / 1' : undefined,
        borderRadius: 11,
        backgroundColor: t.bgSub,
        transition: 'width 0.3s ease, height 0.3s ease',
      }}
    >
      {cover ? (
        <img src={cover} alt="" className="w-full h-full object-cover" style={{ borderRadius: 11 }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ fontSize: expanded ? 34 : 22 }}>
          📝
        </div>
      )}
    </div>
  );

  return (
    <div
      onClick={onToggle}
      className="rounded-2xl p-3 cursor-pointer select-none"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
    >
      {expanded ? (
        <div className="space-y-3">
          {Thumb}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p style={{ fontFamily: 'var(--font-gaegu)', fontSize: 18, color: t.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {title}
              </p>
              {Meta}
            </div>
            <ChevronRight
              size={18}
              style={{ color: t.textMuted, flexShrink: 0, transition: 'transform 0.3s ease', transform: 'rotate(90deg)' }}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: t.textMuted }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {Thumb}
          <div className="min-w-0 flex-1">
            <p
              className="truncate"
              style={{ fontFamily: 'var(--font-gaegu)', fontSize: 17, color: t.text }}
            >
              {title}
            </p>
            {Meta}
          </div>
          <ChevronRight
            size={18}
            style={{ color: t.textMuted, flexShrink: 0, transition: 'transform 0.3s ease', transform: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
