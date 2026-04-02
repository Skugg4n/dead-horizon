# Dead Horizon -- Systems Integration Design

**Version:** 2.0
**Datum:** 2026-04-02

---

## Problemet idag

Systemen (vapen, refugees, byggnader, forsvar) ar isolerade:
- Spelaren bar obegransat antal vapen
- Refugees kan "GUARD" men det ar otydligt
- Byggnader som Pillbox/Shelter/Farm ar lastda bakom base-upgrade men upplasan forklaras inte
- Refugees gor inget synligt under natten
- Ingen koppling mellan vapen-inventariet och refugees

---

## Design: Integrerat forsvarssystem

### 1. Vapenbegransning

Spelaren bar MAX 2 vapen per natt (primary + secondary).
- Valjs i DayScene innan natten borjar (Loadout-panel)
- Ovriga vapen finns i forradet (Storage)
- Motiverar att SPARA bra vapen, inte bara stapla

### 2. Refugees som forsvarare

Refugees med jobb "GUARD" forsvarar basen aktivt under natten:
- Varje GUARD-refugee behover ett VAPEN (tilldelas i DayScene)
- De placeras automatiskt vid narmaste Pillbox/Fortification
- Under natten: de skjuter zombies inom rackvidd (som nuvarande pillbox-system men med vapenstats)
- Utan vapen: de sloss med navar (5 dmg, kort range)

#### Refugee Loadout-panel (ny):
```
REFUGEE: Alex [HP: 80/100] [Job: GUARD]
Weapon: [Worn Pistol ▼]    <- dropdown av tillgangliga vapen
Position: [Pillbox #1 ▼]   <- dropdown av lediga positioner
```

### 3. Byggnadsprogression (tydligare)

Base-niva laser upp byggnader. Gora detta TYDLIGT i build-menyn:

| Base Level | Namn | Kostar | Laser upp |
|-----------|------|--------|-----------|
| 0 | Tent | Start | Barricade, Wall, Trap |
| 1 | Camp | 30 scrap, 5 parts | +Pillbox, +Shelter (2 refugees), +Spike Strip |
| 2 | Outpost | 60 scrap, 15 parts | +Storage, +Bear Trap, +Landmine, +Sandbags (5 refugees) |
| 3 | Settlement | 120 scrap, 30 parts | +Farm, +Electric Fence, +Watchtower (10 refugees) |

Build-menyn visar:
- Tillgangliga: vit text, klickbar
- Last: gra text med "Requires Camp" etc. -- men ocksa visa VAD som behovs for att lasa upp

### 4. Nattligt forsvar -- hur det funkar ihop

```
NATT BORJAR
  |
  Spelaren (2 vapen, ror sig fritt)
  |
  GUARD-refugees vid Pillboxes (med tilldelade vapen)
    - Skjuter automatiskt narmaste zombie
    - Damage baserat pa vapnets stats
    - Forbrukar ammo fran inventory
    - Kan skadas av zombies som nar pillboxen
  |
  Fallor (passive forsvar)
    - Spike strips, bear traps, landmines
    - Barricades/walls saktar ner
  |
  Basen (tar skada om zombies nar den)
```

### 5. Loadout-fas (ny fas mellan Dag och Natt)

Innan natten borjar visas en LOADOUT-skarm:
```
YOUR LOADOUT:
  Primary:   [Fire Axe ▼]
  Secondary: [Hunting Rifle ▼]

BASE DEFENSE:
  Pillbox #1: Alex [Worn Pistol] -- READY
  Pillbox #2: (empty)
  Guard Post: Maria [Baseball Bat] -- READY

  Barricades: 4 placed
  Traps: 2 spike strips, 1 bear trap

  [START NIGHT >>]
```

### 6. Economy-loop med koppling

```
DAG:
  Loot runs -> hittar vapen + resurser
  Crafting -> reparera/uppgradera vapen
  Refugees -> tilldela jobb (GUARD/GATHER/REST)
  Byggnader -> placera forsvar, uppgradera bas
  Loadout -> valj dina vapen + bevaapna refugees
  
NATT:
  Spelaren stridar (2 vapen)
  Refugees forsvarar (tilldelade vapen)
  Fallor gor passiv skada
  Zombie drops -> mer resurser

DOD:
  Behall allt gear, alla vapen, alla refugees
  Ny terrang-layout ("parallell dimension")
  Borja om fran Natt 1 med allt du samlat
```

---

## Implementation-prioritet

1. **Vapenbegransning** (2 per natt) -- enkel, stor gameplay-paverkan
2. **Refugee-vapen-koppling** -- ge vapen till refugees
3. **Loadout-skarm** -- visa forsvar innan natt
4. **Byggnadsprogression tydligare** -- fix build-menyn
5. **Guard AI forbattring** -- refugees skjuter med vapenstats
