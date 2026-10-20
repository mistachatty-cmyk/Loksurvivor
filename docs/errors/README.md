# docs/errors

LokErrorReport writes one markdown file per distinct crash here, automatically, while the game runs under
`pnpm dev` (name = 16-hex fingerprint; repeats bump the occurrence count instead of adding files).
Synthetic "LokErrorReport test" crashes are never written. Run `pnpm errors:docs` (in `artifacts/survivor-616`)
to roll them into `docs/ERRORS.md`. Delete a file once the crash is fixed.
