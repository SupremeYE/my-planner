// 뷰티 케어 — 셀프케어 하트% 게이지 (Stage 5, 모바일 시그니처).
//  · 값 = useBeauty.selfCareScore(0~100, 주기 기반). 원형 SVG 링을 부드럽게 채운다.
//  · 색 분기: 높음 t.success(💖) / 중간 t.accent(🌿) / 낮음 t.danger(🥀).
//  · 보조 표시는 "이번 주 N회"(recentCareCount) + 7칸 스파크(careSpark, 롤링 7일).
//    ⚠️ 게이지(주기 기반)와 7회 카운트(7일)는 다른 값 — 라벨로 명확히 구분해 표기한다.
//  · 파생값은 전부 useBeauty 훅에서 받은 것을 쓰기만 한다(계산 재구현 X).
import { useTheme } from '../../ThemeContext';

interface Props {
  score: number;          // 0~100 (selfCareScore)
  recentCareCount: number;// 롤링 7일 수행 횟수
  spark: number[];        // 길이 7, 과거→오늘 일별 횟수
  careCount: number;      // 등록된 스페셜케어 개수 (0이면 빈 상태)
}

export function SelfCareGauge({ score, recentCareCount, spark, careCount }: Props) {
  const { t } = useTheme();
  const empty = careCount === 0;
  const pct = empty ? 0 : Math.max(0, Math.min(100, score));

  // 색·표정·문구 분기 (임계값: 높음 ≥70 / 중간 ≥40 / 낮음 <40)
  const tier =
    pct >= 70 ? { color: t.success, emoji: '💖', label: '완벽해요!' }
    : pct >= 40 ? { color: t.accent, emoji: '🌿', label: '잘 챙기는 중' }
    : { color: t.danger, emoji: '🥀', label: '조금 소홀했어요' };

  // 원형 게이지 SVG
  const SIZE = 150, STROKE = 12, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);

  return (
    <div className="rounded-2xl px-4 py-5 flex flex-col items-center"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>

      {/* 게이지 */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={t.bgSub} strokeWidth={STROKE} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
            stroke={empty ? t.border : tier.color} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span aria-hidden style={{ fontSize: 34, lineHeight: 1 }}>{empty ? '🌱' : tier.emoji}</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: empty ? t.textMuted : tier.color, marginTop: 2, lineHeight: 1 }}>
            {pct}<span style={{ fontSize: 14, fontWeight: 700 }}>%</span>
          </span>
        </div>
      </div>

      {/* 상태 문구 (손글씨 액센트) */}
      <p style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 26, color: empty ? t.textSub : tier.color, marginTop: 8, lineHeight: 1 }}>
        {empty ? '케어를 추가해 시작해요' : tier.label}
      </p>
      <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
        권장주기를 지키고 있는 케어 비율이에요
      </p>

      {/* 보조: 이번 주 N회 + 스파크 7칸 (게이지와 다른 레이어) */}
      {!empty && (
        <div className="flex items-center gap-3 mt-4 pt-3 w-full justify-center" style={{ borderTop: `1px solid ${t.borderLight}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>
            이번 주 <span style={{ color: t.accent }}>{recentCareCount}</span>회
          </span>
          <div className="flex items-end gap-1" style={{ height: 18 }} aria-label="최근 7일 케어 횟수">
            {spark.map((v, i) => {
              const on = v > 0;
              const h = on ? Math.min(18, 6 + v * 5) : 4;
              return (
                <span key={i} title={`${v}회`}
                  style={{ width: 5, height: h, borderRadius: 999, backgroundColor: on ? t.accent : t.bgSub, transition: 'height 0.3s ease' }} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
