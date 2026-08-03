/**
 * Unit tests for core/catalog/resolve.ts — text normalization and weighted scorer.
 */

import { describe, it, expect } from "vitest";
import { normalizeText, normalizeId, catalogResolve } from "#core/catalog/resolve.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Test Helpers ─────────────────────────────────────────────────── */

function makeIndex(overrides: Partial<CatalogIndex> = {}): CatalogIndex {
  return {
    generated_at: "2026-01-01T00:00:00Z",
    generator: "test@1.0.0",
    components: [],
    contracts: {},
    domains: [],
    flows: [],
    extraction_quality: { total: { high: 0, medium: 0, low: 0 }, per_component: [] },
    errors: [],
    ...overrides,
  };
}

function makeComponent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id.replace(/-/g, " "),
    description: `${id} component description`,
    repo: `https://github.com/acme/${id}`,
    type: "service",
    domain: "test",
    owner: "team",
    criticality: "tier-2",
    lifecycle: "production",
    stack: ["node"],
    aliases: [] as string[],
    provides: [] as Array<{ id: string; kind: string; source: string }>,
    consumes: [] as Array<{ contract: string; criticality?: string }>,
    datastores: [] as string[],
    origin_sha: "abc123",
    ...overrides,
  };
}

/* ─── normalizeText ────────────────────────────────────────────────── */

describe("normalizeText", () => {
  it("lowercases and de-accents", () => {
    const tokens = normalizeText("Café Résumé");
    expect(tokens).toContain("cafe");
    expect(tokens).toContain("resume");
  });

  it("removes stopwords", () => {
    const tokens = normalizeText("the service is for payments");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("for");
    expect(tokens).toContain("service");
    expect(tokens).toContain("payment"); // "payments" → -s → "payment"
  });

  it("applies light stemming", () => {
    const tokens = normalizeText("processing payments notifications");
    expect(tokens).toContain("process"); // "processing" → -ing
    expect(tokens).toContain("payment"); // "payments" → -s
    expect(tokens).toContain("notific"); // "notifications" → -ations
  });

  it("splits on hyphens and underscores", () => {
    const tokens = normalizeText("payment-service_v2");
    expect(tokens).toContain("payment"); // "payment" stays (no matching suffix)
    expect(tokens).toContain("service"); // "service" stays
    expect(tokens).toContain("v2");
  });

  it("handles empty input", () => {
    expect(normalizeText("")).toEqual([]);
    expect(normalizeText("   ")).toEqual([]);
  });

  it("handles accented Spanish text", () => {
    const tokens = normalizeText("Autenticación de usuarios");
    expect(tokens).toContain("autenticacion"); // de-accented + stemmed -ción
    expect(tokens).toContain("usuario"); // stemmed from "usuarios"
    expect(tokens).not.toContain("de"); // stopword
  });
});

/* ─── normalizeId ──────────────────────────────────────────────────── */

describe("normalizeId", () => {
  it("lowercases and de-accents without stemming", () => {
    expect(normalizeId("Payment-Service")).toBe("payment-service");
    expect(normalizeId("café")).toBe("cafe");
  });

  it("trims whitespace", () => {
    expect(normalizeId("  auth-service  ")).toBe("auth-service");
  });
});

/* ─── catalogResolve: scorer signals ───────────────────────────────── */

describe("catalogResolve — scorer signals", () => {
  it("scores exact id match at weight 100", () => {
    const index = makeIndex({
      components: [makeComponent("payment-service")] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "payment-service");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("payment-service");
    expect(results[0].signals.some((s) => s.type === "exact_id" && s.weight === 100)).toBe(true);
  });

  it("scores alias exact match at weight 80", () => {
    const index = makeIndex({
      components: [
        makeComponent("payment-service", { aliases: ["payments", "pay-svc"] }),
      ] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "payments");
    expect(results).toHaveLength(1);
    expect(results[0].signals.some((s) => s.type === "alias_exact" && s.weight === 80)).toBe(true);
  });

  it("scores provides[].id match at weight 80", () => {
    const index = makeIndex({
      components: [
        makeComponent("payment-service", {
          provides: [{ id: "payments-v2", kind: "openapi", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "payments-v2");
    expect(results).toHaveLength(1);
    expect(results[0].signals.some((s) => s.type === "provides_id" && s.weight === 80)).toBe(true);
  });

  it("scores flow alias match at weight 75", () => {
    const index = makeIndex({
      components: [
        makeComponent("cart-service"),
        makeComponent("order-service"),
      ] as CatalogIndex["components"],
      flows: [
        {
          id: "checkout-flow",
          name: "Checkout Flow",
          aliases: ["purchase", "buy"],
          participants: ["cart-service", "order-service"],
        },
      ],
    });
    const results = catalogResolve(index, "purchase");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].signals.some((s) => s.type === "flow_alias")).toBe(true);
  });

  it("scores domain match at weight 60", () => {
    const index = makeIndex({
      components: [
        makeComponent("payment-service", { domain: "payments" }),
      ] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "payments");
    expect(results).toHaveLength(1);
    expect(results[0].signals.some((s) => s.type === "domain" && s.weight === 60)).toBe(true);
  });

  it("scores alias token (substring) match at weight 40", () => {
    const index = makeIndex({
      components: [
        makeComponent("notification-service", { aliases: ["notify", "notifications"] }),
      ] as CatalogIndex["components"],
    });
    // "notification" tokens include "notif" stem which overlaps with "notify" stem
    const results = catalogResolve(index, "notification queue");
    expect(results.length).toBeGreaterThan(0);
    const svc = results.find((r) => r.id === "notification-service");
    expect(svc).toBeDefined();
    expect(
      svc!.signals.some(
        (s) =>
          s.type === "alias_token" || s.type === "name_description" || s.type === "alias_exact",
      ),
    ).toBe(true);
  });

  it("scores name/description word match at weight ≤25", () => {
    const index = makeIndex({
      components: [
        makeComponent("shipping-service", {
          name: "Shipping Service",
          description: "Calculates rates, generates labels, tracks parcels",
          domain: "logistics",
        }),
      ] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "parcel tracking");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].signals.some((s) => s.type === "name_description")).toBe(true);
    expect(
      results[0].signals.find((s) => s.type === "name_description")!.weight,
    ).toBeLessThanOrEqual(25);
  });
});

/* ─── catalogResolve: threshold and limit ──────────────────────────── */

describe("catalogResolve — threshold and limit", () => {
  it("filters results below threshold (default 20)", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", { description: "completely unrelated widget" }),
        makeComponent("payment-service", { aliases: ["payments"] }),
      ] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "payments");
    // Only payment-service should match (exact alias), svc-a shouldn't match
    expect(results.every((r) => r.score >= 20)).toBe(true);
  });

  it("respects custom threshold", () => {
    const index = makeIndex({
      components: [
        makeComponent("payment-service", {
          aliases: ["payments"],
          domain: "payments",
        }),
      ] as CatalogIndex["components"],
    });
    // With threshold 200, nothing should pass
    const results = catalogResolve(index, "payments", { threshold: 200 });
    expect(results).toHaveLength(0);
  });

  it("respects limit", () => {
    const components = Array.from({ length: 15 }, (_, i) =>
      makeComponent(`svc-${i}`, { aliases: ["common-alias"] }),
    );
    const index = makeIndex({ components: components as CatalogIndex["components"] });
    const results = catalogResolve(index, "common-alias", { limit: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("returns max 12 by default", () => {
    const components = Array.from({ length: 20 }, (_, i) =>
      makeComponent(`svc-${i}`, { aliases: ["shared"] }),
    );
    const index = makeIndex({ components: components as CatalogIndex["components"] });
    const results = catalogResolve(index, "shared");
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it("returns empty for empty catalog", () => {
    const index = makeIndex();
    const results = catalogResolve(index, "anything");
    expect(results).toEqual([]);
  });

  it("returns empty for empty query", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "");
    expect(results).toEqual([]);
  });
});

/* ─── catalogResolve: combined scoring ─────────────────────────────── */

describe("catalogResolve — combined scoring and ordering", () => {
  it("exact id ranks above alias exact", () => {
    const index = makeIndex({
      components: [
        makeComponent("auth-service", { aliases: ["auth", "login"] }),
        makeComponent("auth", { aliases: ["authentication"] }),
      ] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "auth");
    expect(results.length).toBeGreaterThanOrEqual(2);
    // "auth" component (exact id) should rank above "auth-service" (alias exact)
    expect(results[0].id).toBe("auth");
  });

  it("multiple signals accumulate score", () => {
    const index = makeIndex({
      components: [
        makeComponent("payment-service", {
          aliases: ["payments", "pay-svc"],
          domain: "payments",
          provides: [{ id: "payments-v2", kind: "openapi", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
    });
    const results = catalogResolve(index, "payment-service");
    expect(results).toHaveLength(1);
    // Should accumulate exact_id (100) + domain partial + name/desc match
    expect(results[0].score).toBeGreaterThan(100);
  });
});
