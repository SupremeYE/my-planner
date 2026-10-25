import type { CSSProperties, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { moaFonts } from './moaShared';
import { SaveStatus } from '../SaveStatus';
export function MoaDialog({ title, description, onClose, children, footer, saveKeys, className = '', style }: {
  title: string; description: string; onClose: () => void; children: ReactNode; footer?: ReactNode; saveKeys?: string[]; className?: string; style?: CSSProperties;
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="mt-overlay mx-overlay" /><Dialog.Content className={`mt-root mt-sheet mx-dialog ${className}`} style={{ ...moaFonts, ...style }} onEscapeKeyDown={event => { event.preventDefault(); onClose(); }} onPointerDownOutside={event => event.preventDefault()}>
    <header className="mx-dialog-head"><div><p className="mt-eyebrow">ONE SMALL STEP</p><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><button onClick={onClose} aria-label={`${title} 닫기`}><X size={21} /></button></header>
    <div className="mx-dialog-body">{children}</div><footer className="mx-dialog-foot"><SaveStatus inline onlyKeys={saveKeys} />{footer}</footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
