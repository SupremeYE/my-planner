import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
import path from 'node:path';
import {transformReviewMedia} from './src/review/mediaBuildTransforms';

if (process.env.VERCEL_ENV === 'production') throw new Error('Review build is forbidden for Production');
export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'moamoa-review-isolation', enforce: 'pre',
    configResolved(config) {
      for (const key of Object.keys(config.env)) if (key.startsWith('VITE_')) delete config.env[key];
    },
    resolveId(source, importer) {
      if (/(?:^\.\/|\/lib\/)itunes(?:\.ts)?$/.test(source)) return path.resolve('src/review/mediaApi.ts');
      if (/(?:^\.\/|\/)BookImage(?:\.tsx)?$/.test(source)) return path.resolve('src/review/ReviewBookImage.tsx');
      if (source.endsWith('/useVoiceInput')) return path.resolve('src/review/disabledVoice.ts');
      if (/(?:^\.\/supabase|\/lib\/supabase)(?:\.ts)?$/.test(source)) return path.resolve('src/review/transport.ts');
      if (/(?:^\.\/|\/lib\/)(?:tmdb|youtube)(?:\.ts)?$/.test(source)) return path.resolve('src/review/cultureApi.ts');
      if (/(?:^\.\/|\/)CultureImage(?:\.tsx)?$/.test(source)) return path.resolve('src/review/ReviewCultureImage.tsx');
      if (source === './routes' && importer?.endsWith('/src/app/App.tsx')) return path.resolve('src/review/reviewRoutes.tsx');
      if (/(?:^\.\/|\/)MoaFrame(?:\.tsx)?$/.test(source)) return path.resolve('src/review/ReviewFrame.tsx');
    },
    transform(code, id) {
      const media = transformReviewMedia(code, id);
      if (media !== undefined) return media;
      if (id.endsWith('/src/app/App.tsx')) return code.replace('<SaveStatus />', '');
      if (id.endsWith('/MoaCultureRoute.tsx')) {
        const navigation = /<div className="mc-section-label">[\s\S]*?<\/div>/;
        const externalLink = /\{link && <a className="mc-external-link"[^>]*>[\s\S]*?<\/a>\}/;
        if (!navigation.test(code) || !externalLink.test(code)) throw new Error('Culture review navigation/link boundary changed');
        return "import { ReviewCultureNav } from '@/review/ReviewCultureNav';\n" + code
          .replace(navigation, '<ReviewCultureNav active="video" />')
          .replace('const link = safeCultureUrl(r.url);', 'const link = undefined;')
          .replace(externalLink, '<p className="mc-help mrc-link-note">{r.url && <>샘플에 보관한 링크: {r.url}<br/>외부 페이지는 열지 않아요.</>}</p>');
      }
      if (id.endsWith('/culture/CultureMetadataSearch.tsx')) {
        const section = '<section className="mc-metadata" aria-label="작품 정보 가져오기">';
        if (!code.includes(section)) throw new Error('Culture metadata sample notice slot changed');
        return "import { ReviewCultureSearchNote } from '@/review/ReviewCultureNav';\n" + code
          .replace(section, section + '<ReviewCultureSearchNote />')
          .replace('작품 정보 제공: TMDB. 이 서비스는 TMDB의 인증을 받지 않았습니다.', '로컬 샘플 응답입니다. TMDB와 YouTube를 실제로 조회하지 않아요.');
      }
      if (id.endsWith('/src/lib/foodPhotos.ts')) return code.replace('      if (!url ||', "      if (url?.startsWith('blob:')) return url;\n      if (!url ||");
      if (id.endsWith('/MoaTodayRoute.tsx')) {
        // Keep the real Today data/actions. Only its duplicate layout is supplied by ReviewShell.
        for (const tag of ['aside', 'header', 'nav']) {
          const className = { aside: 'mt-sidebar', header: 'mt-topbar', nav: 'mt-bottom-nav' }[tag];
          const pattern = new RegExp(`<${tag} className="${className}"[\\s\\S]*?<\\/${tag}>`);
          if (!pattern.test(code)) throw new Error(`Today review layout slot missing: ${className}`);
          code = code.replace(pattern, '');
        }
        return code.replace('return <div className="mt-root"', 'return <div className="mt-root mr-route"')
          .replace('기존 내 기록과 함께하는 오늘', '샘플 데이터로 체험하는 오늘')
          .replace('기존 목표에서 시작하기', '정원에서 목표 보기')
          .replace('핵심 별표는 기존 일간 화면에서 선택해요.', '핵심 별표 편집은 이번 Preview에서 지원하지 않아요.')
          .replace('<button onClick={() => go(\'/daily\')}>일간 화면에서 핵심 선택하기</button>', '<button disabled>핵심 할 일 선택은 준비 중이에요</button>');
      }
      if (id.includes('/src/app/components/moamoa/')) return code
        .replaceAll('개발용 · 실제 내 데이터', '샘플 · 서버 저장 없음')
        .replace('disabled={locked||ai.loading||!draft.foodName.trim()}', 'disabled title="샘플 검토에서는 AI를 사용하지 않아요"')
        .replace(/<Link className="mf-legacy-link"[^>]*>[\s\S]*?<\/Link>/, '<p className="mx-help">확장 음식 통계는 이번 Preview에서 지원하지 않아요.</p>')
        .replaceAll('단식 기록 편집은 기존 음식 화면에서 지원해요.', '단식 기록 편집은 이번 Preview에서 지원하지 않아요.')
        .replaceAll('편집은 기존 음식 화면에서 지원해요.', '편집은 이번 Preview에서 지원하지 않아요.');
      if (id.endsWith('/usePWA.ts') || id.endsWith('/GlobalFloatingTimer.tsx')) return code.replaceAll("'My Planner'", "'모아모아 · 샘플 검토'");
    },
    generateBundle(_options, bundle) {
      for (const id of this.getModuleIds()) {
        if (id.includes('/node_modules/@supabase/')) throw new Error('Review must not bundle the real Supabase SDK');
        if (id.endsWith('/src/app/routes.tsx')) throw new Error('Review must use isolated routes');
        if (/\/src\/lib\/(?:supabase|tmdb|youtube|itunes|transcribe)\.ts$/.test(id)) throw new Error('Review must not bundle a live backend or culture API module');
      }
      for (const item of Object.values(bundle)) if (item.type === 'asset' && item.fileName.endsWith('.css')) {
        // Use the system-font fallbacks without external requests.
        item.source = String(item.source).replace(/@import\s*(?:url\(\s*)?(?:"https?:[^"]*"|'https?:[^']*')\s*\)?[^;]*;/g, '');
      }
    },
  }],
  define: { 'import.meta.env.DEV': 'true', 'import.meta.env.PROD': 'false' },
  build: { outDir: 'dist-review', emptyOutDir: true, rollupOptions: { input: path.resolve('review.html') } },
}));
