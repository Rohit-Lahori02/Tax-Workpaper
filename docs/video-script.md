# Video script: the Miraflores workpaper in eight minutes

Two tracks per section: **SAY** is the narration, **SHOW** is exactly what is on screen and what you click. Record at 1440 wide, dark theme, with Priya Raman (preparer) selected unless the script says otherwise. Move the cursor slowly and let each screen sit for a beat before you speak over it.

Nothing is typed for the camera except the records the script tells you to make live. Every number quoted below is in the packet.

## Before you hit record

- Open the app (local dev server or the Vercel deployment). Press the theme toggle (top right) until it is dark.
- Actor chip (top right) → **Priya Raman · Preparer**. Reveal (the eye icon) off, so the "Masked" label shows.
- Visit `/checks` once so it is warm. Note which findings already show **addressed** (the Northlake duplicate is addressed if an adjustment was recorded earlier). Pick findings that are still open for the live parts: **federal-estimates** and **vehicle-gift**.
- Visit `/approve` once. If it says "sent, but the return changed since", that is fine and the script covers it.
- Close other tabs; the browser's own chrome should be out of frame or minimal.

Timings are a guide. The sections marked **core** carry the argument; cut the others first.

---

## 0:00 Open (core, 40 s)

**SHOW**
- `/` Overview. Let the header sit: *Married filing jointly · Tax year 2025 · CL-20417*, the household name, "Return v3 is current… with N working adjustments on top".
- Slowly pass the cursor over the four tiles (federal total tax, federal balance due, California total tax, California refund).
- Pass over the status chips under the title: *In preparation*, *12 check errors*, *7 engine warnings*, *13 documents reach no line*.

**SAY**
"This is a tax workpaper for one household, the Okafor-Lindqvists, tax year 2025. A pipeline read 74 documents, pulled about three thousand values off their pages, and an engine computed the return three times as documents arrived. The firm's job is to prove that return is right before it files it, and to prove it again two years later when the IRS asks.

The idea is simple. The packet is never edited. Everything a person does, verifying a line, asking the client a question, changing a number, signing off, filing, is a fact appended to a ledger. Every screen is a view over the packet plus that ledger. Nothing is deleted. A mistake is corrected by a later fact."

## 0:40 Trace one number to paper (core, 70 s)

**SHOW**
- Click **Open return v3**. You land on `/return/F1040`. Pause on the form list at the left and the lines table.
- Click line **1a Wages** (`/lines/F1040.1a`). Pause on the four value tiles (engine, working, 2024 as filed, change vs 2024).
- In **How this number is built**, expand the tree one level so the two W-2 inputs show.
- In **Sources**, click a W-2 value chip (an `ev-…` id). The document viewer opens with the value highlighted on the page and selected in the right panel.
- Scroll the viewer's right panel to show *Lands on · v3*.

**SAY**
"Any number on the return opens into how it was built. Line 1a is wages, the sum of two W-2 boxes. Click one, and this is the extracted value: what the pipeline read, at what confidence, and the page it came from with the exact box highlighted. Same number on the form, on the value, on the page. That is a trace, and every line on this return has one."

**SHOW (live record)**
- Back on `/lines/F1040.1a`, in **Evidence and review** click the **Verify** chip, leave *agreed to source document* selected, click **Record verification**. The record appears at the top of the trail with Priya's avatar, the kind badge and the time.

**SAY**
"That verification is the first kind of fact. It sits on the line now, with my name and the time, and nothing can remove it; it can only be retracted by a later record."

## 1:50 The checks find what the pipeline got wrong (core, 90 s)

**SHOW**
- `/checks`. Pause on the four tiles: *Errors 12*, *Warnings 5*, *Information 7*, *If every error is corrected*.
- Point at the filter bar: the severity segments, the **Open only** chip, the area chips with counts.
- Click **Errors** in the segment bar.

**SAY**
"The engine is trusted for arithmetic, not for truth. Thirty-one independent checks recompute lines from their inputs and compare them to the documents, to the IRS transcript, to the FTB account, to the broker statements and to what the client said on the phone. On this packet they find twelve errors."

**SHOW**
- Open **Federal estimated payments agree to the IRS transcript → Federal estimated payments claimed 13,000; IRS shows 12,000** (`/checks/federal-estimates:F1040.26`). Pause on the three big tiles: *On the return 13,000*, *Evidence says 12,000*, *Difference −1,000* with the tax badge.
- Scroll to **Evidence**: the line, the four EFTPS confirmations, the questionnaire answer, the four transcript transactions.
- Use the **→** arrow in the header or go back and open **Vehicle gift** (`/checks/vehicle-gift:F8283.A1.vehicle`).

**SAY**
"Each finding leads with the comparison: what the return says, what the evidence says, the difference and what fixing it does to the tax at the engine's own rates. Below it is every record the finding rests on; each link opens the page itself.

Here the client claimed thirteen thousand of estimated payments. The IRS transcript shows four payments of three thousand. The client's own answer in the questionnaire explains the extra thousand: it was paid, but in January, against the wrong year.

And here: the client guessed the Subaru was worth six thousand. The charity's Form 1098-C says it sold for twenty-nine hundred, and the deduction is limited to the proceeds."

## 3:20 Fix it without touching the packet (core, 70 s)

**SHOW (live record)**
- On the federal-estimates finding, click **Propose adjustment to F1040.26** in the header. The line page opens with the adjustment form already filled: engine 13,000 → corrected 12,000, the reason text, and *from finding check:federal-estimates:F1040.26*.
- Point at the live effect box: *Change −1,000*, *Federal balance +1,000*, the partner-threshold bar, "Tax itself is unchanged: this is a payment line."
- Click **Record adjustment**. The form collapses with "Recorded. The working return now uses 12,000."
- Scroll up: the *Engine* tile is struck through, *Working* shows 12,000 with the *adjusted* badge.

**SAY**
"To fix it I adjust the line. The evidence figure and the reason come across from the finding; I can edit either. Before I record, the form shows the change and what it does to each balance due, and whether it crosses the firm's partner-approval threshold. The engine's number stays. The adjustment is a fact with a tax effect, and the working return recomputes every total that depends on it."

**SHOW**
- `/compare`. Pickers show *v2 → Working* or *v3 → Working*; set **From v3**, **To Working**. Pause on the four tiles with their deltas and the table of changed lines.

**SAY**
"Compare puts any two states side by side: the three engine runs and the working return. Only lines that differ are shown, with where each change came from."

## 4:30 Who did what, and who may do what (core, 70 s)

**SHOW**
- Click the actor chip → **Marcus Bell · Preparer**. Go to `/documents/D06` (the 2024 return). The SSNs show as `•••-••-3390`. Point at the **Masked** label in the top bar.
- Switch to **Daniel Ortiz · Reviewer**. `/review`. Pause on the sign-off matrix: scopes down the side, levels across, green ticks, a reopened cell in amber with "since then N new records".
- Hover a cell Daniel may sign; the **Sign off** pill appears. Do not click.
- Scroll to **Adjustments needing partner approval** and **Blocking review notes**.

**SAY**
"Six staff roles and two clients. Marcus has no sensitive-data clearance, so he sees Social Security numbers masked; when a cleared reviewer unmasks, that view is logged as a fact like any other.

Daniel is the reviewer. A sign-off stores a fingerprint of everything inside its scope. If anything in that scope changes afterwards, the fingerprint no longer matches and the sign-off shows as reopened, with what changed since. Daniel can sign an area as reviewer only when the preparer sign-off beneath it is current, and only if he did not prepare it himself. The no-self-review rule is enforced, not pinned to a wall.

Adjustments over the firm's threshold queue here for a partner, and an open blocking note stops the file from going anywhere."

## 5:40 The client (40 s)

**SHOW**
- Switch to **Ngozi Okafor · Client**. Notice the sidebar shrinks to what a client may see.
- `/approve`. Pause on the plain-words tiles ("You owe the IRS…", "California refunds you…"), the **Signatures** card, and the status line. If the return changed since it was sent, the page says so and explains the preparer will send it again.
- Click **Read the full return** to flash `/client-copy`, then back.

**SAY**
"The client sees a plain summary, the questions addressed to them, and signs Form 8879 here with a self-selected PIN. What they sign is the same fingerprint the partner signed. If a preparer changes a line after that, both reopen and the return goes back to the client. That is what happened on this file: it was signed, then corrected, so it goes round again."

## 6:20 File it, get rejected, fix it, file again (core, 80 s)

**SHOW**
- Switch back to **Priya Raman**. `/filing`. Pause on the tiles (*Gates open N / 6*, *Working return v3 +N*) and the gate list.
- Scroll to the identity section: Theo's row shows "as entered … as printed on D71" with the **Correct from D71** button.
- If you pre-recorded a rejected transmission, show the acknowledgment card with **R0000-504-02**. Otherwise point at the warning text under the transmit button.

**SAY**
"Six gates stand between a prepared return and a filed one: no open blocking notes, every level signed, partner approvals, the required steps, both spouses' approval, and the partner's sign-off still current after the client signed. None of them can be ticked by hand.

One more thing the checks caught: Theo's Social Security number was typed with two digits swapped at intake. Here is the card. The IRS e-file database runs the same comparison, so transmitting now brings the return back rejected with code R0000-504-02."

**SHOW (live record, optional)**
- Click **Correct from D71**, type a short note, confirm. The row changes to "Corrected by Priya Raman · from D71".

**SAY**
"The correction points at the card; the number itself is never stored in the ledger. Once the gates are open, transmit, and the acknowledgment comes back accepted. From that moment the return is frozen: adjustments are refused until a reviewer opens an amendment, and then every change shows as Form 1040-X columns: as filed, change, corrected."

## 7:40 Two years later (50 s)

**SHOW**
- `/timeline`. In the **Jump to** bar click **notice received**. The page scrolls to January 2028 and the cursor is set; the sidebar's current-return box reflects that moment.
- `/notices`, open **Letter 566** (`/notices/N-2025-L566`). Scroll steadily through: cover letter, the items under examination, the exhibits with page numbers, the firm's records on those lines, the receipts reconciliation, the exposure.

**SAY**
"The timeline replays the whole engagement. Set the cursor to any moment and the file shows what it looked like then. In January 2028 the IRS sends Letter 566 asking about the noncash gifts and the Schedule C receipts.

The response package is assembled from the workpaper: the lines, the documents as exhibits with page numbers, the firm's own records on those lines, a reconciliation to the 1099s, and the exposure. Both items the IRS picked are errors the checks found in 2026. The package says so, and says what was done about them."

## 8:30 Close (30 s)

**SHOW**
- `/status`: areas with evidence, open errors, sign-offs and hours against budget.
- `/standards`: scroll to **Partner threshold**; do not change it on camera unless you want a live record (it needs a reason).
- End on `/` Overview.

**SAY**
"For the person running the season: every area's evidence, open errors, sign-offs and hours against budget on one screen. And the firm's standards are data: change the partner threshold here, with a reason, and it applies everywhere at once.

The packet never changed. Every claim on every screen traces to a page, or to a record of who decided what, when and why. That is what a workpaper is for."

---

## If you have to cut to five minutes

Keep, in order: Open (0:00) · Trace (0:40) · Checks with one finding (1:50, federal estimates only) · Fix (3:20, skip Compare) · Sign-offs with Daniel (4:30, skip Marcus) · Filing rejection and correction (6:20) · Notice package (7:40). Drop the client section, Compare, Status and Standards.

## Things that will differ from this script, and what to say

- **A finding already shows "addressed".** Say: "This one has been dealt with already; the check still reports it because checks describe the packet, not the ledger." Then open one that is still open.
- **Send to client is disabled.** The prerequisites list above the button says why (usually the partner sign-off reopened after an adjustment). Say: "It will not send until the partner has re-signed; the button cannot be forced."
- **The sidebar's "Since I looked" count.** Ignore it, or click it once to show the per-person feed of what changed since you were last on the file.
- **Light theme.** The whole app has a light theme; if you prefer it on camera, switch before recording and keep it for the whole take.
