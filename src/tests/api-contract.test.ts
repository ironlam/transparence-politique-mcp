/**
 * Integration tests — API Contract Validation
 *
 * These tests call the live API and validate that the response structure
 * matches what the MCP tools expect. If an API route changes field names
 * or structure, these tests will catch it.
 *
 * Run: npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "https://politic-tracker.vercel.app";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  assert.ok(res.ok, `${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Helpers ───────────────────────────────────────────────────

function assertString(val: unknown, field: string): void {
  assert.equal(typeof val, "string", `${field} should be a string, got ${typeof val}`);
}

function assertNumber(val: unknown, field: string): void {
  assert.equal(typeof val, "number", `${field} should be a number, got ${typeof val}`);
}

function assertStringOrNull(val: unknown, field: string): void {
  assert.ok(
    typeof val === "string" || val === null,
    `${field} should be string|null, got ${typeof val}`,
  );
}

function assertPagination(obj: Record<string, unknown>): void {
  assertNumber(obj.page, "pagination.page");
  assertNumber(obj.limit, "pagination.limit");
  assertNumber(obj.total, "pagination.total");
  assertNumber(obj.totalPages, "pagination.totalPages");
}

// ─── Tests ─────────────────────────────────────────────────────

describe("GET /api/politiques", () => {
  it("returns paginated list with expected fields", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/politiques?limit=2");

    // Pagination
    assert.ok(Array.isArray(data.data), "data should be an array");
    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);

    // Politician item
    const items = data.data as Record<string, unknown>[];
    assert.ok(items.length > 0, "should return at least 1 politician");

    const p = items[0];
    assertString(p.id, "id");
    assertString(p.slug, "slug");
    assertString(p.fullName, "fullName");
    assertString(p.firstName, "firstName");
    assertString(p.lastName, "lastName");
    assertString(p.birthDate, "birthDate");
    assertStringOrNull(p.deathDate, "deathDate");
    assertStringOrNull(p.photoUrl, "photoUrl");

    // currentParty can be null
    if (p.currentParty !== null) {
      const party = p.currentParty as Record<string, unknown>;
      assertString(party.id, "currentParty.id");
      assertString(party.name, "currentParty.name");
      assertString(party.shortName, "currentParty.shortName");
      assertString(party.color, "currentParty.color");
    }
  });

  it("search filter works", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/politiques?search=Macron&limit=5");
    const items = data.data as Record<string, unknown>[];
    assert.ok(items.length > 0, "search for 'Macron' should return results");
    assert.ok(
      items.some((p) => (p.fullName as string).includes("Macron")),
      "should contain Macron",
    );
  });
});

describe("GET /api/politiques/:slug", () => {
  it("returns full politician detail with mandates", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/politiques/emmanuel-macron");

    assertString(data.id, "id");
    assertString(data.slug, "slug");
    assertString(data.fullName, "fullName");
    assertString(data.firstName, "firstName");
    assertString(data.lastName, "lastName");
    assertString(data.birthDate, "birthDate");
    assertStringOrNull(data.birthPlace, "birthPlace");

    // Mandates
    assert.ok(Array.isArray(data.mandates), "mandates should be an array");
    const mandates = data.mandates as Record<string, unknown>[];
    if (mandates.length > 0) {
      const m = mandates[0];
      assertString(m.id, "mandate.id");
      assertString(m.type, "mandate.type");
      assertString(m.title, "mandate.title");
      assertString(m.startDate, "mandate.startDate");
      assert.equal(typeof m.isCurrent, "boolean", "mandate.isCurrent should be boolean");
    }

    // Declarations
    assert.ok(Array.isArray(data.declarations), "declarations should be an array");

    // Affairs count
    assertNumber(data.affairsCount, "affairsCount");
  });
});

describe("GET /api/politiques/:slug/affaires", () => {
  it("returns affairs with sources for nicolas-sarkozy", async () => {
    const data = await fetchJSON<Record<string, unknown>>(
      "/api/politiques/nicolas-sarkozy/affaires",
    );

    // Politician summary
    assert.ok(typeof data.politician === "object" && data.politician !== null);
    const pol = data.politician as Record<string, unknown>;
    assertString(pol.slug, "politician.slug");
    assertString(pol.fullName, "politician.fullName");

    // Affairs array
    assert.ok(Array.isArray(data.affairs), "affairs should be an array");
    assertNumber(data.total, "total");

    const affairs = data.affairs as Record<string, unknown>[];
    assert.ok(affairs.length > 0, "Sarkozy should have affairs");

    const a = affairs[0];
    assertString(a.id, "affair.id");
    assertString(a.title, "affair.title");
    assertString(a.description, "affair.description");
    assertString(a.status, "affair.status");
    assertString(a.category, "affair.category");

    // Sources
    assert.ok(Array.isArray(a.sources), "affair.sources should be an array");
    const sources = a.sources as Record<string, unknown>[];
    if (sources.length > 0) {
      assertString(sources[0].url, "source.url");
      assertString(sources[0].title, "source.title");
      assertString(sources[0].publisher, "source.publisher");
    }
  });
});

describe("GET /api/politiques/:slug/votes", () => {
  it("returns votes with stats", async () => {
    // Use a known deputy with votes
    const data = await fetchJSON<Record<string, unknown>>(
      "/api/politiques/marine-le-pen/votes?limit=2",
    );

    // Politician
    assert.ok(typeof data.politician === "object" && data.politician !== null);

    // Stats
    assert.ok(typeof data.stats === "object" && data.stats !== null);
    const stats = data.stats as Record<string, unknown>;
    assertNumber(stats.total, "stats.total");
    assertNumber(stats.pour, "stats.pour");
    assertNumber(stats.contre, "stats.contre");
    assertNumber(stats.abstention, "stats.abstention");
    assertNumber(stats.participationRate, "stats.participationRate");

    // Votes array
    assert.ok(Array.isArray(data.votes), "votes should be an array");

    // Pagination
    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);
  });
});

describe("GET /api/affaires", () => {
  it("returns paginated affairs with politician info", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/affaires?limit=2");

    assert.ok(Array.isArray(data.data), "data should be an array");
    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);

    const items = data.data as Record<string, unknown>[];
    assert.ok(items.length > 0, "should return affairs");

    const a = items[0];
    assertString(a.id, "id");
    assertString(a.title, "title");
    assertString(a.status, "status");
    assertString(a.category, "category");

    // Nested politician
    assert.ok(typeof a.politician === "object" && a.politician !== null);
    const pol = a.politician as Record<string, unknown>;
    assertString(pol.id, "politician.id");
    assertString(pol.slug, "politician.slug");
    assertString(pol.fullName, "politician.fullName");
  });

  it("category filter works", async () => {
    const data = await fetchJSON<Record<string, unknown>>(
      "/api/affaires?category=CORRUPTION&limit=2",
    );
    const items = data.data as Record<string, unknown>[];
    for (const a of items) {
      assert.equal(a.category, "CORRUPTION", "all results should be CORRUPTION");
    }
  });
});

describe("GET /api/votes", () => {
  it("returns paginated scrutins", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/votes?limit=2");

    assert.ok(Array.isArray(data.data), "data should be an array");
    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);

    const items = data.data as Record<string, unknown>[];
    assert.ok(items.length > 0, "should return scrutins");

    const s = items[0];
    assertString(s.id, "id");
    assertString(s.title, "title");
    assertString(s.votingDate, "votingDate");
    assertNumber(s.votesFor, "votesFor");
    assertNumber(s.votesAgainst, "votesAgainst");
    assertNumber(s.votesAbstain, "votesAbstain");
    assertString(s.result, "result");
  });
});

describe("GET /api/votes/stats", () => {
  it("returns party stats with correct field names", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/votes/stats?chamber=AN&limit=3");

    // Parties
    assert.ok(Array.isArray(data.parties), "parties should be an array");
    const parties = data.parties as Record<string, unknown>[];
    assert.ok(parties.length > 0, "should return party stats");

    const p = parties[0];
    assertString(p.partyId, "partyId");
    assertString(p.partyName, "partyName");
    assertString(p.partyShortName, "partyShortName");
    assertString(p.partyColor, "partyColor");
    assertNumber(p.totalVotes, "totalVotes");
    assertNumber(p.cohesionRate, "cohesionRate");
    assertNumber(p.participationRate, "participationRate");

    // Global
    assert.ok(typeof data.global === "object" && data.global !== null);
    const g = data.global as Record<string, unknown>;
    assertNumber(g.totalScrutins, "global.totalScrutins");
    assertNumber(g.totalVotes, "global.totalVotes");
    assertNumber(g.totalVotesFor, "global.totalVotesFor");
    assertNumber(g.totalVotesAgainst, "global.totalVotesAgainst");
    assertNumber(g.totalVotesAbstain, "global.totalVotesAbstain");
    assertNumber(g.adoptes, "global.adoptes");
    assertNumber(g.rejetes, "global.rejetes");

    // Divisive scrutins
    assert.ok(Array.isArray(data.divisiveScrutins), "divisiveScrutins should be an array");
    const divs = data.divisiveScrutins as Record<string, unknown>[];
    if (divs.length > 0) {
      const d = divs[0];
      assertString(d.id, "divisive.id");
      assertString(d.title, "divisive.title");
      assertString(d.votingDate, "divisive.votingDate");
      assertNumber(d.divisionScore, "divisive.divisionScore");
    }
  });
});

describe("GET /api/search/advanced", () => {
  it("returns enriched search results", async () => {
    const data = await fetchJSON<Record<string, unknown>>(
      "/api/search/advanced?mandate=DEPUTE&hasAffairs=true&limit=3",
    );

    assert.ok(Array.isArray(data.results), "results should be an array");
    assertNumber(data.total, "total");
    assertNumber(data.page, "page");
    assertNumber(data.totalPages, "totalPages");

    const items = data.results as Record<string, unknown>[];
    assert.ok(items.length > 0, "should return results");

    const r = items[0];
    assertString(r.id, "id");
    assertString(r.slug, "slug");
    assertString(r.fullName, "fullName");
    assertNumber(r.affairsCount, "affairsCount");

    // currentMandate
    if (r.currentMandate !== null) {
      const m = r.currentMandate as Record<string, unknown>;
      assertString(m.type, "currentMandate.type");
    }
  });
});

// ─── Fact-checks ───────────────────────────────────────────────

describe("GET /api/factchecks", () => {
  it("returns paginated fact-checks with politician mentions", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/factchecks?limit=2");

    assert.ok(Array.isArray(data.data), "data should be an array");
    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);

    const items = data.data as Record<string, unknown>[];
    assert.ok(items.length > 0, "should return fact-checks");

    const fc = items[0];
    assertString(fc.id, "id");
    assertString(fc.claimText, "claimText");
    assertString(fc.title, "title");
    assertString(fc.verdict, "verdict");
    assertString(fc.verdictRating, "verdictRating");
    assertString(fc.source, "source");
    assertString(fc.sourceUrl, "sourceUrl");
    assertString(fc.publishedAt, "publishedAt");

    // Politicians array
    assert.ok(Array.isArray(fc.politicians), "politicians should be an array");
    const pols = fc.politicians as Record<string, unknown>[];
    if (pols.length > 0) {
      assertString(pols[0].id, "politician.id");
      assertString(pols[0].slug, "politician.slug");
      assertString(pols[0].fullName, "politician.fullName");
    }
  });

  it("verdict filter works", async () => {
    const data = await fetchJSON<Record<string, unknown>>(
      "/api/factchecks?verdict=FALSE&limit=2",
    );
    const items = data.data as Record<string, unknown>[];
    for (const fc of items) {
      assert.equal(fc.verdictRating, "FALSE", "all results should be FALSE");
    }
  });
});

describe("GET /api/politiques/:slug/factchecks", () => {
  it("returns fact-checks for a politician", async () => {
    const data = await fetchJSON<Record<string, unknown>>(
      "/api/politiques/emmanuel-macron/factchecks?limit=2",
    );

    // Politician summary
    assert.ok(typeof data.politician === "object" && data.politician !== null);
    const pol = data.politician as Record<string, unknown>;
    assertString(pol.slug, "politician.slug");
    assertString(pol.fullName, "politician.fullName");

    // Fact-checks array
    assert.ok(Array.isArray(data.factchecks), "factchecks should be an array");
    assertNumber(data.total, "total");

    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);

    const fcs = data.factchecks as Record<string, unknown>[];
    if (fcs.length > 0) {
      const fc = fcs[0];
      assertString(fc.id, "factcheck.id");
      assertString(fc.title, "factcheck.title");
      assertString(fc.verdictRating, "factcheck.verdictRating");
      assertString(fc.source, "factcheck.source");
      assertString(fc.sourceUrl, "factcheck.sourceUrl");
    }
  });
});

describe("GET /api/politiques/:slug (factchecksCount)", () => {
  it("includes factchecksCount field", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/politiques/emmanuel-macron");
    assertNumber(data.factchecksCount, "factchecksCount");
  });
});

// ─── Parties ──────────────────────────────────────────────────

describe("GET /api/partis", () => {
  it("returns paginated list with expected fields", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/partis?limit=2");

    assert.ok(Array.isArray(data.data), "data should be an array");
    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);

    const items = data.data as Record<string, unknown>[];
    assert.ok(items.length > 0, "should return at least 1 party");

    const p = items[0];
    assertString(p.id, "id");
    assertString(p.slug, "slug");
    assertString(p.name, "name");
    assertString(p.shortName, "shortName");
    assertString(p.color, "color");
    assertNumber(p.memberCount, "memberCount");
  });

  it("search filter works", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/partis?search=Renaissance&limit=5");
    const items = data.data as Record<string, unknown>[];
    assert.ok(items.length > 0, "search for 'Renaissance' should return results");
  });
});

describe("GET /api/partis/:slug", () => {
  it("returns full party detail with members", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/partis/renaissance");

    assertString(data.id, "id");
    assertString(data.slug, "slug");
    assertString(data.name, "name");
    assertString(data.shortName, "shortName");
    assertString(data.color, "color");
    assertNumber(data.memberCount, "memberCount");

    // Members
    assert.ok(Array.isArray(data.members), "members should be an array");
    const members = data.members as Record<string, unknown>[];
    if (members.length > 0) {
      const m = members[0];
      assertString(m.id, "member.id");
      assertString(m.slug, "member.slug");
      assertString(m.fullName, "member.fullName");
      assertNumber(m.affairsCount, "member.affairsCount");
    }

    // External IDs
    assert.ok(Array.isArray(data.externalIds), "externalIds should be an array");
  });
});

// ─── Elections ────────────────────────────────────────────────

describe("GET /api/elections", () => {
  it("returns paginated list with expected fields", async () => {
    const data = await fetchJSON<Record<string, unknown>>("/api/elections?limit=2");

    assert.ok(Array.isArray(data.data), "data should be an array");
    assert.ok(typeof data.pagination === "object" && data.pagination !== null);
    assertPagination(data.pagination as Record<string, unknown>);

    const items = data.data as Record<string, unknown>[];
    if (items.length > 0) {
      const e = items[0];
      assertString(e.id, "id");
      assertString(e.slug, "slug");
      assertString(e.type, "type");
      assertString(e.title, "title");
      assertString(e.status, "status");
      assertNumber(e.candidacyCount, "candidacyCount");
    }
  });
});

describe("GET /api/elections/:slug", () => {
  it("returns election detail with candidacies and rounds", async () => {
    // First get an election slug from the list
    const list = await fetchJSON<Record<string, unknown>>("/api/elections?limit=1");
    const items = list.data as Record<string, unknown>[];
    if (items.length === 0) return; // No elections in DB yet, skip

    const slug = items[0].slug as string;
    const data = await fetchJSON<Record<string, unknown>>(`/api/elections/${slug}`);

    assertString(data.id, "id");
    assertString(data.slug, "slug");
    assertString(data.type, "type");
    assertString(data.title, "title");
    assertString(data.status, "status");

    // Candidacies
    assert.ok(Array.isArray(data.candidacies), "candidacies should be an array");

    // Rounds
    assert.ok(Array.isArray(data.rounds), "rounds should be an array");
  });
});
