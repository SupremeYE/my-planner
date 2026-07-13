import React from 'react';
import { useTheme } from '../../ThemeContext';

export interface SegmentOption<V extends string = string> {
  label: string;
  value: V;
}

export interface SegmentedControlProps<V extends string = string> {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** 트랙 최대 폭 (기본 320px). 숫자는 px, 문자열은 그대로. */
  maxWidth?: number | string;
  className?: string;
}

/**
 * 공통 세그먼트 컨트롤 — DESIGN.md §5 / §6.1 단일 기준.
 * 활성 = 불투명 흰 pill + 소프트 그림자 + deep-indigo 600 라벨 + **3px 코랄 언더라인**,
 * 비활성 = 투명 + 뮤트 라벨, 트랙 = near-neutral 저채도(`t.borderLight`).
 * 상호작용(pressed/focus)은 `haon.css` `.haon-seg` 가 담당. 색 토큰 기반 → 전 테마 공통.
 *
 * ⚠️ 캘린더 뷰토글·todo 탭이 향후 이걸로 수렴한다(이번엔 치환 안 함; 정의만).
 */
export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  maxWidth = 320,
  className,
}: SegmentedControlProps<V>) {
  const { t } = useTheme();
  return (
    <div
      role="tablist"
      className={`flex p-1 rounded-2xl ${className ?? ''}`}
      style={{ maxWidth, background: t.borderLight }}
    >
      {options.map(opt => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.value)}
            className="haon-seg relative flex-1 px-4 py-2 rounded-xl text-center"
            style={{
              background: on ? t.card : 'transparent',
              color: on ? t.text : t.textMuted,
              fontWeight: on ? 600 : 500,
              fontSize: 13,
              boxShadow: on ? '0 2px 8px rgba(120,90,160,0.14)' : 'none',
              cursor: 'pointer',
            }}
          >
            {opt.label}
            {on && (
              <span
                aria-hidden
                className="absolute left-3 right-3"
                style={{ bottom: 4, height: 3, borderRadius: 3, background: t.accent }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
