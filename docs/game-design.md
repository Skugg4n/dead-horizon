# Dead Horizon -- Game Design Document

**Version:** 0.1.0
**Datum:** 2026-03-28
**Status:** Draft

---

## 1. Spelöversikt

Genre: Top-down wave defense / base builder / roguelite / idle
Perspektiv: Top-down (rakt ovanifrån)
Kontroll: Mus (dagfas), Tangentbord (nattfas)
Session-längd: En "dag" (dag + natt) tar ca 3-5 minuter realtid

---

## 2. Kärn-loop

```
START RUN
  |
  v
[Dagfas: 12 Action Points]
  - Bygg / uppgradera bas
  - Sätt ut fällor och barrikader
  - Tilldela refugees uppgifter
  - Skicka loot runs
  - Ladda vapen med ammo
  |
  v
[Nattfas: Realtid]
  - Zombies attackerar i vågor
  - Spelaren rör sig med piltangenter
  - Auto-shoot på närliggande fiender
  - Refugees i pillboxes hjälper till
  |
  v
[Resultat]
  - Överlevde? -> Ny dag, hårdare wave
  - Dog? -> Behåll allt gear, starta om från wave 1
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
| Sätt ut fälla | 1 |
| Ladda vapen | 1 |
| Kort loot run | 3 |
| Lång loot run | 5 |
| Tilldela refugee | 0 (gratis, begränsat antal) |
| Reparera vapen | 1 |

### 3.2 Byggande

Spelaren klickar i en bygg-meny för att välja struktur, sedan klickar på kartan för att placera. Strukturer inkluderar:

1. **Barrikader** -- saktar ner zombies. Billiga, låg HP. Byggs av Scrap.
2. **Väggar** -- blockerar zombies. Dyrare, hög HP. Byggs av Scrap.
3. **Fällor** -- skadar zombies som går över dem. Engångs eller begränsad durability.
4. **Pillboxes** -- position där en refugee kan stå och skjuta. Kräver refugee + vapen.
5. **Förråd** -- ökar lagringskapacitet för resurser.
6. **Tält/hus** -- bostäder för refugees. Fler bostäder = fler refugees kan hanteras.
7. **Matodling** -- producerar Food passivt (idle-element).

Alla strukturer kan uppgraderas i nivåer (Level 1-3 i MVP).

### 3.3 Loot Runs

Spelaren skickar sig själv eller refugees på expeditioner:

1. Välj destination (kort = 3 AP, lång = 5 AP)
2. Välj utrustning att ta med (vapen, meds)
3. Välj sällskap (refugees -- men de saknas då hemma)
4. Kör! Resultat visas efter AP-kostnaden spenderats

**Encounters:** Under loot runs kan spelaren möta en encounter. Presenteras som ett val:
- "Du möter en grupp plundrare. Fight or Flee?"
- Resultatet beror på vad du tog med dig. Bättre vapen och fler companions = högre chans att lyckas.
- Win: Extra loot, kanske en ny refugee
- Lose: Förlorar all loot från den runnen. Companions kan skadas.

### 3.4 Refugee-tilldelning

Refugees tilldelas via sliders/knappar:
- **Samla mat** -- producerar Food
- **Samla material** -- producerar Scrap
- **Loot run** -- följer med på expeditioner
- **Reparationer** -- reparerar skadade strukturer
- **Vila/heal** -- skadade refugees återhämtar sig (kostar Meds)

---

## 4. Nattfasen (Action Mode)

### 4.1 Spelarkontroll

- **Rörelse:** Piltangenter (eller WASD)
- **Skjutning:** Auto-shoot på närmaste fiende inom räckvidd
- **Vapenval:** Siffertangenter (1-5) eller scroll
- **Sprint:** Shift (begränsad stamina)

### 4.2 Ljud-mekanik

Varje vapen har ett **ljud-värde** (Noise Level):

| Vapenklass | Noise Level |
|-----------|-------------|
| Melee | 0 (tyst) |
| Pistol | 2 (låg) |
| Pistol + Suppressor | 1 |
| Rifle | 4 (medel) |
| Shotgun | 5 (hög) |
| Explosives | 8 (extrem) |

Zombies har en **awareness radius**. När ett vapen avfyras inom deras radius, ändrar de bana mot ljudkällan. Högre noise = större radius. Detta skapar taktiska val:
- Använd melee för att vara tyst men riskera närkamp
- Använd rifle för att ta ut fiender på avstånd men dra fler mot dig
- Suppressors minskar noise med 1-2 nivåer

### 4.3 Fiender

**MVP-fiender:**
1. **Walker** -- långsam, låg HP, kommer i stora grupper. Grundfiende.
2. **Runner** -- snabb, låg HP, farlig i grupp. Springer runt barrikader.
3. **Brute** -- långsam, hög HP, bryter igenom väggar. Kräver fokuserad eld.

**Framtida fiender (post-MVP):**
4. Spitter (ranged attack)
5. Screamer (drar fler zombies när den tar skada)
6. Boss-varianter

### 4.4 Wave-struktur

Varje "level" har 5 waves. Varje wave är svårare:

- **Wave 1:** Bara Walkers. Introduktion.
- **Wave 2:** Walkers + några Runners.
- **Wave 3:** Fler av allt. Första Brute.
- **Wave 4:** Intensiv. Kräver bra försvar.
- **Wave 5:** Boss-wave. Designad att kräva flera runs av wave 1-4 för att ha nog utrustning.

---

## 5. Resurssystem

### 5.1 Resurstyper

| Resurs | Källa | Användning |
|--------|-------|------------|
| **Scrap** | Loot, dekonstruera, refugee-insamling | Bygg, barrikader, fällor |
| **Food** | Refugee-insamling, odling | Håller refugees vid liv |
| **Ammo** | Loot, köp (framtid) | Ladda vapen innan natt |
| **Parts** | Sällsynt loot, encounters | Uppgradera/reparera vapen |
| **Meds** | Loot, encounters | Hela skadade refugees |

### 5.2 Resurstryck

Spelet skapar konstant tryck genom att resurser alltid är knappa:
- Food äts varje dag (fler refugees = mer food-behov)
- Ammo förbrukas varje natt
- Vapen tappar durability varje natt
- Strukturer tar skada varje natt

Spelaren måste alltid prioritera. Det ska aldrig finnas nog av allt.

---

## 6. Vapensystem

### 6.1 Vapenklasser

| Klass | Range | Damage | Noise | Ammo/natt | Speciellt |
|-------|-------|--------|-------|-----------|-----------|
| **Melee** | Kort | Medel | 0 | 0 | Tyst, riskabelt |
| **Pistol** | Medel | Låg | 2 | 2 | Balanserad |
| **Shotgun** | Kort | Hög | 5 | 4 | AOE, högt ljud |
| **Rifle** | Lång | Medel-Hög | 4 | 3 | Bäst range |
| **Explosives** | Medel | Mycket hög | 8 | 5 | AOE, sällsynt ammo |

### 6.2 Rariteter

1. **Common** (grå) -- grundvapen, låga stats
2. **Uncommon** (grön) -- något bättre
3. **Rare** (blå) -- märkbart bättre, kan ha bonus-egenskap
4. **Legendary** (orange) -- unika vapen med speciella effekter

### 6.3 Vapen-XP

Varje vapen tjänar XP genom användning. Nivåer (1-5):
- Lvl 2: +10% reload speed
- Lvl 3: +10% accuracy/damage
- Lvl 4: +10% reload speed
- Lvl 5: Speciell förmåga (beror på vapen)

### 6.4 Uppgraderingar (Parts)

Vapen kan uppgraderas med Parts:
- **Damage boost** -- +15% damage
- **Extended mag** -- fler skott innan reload
- **Suppressor** -- minskar Noise Level med 1-2
- **Scope** -- ökar range (rifles)
- **Reinforcement** -- ökad durability

### 6.5 Durability

Vapen har durability som sjunker varje natt de används. När durability når 0 går vapnet sönder (kan inte användas). Repareras med Parts (1 AP).

---

## 7. Leveling-system

### 7.1 Filosofi

Skills levlar genom användning -- du blir bättre på det du gör. Ingen generell "level." Varje skill har nivå 1-10. XP tjänas automatiskt genom relaterade aktiviteter.

### 7.2 Skills (MVP)

| Skill | Levlas genom | Effekt per nivå |
|-------|-------------|-----------------|
| **Combat (per vapenklass)** | Kills med den vapenklassen | +accuracy, +damage, +reload speed |
| **Looting** | Genomförda loot runs | Bättre loot-tabeller, färre AP per run, bättre encounter-odds |
| **Building** | Byggda/uppgraderade strukturer | Billigare kostnader, starkare strukturer |

### 7.3 Skills (Post-MVP)

| Skill | Levlas genom | Effekt per nivå |
|-------|-------------|-----------------|
| **Speed/Agility** | Rörelse under natt | Snabbare movement, dodge-chans |
| **Leadership** | Ha refugees i tjänst | Effektivare refugees, fler kan hanteras |
| **Survival** | Överleva waves | Bättre mateffektivitet, meds effektivare |
| **Stealth** | (kräver stealth-mekanik) | Lägre ljud-signatur, zombies reagerar långsammare |

### 7.4 Karaktärer

Spelaren väljer karaktär vid start av varje run. Karaktären ger startbonus i skills:

1. **The Scavenger** -- +3 Looting, +2 Speed. Bra på att hitta grejer.
2. **The Engineer** -- +3 Building, +2 Combat (Melee). Bygger billigare och bättre.
3. **The Soldier** -- +3 Combat (Rifle), +2 Combat (Pistol). Ren stridskraft.
4. **The Medic** -- +3 Survival, +2 Leadership. Refugees håller sig friskare.

---

## 8. Refugee-system

### 8.1 Rekrytering

Refugees fås genom:
- Loot run encounters (rescue-events)
- Slumpmässig invandring (chans per dag)

### 8.2 Egenskaper

Varje refugee har:
- **Namn** (genererat)
- **HP** (kan skadas, healas med Meds)
- **Skill-bonus** (t.ex. "Bra skytt", "Snabb samlare", "Mekaniker")
- **Morale** (post-MVP: påverkas av mat, skador, dödsfall bland andra)

### 8.3 Status

- **Frisk** -- kan tilldelas jobb
- **Skadad** -- måste vila + Meds för att bli frisk. Kan inte jobba.
- **Borta** -- på loot run

---

## 9. Karta och bas

### 9.1 Kartlayout

- Fast stor karta (storlek TBD vid prototyp)
- Bas i centrum (börjar som tält)
- Horisontell väg som går genom kartan
- Skog/natur runt vägen
- Fog of war -- bara området nära basen och utforskade vägar är synliga
- Zombies spawnar vid kartans kanter, följer vägar mot basen

### 9.2 Basexpansion

Basen börjar som ett tält och byggs ut:
1. **Tält** -- start. Plats för spelaren.
2. **Camp** -- första upgrade. Liten mur, plats för 2 refugees.
3. **Outpost** -- andra upgrade. Bättre murar, förråd, plats för 5 refugees.
4. **Settlement** -- tredje upgrade. Full bas med alla byggnadstyper.

### 9.3 Fog of War

- Spelaren ser bara ett begränsat område runt basen
- Loot runs avslöjar mer av kartan
- Zombies är osynliga tills de är inom synfältet
- Ljud kan höras utanför synfältet (indikation att fiender närmar sig)

---

## 10. Progression och svårighetsgrad

### 10.1 Roguelite-loop

- Spelaren dör -> behåller ALL utrustning, alla upgrades, alla refugees, all skill-progress
- Startar om från Wave 1 med allt man har
- Bas-strukturer finns kvar (eventuellt skadade)
- Wave 5 är avsiktligt omöjlig utan flera genomgångar

### 10.2 Svårighetskurva

Varje wave ökar i:
- Antal fiender
- Fiendetyper (nya typer introduceras gradvis)
- Fiendernas HP och speed
- Antal riktningar de kommer ifrån

### 10.3 Framtida progression (post-MVP)

- Flera "levels" (5 waves per level)
- Nya zoner med unika fiender och resurser
- Prestige-system (reset med permanenta bonusar)
