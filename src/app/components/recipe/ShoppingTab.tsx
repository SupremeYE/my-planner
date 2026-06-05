import { ShoppingCart } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

// Phase 2a: 탭 자리만 마련. 전체 기능은 Phase 2c에서 구현.
export function ShoppingTab() {
  const { t } = useTheme();
  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-4 lg:py-6">
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="rounded-full flex items-center justify-center mb-4"
          style={{ width: 72, height: 72, backgroundColor: t.accentLight }}>
          <ShoppingCart size={32} color={t.accent} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>장보기는 곧 추가됩니다</p>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 6 }}>다음 단계에서 장보기 목록 기능이 들어와요</p>
      </div>
    </div>
  );
}
