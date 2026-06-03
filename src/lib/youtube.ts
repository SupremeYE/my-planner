// YouTube oEmbed 유틸 — API 키 불필요 (https://www.youtube.com/oembed)

export interface YouTubeMetadata {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

/**
 * 다양한 YouTube URL 형태에서 video ID를 추출한다.
 * 지원: watch?v=, youtu.be/, shorts/, embed/
 * 매치 안 되면 null.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,            // youtube.com/watch?v=VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,       // youtu.be/VIDEO_ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, // shorts/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,  // embed/VIDEO_ID
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * YouTube oEmbed로 제목/채널/썸네일을 가져온다.
 * 비-YouTube URL 이거나 실패 시 null.
 */
export async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  if (!extractYouTubeVideoId(url)) return null;
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.title) return null;
    return {
      title: json.title,
      author_name: json.author_name ?? '',
      thumbnail_url: json.thumbnail_url ?? '',
    };
  } catch {
    return null;
  }
}
