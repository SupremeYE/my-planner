import React from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { usePWA } from '../hooks/usePWA';

export function PWABanner() {
  const { canInstall, isOnline, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  return (
    <>
      {/* 오프라인 알림 배너 */}
      {!isOnline && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 px-4"
          style={{ backgroundColor: '#9f403d', color: '#fff' }}
        >
          <WifiOff size={14} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>오프라인 상태입니다 — 캐시된 데이터를 표시 중</span>
        </div>
      )}

      {/* 설치 유도 배너 (Android Chrome 등) */}
      {canInstall && !dismissed && (
        <div
          className="fixed bottom-20 left-4 right-4 z-[90] flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg md:bottom-4 md:left-auto md:right-4 md:w-80"
          style={{ backgroundColor: '#26343d', color: '#fff' }}
        >
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#515f74' }}
          >
            <span style={{ fontSize: 20 }}>📋</span>
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 1 }}>홈 화면에 추가</p>
            <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.3 }}>
              앱처럼 설치해서 빠르게 접근하세요
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={promptInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ backgroundColor: '#515f74', color: '#fff', fontSize: 12, fontWeight: 700 }}
            >
              <Download size={12} />
              설치
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#aaa' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// iOS 전용 설치 안내 (Safari는 beforeinstallprompt 미지원)
export function IOSInstallGuide() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  React.useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const alreadyDismissed = localStorage.getItem('ios-install-dismissed');
    if (isIOS && !isStandalone && !alreadyDismissed) {
      // 3초 후 안내 표시
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show || dismissed) return null;

  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-[90] rounded-2xl p-4 shadow-xl md:left-auto md:right-4 md:w-80"
      style={{ backgroundColor: '#26343d', color: '#fff' }}
    >
      <div className="flex items-start justify-between mb-2">
        <p style={{ fontSize: 13, fontWeight: 700 }}>📱 iPhone 홈 화면에 추가</p>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('ios-install-dismissed', 'true');
          }}
          className="p-1"
          style={{ color: '#aaa' }}
        >
          <X size={14} />
        </button>
      </div>
      <ol style={{ fontSize: 12, color: '#ccc', lineHeight: 1.8, paddingLeft: 16 }}>
        <li>Safari 하단의 <strong style={{ color: '#515f74' }}>공유 버튼 (□↑)</strong> 을 탭하세요</li>
        <li><strong style={{ color: '#515f74' }}>홈 화면에 추가</strong> 를 선택하세요</li>
        <li><strong style={{ color: '#515f74' }}>추가</strong> 를 탭하면 완료!</li>
      </ol>
      {/* 화살표 */}
      <div
        className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
        style={{ backgroundColor: '#26343d' }}
      />
    </div>
  );
}
