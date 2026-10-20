import { createRoot } from 'react-dom/client';
import { MoaMoaPrototype } from './MoaMoaPrototype';
import './prototype.css';
import { tokenH } from '../../app/ThemeContext';

// This entry is served by a Vite development middleware, never the product router.
if (import.meta.env.DEV) {
  const root = document.getElementById('moamoa-prototype')!;
  root.style.fontFamily = tokenH.fontBody!;
  root.style.setProperty('--mo-type-title', tokenH.fontPageTitle!);
  root.style.setProperty('--mo-type-number', tokenH.fontNumeric!);
  createRoot(root).render(<MoaMoaPrototype />);
}
