# Dead Horizon -- Session Handoff

**Generated:** 2026-03-28
**Version:** 0.1.1
**Last commit:** 3760bf3 (Fix zombie movement and add save data to menu)

---

## Project

Dead Horizon is a web-based top-down wave defense / base builder / roguelite game.
- **Repo:** ~/Projects/dead-horizon (GitHub: Skugg4n/dead-horizon, private)
- **Stack:** Phaser 3 + TypeScript (strict) + Vite + Vitest + ESLint
- **Original docs location:** Google Drive (Post Apocalyptic Game), copied to ~/Projects/dead-horizon/docs/

## Current state

### Completed

- **Fas 0 (v0.0.1):** Full project setup -- Vite, TypeScript, Phaser 3, ESLint, CI/CD (GitHub Actions -> GitHub Pages), agent definitions in .claude/agents/
- **Fas 1 (v0.1.x):** Playable MVP night phase
  - Player: WASD/arrows, sprint (Shift) with stamina, auto-shoot nearest enemy
  - Map: 40x30 tiles, grass + road + base center
  - Zombies: Walker type, spawn from 4 edges, move toward player, deal contact damage, object pooling
  - Waves: WaveManager with 5 escalating waves, wave transitions
  - Death: HP system, GameOverScene with stats, roguelite loop (keep all stats)
  - Save: SaveManager using localStorage, MenuScene shows saved progress (runs, kills)
  - HUD: HP bar, stamina bar, wave counter, kill counter, wave announcements

### Not started

- **Fas 2 (v0.2.x):** Day/night cycle, resource management, building system
- **Fas 3 (v0.3.x):** Weapons, leveling, sound mechanic, enemy variation
- **Fas 4 (v0.4.x):** Refugees, loot runs, fog of war
- **Fas 5 (v0.5.x):** Polish, balance, audio
- **Fas 6 (v0.6.x+):** Post-MVP features

## Next task: Fas 2

Full task list is in docs/projectplan.md. Key deliverables:

### 2A: Day/night cycle
- DayScene with clickable map, 12 AP system, AP bar, "End Day" button, transition animation
- Files to create/modify: src/scenes/DayScene.ts (exists as placeholder), src/ui/ActionPointBar.ts

### 2B: Resource system
- ResourceManager tracking Scrap, Food, Ammo, Parts, Meds
- Resource bar UI, zombie loot drops, daily food consumption
- Files to create: src/systems/ResourceManager.ts, src/ui/ResourceBar.ts

### 2C: Building
- BuildMenu, placement mode with ghost preview, barricade/wall/trap structures
- Structures take damage during night, click to upgrade/sell
- Files to create: src/ui/BuildMenu.ts, src/systems/BuildingManager.ts, src/structures/Barricade.ts, Wall.ts, Trap.ts

### 2D: Ammo as resource
- Weapons require ammo loading (1 AP), no ammo = can't shoot (except melee), ammo status in HUD

### Parallelization strategy for agent teams
- **Builder-Day:** 2A (DayScene, AP system, day/night transition) + 2C (building system, structures)
- **Builder-Resources:** 2B (ResourceManager, resource UI, loot drops) + 2D (ammo system)
- **Tester:** Verify all implementations after builders complete
- These two builders touch different files and can work in parallel safely.

## Agent Teams setup

Agent teams are enabled and configured:
- `.claude/settings.json` has `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"`
- `~/.claude.json` has `teammateMode: "in-process"`
- Custom subagent definitions exist in `.claude/agents/` (lead.md, builder.md, tester.md) but agent teams are the preferred approach going forward

### How to start agent teams for Fas 2

```
cd ~/Projects/dead-horizon
claude
```

Then give this prompt:

```
Read docs/projectplan.md, docs/game-design.md, and docs/technical-spec.md.
We are building Fas 2 (Management & Resources).

Create an agent team with three teammates:

1. Builder-Day -- Implement DayScene with AP system, build menu, structure placement,
   and day/night transition (tasks 2A + 2C from projectplan.md).
   Files: src/scenes/DayScene.ts, src/ui/BuildMenu.ts, src/ui/ActionPointBar.ts,
   src/systems/BuildingManager.ts, src/structures/Barricade.ts, Wall.ts, Trap.ts

2. Builder-Resources -- Implement ResourceManager, resource bar UI, zombie loot drops,
   food consumption, and ammo loading system (tasks 2B + 2D from projectplan.md).
   Files: src/systems/ResourceManager.ts, src/ui/ResourceBar.ts,
   modify src/scenes/NightScene.ts (loot drops), modify src/ui/HUD.ts (ammo status)

3. Tester -- After builders complete, run npm run typecheck && npm run lint,
   write vitest tests in tests/systems/, start dev server and verify visually.
   Report bugs back to builders.

Rules:
- Follow docs/technical-spec.md architecture (Manager pattern, event system)
- Follow docs/game-design.md for all game values and mechanics
- All game data in JSON files (src/data/), never hardcoded
- TypeScript strict mode, no any types
- Update CHANGELOG.md and docs/projectplan.md when done
- Bump version to 0.2.0 in package.json and src/config/constants.ts
```

## Key files

| File | Purpose |
|------|---------|
| docs/game-design.md | All game mechanics (the bible) |
| docs/technical-spec.md | Architecture, file structure, patterns |
| docs/art-direction.md | Visual style, colors, sprite guide |
| docs/projectplan.md | Phase plan with checkboxes |
| src/config/types.ts | All shared TypeScript types |
| src/config/constants.ts | Game constants + GAME_VERSION |
| src/data/*.json | All game data (weapons, enemies, waves, etc) |
| src/main.ts | Phaser config, scene registration |
| src/scenes/NightScene.ts | Main gameplay scene (action phase) |
| src/systems/WaveManager.ts | Wave spawning and progression |
| src/systems/SaveManager.ts | localStorage save/load (exported as object, not class) |
| src/entities/Player.ts | Player entity with movement, stamina, HP |
| src/entities/Zombie.ts | Zombie entity with target tracking, pooling |
| CHANGELOG.md | All changes with version and date |
| LESSONS.md | Known pitfalls and solutions |

## Known issues and patterns

- SaveManager is exported as a plain object (not a class) to satisfy ESLint no-extraneous-class rule
- Map is currently drawn with Graphics primitives, not Tiled tilemaps -- works for MVP
- Zombie target must be set via WaveManager.setTarget() before starting waves (was a bug, now fixed)
- Project lives in ~/Projects/dead-horizon, NOT in Google Drive (node_modules sync issues)
- Vite serves index.html from project root, not from public/

## User preferences

- Swedish speaker (Ola), communicate in Swedish
- Preserve characters: a, a, o
- Never use EM dash
- Structured workflow: check off tasks in projectplan.md as completed
- Proactive: suggest next steps
- All changes logged in CHANGELOG.md with version + date
- Consult LESSONS.md before debugging, add solutions there
