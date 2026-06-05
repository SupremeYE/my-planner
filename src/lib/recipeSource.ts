// 레시피 출처 URL → 플랫폼 판별.
// 가벼운 추가 폼에서 입력창 우측에 아이콘 표시 + oEmbed 자동 채움 대상 분기.

export type RecipeSourcePlatform = 'youtube' | 'shorts' | 'instagram' | 'other' | null;

export function detectRecipeSourcePlatform(url: string): RecipeSourcePlatform {
  if (!url || !url.trim()) return null;
  const u = url.trim().toLowerCase();
  if (u.includes('youtube.com/shorts/')) return 'shorts';
  if (u.includes('youtube.com/watch') || u.includes('youtu.be/') || u.includes('youtube.com/embed/')) return 'youtube';
  if (u.includes('instagram.com/')) return 'instagram';
  // http(s)로 시작하면 일단 'other'(아이콘 표시), 아니면 null
  if (u.startsWith('http://') || u.startsWith('https://')) return 'other';
  return null;
}

// 한국어 표기
export function sourcePlatformLabel(p: RecipeSourcePlatform): string {
  switch (p) {
    case 'youtube':   return '유튜브';
    case 'shorts':    return '쇼츠';
    case 'instagram': return '인스타그램';
    case 'other':     return '링크';
    default:          return '';
  }
}
