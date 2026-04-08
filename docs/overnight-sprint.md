# Overnight Sprint Plan

## Phase 1: PathFinding.js integration -- DONE v6.0.0
- [x] npm install pathfinding@0.4.18 + @types/pathfinding
- [x] Rewrite PathGrid.ts to use PF.AStarFinder with allowDiagonal + dontCrossCorners
- [x] Remove BFS flowfield code
- [x] Direction cache per tile (invalidated on structure change)
- [x] Kept stuck-nudge as safety net (600ms no-movement -> random nudge)

## Phase 2: Fix remaining bugs
- [ ] zombie-killed null _currentKillSource warnings -- find missing attribution
- [ ] GameLog "SUPPLY CRATE appeared!" spam -- limit to 1 per type per wave
- [ ] Pickup labels too large on map -- reduce font size

## Phase 3: Polish
- [ ] Crafting recipes for armor/shields (not just loot drops)
- [ ] Blueprint discovery text: show what traps they unlock
- [ ] Trap combo tutorial hint on first combo
- [ ] More loot destinations per zone (City/Military unique locations)
- [ ] Settings menu (volume control, mute toggle)

## Phase 4: Verify everything
- [ ] Full playthrough: Forest nights 1-5
- [ ] Check all panels fit (equipment, build, loot, craft, refugee)
- [ ] Verify save persists across reload
- [ ] Verify traps do damage
- [ ] Verify armor reduces damage
- [ ] npx tsc --noEmit && npm run lint && npx vitest run
