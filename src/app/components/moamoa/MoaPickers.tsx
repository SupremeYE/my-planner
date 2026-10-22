import { useState } from 'react';
import { Check, Plus, Settings2 } from 'lucide-react';
import { usePlanner } from '../../store';
import { weeklyRollup } from '../period/periodProgress';
import { MoaDialog } from './MoaDialog';
import { MoaTagManager } from './MoaTagManager';
export function MoaTagPicker({ kind, value, onChange, onClose }: { kind: 'time' | 'normal'; value: string[]; onChange: (ids: string[]) => void; onClose: () => void }) {
  const { tags } = usePlanner(); const [search, setSearch] = useState(''); const [selected, setSelected] = useState(value);
  const [manager, setManager] = useState<string | null>(null);
  const choices = tags.filter(tag => tag.trackTime === (kind === 'time') && tag.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const title = kind === 'time' ? '대표 시간 카테고리 선택' : '추가 태그 선택';
  return <><MoaDialog title={title} description={kind === 'time' ? '최대 하나를 골라요. 선택하지 않으면 실제 시간은 미분류로 표시해요.' : '일반 태그는 여러 개 골라도 시간 합계에 더하지 않아요.'} onClose={onClose} saveKeys={[]} footer={<button className="mx-primary" onClick={() => { onChange(selected); onClose(); }}>선택 적용</button>}>
    <div className="mx-search-row"><input aria-label="선택할 태그 검색" placeholder="태그 검색" value={search} onChange={e => setSearch(e.target.value)} /><button onClick={() => setManager('')}><Settings2 size={17} />태그 관리</button></div>
    {kind === 'time' && <button className="mx-option" role="radio" aria-checked={!selected.length} onClick={() => setSelected([])}>선택 안 함 · 미분류{!selected.length && <Check size={17} />}</button>}
    <div className="mx-option-list" role={kind === 'time' ? 'radiogroup' : 'group'} aria-label={title}>{choices.map(tag => <button key={tag.id} className="mx-option" role={kind === 'time' ? 'radio' : 'checkbox'} aria-checked={selected.includes(tag.id)} onClick={() => setSelected(previous => kind === 'time' ? [tag.id] : previous.includes(tag.id) ? previous.filter(id => id !== tag.id) : [...previous, tag.id])}><span className="mx-color-dot" style={{ background: tag.color }} />{tag.name}{selected.includes(tag.id) && <Check size={17} />}</button>)}</div>
    {!choices.length && <p className="mx-help">일치하는 태그가 없어요.</p>}<button className="mx-add-row" onClick={() => setManager(search.trim())}><Plus size={17} />{search.trim() ? `“${search.trim()}” 새 태그 만들기` : '새 태그 만들기'}</button>
  </MoaDialog>{manager !== null && <MoaTagManager initialName={manager} timeCategory={kind === 'time'} onClose={() => setManager(null)} />}</>;
}
export function MoaGoalPicker({ value, onChange, onClose }: { value?: string; onChange: (id?: string) => void; onClose: () => void }) {
  const { weeklyGoals, todos } = usePlanner(); const [search, setSearch] = useState(''); const [selected, setSelected] = useState(value);
  return <MoaDialog title="목표 연결" description="선택 사항이에요. 기존 주간 목표를 연결하거나 해제할 수 있어요." onClose={onClose} saveKeys={[]} footer={<button className="mx-primary" onClick={() => { onChange(selected); onClose(); }}>목표 선택 적용</button>}>
    <input aria-label="연결할 목표 검색" placeholder="목표 검색" value={search} onChange={e => setSearch(e.target.value)} />
    <div role="radiogroup" aria-label="주간 목표"><button className="mx-option" role="radio" aria-checked={!selected} onClick={() => setSelected(undefined)}>연결 안 함{!selected && <Check size={17} />}</button>{weeklyGoals.filter(g => g.text.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(goal => { const progress = weeklyRollup(goal, todos); return <button className="mx-option" key={goal.id} role="radio" aria-checked={selected === goal.id} onClick={() => setSelected(goal.id)}><div><strong>{goal.text}</strong><small>{goal.weekKey} · {progress.pct}% · {progress.mode === 'manual' ? '수동 완료 기준' : `연결 할 일 ${progress.done}/${progress.total}`}</small></div>{selected === goal.id && <Check size={17} />}</button>; })}</div>
    {!weeklyGoals.length && <p className="mx-help">등록한 주간 목표가 없어요. 기존 목표 화면에서 먼저 만들어주세요.</p>}
  </MoaDialog>;
}
