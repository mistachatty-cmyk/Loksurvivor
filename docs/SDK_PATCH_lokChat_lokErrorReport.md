# SDK patch: `lokChat` and `lokErrorReport` manifest blocks

The vendored SDK in `lib/lok-universe` is the source of truth in `Lok-EcoSystsem/universe-sdk` and must not be edited here.
`artifacts/survivor-616/lok.universe.json` already uses these two blocks, and `pnpm lok:check` (packages/lok-ecosystem)
validates them, but `PlatformManifest` does not know about them yet. To make the SDK carry them:

1. In `Lok-EcoSystsem/universe-sdk/src/types.ts`, add to `PlatformManifest` (the text below is also exported as
   `SDK_SCHEMA_PATCH` from `@lok/ecosystem`, and a test keeps it in step with the checker):

```ts
/** LokErrorReport (packages/lok-error-report): crash capture and the themed pop-up. */
lokErrorReport?: { enabled: boolean; source: string };
/** LOK Chat (packages/lok-chat): per-feature switches, unset means on. */
lokChat?: {
  enabled: boolean;
  source: string;
  features?: Partial<Record<"chat" | "depth" | "questionsBack" | "twoBubbles" | "proactive" | "memory" | "strip" | "scenes" | "group" | "moods" | "presence" | "reactions", boolean>>;
};
```

2. Bump `SDK_VERSION` (minor: 1.3.0), run `sync-sdk.sh` in each platform repo, and set `"sdkVersion": "1.3.0"` in every
   `lok.universe.json`. `pnpm lok:status` then shows which apps are behind.
3. Nothing else changes in 616: `pnpm lok:check` already passes with these blocks.

Switch names mirror `CHAT_FEATURES` in `packages/lok-chat/src/features.ts`; add a name there and in the type above together.
