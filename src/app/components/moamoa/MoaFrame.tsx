import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronRight, Plus, Sprout } from 'lucide-react';
import { moaFonts, moaNav } from './moaShared';
import { MoaBuddy } from './MoaBuddy';
import './today.css';
export function MoaFrame({ children, onQuick, quickDisabled = false, pageTitle = '할 일', className = '' }: { children: ReactNode; onQuick: () => void; quickDisabled?: boolean; pageTitle?: string; className?: string }) {
  const { pathname } = useLocation();
  const links = () => moaNav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={to === pathname || to === '/__moamoa-records' && pathname === '/__moamoa-food' ? 'page' : undefined}><Icon size={20} /><span>{label}</span></Link>);
  return <div className={`mt-root mx-todos${className ? ` ${className}` : ''}`} style={moaFonts}>
    <a href="#moa-todos-main" className="mt-skip">{pageTitle} 내용으로 이동</a>
    <aside className="mt-sidebar"><Link to="/__moamoa-today" className="mt-brand"><Sprout size={28} />모아모아</Link><p>나의 작은 라이프 아지트</p><small className="mt-dev-label">개발용 · 실제 내 데이터</small><nav aria-label="바로가기">{links()}</nav><div className="mt-sidebar-foot"><MoaBuddy small /><p>작은 일부터 하나씩.</p><Link to="/dashboard">기존 홈으로 돌아가기</Link></div></aside>
    <div className="mt-scroll"><header className="mt-topbar"><span className="mt-brand"><Sprout size={22} />모아모아</span><span className="mt-dev-label">{pageTitle} · 개발용</span><Link to="/dashboard">기존 홈 <ChevronRight size={16} /></Link></header><main className="mt-main" id="moa-todos-main" tabIndex={-1}>{children}</main></div>
    <nav className="mt-bottom-nav" aria-label="모바일 주요 메뉴">{links()}</nav><button className="mt-quick" onClick={onQuick} disabled={quickDisabled}><Plus size={22} />빠른 기록</button>
  </div>;
}
