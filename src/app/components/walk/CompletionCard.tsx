// 완료 기록 카드 작성 — 사진(카드 배경)·경로 미니맵 글리프·지표·손글씨 메모.
// 저장 시 walk_sessions insert(mode:'free') + 사진 업로드 + (선택) region_code + 모먼트 씨앗.
import { useRef, useState } from 'react';
import { Camera, X, Loader2, Check } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { hasKakaoKey, coord2RegionCode } from '../../../lib/kakaoMap';
import { RouteGlyph } from './RouteGlyph';
import { formatDistance, formatDuration, formatPace, avgPaceSecPerKm } from './walkUtils';
import { withAlpha } from '../places/placeHelpers';
import type { WalkDraft } from './FreeWalkSession';

// 모먼트 연동(1E): moments 테이블이 있어 깔끔히 연결 가능 → 카드(사진+메모+지표)를 모먼트 씨앗으로.
// 건강(운동) 연동은 '걷기' 유산소 종목이 카탈로그에 없어 이번 단계에서는 스킵(가이드대로).
async function seedMoment(d: WalkDraft, memo: string, photoUrl: string | null, pace: number | null) {
  const stat = `🚶 ${formatDistance(d.distanceM)} · ${formatDuration(d.durationS)}${pace ? ` · ${formatPace(pace)}` : ''}`;
  const content = memo.trim() ? `${memo.trim()}\n\n${stat}` : stat;
  await db.moments.create(content, photoUrl ? [photoUrl] : []);
}

export function CompletionCard({ draft, onSaved, onDiscard }: { draft: WalkDraft; onSaved: () => void; onDiscard: () => void }) {
  const { t } = useTheme();
  const [memo, setMemo] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [toMoment, setToMoment] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pace = avgPaceSecPerKm(draft.distanceM, draft.durationS);

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    // 시작점 → region_code (카카오 키 있을 때만, 실패해도 저장은 진행)
    let regionCode: string | null = null;
    if (hasKakaoKey() && draft.startLat != null && draft.startLng != null) {
      try { regionCode = await coord2RegionCode(draft.startLng, draft.startLat); } catch { /* noop */ }
    }

    const session = await db.walkSessions.create({
      mode: draft.mode ?? 'free',
      path: draft.path,
      plannedRoute: draft.plannedRoute ?? null,
      distanceM: draft.distanceM,
      durationS: draft.durationS,
      avgPaceSPerKm: pace,
      startLat: draft.startLat,
      startLng: draft.startLng,
      regionCode,
      startedAt: draft.startedAt,
      endedAt: draft.endedAt,
      memo: memo.trim() || null,
    });

    if (!session) { setSaving(false); return; }

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await db.walkSessions.uploadPhoto(photoFile, session.id);
      if (photoUrl) await db.walkSessions.update(session.id, { photoUrl });
    }

    if (toMoment) {
      try { await seedMoment(draft, memo, photoUrl, pace); } catch { /* 보조 연동 — 실패해도 저장은 성공 */ }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: t.bg, display: 'flex', flexDirection: 'column' }}>
      {/* 상단 바 */}
      <div className="flex items-center justify-between" style={{ padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', flexShrink: 0 }}>
        <button onClick={onDiscard} disabled={saving} style={{ color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={22} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>산책 기록 남기기</span>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5" style={{ color: t.accent, background: 'none', border: 'none', fontSize: 15, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 저장
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px calc(24px + env(safe-area-inset-bottom))' }}>
        {/* 미리보기 카드 — 사진 배경 + 글리프 + 지표 + 손글씨 */}
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', backgroundColor: t.card, border: `1px solid ${t.border}`, minHeight: 280 }}>
          {/* 사진 배경 */}
          {photoPreview ? (
            <img src={photoPreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
          {/* 가독성 위한 오버레이 */}
          <div style={{ position: 'absolute', inset: 0, background: photoPreview ? `linear-gradient(180deg, ${withAlpha(t.text, 0.15)} 0%, ${withAlpha(t.text, 0.55)} 100%)` : 'transparent' }} />

          {/* 글리프 (우상단) */}
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <RouteGlyph path={draft.path} size={84} stroke={photoPreview ? '#fff' : t.accent} bg={photoPreview ? withAlpha('#000', 0.25) : t.bgSub} />
          </div>

          {/* 하단 지표 + 손글씨 */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 }}>
            <div className="flex items-end gap-4" style={{ marginBottom: 8 }}>
              <Stat label="거리" value={formatDistance(draft.distanceM)} light={!!photoPreview} t={t} big />
              <Stat label="시간" value={formatDuration(draft.durationS)} light={!!photoPreview} t={t} />
              <Stat label="페이스" value={formatPace(pace)} light={!!photoPreview} t={t} />
            </div>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="오늘 산책은 어땠나요…"
              rows={2}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                fontFamily: 'var(--font-nanum-pen)', fontSize: 26, lineHeight: 1.2,
                color: photoPreview ? '#fff' : t.text,
              }}
            />
          </div>
        </div>

        {/* 사진 추가 버튼 */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full" style={{ marginTop: 14, padding: '13px', borderRadius: 14, border: `1.5px dashed ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Camera size={17} /> {photoPreview ? '사진 바꾸기' : '사진 추가'}
        </button>

        {/* 모먼트 연동 토글 (1E, 보조) */}
        <button onClick={() => setToMoment(v => !v)}
          className="flex items-center justify-between w-full" style={{ marginTop: 10, padding: '12px 14px', borderRadius: 14, border: `1px solid ${t.border}`, backgroundColor: t.card, cursor: 'pointer' }}>
          <span style={{ fontSize: 13.5, color: t.text }}>📸 모먼트에도 남기기</span>
          <span style={{ width: 40, height: 24, borderRadius: 999, backgroundColor: toMoment ? t.accent : t.border, position: 'relative', transition: 'background-color .15s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: toMoment ? 18 : 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', transition: 'left .15s' }} />
          </span>
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, light, t, big }: { label: string; value: string; light: boolean; t: any; big?: boolean }) {
  const c = light ? '#fff' : t.text;
  const sub = light ? withAlpha('#fff', 0.8) : t.textSub;
  return (
    <div>
      <div style={{ fontSize: 10.5, color: sub, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 16, fontWeight: 800, color: c, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
