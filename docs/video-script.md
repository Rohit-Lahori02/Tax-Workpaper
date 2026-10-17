# Video script: the Miraflores workpaper in nine minutes

Record at 1440 wide in the dark theme, Priya Raman (preparer) selected unless the script says otherwise. Keep the cursor slow. Every number on screen comes from the packet; nothing is typed for the camera except the records you make live. Run through once before recording so the ledger already holds the Phase 6 sign-offs; the live records below are added on camera.

Timing is a guide. Cut anything that runs long; the sections marked **core** carry the argument.

---

## 0:00 Open (core, 40 s)

Screen: Overview.

"This is a tax workpaper for one household, the Okafor-Lindqvists, tax year 2025. A pipeline read 74 documents, pulled 3,012 values off their pages, and an engine computed the return three times as documents arrived. The firm's job is to prove that return is right before it files it, and to be able to prove it again two years later when the IRS asks.

The core idea is simple. The packet is never edited. Everything a person does, verifying a line, asking the client a question, changing a number, signing off, filing, is a fact appended to a ledger. Every screen is a view over the packet plus that ledger. Nothing is ever deleted; a mistake is corrected by a later fact."

Point at the stat tiles (federal balance, California refund), the versions strip, and the Workpaper checks card with its error count.

## 0:40 Trace one number to paper (core, 70 s)

Screen: Return, Form 1040, click line 1a wages, then its build tree, then a W-2 value, then the document page.

"Any number on the return opens into how it was built. Line 1a is wages. It is a sum of two W-2 boxes. Click one, and this is the extracted value: what the pipeline read, at what confidence, and here is the page it came from, with the exact box highlighted. Same number on the form, on the value, on the page. That is a trace, and every one of the 611 lines on this return has one."

Click **Verify** on the line, choose *agreed to source document*. "That verification is the first kind of fact. It is on the line now, with my name and the time."

## 1:50 The checks find what the pipeline got wrong (core, 90 s)

Screen: Checks.

"The engine is trusted for arithmetic, not for truth. Thirty-one independent checks recompute lines from their inputs, compare them to documents, to the IRS transcript, to the FTB account, to the broker statements and to what the client said on the phone. On this packet they find twelve errors."

Open three, slowly:

1. **Northlake interest counted twice.** "Two 1099-INT documents, same payer group, same 1,840, two lines on Schedule B. Here is each page."
2. **Form 1099-K added on top of the books.** "Schedule C receipts are the books' total plus the Paywell 1099-K. But the books already contain those card deposits. Twelve thousand four hundred counted twice; about 4,400 of federal tax the client should not pay."
3. **Vehicle gift.** "The client guessed the Subaru was worth 6,000. The charity's Form 1098-C says it sold for 2,900, and the law limits the deduction to the proceeds."

"Each finding shows the expected value, the actual value, the difference, the estimated tax effect at the engine's own rates, and links to every page it rests on. Nobody has to take the check's word for it."

## 3:20 Fix it without touching the packet (core, 60 s)

Screen: from the vehicle-gift finding, click the line, **Adjust**.

"To fix it I adjust the line: 2,900, the reason, the authority. The engine's number stays. The adjustment is a fact with a tax effect, and the working return recomputes every total that depends on it: Schedule A, line 12, taxable income, the balance due. Over here is the engine's return and the working return side by side."

Screen: Compare. "v1, v2, v3 and the working return, every changed line, where it came from."

## 4:20 Who did what, and who may do what (core, 70 s)

Screen: role switcher.

"Six staff roles and two clients. Marcus has no sensitive-data clearance, so he sees Social Security numbers masked; when a cleared reviewer unmasks, that view is logged. Switch to Daniel, the reviewer."

Switch to Daniel Ortiz. Screen: Sign-offs.

"A sign-off stores a fingerprint of everything inside its scope. If anything in that scope changes afterwards, the fingerprint no longer matches and the sign-off shows as reopened, with what changed. Daniel can sign the business area as reviewer because Priya's preparer sign-off below it is current, and because he did not prepare it: the firm's no-self-review rule is enforced, not written on a poster."

Switch to Helen Strand (partner). Show the partner approval queue for adjustments over the threshold.

## 5:30 The client (40 s)

Switch to Ngozi Okafor. Screen: Client approval.

"The client sees a plain summary, the questions addressed to them, and signs Form 8879 with a self-selected PIN. What they sign is the same fingerprint the partner signed. If a preparer changes a line after that, both reopen and the return goes back to the client."

## 6:10 File it, get rejected, fix it, file again (core, 80 s)

Switch to Priya. Screen: Filing.

"Six gates stand between a prepared return and a filed one: no open blocking notes, every level signed, partner approvals, the required steps, both spouses' approval, and the partner's sign-off still current after the client signed. None can be ticked by hand.

One more thing the checks caught: Theo's Social Security number was typed with two digits swapped at intake. Here is the card. The IRS e-file database does the same comparison, so if we transmit now the return comes back rejected with code R0000-504-02."

Show the rejection card if you pre-recorded a rejected transmission; otherwise show the warning line under the Transmit button. Click **Correct from D71**.

"The correction points at the card; the number itself is never stored in the ledger. Transmit, and the acknowledgment comes back accepted. From the moment of transmission the return is frozen: adjustments are refused until a reviewer opens an amendment, and then every change shows as Form 1040-X columns, as filed, change, corrected."

## 7:30 Two years later (50 s)

Screen: Timeline. Click **notice received** in the jump bar.

"The timeline replays the whole engagement. Set the cursor to January 2028 and the file shows what it looked like then. The IRS has sent Letter 566 asking about the noncash gifts and the Schedule C receipts."

Screen: Notices, open the Letter 566 package.

"The response package is assembled from the workpaper: the lines, the documents as exhibits with page numbers, the firm's own records on those lines, a receipts reconciliation to the 1099s, and the exposure. Both items the IRS picked are errors the checks found in 2026. The package says so, and says what was done about them."

## 8:20 Close (40 s)

Screen: Status dashboard, then Standards.

"For the person running the season: every area's evidence, open errors, sign-offs and hours against budget. And the firm's standards are data: change the partner threshold here, with a reason, and it applies everywhere at once.

The packet never changed. Every claim on every screen traces to a page or to a record of who decided what, when, and why. That is what a workpaper is for."

---

## Shot list if you have to cut to five minutes

Keep: Open (0:00), Trace (0:40), Checks (1:50), Fix (3:20), Sign-offs with no-self-review (4:20, Daniel only), Filing rejection and correction (6:10), Notice package (7:30). Drop: the client section, Compare, Status and Standards.

## Before you hit record

- Dev server or the Vercel deployment open, dark theme, 1440 wide.
- Priya selected, reveal off.
- `/checks` loads with 12 errors (if adjustments were already made on camera earlier, those findings show as resolved; either state is fine, say which).
- Know the three findings you will open: payer-duplicates, gross-receipts, vehicle-gift.
- If you want the rejection card on screen rather than the warning, transmit once before recording with Theo's SSN uncorrected, pick up the acknowledgment, and leave it rejected.
