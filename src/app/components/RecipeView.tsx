import React, { useState } from 'react';
import { ChefHat, Refrigerator, ShoppingCart, Timer } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useTimers } from '../timers/TimerProvider';
import { RecipeListTab } from './recipe/RecipeListTab';
import { FridgeTab } from './recipe/FridgeTab';
import { ShoppingTab } from './recipe/ShoppingTab';

type ModuleTab = 'recipes' | 'fridge' | 'shopping';

const TABS: { key: ModuleTab; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'recipes', label: '레시피', icon: ChefHat },
  { key: 'fridge', label: '냉장고', icon: Refrigerator },
  { key: 'shopping', label: '장보기', icon: ShoppingCart },
];

// 레시피 모듈 셸 — 내부 탭 네비(레시피/냉장고/장보기).
// 모바일: 하단 탭바(글로벌 네비 위), PC: 헤더 우측 세그먼트 컨트롤. (라우트 변경 없이 상태로 전환)
export function RecipeView() {
  const { t } = useTheme();
  const { timers, openPanel } = useTimers();
  const [tab, setTab] = useState<ModuleTab>('recipes');
  const active = TABS.find(x => x.key === tab)!;
  const ActiveIcon = active.icon;
  const timerCount = timers.length;

  return (
    <div className="recipe-mod-scroll" style={{ backgroundColor: t.bg, minHeight: '100%' }}>
      {/* 모듈 chrome 위치값 — 모바일: 글로벌 네비(56) + 모듈 탭바(54) 위 / PC: 일반 */}
      <style>{`
        .recipe-mod-scroll{padding-bottom:calc(150px + env(safe-area-inset-bottom));}
        .recipe-mod-fab{bottom:calc(142px + env(safe-area-inset-bottom));}
        .recipe-mod-tabbar{bottom:calc(76px + env(safe-area-inset-bottom));}
        @media (min-width:1024px){
          .recipe-mod-scroll{padding-bottom:40px;}
          .recipe-mod-fab{bottom:28px;}
        }
      `}</style>

      {/* 헤더 (sticky — 부모 main이 스크롤 컨테이너) */}
      <div className="sticky top-0 z-20" style={{ backgroundColor: t.bg }}>
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 pt-4 pb-3 flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, color: t.text }}>
            <ActiveIcon size={24} color={t.accent} />
            {active.label}
          </h1>
          <div className="flex items-center gap-2">
          {/* 공용 타이머 진입점 — 모바일·PC 공용 */}
          <button onClick={openPanel} aria-label="타이머"
            className="relative flex items-center justify-center rounded-xl active:scale-95 transition-transform"
            style={{ width: 38, height: 38, backgroundColor: t.card, border: `1px solid ${t.border}` }}>
            <Timer size={19} color={t.accent} />
            {timerCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
                style={{ minWidth: 18, height: 18, padding: '0 4px', fontSize: 10, fontWeight: 800,
                  color: '#fff', backgroundColor: t.accent, border: `2px solid ${t.bg}` }}>
                {timerCount}
              </span>
            )}
          </button>
          {/* PC 세그먼트 컨트롤 */}
          <div className="hidden lg:flex gap-1 p-1 rounded-xl" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = tab === key;
              return (
                <button key={key} onClick={() => setTab(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
                  style={{ fontSize: 13, fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? t.card : 'transparent',
                    color: isActive ? t.accent : t.textSub,
                    boxShadow: isActive ? t.shadow : 'none' }}>
                  <Icon size={15} color={isActive ? t.accent : t.textMuted} />
                  {label}
                </button>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      {/* 활성 탭 본문 */}
      {tab === 'recipes' && <RecipeListTab />}
      {tab === 'fridge' && <FridgeTab />}
      {tab === 'shopping' && <ShoppingTab />}

      {/* 모바일 모듈 탭바 — 떠 있는 글로벌 글래스 알약 바로 위에 뜨는 둥근 바 */}
      <nav className="recipe-mod-tabbar lg:hidden fixed left-4 right-4 z-30 flex overflow-hidden"
        style={{ minHeight: 52, borderRadius: 26, backgroundColor: t.card,
          border: `1px solid ${t.border}`, boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5">
              <div className="flex items-center justify-center rounded-full transition-all"
                style={{ backgroundColor: isActive ? t.accentLight : 'transparent', padding: '3px 14px' }}>
                <Icon size={18} color={isActive ? t.accent : t.textMuted} />
              </div>
              <span style={{ fontSize: 10, color: isActive ? t.accent : t.textMuted, fontWeight: isActive ? 700 : 400 }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
