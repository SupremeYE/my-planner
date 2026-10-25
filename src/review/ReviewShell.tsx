import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Menu, RotateCcw, Sprout } from 'lucide-react';
import { moaFonts, moaNav } from '../app/components/moamoa/moaShared';
import { MoaBuddy } from '../app/components/moamoa/MoaBuddy';
import { SaveStatus } from '../app/components/SaveStatus';
import '../app/components/moamoa/today.css';
import '../app/components/moamoa/todos.css';

export function ReviewShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const isRecords = pathname.startsWith('/culture/') || ['/__moamoa-records', '/__moamoa-food', '/reviews', '/culture', '/books', '/health'].includes(pathname);
  const links = () => moaNav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} title={label} aria-label={label}
    aria-current={pathname === to || to === '/__moamoa-records' && isRecords ? 'page' : undefined}>
    <Icon size={21} /><span>{label}</span></Link>);
  const status = () => <div className="mr-sample"><small>샘플 · 서버 저장 없음<br />새로고침하면 초기화돼요.</small>
    <button type="button" title="샘플 초기화" aria-label="샘플 초기화" onClick={() => location.reload()}><RotateCcw size={17} /><span>샘플 초기화</span></button></div>;
  return <div className={`mt-root mr-shell ${collapsed ? 'mr-collapsed' : ''}`} style={moaFonts}>
    <aside className="mr-sidebar" aria-label="모아모아 사이드바">
      <div className="mr-sidebar-heading"><Link to="/__moamoa-today" className="mr-brand" aria-label="모아모아 오늘"><Sprout size={29} /><span>모아모아</span></Link>
      <button className="mr-collapse" type="button" aria-controls="mr-pc-nav" aria-expanded={!collapsed} aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'} title={collapsed ? '사이드바 펼치기' : '사이드바 접기'} onClick={() => setCollapsed(v => !v)}><Menu size={22} aria-hidden="true" /></button></div>
      <nav id="mr-pc-nav" aria-label="주요 메뉴">{links()}</nav>
      <div className="mr-sidebar-foot"><MoaBuddy small /><p>작은 일부터 하나씩.</p>{status()}</div>
    </aside>
    <div className="mr-body"><header className="mr-mobile-header"><Link className="mr-brand" to="/__moamoa-today"><Sprout size={23} />모아모아</Link>{status()}</header><div className="mr-feedback"><SaveStatus /></div><div className="mr-content"><Outlet /></div></div>
    <nav className="mr-mobile-nav" aria-label="모바일 주요 메뉴">{links()}</nav>
  </div>;
}
