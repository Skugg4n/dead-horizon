# AI / Collision-arkitektur -- anteckningar

## Nuläge (v6.4.x)
PathGrid synkas mot fysiken genom att scanna Phaser StaticGroups runtime.
wallBodies + terrainResult.colliders är enda sanningen för både fysik och A*.
Se `PathGrid.rebuildFromPhysics()`.

## Övervägda alternativ (för framtida refactor)

### Alternativ A: Phaser Tilemap med collision layer
**Idé:** konvertera structures + terrain till tile data vid night-start,
använd `tilemap.setCollision()` och `Tileset`. Då ÄR tilemap både fysik
och AI-grid samtidigt -- inget kan drifta eftersom det finns en datastruktur.

**Pro:** ingen sync-logik alls, A* kan köras direkt mot tilemap-layer.
**Con:** kräver omskrivning av både structure-rendering och terrain-rendering
för att använda tilemap istället för separata GameObjects. Stort grepp.

**När:** om vi får fler sync-buggar som liknar de i v6.0-v6.4, eller om
vi ska lägga till tile-baserade features (flöden, zonema, terrain typer).

### Alternativ C: Yuka.js steering-library
**Idé:** ersätt hand-rollat steering med Yuka's inbyggda SteeringBehaviors
(Arrive, Seek, ObstacleAvoidance). Yuka hanterar obstacles, formations,
path following osv. out of the box.

**Pro:** battle-tested lib, bra för crowd-behavior.
**Con:** stort dependency-tillskott, rework av zombie-movement-koden,
låser in arkitekturen i Yuka's vy av världen. Ingen stor vinst över
pathfinding.js + hand-rolled steering om det nuvarande funkar.

**När:** om vi vill ha realistisk flocking, formationer, eller avancerade
beteenden (flanking, guard duty, patrol-routes).

## Designregel
Ny sanningsskälla kräver explicit sync-protokoll. Aldrig två oberoende
datastrukturer som beskriver samma värld (walls + pathgrid + colliders).
Antingen: (a) en struktur härleder sig från en annan runtime, eller
(b) en gemensam källa (tilemap) används av båda.
