// Supabase Edge Function: fetch-link-metadata
//
// 입력: { url: string }
// 출력: { source, title, thumbnail_url, description, needsManual }
//
// 동작:
//  - 출처 감지(youtube / instagram / threads / web)
//  - youtube: oEmbed (https://www.youtube.com/oembed) — 키 불필요
//  - web:     HTML 가져와 og:title / og:image / og:description 파싱
//  - instagram: best-effort OG 파싱 + 썸네일 재호스팅, 실패 시 needsManual
//  - threads: 자동 fetch 금지 → needsManual:true 만 반환
//
// 실패는 graceful — 항상 200 JSON 응답. 클라이언트는 needsManual 또는 빈 필드만 보고
// "자동 채움 실패 → 직접 입력해주세요" UI 로 폴백한다.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Source = 'youtube' | 'instagram' | 'threads' | 'web';

interface Result {
  source: Source;
  title: string | null;
  thumbnail_url: string | null;
  description: string | null;
  needsManual: boolean;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// 출처 감지 — 호스트네임 기준
function detectSource(url: string): Source {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
      return 'youtube';
    }
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (host === 'threads.net' || host === 'threads.com' || host.endsWith('.threads.net') || host.endsWith('.threads.com')) {
      return 'threads';
    }
    return 'web';
  } catch {
    return 'web';
  }
}

// ── YouTube oEmbed ──
async function fetchYouTube(url: string): Promise<Partial<Result>> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 ScrapBot' } });
    if (!res.ok) return {};
    const data = await res.json();
    return {
      title: typeof data?.title === 'string' ? data.title : null,
      thumbnail_url: typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : null,
      description: typeof data?.author_name === 'string' ? data.author_name : null,
    };
  } catch {
    return {};
  }
}

// ── OG/메타 태그 파싱 ──
// 간단한 정규식 기반 파서. JSDOM 같은 무거운 의존성 없이 OG/twitter/타이틀만 추출한다.
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    // 16진수 엔티티(&#xC758; 등) — 인스타 og:title 이 한글/이모지를 이 형태로 인코딩함
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => codePointToStr(parseInt(h, 16), m))
    // 10진수 엔티티(&#48124; 등). fromCodePoint 로 이모지(BMP 밖)까지 안전 처리
    .replace(/&#(\d+);/g, (m, n) => codePointToStr(Number(n), m));
}

// 유효한 유니코드 코드포인트만 문자로 변환. 범위 밖이면 원본 엔티티 문자열 유지(fromCodePoint 예외 방지).
function codePointToStr(cp: number, fallback: string): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(cp);
  } catch {
    return fallback;
  }
}

function pickMeta(html: string, names: string[]): string | null {
  // <meta property="og:title" content="..."> 또는 name="..." 양쪽 지원, content/property 순서 교환도 허용
  for (const n of names) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // property/name = "n"  →  content = "..."
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
      'i',
    );
    const m1 = html.match(re1);
    if (m1?.[1]) return decodeHtml(m1[1]);
    // content = "..." → property/name = "n"  (순서 반대 케이스)
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
      'i',
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeHtml(m2[1]);
  }
  return null;
}

// 상대경로 og:image 를 절대경로로 변환
function absoluteUrl(maybeUrl: string | null, baseUrl: string): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

// ── 이미지 재호스팅 ──
// 인스타 og:image(CDN 서명 URL)는 몇 시간 뒤 만료되어 썸네일이 깨진다.
// 이미지 바이트를 서버측(CORS 무관)에서 내려받아 public 버킷 scrap-thumbs 에 올리고
// 영구 public URL 을 돌려준다. 서비스 롤 키가 없거나 실패하면 null → 원본 URL 폴백.
async function rehostThumb(imageUrl: string): Promise<string | null> {
  try {
    const supaUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supaUrl || !serviceKey) return null;

    const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 ScrapBot' } });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 10_000_000) return null; // 10MB 방어

    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `ig_${crypto.randomUUID()}.${ext}`;

    const supa = createClient(supaUrl, serviceKey);
    const { error } = await supa.storage
      .from('scrap-thumbs')
      .upload(path, bytes, { contentType, upsert: true });
    if (error) return null;

    const { data } = supa.storage.from('scrap-thumbs').getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

// ── Instagram OG 파싱 (best-effort) ──
// 인스타는 로그인 벽 + 봇 차단이 있지만, 공개 게시물/릴스는 크롤러 UA(facebookexternalhit 등)로
// 요청하면 <head> 에 og:title / og:image / og:description 를 내주는 경우가 많다.
// 성공하면 자동 채움, 실패(로그인 벽·차단)하면 빈 객체 → 상위에서 needsManual 폴백.
async function fetchInstagram(url: string): Promise<Partial<Result>> {
  // 크롤러/봇 UA 를 우선 시도(OG 태그 응답률이 높음), 실패 시 일반 브라우저 UA 재시도
  const uaCandidates = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  ];
  for (const ua of uaCandidates) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko,en;q=0.9',
        },
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const slice = html.length > 200_000 ? html.slice(0, 200_000) : html;

      const title = pickMeta(slice, ['og:title', 'twitter:title']);
      const rawImage = pickMeta(slice, ['og:image', 'og:image:secure_url', 'twitter:image']);
      const description = pickMeta(slice, ['og:description', 'twitter:description']);

      // og:image 라도 건졌으면 성공으로 간주하고 반환(로그인 벽이면 셋 다 비어 다음 UA 시도)
      if (title || rawImage) {
        const absImage = absoluteUrl(rawImage, res.url || url);
        // 만료되는 CDN URL → scrap-thumbs 로 재호스팅(실패 시 원본 URL 임시 사용)
        const persisted = absImage ? (await rehostThumb(absImage)) ?? absImage : null;
        return {
          title: title ?? null,
          thumbnail_url: persisted,
          description: description ?? null,
        };
      }
    } catch {
      /* 다음 UA 후보로 계속 */
    }
  }
  return {};
}

async function fetchWeb(url: string): Promise<Partial<Result>> {
  try {
    const res = await fetch(url, {
      headers: {
        // 일부 사이트는 봇 차단 → 일반 브라우저 UA로 위장
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return {};
    const html = await res.text();
    // <head> 만 자르면 더 빠르지만 일부 사이트는 <body> 안에도 OG 메타 둠 → 20만자까지만 처리
    const slice = html.length > 200_000 ? html.slice(0, 200_000) : html;

    const titleMatch = slice.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title =
      pickMeta(slice, ['og:title', 'twitter:title']) ??
      (titleMatch?.[1] ? decodeHtml(titleMatch[1]) : null);

    const rawImage = pickMeta(slice, ['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);
    const description = pickMeta(slice, ['og:description', 'twitter:description', 'description']);

    return {
      title: title ?? null,
      thumbnail_url: absoluteUrl(rawImage, res.url || url),
      description: description ?? null,
    };
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  let url = '';
  try {
    const body = await req.json();
    url = typeof body?.url === 'string' ? body.url.trim() : '';
  } catch {
    /* invalid json — url 비어있는 채로 진행 */
  }

  if (!url) {
    return jsonResponse({
      source: 'web',
      title: null,
      thumbnail_url: null,
      description: null,
      needsManual: true,
    } as Result);
  }

  const source = detectSource(url);

  // 스레드 — 로그인 벽 때문에 안정적 자동 fetch 불가 → 항상 needsManual
  if (source === 'threads') {
    return jsonResponse({
      source,
      title: null,
      thumbnail_url: null,
      description: null,
      needsManual: true,
    } as Result);
  }

  // 인스타는 best-effort 로 OG 파싱 시도(공개 게시물/릴스). 실패하면 아래 needsManual 폴백.
  const fetched =
    source === 'youtube'
      ? await fetchYouTube(url)
      : source === 'instagram'
        ? await fetchInstagram(url)
        : await fetchWeb(url);

  const result: Result = {
    source,
    title: fetched.title ?? null,
    thumbnail_url: fetched.thumbnail_url ?? null,
    description: fetched.description ?? null,
    // 자동 fetch 가 완전히 실패하면 needsManual 로 표시 (UI 에서 직접 입력 안내)
    needsManual: !fetched.title && !fetched.thumbnail_url,
  };

  return jsonResponse(result);
});
