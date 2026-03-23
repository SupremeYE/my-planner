import { useState } from 'react';
import { Bell, BellOff, X, ChevronDown } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useNotification, ALERT_OPTIONS, formatAlertBefore, AlertBefore } from '../hooks/useNotification';

export function NotificationPermissionBanner() {
  const { t } = useTheme();
  const {
    permission,
    isSupported,
    isIOS,
    alertBefore,
    showBanner,
    requestPermission,
    setAlertBefore,
    dismissBanner,
  } = useNotification();

  const [showOptions, setShowOptions] = useState(false);
  const [requesting, setRequesting] = useState(false);

  if (!showBanner) return null;

  const handleAllow = async () => {
    setRequesting(true);
    const result = await requestPermission();
    setRequesting(false);
    if (result === 'granted') dismissBanner();
  };

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 text-sm"
      style={{
        backgroundColor: t.accentLight,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      {/* 아이콘 */}
      <div className="flex-shrink-0 mt-0.5">
        {permission === 'denied' ? (
          <BellOff size={16} style={{ color: t.textMuted }} />
        ) : (
          <Bell size={16} style={{ color: t.accent }} />
        )}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        {permission === 'denied' ? (
          <p style={{ color: t.textSub, fontSize: 12 }}>
            알림이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해주세요.
          </p>
        ) : (
          <>
            <p style={{ color: t.text, fontWeight: 600, fontSize: 12 }}>
              할일 시작 알림을 받으세요
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* 시간 선택 */}
              <div className="relative">
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: t.card,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    fontSize: 11,
                  }}
                >
                  {formatAlertBefore(alertBefore)} 전
                  <ChevronDown size={10} />
                </button>
                {showOptions && (
                  <div
                    className="absolute top-full left-0 mt-1 rounded-lg shadow-lg z-50 overflow-hidden"
                    style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
                  >
                    {ALERT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setAlertBefore(opt as AlertBefore); setShowOptions(false); }}
                        className="block w-full text-left px-3 py-1.5 text-xs transition-colors"
                        style={{
                          color: opt === alertBefore ? t.accent : t.text,
                          fontWeight: opt === alertBefore ? 700 : 400,
                          backgroundColor: 'transparent',
                        }}
                      >
                        {formatAlertBefore(opt)} 전
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleAllow}
                disabled={requesting}
                className="px-3 py-0.5 rounded-full text-xs font-semibold transition-opacity"
                style={{
                  backgroundColor: t.accent,
                  color: '#fff',
                  opacity: requesting ? 0.6 : 1,
                  fontSize: 11,
                }}
              >
                {requesting ? '요청 중...' : '알림 허용'}
              </button>
            </div>

            {isIOS && (
              <p className="mt-1" style={{ color: t.textMuted, fontSize: 10 }}>
                iOS에서는 홈 화면에 추가 후 iOS 16.4 이상에서만 알림이 지원됩니다.
              </p>
            )}
          </>
        )}
      </div>

      {/* 닫기 */}
      <button
        onClick={dismissBanner}
        className="flex-shrink-0 mt-0.5 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: t.textSub }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
