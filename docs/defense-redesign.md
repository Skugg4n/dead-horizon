# Dead Horizon -- Defense Redesign: McGyver Tower Defense

**Version:** 2.2.0
**Datum:** 2026-04-03

---

## Vision

Skifta spelet från "run and gun" till "prep and pray".
Dagen = planera, bygga, fälla. Natten = se om din plan håller.
Spelaren är fortfarande aktiv men fällorna gör tunga lyftet.

Fällorna ska kännas HEMMABYGGDA. Desperata. Inte militärteknologi.
Tänk: bilmotor + kedjor = köttkvarn. Bensin + flaskor = eldvägg.

---

## 1. Gameplay-balans: Prep vs Action

### Idag (v2.2.0)
```
Dag:  20% av tiden (klicka lite, end day)
Natt: 80% av tiden (spring runt, döda zombies)
```

### Mål
```
Dag:  50% av tiden (planera försvar, placera fällor, optimera)
Natt: 50% av tiden (övervaka, fixa luckor, slåss i nödläge)
```

Spelaren ska tänka: "var lägger jag mina fällor?" mer än "var springer jag?"

---

## 2. McGyver-fällor (Tier 1-3)

### Tier 1: Skräp-fällor (Natt 1-3, billiga)

| Fälla | Material | Effekt | Känsla |
|-------|----------|--------|--------|
| **Nail Board** | 2 scrap | 10 dmg, cripple 2s | Planka med spikar i |
| **Trip Wire** | 1 scrap | Stun 1.5s, ingen dmg | Snubbeltråd mellan pinnar |
| **Glass Shards** | 1 scrap | 5 dmg/s i zon (3 tiles) | Krossat glas på marken |
| **Noise Maker** | 2 scrap | Attraherar zombies, sedan boom | Konservburkar på snöre + liten sprängladdning |

### Tier 2: Hemmabyggda maskiner (Natt 3-5, kräver parts)

| Fälla | Material | Effekt | Känsla |
|-------|----------|--------|--------|
| **Blade Spinner** | 5 scrap, 3 parts | 25 dmg AOE, snurrar | Bilmotor med svetsade blad |
| **Fire Pit** | 3 scrap, 2 food | Brännzon 4 tiles, 15 dmg/s, 2 nätter | Bensinfylld grop med trågaller |
| **Spring Launcher** | 4 scrap, 2 parts | 40 dmg + knockback 80px | Fjäderbelastad metalldörr |
| **Chain Wall** | 8 scrap, 2 parts | Blockerar + 10 dmg vid kontakt, 200 HP | Kedjor mellan stolpar |
| **Shock Wire** | 4 scrap, 3 parts | Stun 3s + 15 dmg, 10 användningar | Bilbatteri + ståltråd |

### Tier 3: Galna konstruktioner (Natt 5+, dyrt men brutalt)

| Fälla | Material | Effekt | Känsla |
|-------|----------|--------|--------|
| **Meat Grinder** | 12 scrap, 5 parts | 50 dmg/s i 2-tile zon, 3 nätter | Motor + kedjor + knivar. Äter zombies. |
| **Flame Thrower Post** | 8 scrap, 4 parts, 3 food | Sprayer eld i kon, 30 dmg/s, 5 nätter | Trädgårdsspruta + bensin + tändare |
| **Car Bomb** | 15 scrap, 5 parts | 200 dmg AOE 120px, engångs | Bilvrak fyllt med explosiver |
| **Razor Corridor** | 10 scrap, 4 parts | 20 dmg/s i smal 6-tile korridor | Taggtråd + rakblad mellan väggar |
| **Pit Trap** | 8 scrap, 2 parts | Fångar 5 zombies, de kan inte ta sig ur | Dold grop med lock |

---

## 3. Försvarsplanering: "Kill Zones"

Spelaren tänker i ZONER:

```
         SKOG        SKOG
          |            |
  [Trip Wire]  [Glass]  [Trip Wire]
          |            |
     [Nail Board]  [Nail Board]
          |            |
  =====[Chain Wall]=========
          |            |
     [Blade Spinner]
          |
  ---[Fire Pit]---[Fire Pit]---
          |
     [MEAT GRINDER]
          |
        BASE
```

Zombies kommer in, saktas ner, tar skada, hamnar i kill zones.
Spelaren patrullerar och fixar LUCKOR -- dödar de som tar sig igenom.

---

## 4. Refugees: Förenkla till "Camp Crew"

Istället för jobb-system: refugees ger PASSIVA bonusar.

Varje refugee = +1 i en av dessa:
- **+1 Food/dag** (de jagar/odlar)
- **+1 Scrap/dag** (de samlar)
- **+1 Repair** (fällor håller 1 natt längre)

Ingen tilldelning behövs. De bara FINNS och hjälper.
Max 5 refugees. Hittas på loot runs.

Om en refugee dör (zombie når basen) förlorar du bonusen.

---

## 5. Natt-gameplay med fällor

```
NATT BÖRJAR
  |
  Zombies spawnar vid kanterna
  |
  Fas 1: "Outer Defense"
    Trip wires, noise makers, glass shards
    Saktar ner, sprider ut, skadar lite
  |
  Fas 2: "Kill Zone"  
    Blade spinners, fire pits, chain walls
    Tunga skador, blockerar vägar
  |
  Fas 3: "Last Stand"
    Meat grinder, razor corridor nära basen
    De som tar sig hit dör snabbt
  |
  Spelaren:
    Rör sig fritt, dödar genombrott
    Reparerar skadade fällor (klicka)
    Lägger ut extra fällor med resurser
```

### Spelaren under natten:
- 30% kämpar aktivt (döda genombrott)
- 40% övervakar (titta var fällorna brister)
- 30% reparerar/omplacerar (taktiskt)

---

## 6. Dagfas: Prep-fokus

```
DAG:
  1. Se skador från natten (vilka fällor gick sönder?)
  2. Loot run för resurser
  3. Bygga/reparera fällor
  4. Planera layout för nästa natt
  5. Upgradera fällor (tier 1 -> tier 2)
  
Fler AP spenderas på BYGGANDE, mindre på random UI-klick.
```

---

## 7. Implementation-prioritet

1. **Tier 1 fällor** (4 nya, billiga, tidigt spel)
2. **Fäll-placement visualization** -- se räckvidd/effekt vid placering
3. **Tier 2 fällor** (5 nya, mid-game)
4. **Natt: fällor gör mer dmg, spelaren behövs mindre**
5. **Refugees förenklade** till passiva bonusar
6. **Tier 3 fällor** (5 nya, end-game)
7. **Kill zone visuellt** -- se var fällor överlappar

---

## 8. Ton och känsla

Varje fälla ska kännas som:
- Byggd av en desperat överlevare
- Material hittade i skräp
- Farlig för ALLA (inklusive byggaren i teorin)
- Satisfying att se fungera ("YES min Meat Grinder åt 8 zombies!")

INTE:
- Militär precision
- Sci-fi teknologi
- "Tower defense turrets"
