# Dead Horizon -- Changelog

## [0.2.2] - 2026-03-28

### Fixed
- DayScene mouse/click offset -- UI buttons and menus were unclickable because setScrollFactor(0) interactive zones drifted with camera scroll. Replaced with dual-camera system: a scrolling main camera for the map and a fixed UI camera at (0,0) for all interactive UI elements. Click zones now always match visual positions.
- Structure popup screen position used manual getWorldPoint(0,0) subtraction which broke with camera zoom. Now uses direct scrollX/scrollY offset.
- Added getContainer() to ActionPointBar so DayScene can register it with the UI camera.

## [0.2.1] - 2026-03-28

### Fixed
- DayScene laddade structures.json via Phaser loader med src/-sokvag -- fungerar inte i prod-build. Andrat till ES import
- NightScene laddade gameState vid klass-instansiering istallet for i create() -- sparade andringar fran DayScene ignorerades
- Wave-progression saknade currentWave-okning -- spelaren fastnade pa wave 1 efter overlevnad
- Strukturer som placerats under dagen syntes inte under natten -- lade till renderPlacedStructures i NightScene
- all-waves-complete-event kunde triggas dubbelt (fran WaveManager.onEnemyKilled + startWave) -- wave-complete startar inte nasta wave efter wave 5
- Exporterade StructureData-interface fran BuildingManager for aterbruk

## [0.2.0] - 2026-03-28

### Added -- Fas 2: Management och resurser
- DayScene med klickbar karta, kamera-panning, grid overlay och fade-transition till NightScene
- Action Point-system (12 AP per dag) med visuell AP-bar (src/ui/ActionPointBar.ts)
- "End Day"-knapp som sparar och overgar till nattfas
- ResourceManager (src/systems/ResourceManager.ts) -- tracker Scrap, Food, Ammo, Parts, Meds
- ResourceBar (src/ui/ResourceBar.ts) -- visar alla resurser i UI
- Zombie loot drops -- dodade zombies droppar resurser (scrap, ammo, food) med floating text
- Loot-data i src/data/zombie-loot.json (inte hardkodad)
- BuildingManager (src/systems/BuildingManager.ts) -- placering, uppgradering, forsaljning av strukturer
- BuildMenu (src/ui/BuildMenu.ts) -- panel med tillgangliga strukturer, kostnader, AP
- Barricade (saktar ner fiender), Wall (blockerar fiender), Trap (skadar fiender) i src/structures/
- Ghost preview vid placering med grid-snapping, hogerklick for att avbryta
- Klicka pa struktur for att uppgradera (50% HP-okning per niva) eller salja (50% refund)
- AmmoLoader (src/systems/AmmoLoader.ts) -- ladda vapen med ammo (1 AP)
- Ammo-system i nattfas -- skjutning forbrukar ammo, auto-shoot stannar vid 0 ammo
- Ammo-counter i HUD (blir rod vid 0)
- loadedAmmo-falt i GameState for persistens
- Daglig food-forbrukning (varning vid brist)
- 46 vitest-tester for ResourceManager och BuildingManager
- MenuScene -> DayScene -> NightScene flade (uppdaterade scen-overgångar)

## [0.1.1] - 2026-03-28

### Fixed
- Zombies rorde sig inte -- target sattes aldrig pa spawnade fiender
- WaveManager skickar nu spelar-referens till alla zombies vid spawn

### Added
- MenuScene visar sparad progress (runs, total kills)
- New Game-knapp for att rensa sparad data
- Versionsnummer lasas fran GAME_VERSION-konstant overallt

## [0.1.0] - 2026-03-28

### Added -- Fas 1: MVP Karn-loop
- Player entity med WASD/piltangenter, sprint (Shift) med stamina
- NightScene med spelbar karta (40x30 tiles, gras + vag + bas i mitten)
- Zombie entity med pooling, pathfinding mot spelare, skada vid kontakt
- Projectile entity med object pooling
- Auto-shoot: spelaren skjuter automatiskt narmaste fiende inom range
- WaveManager: 5 waves med okande svarighet, wave-overgangar
- SaveManager: spara/ladda GameState till localStorage
- HUD: HP-bar, stamina-bar, wave-indikator, kill counter, wave announcements
- GameOverScene med stats (kills, wave) och Try Again
- ResultScene for nar alla waves ar klara
- GitHub repo (Skugg4n/dead-horizon, privat)
- CI/CD: GitHub Actions (lint + typecheck + test + build + deploy till GitHub Pages)

## [0.0.1] - 2026-03-28

### Added
- Projektsetup: Vite + TypeScript + Phaser 3
- ESLint och Vitest konfigurerade
- Komplett filstruktur enligt technical-spec.md
- BootScene med placeholder-assets och splash screen
- MenuScene med Start Game-knapp
- NightScene, DayScene, ResultScene, GameOverScene (placeholder)
- Alla JSON-datafiler: weapons, enemies, structures, waves, characters, skills, loot-tables
- TypeScript-typer i config/types.ts
- Spelkonstanter i config/constants.ts
- Utils: math.ts och random.ts (seeded RNG)
- Agent-definitioner: lead.md, builder.md, tester.md
- CLAUDE.md med projektregler
- CHANGELOG.md och LESSONS.md
