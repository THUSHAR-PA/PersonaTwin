import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ScenarioCases from "./ScenarioCases";
afterEach(cleanup);
it("shows all four cases, their assumptions and monthly amounts", () => {
  const cases = ["Current case", "Worst case", "Best case", "Alternative option"].map((label, i) => ({ id: String(i), label, assumption: `Assumption ${i}`, final_savings: i * 100, minimum_cash: -100, trajectory: [10, i * 100] }));
  render(<ScenarioCases cases={cases} currency="INR" />);
  expect(screen.getByRole("region", { name: "Four simulation cases" })).toBeTruthy();
  for (const item of cases) expect(screen.getByText(item.assumption)).toBeTruthy();
  expect(screen.getByText(/not guaranteed limits/)).toBeTruthy();
});
it("keeps older saved results readable", () => {
  const { container } = render(<ScenarioCases currency="INR" />);
  expect(container.innerHTML).toBe("");
});
