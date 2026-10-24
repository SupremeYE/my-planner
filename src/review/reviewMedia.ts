import {mediaImages,mediaAudio} from './mediaSamples';
const blobs=new Set<string>();
export function registerReviewBlob(url:string){blobs.add(url);return url;}
export function isReviewBlob(url?:string|null){return !!url&&blobs.has(url);}
export function reviewMediaUrl(url?:string|null){return url?(mediaImages[url]??(blobs.has(url)?url:undefined)):undefined;}
export function reviewAudioUrl(url?:string|null){return url?mediaAudio[url]:undefined;}
