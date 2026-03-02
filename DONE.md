# DONE — Tetris Web Game

## Feature Summary

### P0 (All implemented)
- All 7 tetrominoes with correct SRS rotation states
- SRS wall kicks (separate I-piece and JLSTZ tables)
- Ghost piece (semi-transparent landing preview)
- Hard drop (Space) with 2pts/cell scoring
- Soft drop (↓) with 1pt/cell scoring
- Hold piece (C/Shift) — one swap per piece
- Next 3 pieces preview
- 7-bag randomizer (Fisher-Yates)
- Line clear scoring: single/double/triple/tetris × level
- Combo scoring (50 × combo × level)
- Level progression every 10 lines
- Gravity speed curve (Tetris Guideline formula)
- Lock delay (500ms) with move/rotate reset (max 15)
- DAS (167ms) / ARR (33ms) for smooth movement
- Start / Pause / Game Over screens
- Line clear flash animation
- Game state machine (start → playing → paused → gameover)

### P1 (All implemented)
- T-spin detection (3-corner rule with mini distinction)
- T-spin scoring bonuses
- Back-to-back bonus (1.5× for consecutive tetris/T-spin)
- Level-up visual notification
- Action text feedback (SINGLE, DOUBLE, TRIPLE, TETRIS!, T-SPIN, COMBO, B2B)

### P2 (Implemented)
- High score persistence (localStorage)

## Issues Found & Fixed During Review
1. **MAJOR — T-spin detection fallthrough bug**: detectTSpin() returned full T-spin on fallthrough when 3+ corners filled but front corners weren't both filled and no kick used. Fixed to return null.
2. **MAJOR — Action/level-up text invisible**: CSS used .is-visible class for opacity, but JS never toggled the class. Added classList.add/remove('is-visible').
3. **MINOR — Missing action labels for 1-3 line clears**: Only Tetris showed label text. Added SINGLE/DOUBLE/TRIPLE labels.

## Known Limitations
- No mobile/touch controls (P2 feature not implemented)
- No devicePixelRatio handling (canvas may look slightly blurry on HiDPI)
- Soft drop via gravity accumulator may slightly over-award points (documented in lessons.md)
- No resize handling — canvas size is fixed at init
- Math.random() used for bag shuffle (fine for a game)

## Potential Future Improvements
- Touch/swipe controls for mobile
- devicePixelRatio-aware canvas rendering
- Sound effects and music
- Configurable key bindings
- Replay system
- Online leaderboard
- 180° rotation support
- Perfect clear detection and scoring
