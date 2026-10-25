import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { WeeklyReview } from '../../../store';
import type { WeeklyReviewController } from '../../../hooks/useWeeklyReviews';
import { reviewFields, reviewText, type ReviewField } from '../../../../lib/weeklyReviewRepository';
import { saveIntent } from '../../../../lib/saveCoordinator';
import { MoaDialog } from '../MoaDialog';

const labels: Record<ReviewField, [string, string]> = {
  highlights: ['기억하고 싶은 일', '이번 주 특별히 기억하고 싶은 일'],
  kptKeep: ['잘한 점 · KEEP', '잘했거나 계속 유지하고 싶은 일'],
  notice: ['아쉬웠던 점 · NOTICE', '이번 주 느낀 점, 문제점, 새롭게 발견한 점'],
  kptTry: ['다음에 시도할 점 · TRY', '다음에 다르게 해보고 싶은 일'],
  nextWeek: ['다음 주 계획 · NEXT', '다음 주에 할 일이나 집중할 것'],
};

export function WeeklyReviewEditor({ record, weekKey, period, controller, reference, onClose, onSaved }: {
  record?: WeeklyReview; weekKey: string; period: string; controller: WeeklyReviewController;
  reference: ReactNode; onClose: () => void; onSaved: (record: WeeklyReview) => void;
}) {
  const [initial] = useState(() => record ? structuredClone(record) : undefined);
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const [draft, setDraft] = useState(() => reviewText(initial));
  const [discard, setDiscard] = useState(false), [viewport, setViewport] = useState<CSSProperties>({});
  const inFlight = useRef(false);
  const state = controller.states.find(value => value.key === `weeklyReviews:${id}`);
  const busy = state?.status === 'saving', locked = busy || state?.status === 'error';
  const dirty = saveIntent(draft) !== saveIntent(reviewText(initial));
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);
  useEffect(() => {
    // The visual viewport shrinks with an on-screen keyboard even when 100dvh does not.
    const view = window.visualViewport;
    const update = () => {
      if (!view) return;
      const mobile = window.innerWidth < 768;
      setViewport({ maxHeight: `${view.height - 16}px`, top: mobile ? `${view.offsetTop + view.height - 8}px` : `${view.offsetTop + view.height / 2}px`,
        bottom: 'auto', left: mobile ? 0 : '50%', transform: mobile ? 'translateY(-100%)' : 'translate(-50%, -50%)' });
    };
    update(); view?.addEventListener('resize', update); view?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => { view?.removeEventListener('resize', update); view?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);
  function close() {
    if (busy || inFlight.current) return;
    if (dirty || state?.status === 'error') { setDiscard(true); return; }
    onClose();
  }
  async function submit(event?: FormEvent, retry = false) {
    event?.preventDefault();
    if (inFlight.current || busy || (!retry && locked)) return;
    inFlight.current = true;
    try {
      const result = retry ? await controller.retry(id) : await controller.save({
        ...initial, id, weekKey: initial?.weekKey ?? weekKey, ...draft,
      }, initial);
      if (result) onSaved(result as WeeklyReview);
    } finally { inFlight.current = false; }
  }
  return <MoaDialog title="주간 회고" description={`${period} · 모든 항목은 선택 입력이에요.`} onClose={close} saveKeys={[]}
    className="mw-dialog" style={viewport} footer={discard ? <div className="mw-discard" role="alert">
      <p>저장하지 않은 입력을 닫을까요?{state?.status === 'error' && ' 저장 확인에 실패한 요청은 서버에 반영됐을 수 있어요.'}</p>
      <div className="mx-actions"><button onClick={() => setDiscard(false)}>계속 작성</button><button onClick={() => { controller.dismiss(id); void controller.refresh(); onClose(); }}>입력 닫기</button></div>
    </div> : <>
      {state && <div role={state.status === 'error' ? 'alert' : 'status'} className="mw-feedback">
        <p>{busy ? '저장 결과를 확인하고 있어요…' : state.status === 'saved' ? '저장을 확인했어요.' : state.message}</p>
        {state.status === 'error' && <><p>입력은 유지돼요. 아래 내용을 복사해 보관할 수도 있어요.</p>{state.retryable
          ? <button onClick={() => void submit(undefined, true)}>재시도</button>
          : <button onClick={() => { controller.dismiss(id); void controller.refresh(); }}>입력 다시 확인</button>}</>}
      </div>}
      <div className="mx-actions"><button disabled={busy} onClick={close}>닫기</button><button form="weekly-review-form" type="submit" className="mx-primary" disabled={locked}>{busy ? '저장 중…' : '저장'}</button></div>
    </>}>
    <details className="mw-reference"><summary>이번 주 기록 참고하기</summary>{reference}<p>참고 정보는 회고 본문에 자동으로 입력되지 않아요.</p></details>
    <form id="weekly-review-form" className="mw-form" onSubmit={submit}>
      {reviewFields.map(key => <label key={key}><span>{labels[key][0]}</span><small id={`weekly-help-${key}`}>{labels[key][1]}</small>
        <textarea aria-label={labels[key][0]} aria-describedby={`weekly-help-${key}`} rows={3} value={draft[key]} readOnly={locked}
          onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))} />
      </label>)}
    </form>
  </MoaDialog>;
}
