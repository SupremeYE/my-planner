import React, { useState } from 'react';
import { Star, StarHalf } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

interface StarRatingProps {
  value: number;                 // 0 ~ 5 (0.5 단위)
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}

/**
 * 0.5 단위 별점 컴포넌트.
 * - 인터랙티브 모드: 별의 좌측 절반 클릭 → .5, 우측 절반 클릭 → 정수
 * - read-only 모드: onChange 미전달 또는 readOnly=true
 * 색상은 디자인 시스템 토큰(t.accent)만 사용한다.
 */
export function StarRating({ value, onChange, size = 22, readOnly = false }: StarRatingProps) {
  const { t } = useTheme();
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !readOnly && !!onChange;
  const display = hover ?? value;

  const handleClick = (starIndex: number, half: boolean) => {
    if (!interactive) return;
    const next = starIndex + (half ? 0.5 : 1);
    // 같은 값 다시 클릭하면 해제(0점)
    onChange!(next === value ? 0 : next);
  };

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
      {[0, 1, 2, 3, 4].map(i => {
        const filled = display - i;   // 1 이상=꽉참, 0.5=반쪽, 0 이하=빈별
        const Icon = filled >= 1 ? Star : filled >= 0.5 ? StarHalf : Star;
        const isEmpty = filled < 0.5;
        return (
          <span key={i} className="relative inline-flex" style={{ width: size, height: size }}>
            <Icon
              size={size}
              color={t.accent}
              fill={isEmpty ? 'transparent' : t.accent}
              style={{ color: isEmpty ? t.border : t.accent }}
            />
            {interactive && (
              <>
                <button
                  type="button"
                  aria-label={`${i + 0.5}점`}
                  className="absolute inset-y-0 left-0 w-1/2"
                  onMouseEnter={() => setHover(i + 0.5)}
                  onClick={() => handleClick(i, true)}
                />
                <button
                  type="button"
                  aria-label={`${i + 1}점`}
                  className="absolute inset-y-0 right-0 w-1/2"
                  onMouseEnter={() => setHover(i + 1)}
                  onClick={() => handleClick(i, false)}
                />
              </>
            )}
          </span>
        );
      })}
      {interactive && (
        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 6 }}>
          {display > 0 ? display.toFixed(1) : '평가 없음'}
        </span>
      )}
    </div>
  );
}
