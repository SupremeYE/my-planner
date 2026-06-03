import {
  Film, Tv, Sparkles, BookOpen, Clapperboard, Youtube, GraduationCap, Play,
  Bookmark, CheckCircle2, XCircle, type LucideIcon,
} from 'lucide-react';
import type { CulturePlatform, CultureContentType, CultureStatus } from '../../store';

// 플랫폼: 라벨 + placeholder 그라데이션 색상 (콘텐츠 도메인 색상 — PROJECT_COLORS와 동일하게 데이터성 hex 허용)
export const PLATFORM_META: Record<CulturePlatform, { label: string; gradient: [string, string] }> = {
  netflix:      { label: '넷플릭스',   gradient: ['#B81D24', '#E50914'] },
  youtube:      { label: '유튜브',     gradient: ['#C4302B', '#FF0000'] },
  disney_plus:  { label: '디즈니+',    gradient: ['#0C2A6B', '#113CCF'] },
  coupang_play: { label: '쿠팡플레이', gradient: ['#3A1078', '#6A38C2'] },
  tving:        { label: '티빙',       gradient: ['#9B1B5A', '#E61E64'] },
  watcha:       { label: '왓챠',       gradient: ['#7A1133', '#FF0558'] },
  theater:      { label: '영화관',     gradient: ['#3F3222', '#7A6444'] },
  other:        { label: '기타',       gradient: ['#4A4A4A', '#777777'] },
};

export const PLATFORM_ORDER: CulturePlatform[] =
  ['netflix', 'youtube', 'disney_plus', 'coupang_play', 'tving', 'watcha', 'theater', 'other'];

// 콘텐츠 유형: 라벨 + placeholder 아이콘
export const CONTENT_TYPE_META: Record<CultureContentType, { label: string; icon: LucideIcon }> = {
  movie:         { label: '영화',    icon: Film },
  drama:         { label: '드라마',  icon: Tv },
  variety:       { label: '예능',    icon: Sparkles },
  documentary:   { label: '다큐',    icon: BookOpen },
  anime:         { label: '애니',    icon: Clapperboard },
  youtube_video: { label: '유튜브',  icon: Youtube },
  lecture:       { label: '강의',    icon: GraduationCap },
  other:         { label: '기타',    icon: Film },
};

export const CONTENT_TYPE_ORDER: CultureContentType[] =
  ['movie', 'drama', 'variety', 'documentary', 'anime', 'youtube_video', 'lecture', 'other'];

// 상태: 라벨 + 카드 우상단 아이콘
export const STATUS_META: Record<CultureStatus, { label: string; icon: LucideIcon }> = {
  watchlist: { label: '보고싶음', icon: Bookmark },
  watching:  { label: '보는 중',  icon: Play },
  completed: { label: '완료',     icon: CheckCircle2 },
  dropped:   { label: '중단',     icon: XCircle },
};

export const STATUS_ORDER: CultureStatus[] = ['watchlist', 'watching', 'completed', 'dropped'];

// 정렬 (PC·모바일 공용)
export type CultureSortKey = 'created' | 'watched' | 'rating';
export const SORT_LABELS: Record<CultureSortKey, string> = {
  created: '기록일 순',
  watched: '본 날짜 순',
  rating: '별점 높은순',
};
