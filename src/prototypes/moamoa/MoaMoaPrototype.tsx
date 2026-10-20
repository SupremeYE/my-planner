import { CalendarDays, ChevronRight, Flower2, Home, Leaf, NotebookPen, Plus, Settings2, Sprout, Swords } from 'lucide-react';
import { tokenH } from '../../app/ThemeContext';
import { BRAND_FONT_SOFT } from '../../app/styles/brand';
import { PrototypeProvider, useMoa, type Screen } from './PrototypeState';
import { Today } from './Today';
import { Calendar } from './Calendar';
import { Quests } from './Quests';
import { Records, Garden } from './RecordsGarden';
import { Sheets } from './Sheets';
import { Feedback } from './Feedback';
import { MoaBuddy } from './ui';
const navigation = [
  { id: 'today', name: '오늘', en: 'Today', icon: Home },
  { id: 'calendar', name: '캘린더', en: 'Calendar', icon: CalendarDays },
  { id: 'quests', name: '퀘스트', en: 'Quests', icon: Swords },
  { id: 'records', name: '기록', en: 'Records', icon: NotebookPen },
  { id: 'garden', name: '나의 정원', en: 'My Garden', icon: Flower2 },
] as const;
function PrototypeShell() {
  const { screen, navigate, setSheet, openQuick, sheet } = useMoa();
  const title = navigation.find(item => item.id === screen)!;
  const links = (mobile: boolean) => navigation.map(item => <button key={item.id} data-nav={item.id} aria-current={screen === item.id ? 'page' : undefined} onClick={() => navigate(item.id as Screen)}>
    <item.icon size={mobile ? 21 : 20} strokeWidth={screen === item.id ? 2.2 : 1.7} /><span>{item.name}</span>{!mobile && <small>{item.en}</small>}
  </button>);
  return <div className="mo-prototype" style={{ fontFamily: tokenH.fontBody }}>
    <a className="mo-skip" href="#mo-main">본문으로 이동</a>
    <aside className="mo-sidebar">
      <button className="mo-brand" onClick={() => navigate('today')} aria-label="모아모아 오늘 홈"><span className="mo-brand-mark"><Sprout size={28} /></span><span style={{ fontFamily: BRAND_FONT_SOFT }}>모아모아<small>나의 작은 라이프 아지트</small></span></button>
      <p className="mo-sidebar-caption">MY COZY LIFE</p><nav aria-label="PC 주요 메뉴">{links(false)}</nav>
      <div className="mo-sidebar-garden"><MoaBuddy small /><p>쉬어가는 날도<br />나의 이야기니까.</p><span>오늘도 여기 있어요</span></div>
      <button className="mo-demo-settings" onClick={() => setSheet('options')}><Settings2 size={16} />시안 옵션</button>
      <div className="mo-sidebar-foot"><Leaf size={13} />little moments, gathered.</div>
    </aside>
    <div className="mo-workspace">
      <div className="mo-demo-ribbon"><span><span className="mo-demo-dot" />디자인 시안 · 샘플 데이터</span><button onClick={() => setSheet('options')}>새로고침하면 처음으로 <ChevronRight size={12} /></button></div>
      <header className="mo-topbar"><div className="mo-breadcrumb"><span>나의 아지트</span><ChevronRight size={12} /><strong>{title.name}</strong></div>
        <div className="mo-topbar-right"><span className="mo-soft-note"><Sprout size={16} />조금씩, 꾸준히</span><button className="mo-primary mo-header-add" onClick={() => openQuick()}><Plus size={17} />빠른 기록</button><span className="mo-avatar" aria-label="샘플 프로필">모</span></div>
        <button className="mo-mobile-wordmark" style={{ fontFamily: BRAND_FONT_SOFT }} onClick={() => navigate('today')}><Sprout size={22} />모아모아</button>
      </header>
      <main className="mo-main" id="mo-main" tabIndex={-1}>
        <div className={`mo-page mo-page-${screen}`}>
          {screen === 'today' ? <Today /> : screen === 'calendar' ? <Calendar /> : screen === 'quests' ? <Quests /> : screen === 'records' ? <Records /> : <Garden />}
          <footer className="mo-page-footer"><Sprout size={14} />오늘의 작은 조각들이, 나의 숲이 되도록.</footer>
        </div>
      </main>
    </div>
    <button className="mo-mobile-capture" aria-label="빠른 기록 열기" onClick={() => openQuick()}><Plus size={21} /><span>기록</span></button>
    <nav className="mo-bottom-nav" aria-label="모바일 주요 메뉴">{links(true)}</nav>
    {!sheet && <Feedback />}
    <Sheets />
  </div>;
}
export function MoaMoaPrototype() { return <PrototypeProvider><PrototypeShell /></PrototypeProvider>; }
