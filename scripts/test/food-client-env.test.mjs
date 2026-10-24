import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('development and production clients never contain synthetic food secret canaries; product excludes dev routes',{timeout:120000},async()=>{
 const output=await mkdtemp(path.join(tmpdir(),'moa-food-client-'));
 const canaries=['MOAMOA_FAKE_OPENAI_NOT_A_SECRET_90123','MOAMOA_FAKE_FOOD_NOT_A_SECRET_90234','MOAMOA_FAKE_SERVER_NOT_A_SECRET_90345'];
 try{
  let log='';const result=await new Promise(resolve=>{const child=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',output,'--emptyOutDir'],{cwd:root,env:{...process.env,VITE_OPENAI_API_KEY:canaries[0],VITE_FOOD_API_KEY:canaries[1],OPENAI_API_KEY:canaries[2]}});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);child.on('close',resolve);});assert.equal(result,0,log.slice(-2000));
  const devCode = `import {createServer} from 'vite'; const server = await createServer({root:process.cwd(),cacheDir:${JSON.stringify(path.join(output,'dev-cache'))},logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:0}});try{await server.listen();const transformed=await server.transformRequest('/src/lib/supabase.ts');const code=transformed.code;if(${JSON.stringify(canaries)}.some(value=>code.includes(value)))throw new Error('Synthetic food key leaked into development client');}finally{await server.close();}`;
  let devLog='';const devResult=await new Promise(resolve=>{const child=spawn(process.execPath,['--input-type=module','-e',devCode],{cwd:root,env:{...process.env,VITE_OPENAI_API_KEY:canaries[0],VITE_FOOD_API_KEY:canaries[1],OPENAI_API_KEY:canaries[2]}});child.stdout.on('data',d=>devLog+=d);child.stderr.on('data',d=>devLog+=d);child.on('close',resolve);});assert.equal(devResult,0,devLog.slice(-1200));
  for(const name of await readdir(path.join(output,'assets'))){if(!/\.(js|css)$/.test(name))continue;const text=await readFile(path.join(output,'assets',name),'utf8');assert.ok(canaries.every(value=>!text.includes(value)),`Synthetic key leaked into ${name}`);assert.equal(text.includes('/__moamoa-food'),false);assert.equal(text.includes('__moaFixture'),false);}
 }finally{await rm(output,{recursive:true,force:true});}
});
