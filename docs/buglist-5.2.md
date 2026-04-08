# Bug List v5.2 -- Stabilitetssprint

## KRITISKA (gameplay broken):
- [ ] Armor/shield drops: LootManager saknar rollArmorDrop/rollShieldDrop
- [ ] Equipment: no way to equip SECONDARY weapon (click always goes to primary)
- [ ] Barricades seem to do nothing (slow effect not visible)
- [ ] Zombies can't navigate around walls (PathGrid steering insufficient)

## HUD/UI (visual glitches):
- [ ] Top bar: BASE text overlaps HP bar
- [ ] Top bar: minimap sticker ut utanfor
- [ ] Top bar: wave subtext "Wave 4/4 -- 3 left" overflows panel
- [ ] Top bar: unknown grey bar visible
- [ ] Stamina bar visible when it shouldn't be?

## DAY UI:
- [ ] "Outpost" text overlaps UPGRADE button (text on text, screenshot)
- [ ] "Outpost!" upgrade success text appears BEHIND upgrade button
- [ ] ZONE label overlaps with base level name
- [ ] UPGRADE button should be removed -- base upgrade should be via clicking the base (like other structures)
- [ ] Base level name shown twice (top-right corner AND as floating text)

## NIGHT GAMEPLAY:
- [ ] Walls don't stop bosses/brutes (they should take damage but not pass through instantly)
- [ ] Barricade slow effect not noticeable
- [ ] Zombies still can't pathfind around walls effectively

## INVENTORY:
- [ ] Weapons found on loot runs don't appear in Equipment panel (panel shows stale data, needs rebuild on inventory change)
- [ ] Frying Pan and other new weapons confirmed in loot-tables.json but not showing
- [ ] No SCRAP button per weapon in inventory left panel (can only scrap common bulk)
- [ ] Hover comparison overlay covers the next weapon row (needs offset or transparent bg)
- [ ] Right panel text cut off at edge (visible in screenshot -- stats truncated)

## BEKRAFTADE FIXADE:
- [x] Traps do no damage (SpatialGrid instanceof bug) -- v5.0.1
- [x] Walls don't block zombies (createGroups order) -- v4.9.2
- [x] DOT traps show "-0" damage numbers -- v5.2.1
- [x] Equipment panel overflow -- v5.2.0 (dual panel rewrite)
