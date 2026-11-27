# H3 — Queue Sandbox V0.1 (2026-11-27)

Scope: synthetic jobs only. No real queue claims, no production workbook writes, no credentials or internal file identifiers in this repository. The existing Drive backlog is authoritative. No anonymous API. Do not enable the daily Loop bridge yet.

## Files
- QueueCore.gs: deterministic state machine; queueCoreTests() has 27 synthetic assertions.
- Code.gs: Apps Script sandbox adapter, default denied unless explicit sandbox configuration. Script lock guards all mutations; successful requests and response are saved together in a single bounded property, then read back. No automatic reclaim of an expired job. No human review or delivery approval endpoint yet.

## Restricted installation
1. Create a NEW standalone Apps Script project in the authorized project account; do not bind it to or write into the production register. Copy both .gs files.
2. Set project time zone Asia/Bangkok. In Script Properties set HUB_MODE=SANDBOX_ONLY; set HUB_ROLE_MAP to a JSON mapping of explicitly authorized account emails to ADMIN, WORKER or VIEWER. Keep this map private; do not commit values. No user identity is accepted from request fields.
3. Run queueCoreTests() in the editor and compare the 27 assertions. As the authorized ADMIN, run initializeSandbox() once; repeat must not overwrite the existing state. Do not log tokens or dump the stored journal.
4. If using a web app, deploy as the accessing user, only for explicitly permitted signed-in users (or only yourself for initial testing). No anonymous/anyone deployment. If Workspace policy or active-user email is unavailable, fail closed. Script editors are trusted administrators with full property access; do not share editor access with workers.
5. Confirm denied unknown identity, viewer list only, worker claim/start/renew/submit/block and admin-only reconcile; test with two actual authorized accounts and two concurrent invocations. Confirm lock timeout does not write, property readback and restart behavior. Test expiration and repeated request ID. Use TEST-* IDs exclusively.
6. The web page offers read-only synthetic queue listing; mutations can be exercised from controlled test code calling sandboxRequest. The adapter intentionally has no doPost, public token, production data connector, automatic execution, or completion endpoint. The journal is bounded to 8000 bytes; capacity exhaustion fails closed. This is not a scalable storage design.

## Contract
Request: action, request_id (8–80 safe characters), expected_job_id, track for claim, lease_token for worker transitions. Read action list requires signed-in authorized role. Each successful mutation records actor, request ID, signature, timestamp and response. Same actor and same request payload replay the recorded receipt; an old claim receipt does not extend a lease. Worker must use valid owner/token/expiry for subsequent transitions. Only the next eligible queued test job on the selected track can be claimed, and at most one active lease exists across tracks. Pending review jobs cannot be claimed. submit goes to TECH_QA, not delivered or approved. Expired lease requires admin reconciliation to BLOCKED; never auto-retry. 

## Cutover gates
H2: actual Pages enablement, mobile/desktop, valid/stale/malformed/unavailable data and no private data leakage.
H3: real Apps Script deployment and identity/lock tests above, private test spreadsheet adapter with durable atomic audit; explicit production schema migration and protected single-writer path. Do not activate until reconciled with latest Drive backlog and a rollback plan. H4: verify actual files and human review; H5: end-to-end automation without duplicate jobs and with unchanged 08:00 schedule.
Test result at this commit: pure engine 27/27 in JavaScript runtime. Apps Script service calls, identity, actual concurrency, persistence, browser rendering and Pages deployment NOT verified. No claim of production readiness.
