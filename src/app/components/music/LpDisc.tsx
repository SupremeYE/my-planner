import { useTheme } from '../../ThemeContext';

/**
 * LP판(바이닐 디스크) 컴포넌트.
 *  - 부모 요소의 가로폭을 100% 채우는 정사각형으로 렌더된다(반응형 — 그리드 셀이 크기 결정).
 *  - 바깥: 검은 비닐 디스크(radial-gradient) + 동심원 groove 질감(repeating-radial-gradient)
 *  - 중앙 라벨(지름 약 42%): artworkUrl 을 원형으로 크롭. 없으면 골드(t.accent) 단색 폴백.
 *  - 가운데 구멍: 배경색(t.bg)
 *  - spinning=true 면 약 8s 로 천천히 회전(lpspin 키프레임은 MusicSection 에서 1회 주입).
 *
 * ⚠️ 비닐 자체의 검정/홈 질감은 '실물 LP'의 고정 표현이라 디자인 토큰이 아닌
 *    고정 색으로 그린다(디자인 시스템 팔레트는 라벨 폴백·구멍 등에만 토큰 사용).
 */
export function LpDisc({
  artworkUrl,
  spinning = false,
}: {
  artworkUrl?: string | null;
  spinning?: boolean;
}) {
  const { t } = useTheme();

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        position: 'relative',
        background: 'radial-gradient(circle at 50% 50%, #2c2c2e 0%, #0a0a0a 62%, #000 100%)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.30)',
        animation: spinning ? 'lpspin 8s linear infinite' : undefined,
      }}
    >
      {/* 동심원 groove 질감 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1.5px, transparent 4px)',
        }}
      />
      {/* 광택(살짝) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'linear-gradient(125deg, rgba(255,255,255,0.10) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.06) 100%)',
        }}
      />
      {/* 중앙 라벨 (앨범아트 원형 크롭) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '42%',
          height: '42%',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: artworkUrl ? undefined : t.accent,
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)',
        }}
      >
        {artworkUrl && (
          <img src={artworkUrl} alt="" className="w-full h-full object-cover" draggable={false} />
        )}
      </div>
      {/* 가운데 구멍 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '6%',
          height: '6%',
          borderRadius: '50%',
          backgroundColor: t.bg,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
        }}
      />
    </div>
  );
}
