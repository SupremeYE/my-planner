# PROGRESS_LOG.md — My Planner 진행 현황

> 사용법:
> - `todo로 넣어줘: [내용]` → 오늘 날짜 TODO에 추가
> - `진행현황 기록` → 오늘 작업 내용을 이 파일에 저장

---

## 2026-03-21

### 📋 TODO
- [ ] 스마트 알림 시스템 구현 (습관 알림 + 할일 사전 알림)

### ✅ 완료
- ✅ 주간 칸반 보드 드래그앤드롭 구현 (@dnd-kit/core)
- ✅ PROGRESS_LOG.md 초기 생성 및 GitHub 커밋
- ✅ PROJECT_SPEC.md 최신화 (2026-03-21 기준)
- ✅ CLAUDE.md 단축 명령어 규칙 추가 (todo로 넣어줘 / 진행현황 기록)

### 🛠 오늘 작업 내용
- PROJECT_SPEC.md: 알림 시스템 관련 미구현 항목 반영, 초기 생성
- PROGRESS_LOG.md: 파일 신규 생성
- WeeklyView.tsx: @dnd-kit/core 기반 드래그앤드롭 전면 적용
  - DraggableTodoCard (useDraggable), DayColumn (useDroppable), OverlayCard (DragOverlay) 추가
  - 드롭 시 updateTodo → Supabase 즉시 저장
  - PointerSensor distance:5 으로 클릭/드래그 구분
- PROJECT_SPEC.md: 날짜 업데이트, 버그 라인번호 수정, 드래그앤드롭 구현 완료 반영, @dnd-kit 스택 추가
- CLAUDE.md: PROGRESS_LOG.md 명령어 2종 규칙 추가

---
