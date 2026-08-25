---
name: GitHub collaboration bridge
description: How this workspace accesses the connected GitHub repository for shared handoffs.
---

The connected GitHub integration is accessed through `await listConnections("github")`, then `await connections[0].getClient()` inside an impure CodeExecution function. The returned client exposes Octokit REST methods.

**Why:** The connector is asynchronous and returns an array of connection records; treating it as a client or calling methods before awaiting it produces an empty or unusable connection.

**How to apply:** Use the connected client for repository inspection and explicit issue, branch, file, and pull-request operations. Keep GitHub mutations serialized within one repository.