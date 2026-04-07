# Dead Horizon -- Projektplan

**Version:** 0.1.0
**Datum:** 2026-03-28
**Status:** Draft

---

## Fasöversikt

```
Fas 0: Projektsetup          [v0.0.x]
Fas 1: MVP -- Kärn-loop      [v0.1.x]
Fas 2: Management & Resurser [v0.2.x]
Fas 3: Vapen & Leveling      [v0.3.x]
Fas 4: Refugees & Loot       [v0.4.x]
Fas 5: Polish & Balans       [v0.5.x]
Fas 6: Post-MVP Features     [v0.6.x+]
```

---

## Fas 0: Projektsetup (v0.0.x)

Mål: Repo redo, alla verktyg konfigurerade, agenter uppsatta.

### Uppgifter

- [x] 0.1 Skapa GitHub-repo "dead-horizon"
- [x] 0.2 Initiera Vite + TypeScript + Phaser
- [x] 0.3 Konfigurera ESLint, Vitest
- [x] 0.4 Skapa filstruktur enligt technical-spec.md
- [x] 0.5 Konfigurera CI/CD (GitHub Actions -> GitHub Pages)
- [x] 0.6 Skapa placeholder index.html med Phaser boot
- [x] 0.7 Konfigurera .claude/ med agent-instruktioner
- [x] 0.8 Verifiera att dev server startar och visar en tom Phaser-scen
- [x] 0.9 Skapa CHANGELOG.md, LESSONS.md, PROJECTPLAN.md i repo-root

**Leverans:** "Hello World"-Phaser-scen som bygger och deployas.

---

## Fas 1: MVP -- Kärn-loop (v0.1.x)

Mål: Spelbart minimum. En karta, en spelare, zombies i vågor, dö och starta om.

### 1A: Grundläggande scener och navigation

- [x] 1A.1 BootScene -- ladda placeholder-assets
- [x] 1A.2 MenuScene -- "Start Game"-knapp
- [x] 1A.3 NightScene -- tom spelplan med karta
- [x] 1A.4 Scene-övergångar fungerar (Menu -> Night -> GameOver -> Menu)

### 1B: Spelarkontroll

- [x] 1B.1 Spelarsprite (placeholder-rektangel) på kartan
- [x] 1B.2 Piltangenter/WASD för rörelse
- [x] 1B.3 Kameran följer spelaren
- [x] 1B.4 Sprint (Shift) med stamina

### 1C: Karta

- [x] 1C.1 Tilemap (enkel grid med gräs + väg)
- [x] 1C.2 Bas-position i mitten (tält-placeholder)
- [x] 1C.3 Horisontell väg genom kartan
- [x] 1C.4 Spawn-zoner vid kartans kanter

### 1D: Fiender och strid

- [x] 1D.1 Walker-zombie som rör sig mot basen
- [x] 1D.2 Zombie-spawning från spawn-zoner
- [x] 1D.3 Auto-shoot: spelaren skjuter närmaste fiende inom range
- [x] 1D.4 Projektiler och collision detection
- [x] 1D.5 Zombies tar skada och dör
- [x] 1D.6 Spelaren tar skada vid kontakt med zombies
- [x] 1D.7 Spelare-död -> GameOverScene

### 1E: Wave-system

- [x] 1E.1 WaveManager -- spawna zombies i waves
- [x] 1E.2 Wave 1-5 (enbart Walkers i MVP, ökande antal. Wave 5 designad att kräva flera runs)
- [x] 1E.3 Wave-övergång (alla zombies döda -> ny wave)
- [x] 1E.4 "Wave Complete" UI-text
- [x] 1E.5 Alla waves klara -> ResultScene

### 1F: Roguelite-loop

- [x] 1F.1 Vid död: behåll stats, starta om wave 1
- [x] 1F.2 SaveManager -- spara till localStorage
- [x] 1F.3 Laddskärm hämtar sparad data

### 1G: Grundläggande HUD

- [x] 1G.1 HP-bar
- [x] 1G.2 Current wave-indikator
- [x] 1G.3 Kill counter

**Leverans:** Man kan röra sig, zombies attackerar i vågor, man kan skjuta dem, man kan dö och prova igen. Minimum Viable Fun.

---

## Fas 2: Management och resurser (v0.2.x)

Mål: Dagfasen. Spelaren kan bygga och hantera resurser.

### 2A: Dag/Natt-cykel

- [x] 2A.1 DayScene med klickbar karta
- [x] 2A.2 Action Point-system (12 AP)
- [x] 2A.3 AP-bar i UI
- [x] 2A.4 "End Day"-knapp -> NightScene
- [x] 2A.5 Dag/Natt-övergångsanimation

### 2B: Resurssystem

- [x] 2B.1 ResourceManager -- track Scrap, Food, Ammo, Parts, Meds
- [x] 2B.2 Resursbar i UI (alltid synlig)
- [x] 2B.3 Resurser som loot-drop från döda zombies
- [x] 2B.4 Resursförbrukning per dag (Food)

### 2C: Byggande

- [x] 2C.1 BuildMenu med lista av byggoptions
- [x] 2C.2 Placeringsläge -- visa ghost + klicka för att placera
- [x] 2C.3 Barrikader (saktar ner fiender)
- [x] 2C.4 Väggar (blockerar fiender, har HP)
- [x] 2C.5 Fällor (skadar fiender som passerar)
- [x] 2C.6 Strukturer tar skada under nattfas
- [x] 2C.7 Klicka på struktur -> uppgradera/sälja

### 2D: Ammo-som-resurs

- [x] 2D.1 Vapen kräver ammo-laddning innan natt (1 AP)
- [x] 2D.2 Vapen utan ammo kan inte användas (utom melee)
- [x] 2D.3 Ammo-status synlig i HUD

**Leverans:** Full dag/natt-cykel med byggande och resurshantering.

---

## Fas 3: Vapen och leveling (v0.3.x)

Mål: Djupare stridssystem och karaktärsprogression.

### 3A: Vapensystem

- [x] 3A.1 WeaponManager -- inventory, equip, switch
- [x] 3A.2 Implementera vapenklasser (Melee, Pistol, Rifle, Shotgun)
- [x] 3A.3 Vapenrariteter (Common -> Legendary) med olika stats
- [x] 3A.4 Vapen-XP och leveling (1-5)
- [x] 3A.5 Durability-system (sjunker per natt, reparera med Parts)
- [x] 3A.6 Siffertangenter för vapenval
- [x] 3A.7 WeaponPanel i DayScene
- [x] 3A.8 EquipmentPanel -- 2 vapen-slots (primary/secondary), Q-tangent, auto-equip

### 3B: Ljud-mekanik

- [x] 3B.1 SoundMechanic -- varje vapen har Noise Level
- [x] 3B.2 Zombies reagerar på ljud (ändrar bana mot ljudkälla)
- [x] 3B.3 Awareness radius baserat på Noise Level
- [x] 3B.4 Visuell indikation av ljud (ringar/pulser)

### 3C: Fiendevariation

- [x] 3C.1 Runner-zombie (snabb, runt barrikader)
- [x] 3C.2 Brute-zombie (stark, bryter igenom väggar)
- [x] 3C.3 Uppdatera waves.json med nya fiendetyper
- [x] 3C.4 Wave 4-5 med blandade fiender

### 3D: Skill-system

- [x] 3D.1 SkillManager -- track XP per skill
- [x] 3D.2 Combat skills (per vapenklass)
- [x] 3D.3 Looting skill
- [x] 3D.4 Building skill
- [x] 3D.5 Skill-effekter appliceras på relevanta system
- [x] 3D.6 Skill-panel i UI

### 3E: Karaktärsval

- [x] 3E.1 Karaktärsval i MenuScene (4 karaktärer)
- [x] 3E.2 Startbonus appliceras vid ny run
- [x] 3E.3 Karaktärsporträtt och beskrivning

### 3F: Vapen-upgrades

- [x] 3F.1 Upgrade-system med Parts
- [x] 3F.2 Suppressor (minskar Noise Level)
- [x] 3F.3 Damage boost, extended mag, scope, reinforcement

**Leverans:** Fullt stridssystem med vapen, skills, ljud-mekanik och karaktärsval.

---

## Fas 4: Refugees och loot (v0.4.x)

Mål: Refugee-system och loot runs ger spelet djup och management-lager.

### 4A: Refugee-system

- [x] 4A.1 RefugeeManager -- track refugees, HP, status
- [x] 4A.2 Refugees spawnar (slump per dag)
- [x] 4A.3 RefugeePanel -- tilldela jobb (sliders/knappar)
- [x] 4A.4 Refugees samlar Food och Scrap under dag
- [x] 4A.5 Refugees i Pillboxes under natt (med vapen)
- [x] 4A.6 Refugees kan skadas under natt
- [x] 4A.7 Healing med Meds (refugee vilar tills frisk)
- [x] 4A.8 Food-konsumption per refugee per dag

### 4B: Loot Runs

- [x] 4B.1 LootRunPanel -- valj destination, utrustning, sallskap
- [x] 4B.2 Loot run kostar 3-5 AP
- [x] 4B.3 Loot tables per destination
- [x] 4B.4 EncounterDialog -- "Fight or Flee"-val
- [x] 4B.5 Encounter-resultat baserat pa medhavd styrka
- [x] 4B.6 Rescue-events (hitta nya refugees)
- [x] 4B.7 Fog of war avslojas genom loot runs

### 4C: Basexpansion

- [x] 4C.1 Bas-nivaer (Talt -> Camp -> Outpost -> Settlement)
- [x] 4C.2 Varje niva laser upp nya byggnadstyper
- [x] 4C.3 Shelter (bostader for refugees)
- [x] 4C.4 Storage (okad resurskapacitet)
- [x] 4C.5 Farm (passiv Food-produktion)

### 4D: Fog of War

- [x] 4D.1 FogOfWar overlay-system
- [x] 4D.2 Synlighet runt bas och utforskade omraden
- [x] 4D.3 Zombies osynliga utanfor synfalt
- [x] 4D.4 Ljud-indikation fran osynliga zombies

**Leverans:** Komplett management-lager med refugees, loot och kartan avslöjas gradvis.

---

## Fas 5: Polish och balans (v0.5.x)

Mål: Spelet känns bra, balansen fungerar, inga stora buggar.

### 5A: Visuell polish

- [x] 5A.1 Riktiga pixel art sprites (ersatt placeholders)
- [x] 5A.2 Animationer (walk, attack, death)
- [x] 5A.3 Partiklar (blod, explosion, muzzle flash)
- [x] 5A.4 Dag/natt-ljussattning
- [x] 5A.5 Skarmeffekter (damage flash, wave complete)

### 5B: UI-polish

- [x] 5B.1 Polished menyer med pixel-font
- [x] 5B.2 Tooltips och hjalptext
- [x] 5B.3 Tutorial/onboarding for nya spelare
- [x] 5B.4 Responsiv layout (olika skarmstorlekar)
- [x] 5B.5 ZoneCompleteScene -- dramatisk animation, partiklar, stats-summary
- [x] 5B.6 Blueprint-fynd popup -- guld-glow, scale-in, shake-animation
- [x] 5B.7 FINAL NIGHT banner -- kamera-skakning, morkt overlay, pulsande rod text
- [x] 5B.8 Zone-panel i menyn -- tydlig locked/unlocked/cleared-visuell, las-ikon, progress-bar, stjarnor

### 5C: Balansering

- [x] 5C.1 Speltest av wave-svarighet
- [x] 5C.2 Resursekonomi-balansering
- [x] 5C.3 Vapenbalansering
- [x] 5C.4 Encounter-svarighet

### 5D: Performance

- [x] 5D.1 Object pooling implementerat
- [x] 5D.2 Performance-test med 100+ fiender
- [x] 5D.3 Optimera pathfinding
- [x] 5D.4 Load time under 3 sekunder

### 5E: Ljud (procedurellt genererat via Web Audio API)

- [x] 5E.1 Skottljud per vapenklass
- [x] 5E.2 Zombie-ljud (groan, attack)
- [x] 5E.3 Ambient sounds (vind, djur)
- [x] 5E.4 Bakgrundsmusik (dag och natt)
- [x] 5E.5 Fäll-ljud (nail board, trip wire, glass shards, tar pit, shock wire, spring launcher, chain wall)
- [x] 5E.6 Boss-ljud (roar vid spawn, stomp under rörelse)
- [x] 5E.7 Zon-ljud (zone_complete fanfar, final_night_start doom-ackord)

**Leverans:** v1.0 -- polished, balanserat, spelbart spel med alla kärnfunktioner.

---

## Fas 6: Post-MVP Features (v0.6.x+)

Dessa features implementeras baserat på feedback och prioritet:

### 6A: Random Events
- [x] Traders som dyker upp mellan waves
- [x] Moraliska val (refugees som vill lamna, stold av mat)
- [x] Vader (regn som minskar sikt, storm som skadar strukturer)

### 6B: Fler fiendetyper
- [x] Spitter (ranged)
- [x] Screamer (drar fler zombies)
- [x] Boss-varianter per wave 5
- [x] Zon-specifika zombie-skins (forest/city/military tints)
- [x] city_crawler (ignorerar låga väggar, bara City wave 3+)
- [x] military_heavy (bepansrad, 50% damage reduction, bara Military wave 2+)
- [x] tunnel_zombie (spawnar inuti basen, alla zoner natt 4+)
- [x] forest_boss Brute Alpha (charge-faser, stenkast fas 2, spawnar walkers)
- [x] city_boss Spitter Queen (minions, syra-pools, desperate scream)
- [x] military_tank Tank (2000 HP, armor, svag punkt bak, krossar strukturer)

### 6C: Fler skills
- [x] Speed/Agility
- [x] Leadership
- [x] Survival
- [x] Stealth

### 6D: Expansion
- [x] Nya zoner med unika fiender
- [x] Zon-karta ("overworld")
- [ ] Nya resurser per zon (framtida)

### 6E: Crafting
- [x] Kombinera resurser till nya items
- [x] Crafting-stationer i basen

### 6F: Community
- [ ] Leaderboards (framtida)
- [ ] Shared bases/screenshots (framtida)
- [x] Achievements

### 6G: Inventory-redesign (v2.2.0)
- [x] Auto-load ammo vid nattstart (ta bort manuell AMMO-knapp)
- [x] Ta bort WEAPONS-knapp, sla ihop i EQUIP-panel
- [x] EquipmentPanel: repair + upgrade direkt i panel
- [x] Dual weapon HUD -- visa bada vapen i bottom-bar
- [x] Ammo-varning vid nattstart om ammo inte racker
- [x] Toolbar: 6 knappar (BUILD, EQUIP, CRAFT, LOOT, REFUGEES, END DAY)
- [x] Resource tooltips pa resursbaren (hover)
- [x] Tutorial-text uppdaterad: auto-ammo istallet for manuell laddning
- [ ] Meds-kostnad tydlig i RefugeePanel (fas 3)

### 6I: Zon-progressionssystem (v2.5.0)
- [x] ZoneCompleteScene: visas nar spelaren klarar wave 5 i en zon
- [x] MenuScene: buildZonePanel() visar Forest/City/Military med status (locked/unlocked/cleared)
- [x] MenuScene: Continue-subtext visar "[Zonnamn] -- Night X/5"
- [x] NightScene: "FINAL NIGHT" banner vid wave 5 start
- [x] NightScene: zoneProgress sparas och nasta zon las upp vid zon-klar
- [x] NightScene: vid dod borjar spelaren om fran natt 1 i SAMMA zon (gear/refugees/skills behalles)

### 6H: Cooldown-system + 6 nya mekaniska fallor (v2.3.0)
- [x] TrapBase: abstrakt basklass med cooldown, overheat, malfunction, fuel, uses
- [x] BladeSpinner: roterande blad-AOE, cd 4s, overheat 30s, malfunction 15%, fuel 1
- [x] FirePit: brannzon 3 tiles, 15 dmg/s, malfunction 5%, fuel 2
- [x] PropaneGeyser: eld-burst 60px radie, 40 dmg, cd 6s, overheat 20s, malfunction 10%
- [x] CartWall: passiv blockerare 80 HP, billig barrikar
- [x] WashingCannon: projektil mot narmaste zombie 150px, 30 dmg, cd 3s, overheat 25s, malfunction 20%
- [x] PitTrap: fanger 5 zombies permanent, forstors nar full, malfunction 10%
- [x] NightScene: malnattstart (fuel-avdrag + malfunction-roll), updateMechanicalTraps(), updateRepairMechanic()
- [x] Repair-mekanik: hall E 2s nara malfunctioned trap, kostar 1 parts, progress-bar
- [x] Visuella statusoverlayn: gron (aktiv), gra+timer (cooldown), orange+HOT! (overheat), rod blinkande !! (malfunction)
- [x] Alla 6 fallor tillagda i structures.json och build-menyn (auto via getAllStructureData)

---

## Milstolpar

| Milstolpe | Fas | Leverans |
|-----------|-----|----------|
| **"Hello World"** | 0 | Tomt Phaser-projekt på GitHub Pages |
| **"First Kill"** | 1 | Spelaren kan döda en zombie |
| **"Minimum Viable Fun"** | 1 | Full kärn-loop med waves och roguelite |
| **"Day & Night"** | 2 | Dag/natt-cykel med byggande och resurser |
| **"Arsenal"** | 3 | Vapen, skills, ljud-mekanik |
| **"Community"** | 4 | Refugees, loot runs, fog of war |
| **"v1.0"** | 5 | Polished, balanserat, releasebar |
