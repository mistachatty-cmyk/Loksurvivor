# LokErrorReport (packages/lok-error-report)

- Zero game imports; the 616 wiring is `src/lib/lokErrorReport.ts`, `main.tsx`, `RunScreen.tsx` (rAF loop is
  try/caught and pauses the run) and `ui/LokErrorSettings.tsx`.
- Display rule: dev shows file:line:col + code; production shows "LOK doesn't have access to the code behind this one."
  and never the message or stack.
- Dev endpoint is the only thing that writes `docs/errors/`; "LokErrorReport test" crashes are never written.
- Nothing is sent to LOK cloud unless the player presses Send (auto-send setting defaults off).
- `vite.config.ts` imports the plugin by relative path (Node cannot resolve the TS package entry).
- Product spec and extraction checklist: `docs/LOK_ERROR_REPORT.md`.
