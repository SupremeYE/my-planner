import { useState } from 'react';
import { useTheme } from '../../ThemeContext';
import { BODY_PART_EMOJI } from './workoutUtils';
import type { Exercise } from '../../../lib/db';

// 종목 썸네일 — image_url(GitHub raw 핫링크) 우선, 없거나 로드 실패 시 부위 이모지 fallback.
// 런타임 번역과 무관(이미지 표시만). 색상은 토큰만 사용.
export function ExerciseThumb({ exercise, size = 56, radius = 12 }: { exercise: Exercise; size?: number; radius?: number }) {
  const { t } = useTheme();
  const [failed, setFailed] = useState(false);
  const showImg = exercise.imageUrl && !failed;

  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius,
        backgroundColor: t.bgSub, overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${t.borderLight}`,
      }}
    >
      {showImg ? (
        <img
          src={exercise.imageUrl!}
          alt={exercise.nameKo || exercise.nameEn}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.42) }} aria-hidden>
          {BODY_PART_EMOJI[exercise.bodyPart] ?? '🏋️'}
        </span>
      )}
    </div>
  );
}
