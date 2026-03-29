# Dead Horizon -- Session Handoff

**Generated:** 2026-03-29
**Version:** 1.6.0
**Last commit:** fe71143 (Fix shooting crash: guard against dead target zombie)
**Live URL:** https://skugg4n.github.io/dead-horizon/

---

## Project

Dead Horizon is a web-based top-down wave defense / base builder / roguelite game.
- **Repo:** ~/Projects/dead-horizon (GitHub: Skugg4n/dead-horizon, private)
- **Stack:** Phaser 3 + TypeScript (strict) + Vite + Vitest + ESLint
- **CI/CD:** GitHub Actions -> GitHub Pages (auto-deploy on push to main)

## What works (v1.6.0)

- Full day/night cycle with 12 AP management phase
- Player movement (WASD), auto-shoot, sprint, stamina
- 5 weapon classes (melee, pistol, rifle, shotgun, explosives) with durability + XP
- 6 enemy types (walker, runner, brute, spitter, screamer, brute_boss)
- Wave system (5 waves per zone, escalating difficulty)
- Building system (barricade, wall, trap, pillbox, storage, shelter, farm)
- Resource system (scrap, food, ammo, parts, meds) with daily consumption
- Refugee system (arrival, job assignment, pillbox manning, healing)
- Loot runs with encounters (fight/flee)
- Skill system (10 skills, use-based XP progression)
- Character select (4 characters with starting bonuses)
- Save/load via localStorage with migration for old saves
- Procedural audio (weapon sounds, zombie groans, ambient, UI clicks)
- 47 pixel art sprites
- Zones (forest, city, military) with unique wave files
- Crafting system
- Achievement system
- Random day events
- Onboarding tutorials (night phase + day phase)
- Settings panel (SFX/ambient/volume toggles)

## Agent Teams setup

Enabled and ready:
- `.claude/settings.json` has `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"`
- `~/.claude.json` has `teammateMode: "in-process"`
- Playwright MCP tools are permitted in settings.json

---

## BUGS TO FIX (Priority: Critical)

### B1: Shooting crash (partially fixed but may still occur)
- Crash at first shot in Wave 2+
- Added `!target.active` guard in shootAt but root cause may be deeper
- Could be related to zombie dying between tryAutoShoot detection and shootAt call
- Files: `src/scenes/NightScene.ts` (tryAutoShoot, shootAt)
- **Test:** Start game, play to wave 2, shoot zombies. Should never crash.

### B2: Continue button crash
- SaveManager.load() now merges with defaults for missing fields
- STILL CRASHES for some users -- needs deeper investigation
- Likely: a Manager constructor accesses a save field that migration doesn't cover
- Files: `src/systems/SaveManager.ts` (load function), `src/scenes/DayScene.ts` (create)
- **Test:** Set old-format save in localStorage, click Continue. Must not crash.

### B3: Pillbox refugees not dealing damage
- Pillboxes with assigned refugees should auto-shoot nearby zombies during night
- Currently appears to do nothing
- Files: `src/scenes/NightScene.ts` (setupPillboxRefugees, pillboxAssignments update loop)
- **Test:** Place pillbox, assign refugee to it in DayScene, verify it shoots in NightScene.

---

## FEATURES TO BUILD (Priority: High)

### F1: Cooler zombie death effects
- Current: zombie just disappears with a blood particle
- Wanted: death animation, body stays briefly, maybe a splatter sprite
- Files: `src/entities/Zombie.ts` (die method), `src/scenes/NightScene.ts` (zombie-killed event)

### F2: Persistent blood splatters on ground
- Blood particles currently fade away
- Should leave permanent marks on the ground that persist for the rest of the night
- Approach: on zombie death, draw a small blood splat Graphics at zombie position on a low-depth layer
- Files: `src/scenes/NightScene.ts`

### F3: Base health bar
- Base has no visible HP indicator during night
- Zombies now walk toward base (v1.6.0 aggro change) but player can't see base HP
- Add an HP bar above the base structure in NightScene
- Files: `src/scenes/NightScene.ts`, `src/ui/HUD.ts`

### F4: More procedural sounds (comprehensive list)
Existing sounds that need VERIFICATION (may not actually play):
- Structure destroyed (structure_break exists in AudioManager but may not be triggered)
- Wave complete fanfare (wave_clear exists but verify)
- Loot pickup (loot_pickup exists but verify)

NEW sounds to generate in AudioManager:
- Footstep sound when player walks (soft, varied pitch, tied to movement)
- Melee hit "thud" on contact (not just the swing whoosh)
- Zombie attack sound when zombie hits player (guttural slap)
- Zombie spawn groan (play when zombie first appears, random pitch)
- Structure taking damage (creaking/cracking, different from break)
- Ammo loading click (metallic, plays in DayScene when loading weapons)
- Panel/door open sound (subtle UI sound for opening menus)
- Refugee arrival chime (positive, subtle)
- Day-to-night transition whoosh (dramatic)
- Night-to-day transition (relief, lighter)

AMBIENT improvements:
- Night ambient: darker tone, occasional distant zombie moaning
- Day ambient: more bird variation, wind changes subtly over time
- Different ambient per zone (forest vs city vs military)
- Ambient should react to wave intensity (more chaos = louder ambient)

VARIATION in existing sounds:
- Randomize pitch slightly (+/- 10%) on every play for: all weapon sounds, zombie death, zombie groan
- Randomize which variant plays (generate 2-3 variants per sound type)

Files: `src/systems/AudioManager.ts`, `src/scenes/NightScene.ts`, `src/scenes/DayScene.ts`

### F5: Zombie aggro balance
- Currently ALL zombies walk toward base (v1.6.0 change)
- Should be ~70% toward base, ~30% wander randomly near edges
- Player weapon noise overrides and attracts nearby zombies
- Base upgrades should also generate noise (more built = more zombies attracted to base)
- Creates tactical choice: build big base (attracts more) vs stay small (fewer zombies but less defense)
- Files: `src/entities/Zombie.ts`, `src/systems/WaveManager.ts`, `src/scenes/NightScene.ts`

---

## UI IMPROVEMENTS (Priority: Medium)

### U1: Simplify loot run panel (major UX issue)
- Current flow: open panel -> click SELECT -> choose weapons -> confirm -> see result -> OK (too many clicks!)
- Wanted: click destination row = start run immediately with current loadout
- Remove separate SELECT button, make entire row clickable
- Skip weapon selection step entirely (use whatever is equipped)
- Result dialog should auto-close after 2-3 seconds or single click
- Files: `src/ui/LootRunPanel.ts`

### U2: Redesign refugee panel
- Current: plain text list, text overflows, no visual identity
- Wanted: portrait/icon per refugee, cleaner job buttons, contained layout
- Files: `src/ui/RefugeePanel.ts`

### U3: Refugee on loot runs
- User reports refugees can't be taken on loot runs (or it's not working)
- Verify and fix companion selection in LootRunPanel
- Files: `src/ui/LootRunPanel.ts`, `src/systems/LootManager.ts`

### U4: Event dialog polish
- Grey box STILL extends beyond panel in DayScene (partially fixed v1.5.0 but user reports it persists)
- Rounded corners, proper text wrapping for long choice text
- Font size may need reducing for long choice texts
- Files: `src/ui/EventDialog.ts`

### U5: Day scene general UX
- Too many clicks overall in management phase
- Panels should feel snappy: open fast, close fast
- Consider keyboard shortcuts for common actions (B = build, L = loot, R = refugees, E = end day)
- Files: `src/scenes/DayScene.ts`

---

## KNOWN ISSUES AND PATTERNS

### Architecture
- SaveManager exported as plain object (not class) -- ESLint no-extraneous-class rule
- Zombie `basePosition` is map center -- zombies walk toward base by default, attract to player via SoundMechanic
- Night overlay completely removed (was RenderTexture, caused grey rectangle bugs)
- FogOfWar visibility checks disabled -- all zombies always visible now
- Build menu stays open after placement (v1.6.0)
- Lighting: night uses darker background `#0F1A0F` instead of overlay

### Save migration
- SaveManager.load() merges saved data with defaults
- Must handle: missing `zone`, `achievements`, `stats`, `zoneProgress`, `loadedAmmo`, new SkillTypes
- Old saves from v0.x-v1.3 may have different GameState shape

### Testing
- 283 vitest tests across 12 test files
- FogOfWar test mock must include: setVisible, setScrollFactor, setAlpha on graphics
- GameState in tests must include all current fields (zone, achievements, stats, zoneProgress)
- Run: `npm run test && npm run typecheck && npm run lint`

### Sprites
- 47 pixel art PNGs in `public/assets/sprites/`
- Fallback textures generated in `src/utils/spriteFactory.ts` if PNGs missing
- BootScene loads all sprites with silent error handler for missing files

---

## KEY FILES

| File | Purpose |
|------|---------|
| src/scenes/NightScene.ts | Main gameplay (night phase, combat, waves) ~850 lines |
| src/scenes/DayScene.ts | Management phase (build, loot, refugees) ~1400 lines |
| src/scenes/MenuScene.ts | Main menu, character select, settings, achievements |
| src/entities/Zombie.ts | Zombie entity with behavior variants, aggro, pooling |
| src/entities/Player.ts | Player with movement, stamina, animations |
| src/systems/WaveManager.ts | Wave spawning, progression, base/player targeting |
| src/systems/SaveManager.ts | localStorage save/load with migration |
| src/systems/AudioManager.ts | Procedural audio via Web Audio API |
| src/systems/SoundMechanic.ts | Weapon noise -> zombie attraction (visual rings) |
| src/systems/WeaponManager.ts | Weapon inventory, XP, durability, upgrades |
| src/systems/ResourceManager.ts | Resource tracking (scrap, food, ammo, parts, meds) |
| src/systems/RefugeeManager.ts | Refugee status, jobs, healing, gathering |
| src/systems/BuildingManager.ts | Structure placement, upgrades, costs |
| src/ui/HUD.ts | Night HUD (HP, stamina, wave, ammo, kills) |
| src/ui/LootRunPanel.ts | Loot run destination selection + encounters |
| src/ui/RefugeePanel.ts | Refugee job assignment panel |
| src/ui/EventDialog.ts | Random event modal dialog |
| src/config/types.ts | All shared TypeScript types |
| src/config/constants.ts | Game constants + GAME_VERSION |
| src/data/*.json | All game data (weapons, enemies, waves, etc) |
| CHANGELOG.md | All changes with version and date |
| LESSONS.md | Known pitfalls and solutions |
| docs/game-design.md | Game mechanics reference |
| docs/technical-spec.md | Architecture reference |

---

## AGENT TEAMS PROMPT

Start a new session (`cd ~/Projects/dead-horizon && claude`) and paste this:

```
Las HANDOFF.md for full project context. This is Dead Horizon, a Phaser 3 + TypeScript
web game at v1.6.0. Allt ar redan byggt -- vi fixar buggar och polishar.

Skapa ett agent team med 4 teammates:

1. Bugfixer -- Fixa de 3 kritiska buggarna i HANDOFF.md "BUGS TO FIX":
   B1 (shooting crash -- finn root cause, inte bara guard),
   B2 (Continue krasch -- testa med gammal save-data),
   B3 (pillbox gor ingen skada -- las setupPillboxRefugees och fixa).
   Filer: NightScene.ts, SaveManager.ts, DayScene.ts

2. Gameplay -- Bygg features F1-F5 i HANDOFF.md "FEATURES TO BUILD":
   F1 (coolare zombie-dod, kroppen ligger kvar),
   F2 (permanenta blodspar pa marken),
   F3 (bas-healthbar i NightScene),
   F4 (alla nya ljud -- las hela listan!),
   F5 (zombie aggro balans: 70% bas, 30% vandrar).
   Filer: Zombie.ts, NightScene.ts, HUD.ts, AudioManager.ts, WaveManager.ts

3. UI-Polish -- Fixa UI-problemen U1-U5 i HANDOFF.md "UI IMPROVEMENTS":
   U1 (ett-klick loot runs -- ta bort vapenval, klicka rad = kor),
   U2 (refugee-panel med portratt och renare layout),
   U3 (refugee companions pa loot runs fungerar inte),
   U4 (event dialog gra box lacker fortfarande),
   U5 (tangentbordsgenvargar for dagfasen: B=build, L=loot, R=refugees, E=end day).
   Filer: LootRunPanel.ts, RefugeePanel.ts, EventDialog.ts, DayScene.ts

4. Tester -- Nar de andra ar klara:
   Kor npm run typecheck && npm run lint && npm run test.
   Starta dev server (npm run dev) och testa i browser med Playwright.
   Verifiera: Continue fungerar, shooting kraschar inte, pillbox skadar,
   loot runs ar ett-klick, ljud spelas. Rapportera buggar tillbaka.

Regler for ALLA teammates:
- TypeScript strict mode, inga any-typer
- All speldata i JSON (src/data/), aldrig hardkodad
- Kor npm run typecheck && npm run lint efter andringar
- Kommunicera pa svenska med anvandaren (Ola)
- Uppdatera CHANGELOG.md med alla andringar
- Bumpa version till 1.7.0
- Las LESSONS.md innan debugging
- Lagg till nya losningar i LESSONS.md
```

---

## USER PREFERENCES

- Swedish speaker (Ola), communicate in Swedish
- Preserve characters: a, a, o (but code/comments in English)
- Never use EM dash
- Update CHANGELOG.md with version + date for every change
- Check off tasks in docs/projectplan.md
- Consult LESSONS.md before debugging, add solutions there
- Wants agent teams for parallel work
- Values: gameplay feel > visual polish > features
- Likes: challenging difficulty, gritty atmosphere, tactical depth
- Dislikes: excessive clicking, unclear UI, "cute" death effects
