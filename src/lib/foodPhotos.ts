import { SaveFailure, saveFailure } from './saveCoordinator';
export interface FoodPhotoUpload { file: File; operationId: string }
const extensions: Record<string,string> = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/heic':'heic','image/heif':'heif' };
export function foodPhotoPath(recordId: string, upload: FoodPhotoUpload) {
  const ext = extensions[upload.file.type];
  if (!ext || !upload.file.size || upload.file.size > 10 * 1024 * 1024) throw new SaveFailure('JPEG·PNG·WebP·GIF·AVIF·HEIC·HEIF 사진을 10MB 이하로 선택해주세요.',false);
  if (!/^[a-f0-9-]{36}$/i.test(upload.operationId)) throw new SaveFailure('사진 요청 ID를 확인해주세요.',false);
  return `${recordId.replace(/[^a-zA-Z0-9_-]/g,'_')}-${upload.operationId}.${ext}`;
}
const digest = async (value: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await value.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
export function foodPhotoStorage(client: { storage: { from: (bucket: string) => any } }) {
  return {
    async uploadConfirmed(file: File, recordId: string, operationId: string): Promise<string> {
      const path = foodPhotoPath(recordId,{file,operationId});
      const bucket = client.storage.from('food-photos');
      const result = await bucket.upload(path,file,{upsert:false,contentType:file.type});
      if (result.error) {
        const status = result.error.statusCode == null ? undefined : Number(result.error.statusCode);
        if (status === 409 || result.error.code === 'Duplicate' || /already exists/i.test(result.error.message ?? '')) {
          // Only this new request's unique path is read. Never overwrite a pre-existing original.
          const existing = await bucket.download(path);
          if (existing.error) throw saveFailure(existing.error.originalError ?? existing.error,existing.error.statusCode == null ? undefined : Number(existing.error.statusCode));
          if (!(existing.data instanceof Blob) || await digest(existing.data) !== await digest(file)) throw new SaveFailure('같은 사진 경로에 다른 파일이 있어요. 새 사진을 선택해주세요.',false);
        } else throw saveFailure(result.error.originalError ?? result.error,status);
      } else if (result.data?.path !== path) throw new SaveFailure('사진 업로드 결과를 확인하지 못했어요.',false);
      const url = bucket.getPublicUrl(path).data?.publicUrl;
      if (!url || !/^https?:\/\//.test(url)) throw new SaveFailure('사진 주소를 확인하지 못했어요.',false);
      return url;
    },
  };
}
