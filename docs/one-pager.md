# Tax Workpaper: Core Idea and Data Model

Rohit Lahori · October 2026 · live doc: https://claude.ai/code/artifact/c80b3ec3-293d-4e77-814a-cf08a7f41e82 · code: https://github.com/Rohit-Lahori02/Tax-Workpaper

## Core idea

The workpaper is not a document. It is the provenance graph the pipeline already produced, plus an append-only ledger of every fact a person adds to it. Every screen is a view over those two things.

The packet gives the graph for free. Each return line names its rule, its input lines and its source extracted values. Each extracted value names a document, a page and a position. Loading the packet and building the reverse edges turns 627 lines, 3,012 values and 74 documents into one navigable structure: pick any number and walk down to the printed field, or pick any document and walk up to every line it touched or should have touched.

People never edit that graph. They attach facts to it: this value was agreed to its source, this line is adjusted by 3,100 with this reason and this tax effect, this question went to the client, this scope was signed by the reviewer at this moment, this return was transmitted with this fingerprint. Facts are immutable and timestamped, so history, versions, undo, freeze at filing, amend on top and a self-contained notice response are all the same operation: read the ledger up to a point in time.

The design argument is trust. A number in a spreadsheet cell can be anything. A number here is either a packet fact with a source, or a ledger fact with an author. Nothing else can exist on the page, so the examiner, the new hire and the partner read the same chain.

## Data model

Three layers. The packet is stored once and never written. The ledger is one table of facts. Everything a user sees is computed from the two at read time.

Facts in the ledger point at packet nodes by the packet's own identifiers (`F1040.11`, `ev-0703`, `D31`, `check:vehicle-gift:D66`), so a real extraction pipeline can replace the simulated documents without changing a single fact.

| Fact type | Carries | What it drives |
|---|---|---|
| Verification | target, one of the firm's verification types, note | tick marks, completeness, examiner trail |
| Adjustment | target line, engine value, new value, reason, authority, tax effect from the version's per-dollar rates | working return, partner approval over the firm's threshold |
| Note, question, answer, attachment | addressee (staff or client), text, blocking flag, resolution | filing block, client answers as evidence |
| Judgment, disposition, step | decision, authority relied on, document disposition, manual step | variance explanations, elections, due diligence, completeness board |
| Sign-off, approval request, approval | level, scope, SHA-256 of the scope at signing; client PIN hint | reopens itself when any later fact touches the scope; the client signs the same hash |
| Filing | extension, transmission (hash, submission id, key lines), acknowledgment, amendment, notice response, roll-forward | freeze on transmit, simulated agency decision, Form 1040-X columns, carry-forward |
| Correction | field and the evidence it is read from (the value is never stored) | identity fixes that clear an e-file rejection |
| Assignment, time, standard, seen, sensitive view | actor, area, hours, standard key and value, cursor, fields viewed | workload, budget vs actual, firm rules as audited data, since-I-looked, view log |

Every fact has an id, sequence, actor, timestamp, target, kind, body, optional batch id and optional supersedes pointer. Undo writes a retraction that supersedes. Bulk actions share a batch id so the whole batch undoes together. Retractions, resolutions and answers fold into their parents when the ledger is projected.

A sign-off stores the hash of its scope: the working values of the lines in it and every live fact attached to them. Any later write that changes that hash flips the sign-off to reopened without a workflow engine. The same hash is what the client approves and what the transmission carries.

## How the model delivers the brief

| Requirement | How the model answers it |
|---|---|
| Evidence | Walk the graph from a line to its extracted values to the highlighted field on a simulated page. Walk up from a document to every line it reached. Verifications are facts on the edge. |
| Calculation | A line's rule and inputs render as a build tree. Thirty-one independent checks recompute lines from inputs and compare them with documents, the IRS transcript, the FTB account, broker totals and the client's own words. They trust neither the engine nor the extractor; on this packet they find twelve errors (docs/errors-found.md). |
| Change | An adjustment is a fact, so the original stays. The working return propagates it through the sums that depend on it. Versions v1 to v3 and the working return compare line by line. Since-I-looked is facts after the viewer's cursor. Undo supersedes. |
| Judgment | Variance flags compare 2024 lines to the working return under the firm's thresholds. Judgment calls and due diligence are facts with authority. Completeness is a projection: every document, every area, every outside filing, used or explained. |
| People | Roles live on the staff record and are enforced in server actions. A question is a fact addressed to a person. Blocking notes close a filing gate. Sign-offs reopen by hash; no one signs above work they prepared. Masking and view logging apply to staff without clearance. Live updates stream the ledger's sequence to every open session. |
| Filing and after | Transmission is a fact carrying the return's hash; the return freezes until the agency answers. The agency is simulated from the data (a dependent's SSN that disagrees with the card in the file is rejected with R0000-504-02 until a correction fact points at the card). An amendment is facts after the accepted transmission, shown as 1040-X columns. The timeline replays the ledger and the packet to any moment. A notice package is the lines, exhibits and facts behind the examined items. Carry-forward is the engine's carryovers plus the open basis items, fingerprinted. |
| Firm | Standards are facts the administrator or a partner writes, so a rule change is itself audited and applies everywhere at once. Time entries project against budget hours by area. Search indexes graph nodes and facts together. |

## Stack and tradeoffs

Next.js 16 with TypeScript, Postgres (Neon) with Drizzle, Zod schemas for the packet, TanStack Virtual for the 282 sales lots, and a small renderer for simulated pages. Writes go through server actions that enforce roles, so masking, freezes and view logs cannot be bypassed from the browser. A server-sent event stream pushes new facts to every open session. 53 unit tests cover the projections: ledger folding, working return, checks, sign-off hashes, filing lifecycle, standards overlay, search.

Three tradeoffs were deliberate. Projections are computed on read rather than cached, which keeps one source of truth at the cost of query work; the packet is small enough that this is free. Tax effects use the per-dollar rates the packet supplies rather than a recompute, so adjustments are labelled as estimates and engine-owned tax lines stay the engine's until it recomputes. Role switching replaces login, because the brief asks for a switcher and real authentication would add nothing to the evaluation.
