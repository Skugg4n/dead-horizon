# Dead Horizon -- Projektregler

## VIKTIGT -- Innan VARJE push
1. Bumpa GAME_VERSION i src/config/constants.ts
2. Kor ALLA tre checks: `npx tsc --noEmit && npm run lint && npx vitest run`
3. Om nagon failar: FIXA INNAN PUSH. Annars deployas INTE koden.
4. Vid problem: Las LESSONS.md -- kanda CI/deploy-problem och losningar finns dar.

## Projekt
Dead Horizon ar ett webbbaserat top-down wave defense / base builder med roguelite-progression.
Tech stack: Phaser 3 + TypeScript + Vite.

## Dokumentation
Las alltid relevanta docs INNAN du borjar arbeta:
- docs/vision.md -- karnidan och tonen
- docs/game-design.md -- alla spelmekaniker
- docs/technical-spec.md -- arkitektur och filstruktur
- docs/art-direction.md -- visuell stil
- docs/projectplan.md -- vad som ska goras och i vilken ordning

## Regler
1. Uppdatera alltid versionsnummer vid andringar
2. Logga alla andringar i CHANGELOG.md (version, datum, tid, vad och varfor)
3. Uppdatera docs/projectplan.md -- kryssa av klara uppgifter
4. Kolla LESSONS.md innan debugging -- kanda problem och losningar finns dar
5. Lagg till nya losningar i LESSONS.md
6. Anvand ALDRIG EM dash
7. Behåll svenska tecken: å ä och
8. All speldata i JSON-filer (src/data/), inte hardkodad i kod
9. TypeScript strict mode
10. Kommentera komplex logik pa engelska i koden

## Kodstandard
- Filnamn: PascalCase for klasser (Player.ts), camelCase for utils (math.ts)
- Exportera alltid typer fran config/types.ts
- Managers anvander Phasers event-system for kommunikation
- Object pooling for allt som skapas/forstors ofta (zombies, projektiler)

## Vid oklarheter
Las docs/game-design.md. Om svaret inte finns dar, FRAGA -- gissa inte.
