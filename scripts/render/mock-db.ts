/**
 * 렌더 하네스용 db 스텁 — `src/lib/db` 를 이 파일로 리다이렉트한다.
 * store.tsx 가 로드하는 fetchAll/fetch 는 아래 SEED 를 돌려주고,
 * 그 밖의 임의 db.*.*() 호출은 안전한 빈 결과(Promise<[]>)로 흡수한다.
 *
 * 시드 날짜는 브라우저 런타임의 '오늘' 기준으로 동적으로 만든다
 * (getLogicalToday 와 정렬되도록). 12건 이상의 할일에
 * 완료/미완료/기간/늦음/태그유무/중요표시를 섞는다.
 */

// ── 날짜 유틸 ──────────────────────────────────────────────────────────────
const now = new Date();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (n: number) => {
  const x = new Date(now);
  x.setDate(x.getDate() + n);
  return x;
};
const TODAY = iso(now);
const TOMORROW = iso(shift(1));
const DAY_AFTER = iso(shift(2));
const YESTERDAY = iso(shift(-1));
const TWO_AGO = iso(shift(-2));
const IN_3 = iso(shift(3));
const MONTH = TODAY.slice(0, 7);
const YEAR = now.getFullYear();

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
const WEEK_KEY = isoWeekKey(now);

// ── 태그 ──────────────────────────────────────────────────────────────────
const tags = [
  { id: 'tag-work', name: '업무', color: '#C4A882', trackTime: true },
  { id: 'tag-study', name: '공부', color: '#6BAA7A', trackTime: true },
  { id: 'tag-life', name: '생활', color: '#D4735A', trackTime: false },
  { id: 'tag-health', name: '건강', color: '#8FB7C9', trackTime: false },
];

// ── 프로젝트 / 마일스톤 ─────────────────────────────────────────────────────
const projects = [
  { id: 'proj-a', name: '웹모델 리뉴얼', color: '#C4A882', status: 'active' },
  { id: 'proj-b', name: '자기계발', color: '#6BAA7A', status: 'active' },
];
const milestones = [
  { id: 'ms-1', projectId: 'proj-a', title: '디자인 시안 확정', date: IN_3, done: false },
  { id: 'ms-2', projectId: 'proj-a', title: '1차 배포', date: iso(shift(10)), done: false },
];

// ── 목표 (기간별) ───────────────────────────────────────────────────────────
const annualGoals = [
  { id: 'ag-1', year: YEAR, text: '건강한 루틴 정착시키기', done: false },
  { id: 'ag-2', year: YEAR, text: '사이드 프로젝트 런칭', done: false },
];
const quarterlyGoals = [
  { id: 'qg-1', year: YEAR, quarter: Math.floor(now.getMonth() / 3) + 1, text: '운동 주 3회', done: false },
];
const monthlyGoals = [
  { id: 'mg-1', text: '플래너 앱 일간 화면 정비', month: MONTH, annualGoalId: 'ag-2' },
  { id: 'mg-2', text: '책 2권 읽기', month: MONTH, annualGoalId: 'ag-1' },
  { id: 'mg-3', text: '아침 루틴 21일 유지', month: MONTH, annualGoalId: 'ag-1' },
];
const weeklyGoals = [
  { id: 'wg-1', text: '미루기 버그 고치기', done: false, monthlyGoalId: 'mg-1', weekKey: WEEK_KEY },
  { id: 'wg-2', text: '렌더 하네스 상주화', done: true, monthlyGoalId: 'mg-1', weekKey: WEEK_KEY },
  { id: 'wg-3', text: '러닝 3회', done: false, monthlyGoalId: 'mg-3', weekKey: WEEK_KEY },
  { id: 'wg-4', text: '독서 100p', done: false, monthlyGoalId: 'mg-2', weekKey: WEEK_KEY },
];

// ── 할일 (12+; 완료/미완료/기간/늦음/태그유무/중요) ─────────────────────────
const todos = [
  // 오늘 — 다양한 상태
  { id: 't01', text: '매뉴얼 양식 공유', date: TODAY, endDate: TODAY, status: 'done', isTop3: true, tags: ['tag-work'], projectId: 'proj-a', weeklyGoalId: 'wg-1' },
  { id: 't02', text: '웹모델 현황 문의하기', date: TODAY, endDate: TODAY, status: 'active', isTop3: true, tags: ['tag-work'] },
  { id: 't03', text: '아침 스트레칭', date: TODAY, endDate: TODAY, status: 'done', isTop3: false, tags: ['tag-health'] },
  { id: 't04', text: '이메일 회신', date: TODAY, endDate: TODAY, status: 'done', isTop3: false, tags: [] },
  { id: 't05', text: '리액트 훅 공부', date: TODAY, endDate: TODAY, status: 'inProgress', isTop3: true, tags: ['tag-study'], weeklyGoalId: 'wg-4' },
  { id: 't06', text: '장보기 목록 작성', date: TODAY, endDate: TODAY, status: 'active', isTop3: false, tags: ['tag-life'] },
  { id: 't07', text: '회의록 정리', date: TODAY, endDate: TODAY, status: 'active', isTop3: false, tags: [] },
  { id: 't08', text: '물 2L 마시기', date: TODAY, endDate: TODAY, status: 'active', isTop3: false, tags: ['tag-health'] },
  { id: 't09', text: '블로그 초안 쓰기', date: TODAY, endDate: TODAY, status: 'active', isTop3: false, tags: ['tag-study'] },
  { id: 't10', text: '방 청소', date: TODAY, endDate: TODAY, status: 'cancelled', isTop3: false, tags: ['tag-life'] },
  // 기간 할일 (date != endDate) — 오늘 포함
  { id: 't11', text: '분기 보고서 작성', date: TODAY, endDate: IN_3, status: 'active', isTop3: false, tags: ['tag-work'], projectId: 'proj-a' },
  { id: 't12', text: '전시회 준비', date: YESTERDAY, endDate: TOMORROW, status: 'active', isTop3: false, tags: [] },
  // 늦음(overdue) — 과거 날짜인데 미완료
  { id: 't13', text: 'kisti에 일정 미리 연락하기', date: YESTERDAY, endDate: YESTERDAY, status: 'active', isTop3: false, tags: ['tag-work'] },
  { id: 't14', text: '지난주 리뷰 마무리', date: TWO_AGO, endDate: TWO_AGO, status: 'active', isTop3: false, tags: [] },
  // 내일 이후
  { id: 't15', text: '수정된 야근대장 지품에 댓글추가', date: TOMORROW, endDate: TOMORROW, status: 'active', isTop3: false, tags: ['tag-work'] },
  { id: 't16', text: '병원 예약 확인', date: TOMORROW, endDate: TOMORROW, status: 'active', isTop3: false, tags: ['tag-health'] },
  { id: 't17', text: '주간 회고 쓰기', date: DAY_AFTER, endDate: DAY_AFTER, status: 'active', isTop3: false, tags: [] },
].map((t) => ({
  isTop3: false,
  tags: [],
  ...t,
}));

// ── 일정 ────────────────────────────────────────────────────────────────────
const events = [
  // 시각 + track_time 태그(업무/공부) → 시간 리포트·주간 리뷰 시간 스트립에 자동 집계(일정 모달 태그 검증용)
  { id: 'e1', title: '팀 스탠드업', date: TODAY, startTime: '09:30', endTime: '10:00', tags: ['tag-work'], color: '#C4A882' },
  { id: 'e2', title: '점심 약속', date: TODAY, startTime: '12:30', endTime: '13:30', location: '연남동', tags: [], color: '#D4735A' },
  { id: 'e3', title: '디자인 리뷰', date: TODAY, startTime: '15:00', endTime: '16:00', tags: ['tag-study'], color: '#6BAA7A' },
  { id: 'e4', title: '생일', date: TODAY, isAllDay: true, tags: [], color: '#8FB7C9' },
  { id: 'e5', title: '치과', date: TOMORROW, startTime: '11:00', endTime: '11:40', tags: [], color: '#C4A882' },
];

// ── 습관 ────────────────────────────────────────────────────────────────────
const checked = (offsets: number[]) => offsets.map((o) => iso(shift(o)));
const habits = [
  { id: 'h1', name: '물 마시기', checkedDates: checked([0, -1, -2, -4]), habitType: 'check', repeat: 'daily', color: '#8FB7C9', dailyProgress: {}, dailyMemos: {} },
  { id: 'h2', name: '독서', checkedDates: checked([-1, -2, -3]), habitType: 'check', repeat: 'daily', color: '#6BAA7A', dailyProgress: {}, dailyMemos: {} },
  { id: 'h3', name: '운동', checkedDates: checked([0, -2, -5]), habitType: 'check', repeat: 'weekly', weeklyTarget: 3, color: '#D4735A', dailyProgress: {}, dailyMemos: {} },
  { id: 'h4', name: '일기', checkedDates: checked([-1, -3, -6]), habitType: 'check', repeat: 'daily', color: '#C4A882', dailyProgress: {}, dailyMemos: {} },
];

// ── 회고/리뷰 ────────────────────────────────────────────────────────────────
const reviewRecords = [
  { id: 'r1', date: TODAY, types: ['emotion', 'gratitude'], emotion: 4, emotionMemo: '집중이 잘 된 하루', gratitude: ['맑은 날씨', '맛있는 점심'], happiness: '' },
  { id: 'r2', date: YESTERDAY, types: ['kpt'], kptKeep: '아침 루틴 유지', kptProblem: '저녁에 집중력 저하', kptTry: '오후 산책 넣기' },
  { id: 'r3', date: TWO_AGO, types: ['daily'], dailySummary: '전반적으로 무난', dailyGood: '운동함', dailyImprove: '일찍 자기' },
];
const weeklyReviews = [
  { id: 'wr1', weekKey: WEEK_KEY,
    highlights: '금요일 저녁 산책에서 본 노을',
    kptKeep: '아침에 물 먼저 마시기 — 계속 이어가고 싶다',
    notice: '일이 많아서보다 확인 안 한 일이 쌓일 때 더 정신없음',
    kptTry: '하루 끝에 5분 정리 시간 넣어보기',
    nextWeek: '일간 화면 정비 마무리' },
];
const monthlyReviews = [
  { id: 'mr1', month: MONTH, achievement: '일간 화면 리팩터링 시작', nextFocus: '캘린더 정합성' },
];
const happyMoments = [
  { id: 'hm1', content: '오랜만에 친구와 통화', date: TODAY, happenedAt: null, createdAt: now.toISOString() },
  { id: 'hm2', content: '버그 하나 잡음', date: YESTERDAY, happenedAt: null, createdAt: shift(-1).toISOString() },
];

// ── 기타 ────────────────────────────────────────────────────────────────────
const selfCareRecords = [
  { id: 'sc1', date: TODAY, category: 'exercise', content: '홈트 20분', duration: 20 },
  { id: 'sc2', date: YESTERDAY, category: 'study', content: '온라인 강의', duration: 60 },
  { id: 'sc3', date: TWO_AGO, category: 'sleep', content: '수면', duration: 430, sleepStart: '23:40', sleepEnd: '06:50' },
];
const timelineLogs = [
  { id: 'tl1', date: TODAY, time: '09:15', text: '오늘도 화이팅', color: '#C4A882' },
  { id: 'tl2', date: TODAY, time: '14:20', text: '집중이 잘 안 됨', color: '#D4735A' },
];
const routines = [
  { id: 'ro1', name: '모닝 루틴', icon: '☀️', startTime: '07:00', duration: 30, steps: ['기상', '물 한잔', '스트레칭'], checkedDates: checked([0, -1, -2]), repeat: 'daily' },
];

const settings = {
  dayStartHour: 4,
  dayEndHour: 26,
  appSettings: {
    showQuarterlyGoals: true,
    showWeeklyKpt: false,
    showWeeklyHappiness: false,
    showMonthlyKpt: false,
    showHabitHeatmap: true,
    habitAlarmDefault: '',
    globalAffirmation: '오늘 나는 내가 원하는 삶을 만들어가고 있다.',
    weekStartsOn: 1,
    mobileWeekDays: 3,
    annualProfiles: { [String(YEAR)]: { identity: '꾸준한 사람', values: ['건강', '성장', '균형'] } },
    annualIdentity: '꾸준한 사람',
    annualValues: ['건강', '성장', '균형'],
  },
};

// ── SEED 매핑 (store.tsx 가 부르는 namespace.fetch* → 시드) ──────────────────
const SEED: Record<string, any> = {
  todos: todos,
  events: events,
  habits: habits,
  projects: projects,
  milestones: milestones,
  selfCareRecords: selfCareRecords,
  reviewRecords: reviewRecords,
  timelineLogs: timelineLogs,
  weeklyGoals: weeklyGoals,
  monthlyGoals: monthlyGoals,
  annualGoals: annualGoals,
  quarterlyGoals: quarterlyGoals,
  weeklyReviews: weeklyReviews,
  monthlyReviews: monthlyReviews,
  happyMoments: happyMoments,
  tags: tags,
  routines: routines,
  todoTimeBlocks: [],
  brainstormItems: [],
  periodRecords: [],
  habitMonthlyMemos: [],
  // 조각(MemoryPieces) 커버리지 — 모먼트·맛있었던 것(주간·월간·일간 공용 스트립을 실제로 렌더).
  foodRecords: [
    { id: 'fd1', date: TODAY, foodName: '들기름 막국수', tasteRating: 'good', photoUrl: null, mealType: 'lunch' },
  ],
  moments: [
    { id: 'mo1', content: '노을이 예뻤던 저녁 산책', photos: [], is_highlight: true, created_at: now.toISOString() },
  ],
  userSymptoms: [],
  // 컨디션 재설계 검증 시드 — 하루 여러 건/컨디션만/구 기록(null) 시나리오를 모두 담는다.
  conditionRecords: [
    // 오늘: 아침 좋음(스트레스 낮음) → 저녁 나쁨(스트레스 높음). "아침엔 괜찮았는데 저녁에 무너졌다".
    { id: 'c1', date: iso(shift(0)), slot: '아침', condition: 3, stress: 2, symptoms: [], memo: '아침엔 괜찮았다' },
    { id: 'c2', date: iso(shift(0)), slot: '저녁', condition: 1, stress: 5, symptoms: ['두통', '피로'], memo: '저녁에 무너짐' },
    // 어제: 컨디션만(스트레스 없이) 저장.
    { id: 'c3', date: iso(shift(-1)), slot: '낮', condition: 4, stress: null, symptoms: [], memo: '컨디션만 기록' },
    // 그제: 보통.
    { id: 'c4', date: iso(shift(-2)), slot: '아침', condition: 2, stress: 3, symptoms: ['졸림'], memo: null },
    // 구 기록(재설계 전): condition·slot = null, 스트레스만 → "컨디션 기록 없음"으로 표시돼야 함.
    { id: 'c5', date: iso(shift(-3)), slot: null, condition: null, stress: 4, symptoms: ['소화불량'], memo: '예전 기록' },
  ],
};

// ── namespace 프록시 ─────────────────────────────────────────────────────────
// fetchAll → 시드 배열, brainstormMemos.fetchAll → {}, settings.fetch → 객체.
// 그 밖의 메서드(upsert/insert/update/delete/...)는 no-op(Promise<[]>).
function nsProxy(name: string): any {
  return new Proxy(
    {},
    {
      get(_t, method) {
        if (method === 'then') return undefined;
        const m = String(method);
        if (name === 'settings' && m === 'fetch') return async () => settings;
        if (name === 'brainstormMemos' && m === 'fetchAll') return async () => ({});
        if (m === 'fetchAll') return async () => SEED[name] ?? [];
        // 배열을 돌려줘야 하는 조회들(목록·기간·이력 등) → []
        if (/All|^list|Many|Dates|Between|History|Logs|Items|Range|^search/.test(m)) {
          return async () => SEED[name] ?? [];
        }
        // 단건 조회(summaryForDate/fetch*/get*/find*/count* 등)와 액션 → null
        // (summaryForDate 등은 "데이터 없음 = null" 계약이므로 [] 를 주면 truthy 로 오인됨)
        return async () => null;
      },
    }
  );
}

export const db: any = new Proxy(
  {},
  {
    get(_t, ns) {
      if (ns === 'then') return undefined;
      return nsProxy(String(ns));
    },
  }
);

// db.ts 의 value export 재현 (import { exerciseLabel } 대비)
export const exerciseLabel = (e: any): string => (e && (e.nameKo || e.nameEn)) || '';

export default db;
