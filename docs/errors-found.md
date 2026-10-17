# Errors found in the Okafor-Lindqvist 2025 packet

The packet says of itself: "the packet contains mistakes with high confidence scores, as real pipeline output does." The workpaper's checks engine (31 independent checks, `src/lib/checks`, report with `pnpm tsx scripts/checks-report.ts`) runs against the current return (v3) and reports 12 errors, 5 warnings and 7 informational findings. Every finding links to the page, value and line it rests on, so a reviewer can see the evidence rather than take the check's word for it.

Tax effects are the engine's own per-dollar rates for the category of the line (`return_versions[].tax_effect_rates`), as the app shows them next to each adjustment. Positive means the household's balance due goes up when the error is fixed; negative means it goes down.

## Errors (the return is wrong)

| # | Where | What the packet did | What the evidence says | Check | Effect (fed / CA) |
|---|---|---|---|---|---|
| 1 | Schedule B, lines 1.1 and 1.2 | Northlake interest of 1,840 appears twice, once on the Northlake Securities consolidated 1099 (ev-0492, D28, "Northlake Bank sweep") and once on the Northlake Bank 1099-INT (ev-0538, D29) | The two documents are the same payer group reporting the same account; one Form 1099-INT | `payer-duplicates` | -640 / -127 |
| 2 | Schedule B, line 1.6 | Swedish interest of SEK 18,450 (D36) converted with the 2024 average rate (`ref:fx.SEK.2024_average`) | 2025 income converts at the 2025 rate; the line is about 124 too high | `fx-rate-year` | +43 / +9 |
| 3 | Form 1040, line 26 | 13,000 of federal estimated payments claimed from the client's payment confirmations and qa-41 | The IRS account transcript (D69, code 670) shows four payments of 3,000: 12,000 | `federal-estimates` | +1,000 / 0 |
| 4 | Form 540NR, line 72 | 14,000 of California estimates claimed | The FTB account shows 10,500 applied to 2025; the 3,500 paid 2025-09-15 was designated tax year 2024 by Web Pay and is held as a 2024 credit | `california-estimates` | 0 / +3,500 |
| 5 | Form 8949 from D31 (corrected Meridian 1099-B) | Lot detail sums to 71,715 of proceeds against a 71,965 statement total | Page 32 "Additional transactions" was never read by the pipeline; the 250 of missing proceeds is a lot on an unread page. The same gap exists on the superseded D30 | `broker-summary`, `unread-pages` | not computable until the page is read |
| 6 | Schedule C, line 1 | Gross receipts 163,700 = books total income 151,300 + Form 1099-K 12,400 | The books already contain the Paywell card deposits that the 1099-K reports; the 12,400 is counted twice | `gross-receipts` | -4,402 / -384 |
| 7 | Schedule C, line 25 | Telephone deducted at 100% (2,160) | On the 2026-03-26 call (call-01) Erik said the family plan is 70% business | `business-use` | +230 / +20 |
| 8 | Schedule C, line 25 | Internet deducted at 100% (1,320) | Same call: home internet is about 50% business | `business-use` | +234 / +20 |
| 9 | Schedule C, line 27a | Software and subscriptions (6,850) include 216 of Spotify Family | Same call: personal, booked by mistake | `business-use` | +77 / +7 |
| 10 | Schedule CA (540NR), line 1 column E | All 218,400 of wages treated as California-source | The household moved to Texas on 2025-07-15; the W-2 state wages and the paystub at the move (D73) support about 129,569 of California wages | `part-year-wages` | 0 / -5,685 |
| 11 | Form 8283 / Schedule A line 12 | 2012 Subaru donation deducted at 6,000, the client's Kelley Blue Book guess (qa-39) | Form 1098-C from Lone Star Kids Auto Donation (D66, box 4c) shows the charity sold it for 2,900; the deduction is limited to the proceeds | `vehicle-gift` | +806 / +149 |
| 12 | Household record, dependent Theo | SSN entered at intake ends 3309 | Theo's Social Security card (D71, ev-1080) ends 3390. The IRS e-file database rejects the return with R0000-504-02 until the entry is corrected, which is exactly what the packet's scripted timeline shows happening on 2026-07-13 | `identity-documents` | no tax effect; blocks e-filing |

Net of the eleven computable effects the federal balance falls by about 2,650 and the California balance by about 2,500 (the California refund grows), before the Meridian lot on page 32 is read.

## Warnings (look before relying on it)

- **Coinhaven lot C6 has no cost basis.** The engine taxed the whole proceeds as gain. Erik's message of 2026-06-30 (msg-07) says the BTC was bought on another exchange; the basis needs his records. `digital-assets`, engine diagnostic `DIGITAL_ASSET_BASIS_MISSING`.
- **St. Brigid handwritten receipt read at 41% confidence** (ev-1049, 1,500). Ngozi confirmed 1,500 by phone and bank statement (msg-08). The line is right; the read needed confirming. `low-confidence`.
- **9,300 of receipts in the transaction detail sit outside the books' income total** (D15 page 3). After the 1099-K double count is removed, this is what reconciles reported receipts to the third-party forms. `gross-receipts`.
- **D31 only partially read** (page 32). See error 5.
- **The Meridian C6 crypto basis read at 60%** (`low-confidence`).

## Things the engine itself flags, and what the workpaper does with them

The engine's eleven diagnostics on v3 (`return_versions[2].diagnostics`) are not errors in the arithmetic; they are decisions a person has to make and record. The app turns each into a decision point on the Judgment page with the authority to cite: the questionnaire says no investments were sold while 282 sales and 12 crypto dispositions are in the documents (qa-14); Form 8867 due diligence for the child tax credit and credit for other dependents; two contractors paid over 600 with no Forms 1099-NEC filed; California AMT on the ISO exercise not computed; the home office shrank from 300 to 240 square feet; the FBAR due outside the return; the AMT credit carrying to 2026.

## Not errors, but worth knowing

- D09 and D10 are the same Halvorsen W-2, uploaded twice (msg-02 explains why). The engine counted it once; the duplicate needs a disposition so the document count closes.
- Schedule CA column D lines list incomplete inputs (informational): the engine's arithmetic is right, the input list is short.
- The prior preparer left three basis records open (2023 and 2024 S corporation stock basis, Ridgeline outside basis). Erik found the 2023 K-1 in June (D40, msg-06); the stock basis can now be rebuilt. These travel to 2026 on the carry-forward page until closed.

## How each one is dealt with in the app

Nothing is fixed by editing the packet. A wrong line gets an **adjustment** (reason, authority, estimated tax effect; partner approval when the effect exceeds the firm's threshold) from the finding row; the working return recomputes the totals that depend on it; the sign-offs that covered the line reopen; and the error, the fix and who approved it stay in the ledger forever. A finding that turns out to be right gets a **note** or **judgment** on the finding, which counts as resolved. The identity typo gets a **correction** record that points at the card rather than storing the number. Everything above is reachable from Checks, and the notice response package for the 2028 Letter 566 cites the same records when the IRS asks about items 6 and 11 two years later.
