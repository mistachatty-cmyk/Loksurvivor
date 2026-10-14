# Survivor 616 catalog review copy

Generated on 2026-10-13 from the current Survivor 616 catalog using the repository exporter:

```powershell
cd artifacts/survivor-616
pnpm exec tsx scripts/export-lok-registry.ts ../../work/lok-registry-review
```

The generated `survivor616.catalog.sql` contains 114 catalog entries, including `survivor616.weaponRackUnlock.weapon-rack` at 750 LokTokens. The exporter also writes a cards registry file, which is not included here.

The catalog SQL was applied on 2026-10-14 to the shared Supabase project **LokServices** (`jfavkudihasswkhkouxq`), tenant **lok** (`0a4dd8fb-abbe-4a88-b92c-1222c84d7d37`), after owner authorization. The seven existing Survivor 616 entries matched the generated descriptions, names, rarity, and payloads. The upsert preserves their live prices. A readback found 114 Survivor 616 rows and the active Weapon Rack entry at 750 LokTokens (`boost`, `rare`). A real account purchase and arena unlock still need an end-to-end check.

For future catalog changes, regenerate the SQL, compare it with the live registry, and publish through an authorized owner session.
