# Overnight Sprint Plan

## Phase 1: PathFinding.js integration -- DONE v6.0.0
- [x] npm install pathfinding@0.4.18 + @types/pathfinding
- [x] Rewrite PathGrid.ts to use PF.AStarFinder with allowDiagonal + dontCrossCorners
- [x] Remove BFS flowfield code
- [x] Direction cache per tile (invalidated on structure change)
- [x] Kept stuck-nudge as safety net (600ms no-movement -> random nudge)

## Phase 2: Fix remaining bugs -- DONE v6.1.0
- [x] zombie-killed null source: DOT trap attribution via position check
- [x] Pickup log spam: max 3 messages per night
- [x] Pickup labels: smaller, muted color

## Phase 3: Polish -- DONE v6.1.0
- [x] Crafting: Improvised Plate + Trash Can Lid recipes
- [x] Blueprint discovery shows unlock list
- [x] Trap combo tutorial hint on first combo
- [ ] More loot destinations per zone (deferred)
- [x] Settings menu: Master/SFX/Music volume + mute toggles

## Phase 4: Verify everything -- DONE v6.1.0
- [x] npx tsc --noEmit (0 errors)
- [x] npm run lint (0 warnings)
- [x] npx vitest run (1127/1127 tests pass)
- [x] npm run build (production build succeeds)
- [ ] Full playthrough: Forest nights 1-5 (needs manual testing)
- [ ] Verify save persists across reload (needs manual testing)
- [ ] Verify traps do damage (needs manual testing)
- [ ] Verify armor reduces damage (needs manual testing)
