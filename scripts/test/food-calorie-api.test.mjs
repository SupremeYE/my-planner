import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
async function load(primary,legacy){const result=await build({absWorkingDir:root,entryPoints:['api/food-calorie.ts'],bundle:true,platform:'node',format:'esm',write:false,define:{'process.env.OPENAI_API_KEY':primary?JSON.stringify(primary):'undefined','process.env.VITE_OPENAI_API_KEY':legacy?JSON.stringify(legacy):'undefined'}});return(await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;}
test('food calorie proxy keeps keys server-side, supports old config and returns only the estimate',async()=>{
 const original=globalThis.fetch;let calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({choices:[{message:{content:'350'}}]});};
 try{
  const handler=await load('isolated-primary-key','isolated-old-key');const response=await handler(new Request('http://localhost/api/food-calorie?input=rice'));assert.equal(response.status,200);assert.deepEqual(await response.json(),{calories:350});assert.equal(calls[0].options.headers.Authorization,'Bearer isolated-primary-key');
  const old=await load(undefined,'isolated-old-key');await old(new Request('http://localhost/api/food-calorie?input=rice'));assert.equal(calls[1].options.headers.Authorization,'Bearer isolated-old-key');
  const before=calls.length;const missing=await handler(new Request('http://localhost/api/food-calorie'));assert.equal(missing.status,400);assert.equal(calls.length,before);
  globalThis.fetch=async()=>new Response('',{status:503});const failure=await handler(new Request('http://localhost/api/food-calorie?input=rice'));assert.equal(failure.status,502);assert.equal(JSON.stringify(await failure.json()).includes('isolated-primary-key'),false);
 }finally{globalThis.fetch=original;}
});
