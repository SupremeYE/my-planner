// 카카오맵 JS SDK 전역 타입 (느슨한 any — SDK 는 런타임 로드)
declare const kakao: any;
interface Window {
  kakao: any;
}
