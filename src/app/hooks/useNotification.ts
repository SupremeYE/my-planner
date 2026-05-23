import { useEffect, useRef, useState, useCallback } from 'react';
import { Todo, Habit } from '../store';

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

const ALERT_BEFORE_KEY = 'notif_alert_before_minutes';
const BANNER_DISMISSED_KEY = 'notif_banner_dismissed';

export const ALERT_OPTIONS = [5, 10, 30, 60] as const;
export type AlertBefore = typeof ALERT_OPTIONS[number];

function getAlertBefore(): AlertBefore {
  const stored = localStorage.getItem(ALERT_BEFORE_KEY);
  const n = stored ? parseInt(stored) : 10;
  return (ALERT_OPTIONS.includes(n as AlertBefore) ? n : 10) as AlertBefore;
}

export function formatAlertBefore(minutes: number): string {
  if (minutes === 60) return '1시간';
  return `${minutes}분`;
}

interface ScheduledNotif {
  id: string;
  timerId: ReturnType<typeof setTimeout>;
}

export function useNotification() {
  const isSupported = 'Notification' in window;

  const [permission, setPermission] = useState<NotifPermission>(
    isSupported ? (Notification.permission as NotifPermission) : 'unsupported'
  );
  const [alertBefore, setAlertBeforeState] = useState<AlertBefore>(getAlertBefore());
  const [bannerDismissed, setBannerDismissed] = useState(
    localStorage.getItem(BANNER_DISMISSED_KEY) === '1'
  );
  const scheduledRef = useRef<ScheduledNotif[]>([]);

  // iOS PWA 여부 (참고용 안내)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (!isSupported) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result as NotifPermission;
  }, [isSupported]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(BANNER_DISMISSED_KEY, '1');
    setBannerDismissed(true);
  }, []);

  const setAlertBefore = useCallback((minutes: AlertBefore) => {
    localStorage.setItem(ALERT_BEFORE_KEY, String(minutes));
    setAlertBeforeState(minutes);
  }, []);

  const cancelAll = useCallback(() => {
    scheduledRef.current.forEach(({ timerId }) => clearTimeout(timerId));
    scheduledRef.current = [];
  }, []);

  const scheduleAlerts = useCallback(
    (todos: Todo[], dateStr: string) => {
      cancelAll();
      if (permission !== 'granted' || !isSupported) return;

      const now = Date.now();
      const alertBeforeMs = alertBefore * 60 * 1000;

      todos.forEach((todo) => {
        if (!todo.planStart) return;
        if (todo.status === 'done' || todo.status === 'cancelled') return;

        const [h, m] = todo.planStart.split(':').map(Number);
        const startMs = new Date(
          `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
        ).getTime();

        const alertMs = startMs - alertBeforeMs;
        const delay = alertMs - now;
        if (delay <= 0) return;

        const body = `${formatAlertBefore(alertBefore)} 후 시작해요`;
        const url = `/daily?date=${dateStr}&todoId=${todo.id}`;

        const timerId = setTimeout(async () => {
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(todo.text, {
              body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
              vibrate: [100, 50, 100],
              data: { url },
              tag: `todo-${todo.id}`,
            } as NotificationOptions);
          } catch {
            if (Notification.permission === 'granted') {
              const n = new Notification(todo.text, {
                body,
                icon: '/icons/icon-192x192.png',
              });
              n.onclick = () => {
                window.focus();
                window.location.href = url;
              };
            }
          }
        }, delay);

        scheduledRef.current.push({ id: todo.id, timerId });
      });
    },
    [permission, alertBefore, cancelAll, isSupported]
  );

  const scheduleHabitAlerts = useCallback(
    (habits: Habit[], dateStr: string) => {
      if (permission !== 'granted' || !isSupported) return;

      const now = Date.now();

      habits.forEach((habit) => {
        if (!habit.alarmTime) return;
        // 이미 오늘 체크 완료된 습관은 알림 skip
        if (habit.checkedDates?.includes(dateStr)) return;

        const [h, m] = habit.alarmTime.split(':').map(Number);
        const alarmMs = new Date(
          `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
        ).getTime();

        const delay = alarmMs - now;
        if (delay <= 0) return;

        const timerId = setTimeout(async () => {
          const body = '습관 실행 시간이에요!';
          const url = '/habits';
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(habit.name, {
              body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
              vibrate: [100, 50, 100],
              data: { url },
              tag: `habit-${habit.id}`,
            } as NotificationOptions);
          } catch {
            if (Notification.permission === 'granted') {
              const n = new Notification(habit.name, { body, icon: '/icons/icon-192x192.png' });
              n.onclick = () => { window.focus(); window.location.href = url; };
            }
          }
        }, delay);

        scheduledRef.current.push({ id: habit.id, timerId });
      });
    },
    [permission, isSupported]
  );

  useEffect(() => () => cancelAll(), [cancelAll]);

  const showBanner =
    isSupported &&
    permission !== 'granted' &&
    permission !== 'unsupported' &&
    !bannerDismissed;

  return {
    permission,
    isSupported,
    isIOS,
    alertBefore,
    showBanner,
    requestPermission,
    setAlertBefore,
    dismissBanner,
    scheduleAlerts,
    scheduleHabitAlerts,
    cancelAll,
  };
}
