# Dead Horizon -- Changelog

## [1.0.0] - 2026-03-29

### Added -- Fas 5: Polish och balans
- Programmatiska pixel art sprites for spelare, zombies, strukturer via spriteFactory.ts
- Spelar-walkanimation (bobbing), zombie-dodsanimation (shrink+fade+rotation), attack-puls
- Partikeleffekter: muzzle flash, blodsplatter, fallsparkar (Phaser particle emitter)
- Nattljus: mork overlay med radial gradient runt spelare och pillboxes
- Skarmeffekter: rod flash vid skada, guld flash vid wave complete
- "Press Start 2P" pixel-font fran Google Fonts pa all text
- Tutorial-overlay for nya spelare (forsvinner efter 6s)
- Ombalanserade waves: W1 latt intro, W5 nastan omojlig utan forberedelse
- Sprint stamina drain okad till 25/s for mer strategisk sprint
- Zombie loot: scrap 40% (fran 50%), 5% parts-chans tillagd
- FPS-counter i dev mode (top-right)
- Zombie pathfinding-throttle: off-screen zombies uppdaterar 500ms istallet for varje frame
- Vite type declarations (src/vite-env.d.ts)

### Added -- Fas 6: Post-MVP Features
- EventManager med 9 random events: traders, moraliska val, vader (regn/storm), supply caches, horde warnings
- EventDialog modal for event-val med konsekvenser
- Spitter-zombie: ranged attack, gronn tint, skjuter projektil var 3s
- Screamer-zombie: lila pulsande, skriker vid skada, attraherar alla zombies inom 500px
- Brute Boss: 2x skala, rod glod, 500 HP, spawnar 3 brutes vid dod
- 4 nya skills: speed_agility, leadership, survival, stealth
- ZoneManager: 3 zoner (Forest, City, Military Base) med unika waves
- Zon-specifika wave-filer (waves-city.json, waves-military.json)
- CraftingManager: 5 recept (weapon repair kit, rations, ammo pack, reinforced wall, medkit)
- CraftingPanel i DayScene for crafting med AP-kostnad
- AchievementManager: 10 achievements (First Blood, Wave Survivor, Builder, etc)
- Achievement-popup och panel i MenuScene
- Stats-tracking i GameState (structuresPlaced, lootRunsCompleted, itemsCrafted)
- 283 vitest-tester (12 filer), alla passerar

### Fixed
- ResourceBar.setText crash efter scene-transition (null glTexture guard)

## [0.4.0] - 2026-03-29

### Added -- Fas 4: Refugees och loot
- RefugeeManager (src/systems/RefugeeManager.ts) -- tracker refugees med HP, status, jobb-tilldelning
- Refugees spawnar slumpmassigt (20% chans per dag), 35 unika namn
- RefugeePanel (src/ui/RefugeePanel.ts) i DayScene for jobb-tilldelning (gather_food/scrap, repair, rest)
- Refugees samlar resurser under dag: 2 food eller 3 scrap per gatherer, 10 HP reparation
- Refugees i Pillboxes skjuter under natt (range 150, damage 5, cooldown 1500ms)
- Refugees kan skadas under natt, injured refugees maste vila + 1 Meds for att hela
- Food-forbrukning: 1 per refugee + 1 for spelare per dag, svalt skadar 10 HP
- Max refugees begransat av shelters (2 per shelter, minimum 1)
- LootManager (src/systems/LootManager.ts) -- loot run-logik med destinations fran loot-tables.json
- LootRunPanel (src/ui/LootRunPanel.ts) -- valj destination, utrustning, sallskap
- EncounterDialog (src/ui/EncounterDialog.ts) -- Fight or Flee-val vid encounters
- Encounter-styrka = vapensskada + companions * 20 vs destination-troskel
- Win encounter: 1.5x loot, 30% chans att radda ny refugee
- Lose encounter: forlorar all loot, 40% skadechans per companion
- Flee: forlorar 1 resurstyp, alla klarar sig
- 50 XP per loot run for looting skill
- Bas-nivaer: Tent -> Camp -> Outpost -> Settlement med okande kostnader
- Varje niva laser upp nya strukturtyper (pillbox, shelter, storage, farm)
- Shelter: husar 2 refugees per shelter
- Storage: +50 resurskapacitet per storage (default 100)
- Farm: producerar food passivt per dag (2 food/farm fran structures.json)
- Bas-uppgradering UI i DayScene med kostnad och AP
- Visuell bas som vaxer med niva (storlek och farg)
- FogOfWar (src/systems/FogOfWar.ts) -- grid-baserad mork overlay i NightScene
- Avslojad area runt basen (radius okar med bas-niva: 3/5/7/9 block)
- Zombies osynliga utanfor avslojat omrade men fortfarande aktiva
- Roda riktningspilar vid dimkanten for dolda zombies i narhet
- Loot runs avslojar omraden (sparas i GameState.map.explored)
- 205 vitest-tester (8 filer), alla passerar

## [0.3.0] - 2026-03-29

### Added -- Fas 3: Vapen och leveling
- WeaponManager (src/systems/WeaponManager.ts) -- vapeninventar, equip, switch med siffertangenter 1-5
- Vapenklasser: melee, pistol, rifle, shotgun med unika stats fran weapons.json
- Vapenrariteter (common/uncommon/rare/legendary) med stat-multiplikatorer
- Vapen-XP och leveling (1-5): Lvl2 +10% reload, Lvl3 +10% damage, Lvl4 +10% reload
- Durability-system -- minskar per natt, reparera med Parts (1 AP)
- Vapenuppgraderingar med Parts: damage_boost, suppressor, extended_mag, scope, reinforcement
- WeaponPanel (src/ui/WeaponPanel.ts) i DayScene med reparation och uppgraderingsalternativ
- Startarvapen: rusty_knife (melee) + worn_pistol (ranged)
- Shotgun avfyrar 3 pellets i spread
- Vapennamn och durability i HUD under nattfas
- SoundMechanic (src/systems/SoundMechanic.ts) -- vapen har noiseLevel, zombies reagerar pa ljud
- Visuella ljudringar vid skott, storlek baserad pa noiseLevel, farg fran gul till rod
- Zombies attraheras till ljudkalla i 5 sekunder, sedan tillbaka till spelare
- Runner-zombie: gul tint, snabb (speed 100), forsoker undvika strukturer
- Brute-zombie: mork tint, 1.5x storlek, skadar strukturer vid kollision (5 dmg/hit)
- Vaggar ar nu fysiska objekt som blockerar zombies och spelare
- Barrikader saktar ner zombies, fallor skadar vid overlap (engangbruk)
- SkillManager (src/systems/SkillManager.ts) -- tracker XP per skill fran skills.json
- Combat skills far XP per kill med matchande vapenklass (10 XP per kill)
- Building skill far 25 XP per placerad struktur
- Skill-effekter: combat okar damage/speed, building minskar kostnad/okar HP
- SkillPanel (src/ui/SkillPanel.ts) i DayScene med XP-bars och nivaer
- Karaktarsval i MenuScene: Scavenger, Engineer, Soldier, Medic
- Karaktarsbonus appliceras som start-XP fran characters.json
- Ny/fortsatt-spelflode: ny save visar karaktarsval, sparad save visar Continue/New Game

## [0.2.3] - 2026-03-28

### Fixed
- Build menu click immediately placed structure at click location instead of entering placement mode. Added placementJustStarted flag to skip the same pointer event that selected the menu item.

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
