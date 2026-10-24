import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { moaFonts } from '../app/components/moamoa/moaShared';

/** The product MoaFrame is replaced only by the static review build. */
export function MoaFrame({ children, onQuick, quickDisabled = false, pageTitle = '할 일' }: { children: ReactNode; onQuick: () => void; quickDisabled?: boolean; pageTitle?: string }) {
  return <div className="mt-root mx-todos mr-route" style={moaFonts}>
    <a href="#moa-todos-main" className="mt-skip">{pageTitle} 내용으로 이동</a>
    <div className="mt-scroll"><main className="mt-main" id="moa-todos-main" tabIndex={-1}>{children}</main></div>
    <button className="mt-quick" onClick={onQuick} disabled={quickDisabled}><Plus size={22} />빠른 기록</button>
  </div>;
}
