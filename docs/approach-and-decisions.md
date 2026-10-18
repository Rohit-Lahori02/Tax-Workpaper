# Approach and key decisions

Rohit Lahori · October 2026 · code: https://github.com/Rohit-Lahori02/Tax-Workpaper

The companion documents are the one-pager (core idea and data model), the list of errors the checks found, and the video script. This one explains how the work was approached and why the main decisions went the way they did, including the ones that cost something.

## How I read the brief

The packet is pipeline output: 74 documents as records, 3,012 values read from them, the client's answers and messages, prior-year and agency records, firm settings, and the return as computed at three moments. Its own readme says it "contains no reviews, notes, sign-offs or decisions. Those are yours to design." It also says it contains mistakes with high confidence scores, as real pipeline output does.

So the job was not to display a return. It was to design the layer where people prove the return right, change it when it is wrong, decide what cannot be computed, sign for it, file it, and answer for it two years later, with every one of those acts attributable and recoverable. That framing drove everything below.

## Approach: ten phases, each shippable

The work went in ten phases, each committed and runnable on its own, in an order chosen so that every later phase could lean on the earlier ones:

| Phase | What landed | Why in this position |
|---|---|---|
| 0 | Load, validate and index the packet; role switcher with masking | Nothing else is trustworthy until the packet is parsed strictly (Zod) and every reference resolves. Masking had to exist before any screen showed data. |
| 1 | Evidence and trace screens | The core promise: any number opens into how it was built and the page it came from. |
| 2 | Append-only ledger: verifications, notes, questions, attachments, view log | The first facts people add. Everything after is more fact kinds on the same table. |
| 3 | Thirty-one independent checks; sales, depreciation, books-to-tax and California workpapers | Finding the packet's planted errors is the proof the evidence layer works. |
| 4 | Adjustments, working return, compare, what-ifs, since-I-looked, bulk undo | Change without editing the packet. |
| 5 | Judgment records, due diligence, document dispositions, outside filings, required steps | What cannot be computed must still be recorded and attributed. |
| 6 | Sign-offs with scope hashes, filing gates, assignments, my work, live updates | People and responsibility. |
| 7 | Timeline replay, extension and e-file lifecycle with a simulated agency, amend on top, notice packages, carry-forward | The life of the return after it is prepared. |
| 8 | Firm standards as data, time against budget, status dashboard, full-text search | The firm's view. |
| 9 | Error report, one-pager, video script | The write-up, once the facts were settled. |

After the phases came a design refresh across the whole app, then focused passes on every page, then cross-cutting work: phone and tablet layouts, loading and error boundaries, keyboard focus and reduced motion, print output, and one vocabulary for every form.

Two disciplines ran throughout. Every claim the app makes is covered by a projection with a unit test (53 tests over ledger folding, the working return, the checks, sign-off hashes, the filing lifecycle, the standards overlay and search). And every screen was checked in a real browser in both themes and, at the end, at phone and tablet widths, with each pass committed separately so the history reads as a sequence of decisions rather than one drop.

## Key decisions

Each entry gives the decision, what it was weighed against, why it won, and what it costs.

### 1. The packet is never written; people append facts

**Alternative:** a conventional workpaper database where lines, documents and review state are rows that get updated.

**Why:** a workpaper's value is that it can be believed later. If a number can be edited in place, an examiner has to trust the process. If the packet is immutable and every human act is a timestamped, attributed fact that points at a packet node, the chain of custody is the data model. Versions, undo, freeze at filing, amendment and the notice response all become the same operation: read the ledger up to a point.

**Cost:** nothing is ever simple to "just fix". A wrong record is corrected by a later record that supersedes it, and the UI has to make that feel natural rather than bureaucratic. Most of the design effort on the evidence panel and the adjustment form went into that.

### 2. Everything a user sees is computed at read time

**Alternative:** materialise the working return, sign-off states and completeness into tables updated by triggers or jobs.

**Why:** one source of truth. With projections computed per request (and cached for that request), there is no way for a cached state to disagree with the ledger, and the as-of replay on the timeline falls out for free: the same projection, run over a ledger prefix.

**Cost:** query work on every page. The packet is a few megabytes and the ledger a few thousand rows, so this is well inside budget here. At a firm's scale the projections would need snapshotting; the code is already shaped as pure functions over (packet, ledger), which is what a snapshot would memoise.

### 3. Facts address packet nodes by the packet's own identifiers

**Alternative:** internal surrogate keys with a mapping table.

**Why:** `F1040.11`, `ev-0703`, `D31`, `check:vehicle-gift:D66` are what the people in the firm already say and type. Using them as targets means the lookup box, search, links in notes and the notice package all speak one language, and a real extraction pipeline can replace the simulated documents without touching a single fact.

**Cost:** reference parsing has to be exact and in one place (`src/lib/refs.ts`), and unknown references need a graceful landing page rather than a crash.

### 4. A sign-off is a hash of its scope, not a status flag

**Alternative:** a workflow engine that marks sign-offs stale when specific events occur.

**Why:** the rule the firm actually cares for is "a signature covers exactly what was there when it was given". Storing the SHA-256 of the scope's working values and live facts at signing time enforces that rule mechanically: any later write that changes the scope changes the hash and the sign-off shows as reopened, with what changed since. No list of invalidating events to maintain and get wrong. The client's approval and the transmission carry the same hash, so "the client signed what the partner signed" is a comparison, not a promise.

**Cost:** some reopenings are pedantic (a note added to a line reopens the reviewer's sign-off on that line's area). I kept that behaviour deliberately: a reviewer should know a note appeared on something they signed, and re-signing is one click.

### 5. The checks trust neither the engine nor the extractor

**Alternative:** rely on the engine's own diagnostics, or only compare lines to their declared sources.

**Why:** the planted errors are exactly the kind that pass a declared-source check: a value read correctly from a document that should not be on the return at all (Northlake twice, the 1099-K on top of the books), a correct value converted at last year's rate, a client guess instead of the charity's form. Each check recomputes from inputs and compares to an independent witness: the IRS transcript, the FTB account, broker totals, the page text, the client's own words on a call. On this packet that finds twelve errors, five warnings and seven notes, each linked to every record it rests on.

**Cost:** each check is hand-written domain logic, and a check can be wrong. That is why every finding shows its evidence and why a finding can be closed by a judgment that says "the check is mistaken, here is why". Checks describe the packet, never the ledger, so an addressed finding still shows, marked addressed.

### 6. Adjustments layer over the engine; tax effects are labelled estimates

**Alternative:** re-run the tax computation on every adjustment.

**Why:** the engine is not in the packet, only its results and a table of per-dollar rates by category for each version. Recomputing would mean rewriting a tax engine, and a half-right one is worse than an honest estimate. So an adjustment records the engine's value, the corrected value, the reason, the authority and an effect computed from the version's rates, and the working return propagates the change through the sums that depend on the line. Engine-owned tax lines stay the engine's until it recomputes, and the UI says so.

**Cost:** a change that crosses a bracket or phase-out is approximate until the next engine run. The adjustment form says this in its footer rather than hiding it.

### 7. Roles are enforced in server actions; a switcher replaces login

**Alternative:** real authentication with sessions and an identity provider.

**Why:** the brief asks for a role switcher, and the evaluation is about what each role may do, not about password handling. Every write goes through a server action that checks the actor's role, clearance and, for sign-offs, whether they prepared the work themselves, so masking, freezes, the no-self-review rule and the view log cannot be bypassed from the browser. Swapping the switcher for a session cookie from an identity provider touches one function.

**Cost:** anyone with the URL can pick any role. Fine for a case study, not for production, and the README says so.

### 8. The agency is simulated from the data, not scripted

**Alternative:** replay the packet's timeline (which already contains a rejection and later acceptance) as canned events.

**Why:** a scripted rejection teaches nothing. The simulated IRS does what the real e-file database does: compares the dependent's SSN on the return with the identity document in the file and rejects with R0000-504-02 until a correction fact points at the card. California follows the federal decision. Fix the data and the outcome changes; leave it and it does not. That makes the filing gates and the correction record real controls rather than theatre.

**Cost:** the simulation is narrow (identity mismatch only). Other rejection codes would need their own rules.

### 9. Time is a cursor, not a copy

**Alternative:** snapshot the file at milestones.

**Why:** with an append-only ledger and read-time projections, "what did this look like in January 2028" is the same projection over facts up to that moment, plus the packet's own timeline events up to then. The cursor is a cookie, so a reviewer can set it, browse any page as of that date, and clear it.

**Cost:** anything that is not a fact or a packet event is invisible to replay. That was a useful constraint: it forced every meaningful act to be a fact.

### 10. Firm standards are facts too

**Alternative:** a config file or settings table.

**Why:** the partner threshold, the verification types and the variance tolerances change the meaning of other records. If an administrator raises the threshold, that change should be attributable and dated like everything else, and old adjustments should be judged against the threshold that applied when they were made. A standard is a fact with a key, a value and a reason; the packet's starter standards are the baseline it overlays.

**Cost:** a little indirection when reading a standard, hidden behind one accessor.

### 11. Simulated pages with real highlights, instead of page images

**Alternative:** generate PDF-like images of the documents.

**Why:** the packet has no page images, only each page's printed text and each value's position and text-as-read. Rendering the text and locating each value's string on it gives an honest trace: the highlight is where the pipeline actually read, and a value whose text cannot be found on the page is flagged as unverified rather than drawn somewhere plausible. Two of the planted problems (an unread broker page, a handwritten receipt read at 41 percent) surface precisely because the trace refuses to pretend.

**Cost:** it does not look like a scanned form. The viewer says what it is.

### 12. Design: one dense, quiet system with two audiences

**Alternative:** a generic admin template, or a separate client portal.

**Why:** staff live in this tool for a season, so density, keyboard access, fast scanning and consistent controls matter more than decoration. The design system is small (cards, pills, chips, segmented controls, reference chips, one input style, tokens for both themes) and every page was passed through it individually. The client sees the same application through the same ledger, but with internal items filtered out and balances said in plain words ("you owe the IRS", "California refunds you"), because a client should never need a glossary to sign.

**Cost:** two voices in one codebase. The permission layer and a handful of `isClient` branches carry it.

### 13. Stack

Next.js (app router, server actions, streaming), TypeScript strict, Postgres on Neon through Drizzle for the ledger, Zod for the packet, TanStack Virtual for the 282 sales lots, server-sent events for live updates, Tailwind for layout over a token sheet. No client state library: the ledger is the state and the server renders from it.

## What is simulated, and what is real

Real: the packet parsing and indexing, every projection, the checks, the ledger and its guarantees, the role enforcement, the hashes, the masking and view log, the print output. Simulated: the documents (text, not images), the people, the tax agency's decisions, the e-file transport, authentication. Each simulated piece is isolated behind one module so it can be replaced without touching the rest.

## Limits I know about

- Tax effects are estimates from per-dollar rates until the engine recomputes (decision 6).
- The simulated agency knows one rejection rule (decision 8).
- Projections are computed per request; a large firm would snapshot them (decision 2).
- The route error page could only be compile-checked; nothing in the app throws on demand.
- Print output was verified by applying the print rules on screen, not through a printer.

## How to check any of this

`pnpm test` runs the 53 projection tests. `pnpm tsx scripts/checks-report.ts` prints the checks' findings against the current return. `docs/errors-found.md` lists the twelve errors with the evidence for each. The git history is one commit per phase and per design pass, so any decision above can be read at the point it was made.
