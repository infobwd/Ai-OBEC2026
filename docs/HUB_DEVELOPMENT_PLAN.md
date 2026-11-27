# AI OBEC — Knowledge & Production Hub V1.0
Approved direction: 2026-11-27. Internal project, not an official OBEC service.

## Objective and architecture
Apply WD Media queue/report/review pattern to existing P0–P5; keep academic and media tracks separate. Existing daily 08:00 Asia/Bangkok automation stays unchanged. No new paid service or Supabase project. Google Sheets is proposed operational registry after migration; existing Drive logs remain authoritative until cutover gates pass. Drive source read-only; internal deliverables stay in approved Drive folders. GitHub public contains code, generic standards and aggregate project status only. Never publish internal links, source IDs, personal data, exam content, credentials or private reports.

## Roadmap
| ID | Deliverable | Acceptance |
|---|---|---|
| H0 | Reconcile latest Drive backlog, source registry, GitHub overview | Exact versions read; conflicts explicit; no duplicate D1/D2 |
| H1 | Internal Sheets registry | Unique stable job IDs; separate academic/media jobs; source/version lineage, QA, delivery, human review, run log; readback; no cutover until verified |
| H2 | Responsive dashboard | Public-safe overview only; private queue/library/review require authenticated backend; stale or unavailable status clearly labeled |
| H3 | Apps Script queue and chat bridge | Idempotent request ID; lock/lease; expected_job_id guard; retries, audit and readback; reject unauthorized access |
| H4 | Review and revision | PDF/PNG Drive readback; A4 A/B + square A/B; human approval distinct from technical QA; new revision retains old file |
| H5 | Loop integration | Existing schedule; one unit per run; verify registry, Drive, log and public summary; no duplicate delivery; E2E and permission tests |

## Operating contract
Academic jobs: PLAN_KNOWLEDGE, EXTRA_KNOWLEDGE, REVISION; media jobs: MEDIA_BACKFILL, MEDIA_VARIANT, MEDIA_REVISION. State QUEUED, PENDING_REVIEW, CLAIMED, PRODUCING, TECH_QA, DELIVERED_INTERNAL, BLOCKED; independent QA PASS/PARTIAL/BLOCKED/NO_CHANGE, review PENDING/APPROVED/CHANGES_REQUESTED (human only), selection UNSELECTED/SELECTED (human only). Use source ID + revision, job ID and artifact version to dedupe. Do not infer approvals or count a queued job as delivered. Reports include run ID, job ID, actual changes, verified internal links, blockers and next job. Public projection excludes private IDs/URLs. For automated claims use a single server-side lock and lease token; no spreadsheet-only claim in concurrent workers. Expired claims require reconciliation before retry. Avoid formula injection and escaped user input; authorization server-side, deny by default; no browser secrets or public JSONP. Private UI should be served by restricted Apps Script web app if cross-origin identity cannot be proven. Do not enable anonymous deployment or change sharing.

## Initial implementation
H0 latest log reconciled with current overview: D1/D2 delivered internally, D3 next subject to revised day-3 evidence, P1 media pending. Historical logs retained. H1 initialize registry from actual log; source registry remains referenced, not copied publicly. H2 code preview reads only public aggregate status. Live private operations and Pages deployment require separate verification. H3–H5 remain pending until authentication, claim/retry and readback tests pass. No change to existing Knowledge Loop or academic queue.

## สถานะการดำเนินงาน 27 พฤศจิกายน 2569
- H0 PASS (log reconciliation): latest internal log and source registry read, 29 source rows in register; D3 remains next academically. This is not a new full source scan or artifact QA.
- H1 PARTIAL: six-tab pilot workbook built locally from the verified log/registry (Overview, Queue, Sources, Artifacts, Runs, Hub_Plan). Native import returned INVALID_ARGUMENT; no confirmed Google Sheets creation, no operational queue or migration. Check folder for duplicate before retry. Keep pilot internal.
- H2 PARTIAL: hub/index.html V0.1 committed and read back, public-only status text with explicit unavailable state. Pages deployment and browser test not verified; no private backend.
- H3–H5 PENDING: complete H1 readback first, then restricted Apps Script deployment and auth/queue tests. Never expose credentials/Drive links publicly. Do not alter existing academic automation. 
- Next action: verify internal native registry import and its schema/rows, then test H2 and deploy only the public-safe preview. Do not replace authoritative backlog or treat pilot statuses as delivery receipts.
