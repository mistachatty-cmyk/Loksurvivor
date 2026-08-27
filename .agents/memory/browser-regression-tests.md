---
name: Browser regression tests
description: Environment constraint for running browser-level UI tests in this workspace.
---

Playwright browser tests should support an explicit Chromium executable path in addition to the bundled browser default.

**Why:**  
The workspace's NixOS shell may provide Chromium libraries without exposing the bundled Playwright headless shell's shared-library environment to the test process.

**How to apply:**  
Keep the runner's executable override optional so CI can use the normal Playwright browser, while local Replit validation can point it at the workspace's installed Chromium.