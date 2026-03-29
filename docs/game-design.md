# Dead Horizon -- Game Design Document

**Version:** 1.7.0
**Datum:** 2026-03-29
**Status:** Active

---

## 1. Speloversikt

Genre: Top-down wave defense / base builder / roguelite
Perspektiv: Top-down (rakt ovanifran)
Kontroll: WASD + mus (nattfas), mus (dagfas)
Session-langd: En "dag" (dag + natt) tar ca 3-5 minuter realtid

### Tema och ton
Post-apokalyptisk zombieoverlevnad. Morkt, gritty, taktiskt. Spelaren ar en overlevare som bygger en bas, forsvara den mot nattliga zombieangrepp, och skickar loot runs for resurser. Kanslan ar desperat men hoppfull -- varje natt ar ett test, varje dag en chans att forbereda sig battre.

### Titel-skarmen
Vansterstallda layouten med:
- "DEAD HORIZON" titel i stor pixel art-stil
- Tagline: "POST APOCALYPTIC TOP-DOWN SURVIVAL / BASE BUILDING - SHOOTER"
- "Refugees. Repairs. Survive. Die many times."
- CONTINUE (visar dag + zon), NEW GAME, SETTINGS, ACHIEVEMENTS
- Procedurell bakgrund med byggnadssilhuetter, lagreld, zombie-skuggor
- "What to Expect" info-panel (Build & Fortify, Scavenge & Repair, Zombie Swarms)

---

## 2. Karn-loop

```
START RUN
  |
  v
[Dagfas: 12 Action Points]
  - Bygg / uppgradera bas
  - Satt ut fallor och barrikader
  - Tilldela refugees uppgifter
  - Skicka loot runs (ett-klick)
  - Ladda vapen med ammo
  - Tangentbordsgenvargar: B=build, L=loot, R=refugees, E=end day
  |
  v
[Nattfas: Realtid]
  - Zombies attackerar i vagor
  - Spelaren ror sig med WASD
  - Auto-shoot pa narliggande fiender
  - Refugees i pillboxes hjalper till
  - Procedurell terrang (trad, stenar, vatten paverkar rorelse)
  - Base HP bar visar basens halsa
  |
  v
[Resultat]
  - Overlevde? -> Ny dag, hardare wave
  - Dog? -> Behall allt gear, starta om fran wave 1
  |
  v
REPEAT
```

---

## 3. Dagfasen (Management Mode)

### 3.1 Action Points (AP)

Varje dag har spelaren **12 AP** (representerar 12 timmars dagsljus). Varje handling kostar AP:

| Handling | AP-kostnad |
|----------|-----------|
| Bygg/placera struktur | 1-2 |
| Uppgradera struktur | 1-3 |
| Satt ut falla | 1 |
| Ladda vapen | 1 |
| Kort loot run | 3 |
| Lang loot run | 5 |
| Tilldela refugee | 0 (gratis, begransat antal) |
| Reparera vapen | 1 |

### 3.2 Byggande

Spelaren klickar i en bygg-meny (tangent B) for att valja struktur, sedan klickar pa kartan for att placera. Byggmenyn stangs INTE efter placering -- spelaren kan placera flera i rad.

Strukturer:
1. **Barrikader** -- saktar ner zombies. Billiga, lag HP. Byggs av Scrap.
2. **Vaggar** -- blockerar zombies. Dyrare, hog HP. Byggs av Scrap.
3. **Fallor** -- skadar zombies som gar over dem. Engangsfallor.
4. **Pillboxes** -- position dar en refugee kan sta och skjuta. Kraver refugee-tilldelning.
5. **Forrad** -- okar lagringskapacitet for resurser.
6. **Talt/hus** -- bostader for refugees.
7. **Matodling** -- producerar Food passivt.

Alla strukturer kan uppgraderas i nivaer (Level 1-3).

### 3.3 Loot Runs

Ett-klick-system (v1.7.0): klicka pa destinationsrad = starta direkt med nuvarande utrustning.

1. Klicka destination (kort = 3 AP, lang = 5 AP)
2. Valfritt: valj refugee-companion (ger combat strength)
3. Resultat visas, stanger automatiskt efter 3 sekunder

**Encounters:** Under loot runs kan spelaren mota en encounter:
- "Du moter en grupp plundrare. Fight or Flee?"
- Resultatet beror pa vad du tog med dig. Battre vapen och fler companions = hogre chans.
- Win: Extra loot, kanske en ny refugee
- Lose: Forlorar all loot fran den runnen. Companions kan skadas.

**Destinations per zon:**
- Forest: nearby_houses, abandoned_store
- City: city_ruins, hospital, police_station
- Military: military_outpost, armory

### 3.4 Refugee-tilldelning

Panel oppnas med tangent R. Varje refugee har:
- Portratt-ikon (cirkel fargkodad: gron=frisk, gul=skadad, rod=kritisk, bla=borta)
- HP-bar
- Jobb-knappar med visuell feedback

Jobb:
- **Samla mat** -- producerar Food
- **Samla material** -- producerar Scrap
- **Loot run** -- companion pa expeditioner
- **Reparationer** -- reparerar skadade strukturer
- **Vila/heal** -- skadade refugees aterharntar sig (kostar Meds)
- **Pillbox** -- bemannar en pillbox for nattstrid

---

## 4. Nattfasen (Action Mode)

### 4.1 Spelarkontroll

- **Rorelse:** WASD
- **Skjutning:** Auto-shoot pa narmaste fiende inom rackhall
- **Sprint:** Shift (begransad stamina, regenereras)

### 4.2 Ljud-mekanik

Varje vapen har ett **ljud-varde** (Noise Level):

| Vapenklass | Noise Level |
|-----------|-------------|
| Melee | 0 (tyst) |
| Pistol | 2 (lag) |
| Rifle | 4 (medel) |
| Shotgun | 5 (hog) |
| Explosives | 8 (extrem) |

Zombies reagerar pa vapenljud via SoundMechanic:
- Vapenljud skapar visuella ljudringar runt spelaren
- Zombies inom rackvidd andrar mal till spelaren
- Hogre noise = storre radius
- Taktiskt val: tyst melee vs effektiv rifle som drar fler zombies

### 4.3 Zombie Aggro (v1.7.0)

- 70% av zombies ar "base_seekers" -- gar direkt mot basen
- 30% ar "wanderers" -- vandrar slumpmassigt nara kartans kanter
- Brutes och bossar ar ALLTID base_seekers
- Vapenljud overridar beteendet for ALLA zombie-typer
- Mer byggd bas = fler zombies attracted (taktiskt val: stor bas vs liten)

### 4.4 Fiender

6 fiendetyper implementerade:

1. **Walker** -- langsam, lag HP, kommer i stora grupper. Grundfiende.
2. **Runner** -- snabb, lag HP, farlig i grupp. Springer runt barrikader.
3. **Brute** -- langsam, hog HP, bryter igenom vaggar. Kraver fokuserad eld.
4. **Spitter** -- ranged attack med projektiler. Kan skada spelare pa avstand.
5. **Screamer** -- drar fler zombies nar den tar skada. Prioritet-mal.
6. **Brute Boss** -- extra tuff brute med mer HP och skada.

### 4.5 Wave-struktur

Varje zon har 5 waves. Varje wave ar svarare:

- **Wave 1:** Bara Walkers. Introduktion.
- **Wave 2:** Walkers + nagra Runners.
- **Wave 3:** Fler av allt. Forsta Brute.
- **Wave 4:** Intensiv. Spitters och Screamers.
- **Wave 5:** Boss-wave. Brute Boss + alla typer.

### 4.6 Terrang (v1.7.0)

Procedurellt genererad terrang varje natt:

| Element | Effekt | Zonvariation |
|---------|--------|-------------|
| **Trad** | Blockerar rorelse (physics collider) | Forest: 5-8, City: 1-3, Military: 2-4 |
| **Stenar** | Blockerar rorelse | Forest: 4-8, City: 7-12, Military: 5-9 |
| **Buskar** | Visuell dekoration | Bara i Forest |
| **Stubbar** | Visuell dekoration | Forest + Military |
| **Vattensamlingar** | Saktar ner zombies 50% | Forest + Military |
| **Stigar** | Visuell dekoration | Alla zoner |

Tradkronor renderas ovanfor spelare/zombies for djupkansla. Seed ar deterministisk per dag.

### 4.7 Visuella effekter

- **Zombie-dod:** Tvafas-animation (flash vit + shrink), kroppen ligger kvar 10-15s
- **Blodflaggar:** Permanenta blodspar pa marken hela natten (randomiserade ellipser + droppar)
- **Base HP bar:** Visar basens halsa i HUD (gron -> gul -> rod)

### 4.8 Ljud (procedurellt via Web Audio API)

Alla ljud genereras procedurellt -- inga externa ljudfiler:
- Vapensounds per klass (pistol, rifle, shotgun, melee swing, explosives)
- Zombie groan, attack, death
- Footstep, melee hit thud, zombie attack hit
- Structure damage, day-to-night whoosh
- UI-klick, wave clear fanfare
- Ambient (natt/dag)
- **Pitch-variation:** +/-10% pa alla weapon/zombie sounds for naturlighet

---

## 5. Resurssystem

### 5.1 Resurstyper

| Resurs | Kalla | Anvandning |
|--------|-------|------------|
| **Scrap** | Loot, dekonstruera, refugee-insamling | Bygg, barrikader, fallor |
| **Food** | Refugee-insamling, odling | Haller refugees vid liv |
| **Ammo** | Loot | Ladda vapen innan natt |
| **Parts** | Sallsynt loot, encounters | Uppgradera/reparera vapen |
| **Meds** | Loot, encounters | Hela skadade refugees |

### 5.2 Resurstryck

Spelet skapar konstant tryck genom att resurser alltid ar knappa:
- Food ats varje dag (fler refugees = mer food-behov)
- Ammo forbrukas varje natt
- Vapen tappar durability varje natt
- Strukturer tar skada varje natt

---

## 6. Vapensystem

### 6.1 Vapenklasser

| Klass | Range | Damage | Noise | Speciellt |
|-------|-------|--------|-------|-----------|
| **Melee** | Kort | Medel | 0 | Tyst, riskabelt |
| **Pistol** | Medel | Lag | 2 | Balanserad |
| **Shotgun** | Kort | Hog | 5 | AOE, hogt ljud |
| **Rifle** | Lang | Medel-Hog | 4 | Bast range |
| **Explosives** | Medel | Mycket hog | 8 | AOE, sallsynt ammo |

### 6.2 Vapen-XP

Varje vapenklass tjanar XP genom anvandning. Nivaer (1-5):
- Lvl 2: +10% reload speed
- Lvl 3: +10% accuracy/damage
- Lvl 4: +10% reload speed
- Lvl 5: Speciell formaga

### 6.3 Uppgraderingar (Parts)

Vapen kan uppgraderas med Parts:
- **Damage boost** -- +15% damage
- **Extended mag** -- fler skott
- **Suppressor** -- minskar Noise Level
- **Scope** -- okar range
- **Reinforcement** -- okad durability

### 6.4 Durability

Vapen har durability som sjunker varje natt de anvands. Nar durability nar 0 gar vapnet sonder. Repareras med Parts (1 AP).

---

## 7. Skill-system

### 7.1 Filosofi

Skills levlar genom anvandning -- du blir battre pa det du gor. 10 skills, niva 1-10 vardera.

### 7.2 Skills

| Skill | Levlas genom | Effekt per niva |
|-------|-------------|-----------------|
| **Combat Melee** | Kills med melee | +damage, +swing speed |
| **Combat Pistol** | Kills med pistol | +accuracy, +damage |
| **Combat Rifle** | Kills med rifle | +accuracy, +damage, +range |
| **Combat Shotgun** | Kills med shotgun | +spread, +damage |
| **Looting** | Genomforda loot runs | Battre loot-tabeller |
| **Building** | Byggda strukturer | Billigare kostnader |
| **Speed/Agility** | Rorelse under natt | Snabbare movement |
| **Leadership** | Ha refugees i tjanst | Effektivare refugees |
| **Survival** | Overleva waves | Battre mateffektivitet |
| **Stealth** | Undvika zombies | Lagre ljud-signatur |

### 7.3 Karaktarer

Spelaren valjer karaktar vid start. Ger startbonus i skills:

1. **The Scavenger** -- +3 Looting. Bra pa att hitta grejer.
2. **The Engineer** -- +3 Building, +2 Melee. Bygger billigare och battre.
3. **The Soldier** -- +3 Rifle, +2 Pistol. Ren stridskraft.
4. **The Medic** -- Inga skill-bonusar. Haller folk vid liv genom erfarenhet.

---

## 8. Refugee-system

### 8.1 Rekrytering

Refugees fas genom:
- Loot run encounters (rescue-events, 30% chans)
- Slumpmassig invandring (chans per dag)

### 8.2 Egenskaper

Varje refugee har:
- **Namn** (genererat)
- **HP** (kan skadas, healas med Meds)
- **Status:** Frisk (gron), Skadad (gul), Kritisk (rod), Borta (bla)

### 8.3 Pillbox-bemanning

Refugees tilldelade till pillboxes auto-skjuter narmaste zombie under natten. Range och damage styrs av REFUGEE_PILLBOX_RANGE och REFUGEE_PILLBOX_DAMAGE.

---

## 9. Zoner

3 zoner implementerade, var och en med unika waves och terrang:

| Zon | Terrang | Fiender | Resurser |
|-----|---------|---------|----------|
| **Forest** | Trad, buskar, vatten | Standard mix | Grundresurser |
| **City** | Betong, asfalt | Fler runners/spitters | Mer scrap/parts |
| **Military** | Sand, kratrar | Tuffare fiender | Mer ammo/vapen |

Spelaren valjer zon i DayScene. Varje zon har egna wave-filer (src/data/).

---

## 10. Karta och bas

### 10.1 Kartlayout

- Fast karta: 1280x960 pixlar (80x60 tiles a 16px)
- Bas i centrum
- Zombies spawnar vid kartans kanter
- Procedurell terrang varje natt (trad, stenar, vatten etc.)

### 10.2 Basexpansion

Basen borjar som ett talt och byggs ut:
1. **Talt** -- start. Plats for spelaren.
2. **Camp** -- forsta upgrade. Liten mur, plats for 2 refugees.
3. **Outpost** -- andra upgrade. Battre murar, forrad, plats for 5 refugees.
4. **Settlement** -- tredje upgrade. Full bas med alla byggnadstyper.

### 10.3 Base HP (v1.7.0)

Basen har HP (200 max). Zombies som nar basens radie ger skada. HP visas som en bar i HUD under natten (gron->gul->rod). Base HP aterstalls varje natt.

---

## 11. Progression och svarighetsgrad

### 11.1 Roguelite-loop

- Spelaren dor -> behaller ALL utrustning, alla upgrades, alla refugees, all skill-progress
- Startar om fran Wave 1 med allt man har
- Bas-strukturer finns kvar (eventuellt skadade)
- Wave 5 ar avsiktligt omojlig utan flera genomgangar

### 11.2 Svarighetskurva

Varje wave okar i:
- Antal fiender
- Fiendetyper (nya typer introduceras gradvis)
- Fiendernas HP och speed
- Antal riktningar de kommer ifran

---

## 12. Achievements

Lasbara achievements som sporrar spelaren:
- Tracked via AchievementManager
- Visas i menyn under ACHIEVEMENTS
- Exempel: "Forsta natten", "100 kills", "Bygg settlement"

---

## 13. Save-system

- localStorage-baserat
- Automatisk save vid scenoverganger
- Migration for gamla save-format (SaveManager normaliserar saknade falt)
- Continue-knapp pa titelskarmen laddar senaste save

---

## 14. Random Day Events

Slumpmassiga handelser under dagfasen:
- Presenteras via EventDialog (modal med valknappar)
- Dynamisk panelhojd baserat pa innehall
- Exempel: "En grupp overlevande vill byta resurser", "Storm narmar sig"
