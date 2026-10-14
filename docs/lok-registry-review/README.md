# Survivor 616 catalog review copy

Generated on 2026-10-13 from the current Survivor 616 catalog using the repository exporter:

```powershell
cd artifacts/survivor-616
pnpm exec tsx scripts/export-lok-registry.ts ../../work/lok-registry-review
```

The generated `survivor616.catalog.sql` contains 114 catalog entries, including `survivor616.weaponRackUnlock.weapon-rack` at 750 LokTokens. This file is a review artifact; it has not been applied to the shared Lok economy. The exporter also writes a cards registry file, which is not included because this change only adds a store item.

Before applying, have the economy owner confirm the target Supabase project and tenant context and review the catalog diff against the live registry. This checkout does not have the authorized publishing session.
