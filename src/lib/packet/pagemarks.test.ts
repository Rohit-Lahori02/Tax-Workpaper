import { describe, expect, it } from "vitest";
import { computeMarks, segmentText } from "./pagemarks";

const pos = (y0: number, x0 = 0) => ({ x0, y0, x1: x0 + 0.1, y1: y0 + 0.02 });

describe("page marks", () => {
  it("assigns repeated text in reading order", () => {
    const text = "Box 3 118,000.00; Box 5 118,000.00; Box 6 1,711.00";
    const r = computeMarks(text, [
      { id: "box5", text: "118,000.00", position: pos(0.5) },
      { id: "box3", text: "118,000.00", position: pos(0.3) },
      { id: "box6", text: "1,711.00", position: pos(0.6) },
    ]);
    expect(r.unmatched).toEqual([]);
    expect(r.marks.map((m) => m.valueId)).toEqual(["box3", "box5", "box6"]);
    const segs = segmentText(text, r.marks);
    expect(segs.filter((s) => s.valueId).map((s) => s.text)).toEqual(["118,000.00", "118,000.00", "1,711.00"]);
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });

  it("reports values that are not printed as read", () => {
    const r = computeMarks("Total 71,965.00", [
      { id: "ok", text: "71,965.00", position: pos(0.1) },
      { id: "missing", text: "71,715.00", position: pos(0.2) },
      { id: "blank", text: "", position: pos(0.3) },
    ]);
    expect(r.marks.map((m) => m.valueId)).toEqual(["ok"]);
    expect(r.unmatched).toEqual(["missing", "blank"]);
  });
});
