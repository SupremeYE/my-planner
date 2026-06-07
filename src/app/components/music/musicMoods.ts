// 음악 기록 — 무드·상황 태그 공통 정의
// 추가 폼(MusicAddSheet)과 무드 필터(MusicSection)가 같은 목록을 공유한다.

export const MOOD_OPTIONS = ['집중', '위로', '신날 때', '드라이브', '잠들기 전'] as const;

export type Mood = (typeof MOOD_OPTIONS)[number];

// 무드 필터 값 — '전체' 또는 특정 무드
export type MoodFilter = 'all' | Mood;
