import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
import path from 'node:path';
if (process.env.VERCEL_ENV === 'production') throw new Error('Review build is forbidden for Production');
export default mergeConfig(base, defineConfig({
 plugins:[{name:'moamoa-review-isolation',enforce:'pre',
  configResolved(config){for(const key of Object.keys(config.env))if(key.startsWith('VITE_'))delete config.env[key];},
  resolveId(source){if(/(?:^\.\/supabase|\/lib\/supabase)(?:\.ts)?$/.test(source))return path.resolve('src/review/transport.ts');},
  transform(code,id){
   if(id.endsWith('/src/lib/foodPhotos.ts'))return code.replace('      if (!url ||',"      if (url?.startsWith('blob:')) return url;\n      if (!url ||");
   if(id.includes('/src/app/components/moamoa/'))return code.replaceAll('개발용 · 실제 내 데이터','샘플 · 서버 저장 없음').replace('disabled={locked||ai.loading||!draft.foodName.trim()}','disabled title="샘플 검토에서는 AI를 사용하지 않아요"');
   if(id.endsWith('/usePWA.ts')||id.endsWith('/GlobalFloatingTimer.tsx'))return code.replaceAll("'My Planner'","'모아모아 · 샘플 검토'");
  },
  generateBundle(_options,bundle){
   for(const id of this.getModuleIds())if(id.includes('/node_modules/@supabase/'))throw new Error('Review must not bundle the real Supabase SDK');
   // Review stays offline: use the existing system-font fallbacks instead of remote font stylesheets.
   for(const item of Object.values(bundle))if(item.type==='asset'&&item.fileName.endsWith('.css'))item.source=String(item.source).replace(/@import\s*(?:url\(\s*)?(?:"https?:[^"]*"|'https?:[^']*')\s*\)?[^;]*;/g,'');
  }
 }],
 define:{'import.meta.env.DEV':'true','import.meta.env.PROD':'false'},
 build:{outDir:'dist-review',emptyOutDir:true,rollupOptions:{input:path.resolve('review.html')}}
}));
