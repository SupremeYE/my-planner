import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
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
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export function MomentView() {
  const { t } = useTheme();
  const [moments, setMoments]         = useState<Moment[]>([]);
  const [content, setContent]         = useState('');
  const [photoFiles, setPhotoFiles]   = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [saving, setSaving]           = useState(false);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'M월 d일 (EEE) a h:mm', { locale: ko });
    } catch {
      return iso;
    }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      <div className="max-w-xl mx-auto px-4 py-5 lg:py-8 space-y-5">

        {/* 헤더 */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text }}>모먼트</h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>순간을 짧게 기록해요</p>
        </div>

        {/* 작성 카드 */}
        <div
          className="rounded-2xl p-4 space-y-3"
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

        {/* 모먼트 목록 */}
        <div className="space-y-3">
          {moments.length === 0 && (
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-2"
              style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
            >
              <span style={{ fontSize: 32 }}>📸</span>
              <p style={{ fontSize: 14, color: t.textMuted, textAlign: 'center' }}>
                아직 기록된 순간이 없어요.<br />첫 번째 모먼트를 남겨보세요!
              </p>
            </div>
          )}

          {moments.map(moment => {
            const weather = moment.weather_code != null
              ? weatherInfo(moment.weather_code)
              : null;

            return (
              <div
                key={moment.id}
                className="rounded-2xl p-4 space-y-3"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
              >
                {/* 사진 썸네일 */}
                {moment.photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {moment.photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="rounded-xl object-cover"
                        style={{
                          width:  moment.photos.length === 1 ? '100%' : 96,
                          height: moment.photos.length === 1 ? 220  : 96,
                          border: `1px solid ${t.border}`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* 텍스트 */}
                {moment.content && (
                  <p style={{ fontSize: 15, color: t.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {moment.content}
                  </p>
                )}

                {/* 푸터: 날씨 + 시각 + 삭제 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* 날씨 배지 */}
                    {weather && (
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
                        style={{ backgroundColor: t.bgSub, fontSize: 11, color: t.textSub }}
                      >
                        <span>{weather.emoji}</span>
                        {moment.weather_temp != null && (
                          <span>{moment.weather_temp}°C</span>
                        )}
                        <span>{weather.label}</span>
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: t.textMuted }}>
                      {formatTime(moment.created_at)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(moment.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: t.textMuted }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
