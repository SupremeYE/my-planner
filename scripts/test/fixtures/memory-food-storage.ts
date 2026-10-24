/** Isolated Blob transport; no network, credentials or actual Supabase bucket. */
export function memoryFoodStorage(initial: Array<{bucket:string;path:string;base64:string;type?:string}> = []) {
 const objects=new Map<string,Blob>();
 for(const value of initial)objects.set(`${value.bucket}/${value.path}`,new Blob([Uint8Array.from(atob(value.base64),c=>c.charCodeAt(0))],{type:value.type??'image/png'}));
 const requests:any[]=[],faults:any[]=[];const held=new Set<string>();const releases=new Map<string,Array<()=>void>>();
 const controls={objects,requests,failNext:(kind:string,fault:any)=>faults.push({kind,...fault}),hold:(kind:string)=>held.add(kind),release:(kind:string)=>{held.delete(kind);releases.get(kind)?.forEach(fn=>fn());releases.delete(kind);}};
 const failure=(fault:any)=>({data:null,error:{statusCode:String(fault.status??503),message:'isolated storage failure',code:fault.code}});
 const gate=async(kind:string)=>{if(held.has(kind))await new Promise<void>(r=>releases.set(kind,[...releases.get(kind)??[],r]));const index=faults.findIndex(f=>f.kind===kind);return index<0?undefined:faults.splice(index,1)[0];};
 const storage={from(bucket:string){return{
  async upload(path:string,file:Blob,options:any){requests.push({kind:'upload',bucket,path,upsert:options?.upsert});const fault=await gate('upload');if(fault&&!fault.afterCommit)return failure(fault);const key=`${bucket}/${path}`;if(objects.has(key)&&!options?.upsert)return{data:null,error:{statusCode:'409',code:'Duplicate',message:'already exists'}};objects.set(key,file.slice(0,file.size,file.type));return fault?failure(fault):{data:{path},error:null};},
  async download(path:string){requests.push({kind:'download',bucket,path});const fault=await gate('download');if(fault)return failure(fault);const value=objects.get(`${bucket}/${path}`);return value?{data:value,error:null}:{data:null,error:{statusCode:'404',message:'not found'}};},
  getPublicUrl(path:string){return{data:{publicUrl:`https://food.example.invalid/storage/v1/object/public/${bucket}/${path}`}};},
  async remove(paths:string[]){requests.push({kind:'remove',bucket,paths});for(const path of paths)objects.delete(`${bucket}/${path}`);return{data:[],error:null};},
 };}};
 return{storage,controls};
}
