# tasks/lessons.md — Tetris game.js implementation

## [2026-03-02] ROWS 상수 정의 주의

**실수**: ROWS=20으로 시작할 뻔함 (DESIGN.md에 22로 명시).
**근본 원인**: 제목에 "20×10"이 반복되어 22(hidden rows 포함)를 놓칠 뻔.
**규칙**: 보드 높이 상수 정의 전 DESIGN.md의 "Board State" 섹션을 명시적으로 확인한다.

## [2026-03-02] 가시 행 오프셋 렌더링

**실수**: board row 0이 화면 row 0에 대응된다고 가정하기 쉬움.
**근본 원인**: 내부 board는 22줄이나 캔버스는 20줄만 그린다.
**규칙**: 렌더링 시 `visRow = boardRow - (ROWS - VISIBLE_ROWS)` 계산을 반드시 사용한다. 음수 visRow는 hidden zone이므로 skip.

## [2026-03-02] initState에서 phase 덮어쓰기 순서

**실수**: initState() 내부에서 spawnPiece() 호출이 phase='playing'을 가정하는 코드를 트리거할 수 있음.
**근본 원인**: init() 흐름이 phase='start' → initState() → phase 재설정 순서여야 함.
**규칙**: init()에서 initState() 호출 직후 state.phase를 원하는 값으로 명시적으로 재설정한다.

## [2026-03-02] 락 딜레이 vs 중력 타이머 분리

**실수**: gravityTimer와 lockTimer를 하나로 합치면 소프트드롭 시 lock이 즉시 발생.
**근본 원인**: 중력과 락 딜레이는 독립 타이머가 필요.
**규칙**: gravityTimer(중력 누산)와 lockTimer(표면 접지 누산)를 항상 분리된 변수로 관리한다.

## [2026-03-02] T-spin 3-corner rule front/back 코너 인덱스

**실수**: rotation state별 front corners 인덱스를 직접 계산하면 혼란.
**근본 원인**: 4개의 rotation state가 각각 다른 방향의 T bump를 가짐.
**규칙**: frontIndices = {0:[0,1], 1:[1,3], 2:[2,3], 3:[0,2]} 형태의 룩업 테이블로 명시적으로 정의한다.

## [2026-03-02] 일시정지 후 lastTimestamp 리셋

**실수**: 일시정지 후 resumeGame()에서 lastTimestamp를 null로 초기화하지 않으면 긴 dt가 발생해 중력이 순간 점프.
**근본 원인**: rAF timestamp는 탭이 백그라운드에 있어도 계속 증가.
**규칙**: resumeGame() 및 탭 복귀 시나리오에서 lastTimestamp = null로 리셋하여 첫 프레임 dt를 0으로 만든다.

---

## [2026-03-02] T-spin fallthrough bug — last return must be null, not full T-spin

**Mistake**: `detectTSpin()` returned `{ isTSpin: true, isMini: false }` as default when 3+ corners filled but front corners weren't both filled and no kick was used. This incorrectly awarded full T-spin scores.

**Root Cause**: Copy-paste of the full T-spin return value into the fallthrough case.

**Rule**: When a detection function has multiple qualifying conditions, the final fallthrough should return the "not detected" case (null), not the most generous match.

---

## [2026-03-02] CSS class-based visibility requires JS to toggle classes

**Mistake**: CSS defined `.is-visible` for action/level-up text opacity transitions, but JS only set `textContent` without adding/removing the class. Text was always invisible (opacity: 0).

**Root Cause**: CSS and JS were written by different passes and the integration was never tested visually.

**Rule**: When CSS uses class-based visibility (opacity transitions), always verify the JS toggles the corresponding class. Search for the class name across both CSS and JS files before declaring done.
