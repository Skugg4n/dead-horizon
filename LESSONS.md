# Dead Horizon -- Lessons Learned

Kanda problem och losningar. Kolla har innan du debuggar.

---

## Projektsetup

### Google Drive och npm
**Problem:** node_modules i Google Drive orsakar synkproblem (tusentals filer).
**Losning:** Projektet ligger i ~/Projects/dead-horizon, INTE i Google Drive. Docs kopierades dit fran Drive.

### Vite och icke-tomma mappar
**Problem:** `npm create vite@latest . -- --template vanilla-ts` kraschar om mappen inte ar tom.
**Losning:** Satt upp Vite manuellt med package.json, tsconfig.json och vite.config.ts.
