import { useEffect, useState, type CSSProperties } from 'react';
import { CalendarDays, Home, Leaf, NotebookPen, Swords } from 'lucide-react';
import { logicalDateStr } from '../../store';
import { tokenH } from '../../ThemeContext';
import { BRAND_FONT_SOFT } from '../../styles/brand';
export const moaNav = [{ to: '/__moamoa-today', icon: Home, label: '오늘' }, { to: '/calendar', icon: CalendarDays, label: '캘린더' },
  { to: '/__moamoa-todos', icon: Swords, label: '할 일' }, { to: '/__moamoa-records', icon: NotebookPen, label: '기록' }, { to: '/profile', icon: Leaf, label: '나의 정원' }];
export const moaFonts = { fontFamily: tokenH.fontBody, '--mt-title-font': tokenH.fontSection, '--mt-brand-font': BRAND_FONT_SOFT } as CSSProperties;
export function useMoaToday(dayEndHour: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date()); tick();
    const timer = window.setInterval(tick, 15000);
    window.addEventListener('focus', tick); document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [dayEndHour]);
  return logicalDateStr(now, dayEndHour);
}
