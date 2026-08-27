import { describe, expect, it } from "vitest";

describe("GitHub Actions integration", () => {
  it("accepts the configured GitHub token", async () => {
    const token = process.env.GITHUB_ACTIONS_TOKEN;
    expect(token, "GITHUB_ACTIONS_TOKEN is required").toBeTruthy();
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    expect(response.status).toBe(200);
  }, 20_000);
});
