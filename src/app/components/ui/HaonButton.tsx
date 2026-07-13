import React from 'react';
import { useTheme } from '../../ThemeContext';
import { buttonStyle, type ButtonVariant } from '../../styles/haonStyles';

export interface HaonButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  /** primary 한정 — 코랄→핑크 그라데이션 채움(강조용). 기본은 솔리드. */
  gradient?: boolean;
  style?: React.CSSProperties;
}

/**
 * 공통 버튼 — DESIGN.md §5 단일 기준.
 * 정적 스타일은 `buttonStyle(t, variant)` recipe(haonStyles)가, 상호작용 상태
 * (hover/pressed/focus/disabled, §5 :242)는 `haon.css` 의 `.haon-btn` 클래스가 담당한다.
 * 버튼은 색 토큰 기반이라 **전 테마 공통(A/B/C/D/H) — isHaon 게이팅 없음**. 브랜드 화면용 아님.
 *
 * ⚠️ 아직 어떤 페이지도 이 컴포넌트를 소비하지 않는다(정의만; 페이지 치환은 다음 단계).
 */
export function HaonButton({
  variant = 'primary',
  loading = false,
  leftIcon,
  gradient = false,
  disabled = false,
  className,
  style,
  children,
  ...rest
}: HaonButtonProps) {
  const { t } = useTheme();
  const isDisabled = disabled || loading;

  // 정적 recipe (색·radius·weight·disabled opacity)
  const base = buttonStyle(t, variant, isDisabled);

  // primary 그라데이션 옵션(강조) — §3/§5 관용구: `t.primaryGradient ?? t.accent` 폴백.
  const bg =
    gradient && variant === 'primary'
      ? { background: t.primaryGradient ?? t.accent }
      : null;

  // rest 그림자: 채움형(primary)은 코랄 그림자, 나머지는 없음 → hover/focus 는 .haon-btn 이 관리.
  const restShadow = variant === 'primary' ? 'var(--shadow-button-colored)' : 'none';

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`haon-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 ${className ?? ''}`}
      style={{ ...base, ...bg, ['--haon-btn-rest-shadow' as string]: restShadow, ...style }}
      {...rest}
    >
      {loading ? <span className="haon-btn-spinner" aria-hidden /> : leftIcon}
      {children}
    </button>
  );
}
