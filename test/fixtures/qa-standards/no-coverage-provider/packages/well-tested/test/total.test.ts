import { describe, it, expect } from "vitest";
import { total } from "../src/total";

describe("total", () => {
  it("sums values", () => expect(total([1, 2, 3])).toBe(6));
  it("returns 0 for empty", () => expect(total([])).toBe(0));
  it("handles negatives", () => expect(total([-1, 1])).toBe(0));
});
