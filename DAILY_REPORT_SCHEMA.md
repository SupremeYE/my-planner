# DAILY_REPORT_SCHEMA.md — 저녁 Discord 리포트 명세

> 최종 업데이트: 2026-06-03 (문화 기록 섹션 추가 — Stage 4)

매일 저녁 자동으로 Discord 채널에 전송되는 "오늘의 리포트" 명세서.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| Edge Function | `supabase/functions/daily-report/index.ts` (`Deno.serve` 핸들러) |
| 호출 방식 | pg_cron job `daily-report-evening` → `net.http_post` 로 함수 URL 호출 |
| 스케줄 | `59 14 * * *` (UTC) = **매일 23:59 KST** |
| (선택) 아침 | `daily-report-morning` cron은 README에 주석 처리됨. **별도 함수 없음 — 동일 `daily-report` 함수를 호출** |
| 메시지 형식 | **plain text** (Discord webhook `content` 필드, Markdown 일부). embed 미사용. **1 메시지** |
| 길이 한도 | Discord 2000자. 문화 섹션 발췌 길이로 1900자 이하 방어 |
| 타임존 | KST(UTC+9). `kstNowInfo()`가 오늘 `yyyy-MM-dd`(KST) 산출 |
| 전송 실패 | webhook 미설정/실패 시 HTTP 500 반환, 섹션별 `try/catch`로 부분 실패 격리 |

### 환경변수
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Edge Function 자동 주입 (RLS 우회 조회)
- `DISCORD_WEBHOOK_URL` — `supabase secrets set` 으로 등록

---

## 2. 섹션 순서

```
📋 오늘의 리포트 (yyyy-MM-dd 요일)
🕘 HH:mm 기준

**할일** — done/total 완료
**습관 체크** — done/total 완료
**오늘 일정**            (events)
**식단**                 (food_records)
**감정**                 (mood_records)
**독서**                 (reading_logs + books)
🎬 오늘의 문화 기록       (culture_records)   ← Stage 4 신규
오늘도 수고했어요 🌙
```

> 섹션 사이는 빈 줄(`''`) 1개로 구분.

---

## 3. 타임존 / 날짜 경계 처리

| 컬럼 유형 | 처리 |
|-----------|------|
| `date` text 컬럼 (todos/food/mood/reading) | `.eq('date', today)` — today는 KST `yyyy-MM-dd` |
| `events.start_at` (KST 벽시계 text) | `[today T00:00:00, tomorrow T00:00:00)` 문자열 범위 |
| **`culture_records.created_at` (실제 timestamptz/UTC)** | **KST 하루 경계를 UTC ISO로 변환해 범위 조회** (아래 4장) |

---

## 4. "오늘의 문화 기록" 섹션 (Stage 4)

### 4-1. 데이터 쿼리
- 테이블: `culture_records`
- 조건: `created_at >= 오늘 00:00 KST` AND `created_at < 내일 00:00 KST`
  - `created_at`은 UTC timestamptz이므로 KST 경계를 UTC로 환산:
    ```ts
    const startUtc = new Date(`${today}T00:00:00+09:00`).toISOString();
    const endUtc   = new Date(`${kstTomorrow(today)}T00:00:00+09:00`).toISOString();
    .gte('created_at', startUtc).lt('created_at', endUtc)
    ```
- 정렬: `created_at ASC` (기록한 순서)
- **상태 필터 없음** — watchlist/watching/completed/dropped 모두 포함
- RLS 우회: service role 키 사용 (단일 사용자 앱이라 user_id 추가 필터 없이 전체 조회)

### 4-2. 메시지 포맷
```
🎬 **오늘의 문화 기록 (N개)**

[상태아이콘] [플랫폼] 제목  ⭐ N.N
  💬 리뷰 발췌
  💡 인사이트 발췌

[상태아이콘] [플랫폼] 제목
  ...
```
- 헤더 아래 빈 줄 1개, 항목 사이 빈 줄 **2개**(가독성 위해 여백 확보)
- 별점 `⭐ N.N`(`toFixed(1)`)은 **status가 completed 또는 dropped이고 rating이 있을 때만**. watchlist/watching은 별점 줄 생략
- `💬 리뷰` / `💡 인사이트`는 값이 있을 때만 각각 출력

### 4-3. 상태 아이콘 매핑
| status | 아이콘 |
|--------|:------:|
| watchlist | 🔖 |
| watching | ▶️ |
| completed | ✅ |
| dropped | ❌ |

### 4-4. 플랫폼 한글 매핑
| platform | 표기 |
|----------|------|
| netflix | 넷플릭스 |
| youtube | 유튜브 |
| disney_plus | 디즈니+ |
| coupang_play | 쿠팡플레이 |
| tving | 티빙 |
| watcha | 왓챠 |
| theater | 극장 |
| other | 기타 |

### 4-5. 길이 관리 규칙
- `review` / `insight` 발췌: 기본 **최대 80자**, 초과 시 `…` 부착
- 표시 항목: 최대 **8개**(`CULTURE_MAX_ITEMS`). 초과 시 마지막에 `… 외 N개 더`
- **총량 방어**: 전체 메시지가 1900자 초과 시 발췌 길이를 **80 → 40 → 0(발췌 줄 생략)** 순으로 단계 축소(`compose(limit)` 재구성). 항목 헤더(상태·플랫폼·제목·별점)는 항상 유지

### 4-6. 빈 상태 처리
- 기존 섹션 패턴(식단/감정/독서)과 동일하게 **섹션을 생략하지 않고 헤더 + 안내 문구 표시**:
  ```
  🎬 **오늘의 문화 기록** — 오늘은 기록된 문화 활동이 없습니다
  ```
- 조회 실패 시: `🎬 **오늘의 문화 기록** — 데이터 불러오기 실패`

### 4-7. 출력 예시

**0개 (빈 상태)**
```
🎬 **오늘의 문화 기록** — 오늘은 기록된 문화 활동이 없습니다
```

**2개**
```
🎬 **오늘의 문화 기록 (2개)**
✅ 넷플릭스 오징어 게임 시즌2  ⭐ 4.5
  💬 긴장감이 끝까지 유지된다. 연출이 특히…
  💡 시스템과 개인의 선택에 대해 다시 생각하게 됨

🔖 유튜브 리액트 성능 최적화 강의
```

**9개 (8개만 표시 + 외 N개)**
```
🎬 **오늘의 문화 기록 (9개)**
✅ 넷플릭스 콘텐츠1  ⭐ 5.0
  💬 ...
▶️ 티빙 콘텐츠2
... (8번째까지)

… 외 1개 더
```

---

## 5. 코드 위치 요약
- 매핑 상수: `CULTURE_STATUS_ICON`, `CULTURE_PLATFORM_KR`, `CULTURE_MAX_ITEMS`
- 조회: `fetchCultureRows(supabase, today)` → `{ rows, failed }`
- 포맷: `formatCultureSection(result, excerptLimit)` → `string[]`
- 발췌: `cultureExcerpt(text, limit)`
- 조립: 핸들러에서 `compose(excerptLimit)` 로 독서 다음 + 응원 문구 앞에 삽입, 1900자 방어

---

## 6. 배포 / 테스트

```bash
# 재배포
supabase functions deploy daily-report

# 수동 호출 (anon key 필요)
curl -i -X POST \
  "https://kfvijixulsvxelmmqzpm.supabase.co/functions/v1/daily-report" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json"
```

테스트 시나리오: ① 0개 → 빈 상태 문구 ② 1~2개 → 정상 출력 ③ 긴 리뷰/인사이트 → 80자 `…` 발췌 ④ 9개 이상 → `… 외 N개 더`
