import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * 전역 컨텍스트 FAB — 우측 하단 FAB는 항상 1개만 두고,
 * 현재 보고 있는 페이지가 자기 "주(主) 추가 액션"을 등록하면 그 동작을 수행한다.
 *
 * - `kind: 'action'` — 누르면 해당 페이지의 추가 모달/시트를 바로 연다(`onPress`).
 * - `kind: 'quick'`  — 통합 빠른 입력(QuickAddInput) 팝오버/시트를 띄운다.
 *   (일간/캘린더처럼 날짜 맥락 + 상세 단축이 필요한 페이지용)
 *
 * 등록이 없으면 기본 액션 = 빠른 입력(Inbox 캡처)으로 폴백한다.
 */
export type FabAction =
  | { kind: 'action'; label: string; icon?: LucideIcon; onPress: () => void; fabClassName?: string }
  | {
      kind: 'quick';
      label?: string;
      defaultDate?: string | null;
      onAddTodo?: () => void;
      onAddEvent?: () => void;
      fabClassName?: string;
    }
  // 이 페이지에서는 FAB 자체를 숨김(예: 다중 선택 모드)
  | { kind: 'hidden' };

interface FabContextValue {
  action: FabAction | null;
  /** 페이지가 자기 액션을 등록(고유 id 기준 마지막 등록만 유지) */
  register: (id: string, action: FabAction) => void;
  /** 등록 해제(현재 활성 id 일 때만 비움) */
  unregister: (id: string) => void;
}

const FabContext = createContext<FabContextValue | null>(null);

export function FabProvider({ children }: { children: ReactNode }) {
  // id → action 스택. 라우트 전환 시 이전 페이지 cleanup 과 새 페이지 register 순서가
  // 엇갈려도 "마지막 등록자"가 활성이 되도록 id 기준으로 관리한다.
  const [, force] = useState(0);
  const stackRef = useRef<{ id: string; action: FabAction }[]>([]);

  const register = useCallback((id: string, action: FabAction) => {
    const stack = stackRef.current;
    const idx = stack.findIndex(e => e.id === id);
    if (idx >= 0) stack[idx] = { id, action };
    else stack.push({ id, action });
    force(n => n + 1);
  }, []);

  const unregister = useCallback((id: string) => {
    const stack = stackRef.current;
    const idx = stack.findIndex(e => e.id === id);
    if (idx >= 0) {
      stack.splice(idx, 1);
      force(n => n + 1);
    }
  }, []);

  const top = stackRef.current[stackRef.current.length - 1];
  const action = top ? top.action : null;

  return (
    <FabContext.Provider value={{ action, register, unregister }}>
      {children}
    </FabContext.Provider>
  );
}

export function useFab(): FabContextValue {
  const ctx = useContext(FabContext);
  if (!ctx) throw new Error('useFab must be used within FabProvider');
  return ctx;
}

/**
 * 페이지에서 자기 FAB 액션을 등록하는 훅.
 * - `onPress`/`onAddTodo` 등 콜백은 ref 로 항상 최신값을 읽으므로 매 렌더 재등록되지 않는다.
 * - label/icon/kind/defaultDate 가 바뀌면(예: 서브탭 전환) 재등록한다.
 * - `action` 이 null 이면 등록하지 않음(기본 빠른 입력으로 폴백).
 */
export function useFabAction(action: FabAction | null) {
  const { register, unregister } = useFab();
  const id = useId();
  const ref = useRef(action);
  ref.current = action;

  // 재등록 트리거가 되는 "표시값"만 dep 으로 둔다(콜백은 ref 로 최신값 유지).
  const label = action ? ('label' in action ? action.label : undefined) : null;
  const kind = action?.kind ?? null;
  const icon = action && action.kind === 'action' ? action.icon : undefined;
  const defaultDate = action && action.kind === 'quick' ? action.defaultDate ?? null : null;
  const fabClassName = action?.fabClassName ?? null;

  useEffect(() => {
    const cur = ref.current;
    if (!cur) {
      unregister(id);
      return;
    }
    if (cur.kind === 'hidden') {
      register(id, { kind: 'hidden' });
    } else if (cur.kind === 'action') {
      register(id, {
        kind: 'action',
        label: cur.label,
        icon: cur.icon,
        fabClassName: cur.fabClassName,
        onPress: () => ref.current?.kind === 'action' && ref.current.onPress(),
      });
    } else {
      register(id, {
        kind: 'quick',
        label: cur.label,
        defaultDate: cur.defaultDate ?? null,
        fabClassName: cur.fabClassName,
        onAddTodo: cur.onAddTodo ? () => ref.current?.kind === 'quick' && ref.current.onAddTodo?.() : undefined,
        onAddEvent: cur.onAddEvent ? () => ref.current?.kind === 'quick' && ref.current.onAddEvent?.() : undefined,
      });
    }
    return () => unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, register, unregister, kind, label, icon, defaultDate, fabClassName]);
}
