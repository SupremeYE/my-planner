import type { MusicRecord } from '../app/store';
import type { MusicSearchResult } from './itunes';
import { confirmedWrites } from './confirmedWrites';
import { SaveFailure, saveFailure, saveIntent } from './saveCoordinator';
import { safeCultureUrl } from './cultureRecords';

// Existing listened_date is intentionally feature-local: legacy writers remain untouched.
export type MusicEntry = MusicRecord & { listenedDate?: string | null };
export function fromMusicRecord(r: MusicEntry) {
  return { id:r.id, track_title:r.trackTitle, artist:r.artist, album:r.album ?? null,
    artwork_url:r.artworkUrl ?? null, release_year:r.releaseYear ?? null,
    itunes_track_id:r.itunesTrackId ?? null, preview_url:r.previewUrl ?? null,
    mood:r.mood ?? [], genre:r.genre ?? null, memo:r.memo ?? null,
    listen_url:r.listenUrl ?? null, stickers:r.stickers ?? [],
    ...(r.listenedDate !== undefined ? {listened_date:r.listenedDate} : {}),
  };
}
export type MusicRow = ReturnType<typeof fromMusicRecord> & {created_at?: string};
export function toMusicRecord(r: MusicRow): MusicEntry {
  return {id:r.id,trackTitle:r.track_title,artist:r.artist,album:r.album,artworkUrl:r.artwork_url,
    releaseYear:r.release_year,itunesTrackId:r.itunes_track_id,previewUrl:r.preview_url,
    mood:r.mood ?? [],genre:r.genre,memo:r.memo,listenUrl:r.listen_url,stickers:r.stickers ?? [],
    ...(r.listened_date !== undefined ? {listenedDate:r.listened_date} : {}),createdAt:r.created_at};
}
export function validateMusic(r: MusicEntry, before?: MusicEntry) {
  if (!r.trackTitle.trim()) throw new SaveFailure('곡명을 입력해주세요.',false);
  if (r.listenedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(r.listenedDate) || !Number.isFinite(Date.parse(r.listenedDate)) || new Date(r.listenedDate).toISOString().slice(0,10)!==r.listenedDate)) throw new SaveFailure('들은 날짜를 확인해주세요.',false);
  if (r.releaseYear != null && (!Number.isInteger(r.releaseYear) || r.releaseYear<1 || r.releaseYear>9999)) throw new SaveFailure('발매 연도를 확인해주세요.',false);
  for(const key of ['artworkUrl','previewUrl','listenUrl'] as const) if(r[key] && r[key]!==before?.[key] && !safeCultureUrl(r[key])) throw new SaveFailure('링크는 http 또는 https 주소로 입력해주세요.',false);
}
export function musicRepository(client: {from: (table:string)=>any}) {
  const writes=confirmedWrites<MusicEntry,MusicRow>(client,'music_records',fromMusicRecord,toMusicRecord);
  return {...writes, async save(record: MusicEntry,before?:MusicEntry) {
    validateMusic(record,before);
    if(before && before.id!==record.id) throw new SaveFailure('기록 ID가 일치하지 않아요.',false);
    if(record.itunesTrackId != null && (!before || record.itunesTrackId!==before.itunesTrackId)) {
      const result=await client.from('music_records').select('id').eq('itunes_track_id',record.itunesTrackId);
      if(result.error) throw saveFailure(result.error,result.status);
      if(!Array.isArray(result.data)) throw new SaveFailure('중복 여부를 확인하지 못했어요.',false);
      if(result.data.some((r:{id:string})=>r.id!==record.id)) throw new SaveFailure('이미 기록한 iTunes 곡이에요. 기존 기록을 수정해주세요.',false);
    }
    if(!before) return await writes.createConfirmed(record);
    const old=fromMusicRecord(before),next=fromMusicRecord(record);
    const changed=Object.keys(next).filter(k=>k!=='id' && saveIntent(next[k as keyof typeof next])!==saveIntent(old[k as keyof typeof old]));
    const saved=changed.length ? await writes.updateConfirmed(before,record) : await writes.getConfirmed(record.id);
    if(!saved) throw new SaveFailure('기록이 삭제되었거나 조회 권한이 없어요.',false);
    const actual=fromMusicRecord(saved);
    if(changed.some(k=>saveIntent(next[k as keyof typeof next])!==saveIntent(actual[k as keyof typeof actual]))) throw new SaveFailure('변경 결과를 확인하지 못했어요. 다시 불러와주세요.',false);
    return saved;
  }};
}
export function applyMusicSuggestion(record:MusicEntry,suggestion:MusicSearchResult,touched:Set<keyof MusicEntry>) {
  const next={...record};
  for(const key of ['trackTitle','artist','album','artworkUrl','releaseYear'] as const) {
    if(!touched.has(key) && (next[key]==null || next[key]==='')) (next as any)[key]=suggestion[key];
  }
  // Identity/media belong to the chosen search result, except an existing identity cannot be silently replaced.
  if(record.itunesTrackId==null) {next.itunesTrackId=suggestion.itunesTrackId;next.previewUrl=record.previewUrl || suggestion.previewUrl;}
  return next;
}
export function filterMusic(records:MusicEntry[],search:string,mood:string,sort:string,date:string) {
  const q=search.trim().toLocaleLowerCase();
  return records.filter(r=>(!date || r.listenedDate===date) && (mood==='all'||r.mood.includes(mood)) && (!q||[r.trackTitle,r.artist,r.album,r.genre,...r.mood].some(s=>s?.toLocaleLowerCase().includes(q))))
    .sort((a,b)=>(sort==='title' ? a.trackTitle.localeCompare(b.trackTitle,'ko') : sort==='listened' ? (b.listenedDate??'').localeCompare(a.listenedDate??'') : (b.createdAt??'').localeCompare(a.createdAt??'')) || a.id.localeCompare(b.id));
}
