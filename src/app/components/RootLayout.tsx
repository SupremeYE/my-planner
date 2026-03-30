import React from 'react';
import { useTheme } from '../ThemeContext';
import { Layout } from './Layout';
import { LayoutC } from './LayoutC';

// Layout switcher based on theme — PlannerProvider is now in App.tsx
// above RouterProvider, so it's always available to all route components.
export function RootLayout() {
  const { layoutMode } = useTheme();
  return layoutMode === 'topnav' ? <LayoutC /> : <Layout />;
}