# 운동 종목 한글명(name_ko) 일괄 채움 — 검수 리스트

> 생성: 2026-06-08 · 대상: `exercises` 중 `name_ko IS NULL` 이던 카탈로그 865개(free-exercise-db)
> 번역 결과는 `scripts/exercise-name-ko.seed.json` 에 기록(멱등 적용: `name_en` 매칭 + `name_ko IS NULL` 조건).

## 요약 지표
| 항목 | 값 |
|------|----|
| 전체 종목 | 874 |
| name_ko 채워짐 | 874 (100%) |
| 번역 실패(여전히 null) | **0** |
| name_ko == name_en (사실상 미번역) | **0** |
| 길이 이상치(>30자 또는 빈 값) | **0** |
| name_ko 에 라틴 알파벳 3자 이상 잔존 | 13 (전부 `SMR` 약어 — 허용) |
| "스쿼트" 한글 검색 매칭 | 56 (작업 전 1) |

## 수동 점검 권장 목록

### 라틴 알파벳 잔존 (모두 약어 — 그대로 두어도 무방)
`SMR`(self-myofascial release, 폼롤링)·`EZ바`·`JM`·`T바`·`V바` 는 한국 헬스장에서도 약어로 통용되어 음차하지 않고 유지함.

- 광배근 SMR ← Latissimus Dorsi-SMR
- 능형근 SMR ← Rhomboids-SMR
- 대퇴사두근 SMR ← Quadriceps-SMR
- 목 SMR ← Neck-SMR
- 발바닥 SMR ← Foot-SMR
- 비골근 SMR ← Peroneals-SMR
- 상완근 SMR ← Brachialis-SMR
- 이상근 SMR ← Piriformis-SMR
- 장경인대 SMR ← Iliotibial Tract-SMR
- 전경골근 SMR ← Anterior Tibialis-SMR
- 종아리 SMR ← Calves-SMR
- 햄스트링 SMR ← Hamstring-SMR
- 허리 SMR ← Lower Back-SMR

(그 외 `EZ바 컬`, `라잉 T바 로우`, `V바 풀다운/풀업`, `트라이셉스 푸시다운 (V바)` 등도 약어 1회 포함 — 정상)

### 번역 실패 / 미번역 / 이상치
- 없음.

## 비고
- 이미 한글명이 있던 스타터 9개(바벨 스쿼트·루마니안 데드리프트·바벨 힙쓰러스트·랫풀다운·벤치프레스·숄더프레스·러닝·사이클·요가)는 건너뜀(멱등).
- 재실행 시 `name_ko IS NULL` 조건으로 이미 채워진 행은 다시 건드리지 않음.
- 검색은 `db.workouts.search` 가 `name_ko ilike OR name_en ilike OR equipment OR primary_muscles` 로 매칭 → 한글/영어 모두, custom·미채택 종목도 영어로 안전하게 검색됨.
