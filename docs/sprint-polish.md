# Dead Horizon -- Polish Sprint Plan

## User feedback themes (repeated issues):
1. Panel overflow -- equipment panel STILL doesn't paginate properly in all cases
2. Consistency -- glass shards glow vs other traps don't, font sizes vary
3. Discoverability -- refugees, trap combos, systems not explained
4. Navigation -- too many clicks to scroll through 20+ items
5. Visual polish -- post-apocalyptic feel needs work, lighting, color
6. Balance -- some traps much better than others, early game limited
7. Depth -- trap combos, synergies not leveraged

## Sprint phases:

### Phase 1: EVALUATE (research + analysis) -- COMPLETED v4.9.0
- [x] Audit all panels for overflow/clipping issues
- [x] Audit trap balance (damage per scrap cost ratio)
- [x] Audit build menu categories (count items per tab)
- [x] Audit visual consistency (glow effects, colors, fonts)
- [x] Research post-apocalyptic color palettes
- [x] Research trap combo mechanics in similar games

### Phase 2: PLAN (design solutions) -- COMPLETED v4.9.0
- [x] Design page-based navigation for long lists
- [x] Design trap combo system
- [x] Design improved color palette
- [x] Design pickup notification visuals
- [x] Design refugee tutorial/explanation
- [x] Plan trap rebalancing

### Phase 3: IMPLEMENT (code changes) -- COMPLETED v4.9.0
- [x] Fix ALL panel overflow with page-based nav
- [x] Implement trap combos (knockback -> damage zone = COMBO +50%)
- [x] Apply post-apocalyptic color grading (subtle overlay)
- [x] Add pickup ping/notification visuals (GameLog message)
- [x] Rebalance trap categories (Propane/Spring nerfed, Harvester buffed)
- [x] Add refugee explanation in UI (help text + total bonuses)
- [x] Standardize glow/visual effects on basic traps
- [x] Fix starting trap availability (11 items at Tent, sorted by cost)
- [x] 4-tab build menu (BASIC/MACHINES/WALLS/SPECIAL)
- [x] Sort by cost (cheapest first)

### Phase 4: VERIFY (round 2) -- IN PROGRESS v4.9.1
- [ ] Verify all panels compile and display correctly
- [ ] Verify BuildMenu 4 tabs + categorization
- [ ] Verify dawn animation z-ordering
- [ ] Verify refugee migration for old saves
- [ ] Verify Night HUD in endless mode
- [ ] Verify keyboard nav in all panels
- [ ] Verify all sounds play correctly
- [ ] Verify SaveManager migration completeness
- [ ] Code quality cleanup
