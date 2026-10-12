import { describe, expect, it } from "vitest";
import { buildHumanoid } from "./humanoid";
import { amount, known, percent } from "./format";

describe("Original holographic geometry", () => {
  it("has finite indexed geometry, human proportions and a bounded vertex budget", () => {
    const { body, energy, joints } = buildHumanoid();
    for (const geometry of [body, energy]) {
      expect(geometry.index.count).toBeGreaterThan(100);
      for (const attribute of ["position", "normal"])
        expect(
          [...geometry.attributes[attribute].array].every(Number.isFinite),
        ).toBe(true);
      geometry.computeBoundingBox();
    }
    const bounds = body.boundingBox;
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(3.9, 1);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(2.1);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.4);
    expect(
      body.attributes.position.count + energy.attributes.position.count,
    ).toBeLessThan(8000);
    expect(joints).toHaveLength(13);
    body.dispose();
    energy.dispose();
  });
});

describe("Honest metric formatting", () => {
  it("distinguishes zero, missing, negative, nonfinite and mixed-currency amounts", () => {
    expect(amount(0, "INR")).toBe("₹0");
    expect(amount(null, "INR")).toBe("Not available");
    expect(amount(Number.NaN, "INR")).toBe("Not available");
    expect(amount(1200, null)).toBe("1,200");
    expect(amount(1200, "INR", true)).toBe("Mixed currencies");
    expect(amount(-1200, "INR")).toBe("-₹1,200");
    expect(percent(-50)).toBe("-50%");
    expect(percent(null)).toBe("Not available");
    expect(known(false)).toBe(false);
  });
});
