import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface FactCheckStatsResponse {
  global: {
    totalFactChecks: number;
    byVerdict: Record<string, number>;
  };
  byParty: Array<{
    partyId: string;
    partyName: string;
    partyShortName: string;
    partyColor: string | null;
    partySlug: string | null;
    totalMentions: number;
    byVerdict: Record<string, number>;
  }>;
  byPolitician: Array<{
    politicianId: string;
    fullName: string;
    slug: string;
    partyShortName: string | null;
    totalMentions: number;
    byVerdict: Record<string, number>;
  }>;
  bySource: Array<{
    source: string;
    total: number;
    byVerdict: Record<string, number>;
  }>;
}

interface FactCheckPolitician {
  id: string;
  slug: string;
  fullName: string;
  currentParty: {
    shortName: string;
    name: string;
  } | null;
}

interface FactCheckItem {
  id: string;
  claimText: string;
  claimant: string | null;
  title: string;
  verdict: string;
  verdictRating: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  claimDate: string | null;
  politicians: FactCheckPolitician[];
}

interface FactCheckListResponse {
  data: FactCheckItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PoliticianFactChecksResponse {
  politician: {
    id: string;
    slug: string;
    fullName: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    party: {
      shortName: string;
      name: string;
      color: string;
    } | null;
  };
  factchecks: Array<{
    id: string;
    claimText: string;
    claimant: string | null;
    title: string;
    verdict: string;
    verdictRating: string;
    source: string;
    sourceUrl: string;
    publishedAt: string;
    claimDate: string | null;
  }>;
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatVerdict(rating: string): string {
  const labels: Record<string, string> = {
    TRUE: "Vrai",
    MOSTLY_TRUE: "Plutôt vrai",
    HALF_TRUE: "À moitié vrai",
    MISLEADING: "Trompeur",
    OUT_OF_CONTEXT: "Hors contexte",
    MOSTLY_FALSE: "Plutôt faux",
    FALSE: "Faux",
    UNVERIFIABLE: "Invérifiable",
  };
  return labels[rating] || rating;
}

function formatFactCheck(fc: FactCheckItem | PoliticianFactChecksResponse["factchecks"][0], showPoliticians = false): string {
  const lines: string[] = [];

  lines.push(`### ${fc.title}`);
  lines.push(`**Verdict** : ${formatVerdict(fc.verdictRating)} — "${fc.verdict}"`);
  lines.push(`**Source** : [${fc.source}](${fc.sourceUrl})`);
  lines.push(`**Publié le** : ${formatDate(fc.publishedAt)}`);

  if (fc.claimant) {
    lines.push(`**Déclarant** : ${fc.claimant}`);
  }
  if (fc.claimDate) {
    lines.push(`**Date de la déclaration** : ${formatDate(fc.claimDate)}`);
  }

  lines.push("");
  lines.push(`> ${fc.claimText}`);

  if (showPoliticians && "politicians" in fc) {
    const pols = (fc as FactCheckItem).politicians;
    if (pols.length > 0) {
      const names = pols.map((p) => {
        const party = p.currentParty ? ` (${p.currentParty.shortName})` : "";
        return `${p.fullName}${party}`;
      });
      lines.push("");
      lines.push(`**Politicien(s) mentionné(s)** : ${names.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function registerFactCheckTools(server: McpServer): void {
  server.registerTool(
    "list_factchecks",
    {
      description: "Lister les fact-checks sur des politiciens français. Sources : AFP Factuel, Les Décodeurs, etc.",
      inputSchema: {
        search: z.string().optional().describe("Recherche dans le titre ou la déclaration vérifiée"),
        politician: z.string().optional().describe("Filtrer par slug du politicien (ex: 'marine-le-pen')"),
        source: z.string().optional().describe("Filtrer par source (ex: 'AFP Factuel', 'Les Decodeurs')"),
        verdict: z
          .enum(["TRUE", "MOSTLY_TRUE", "HALF_TRUE", "MISLEADING", "OUT_OF_CONTEXT", "MOSTLY_FALSE", "FALSE", "UNVERIFIABLE"])
          .optional()
          .describe("Filtrer par verdict : TRUE, FALSE, MISLEADING, etc."),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche de fact-checks...",
        "openai/toolInvocation/invoked": "Fact-checks trouvés",
      },
    },
    async ({ search, politician, source, verdict, page, limit }) => {
      const data = await fetchAPI<FactCheckListResponse>("/api/factchecks", {
        search,
        politician,
        source,
        verdict,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.pagination.total} fact-checks** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const fc of data.data) {
        lines.push(formatFactCheck(fc, true));
        lines.push("");
        lines.push("---");
        lines.push("");
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          total: data.pagination.total,
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          items: data.data.map((fc) => ({
            title: fc.title,
            claimText: fc.claimText,
            claimant: fc.claimant,
            verdictRating: fc.verdictRating,
            verdict: fc.verdict,
            source: fc.source,
            sourceUrl: fc.sourceUrl,
            publishedAt: fc.publishedAt,
            politicians: fc.politicians.map((p) => ({ slug: p.slug, fullName: p.fullName })),
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_politician_factchecks",
    {
      description: "Obtenir les fact-checks mentionnant un politicien spécifique.",
      inputSchema: {
        slug: z.string().describe("Identifiant du politicien (ex: 'marine-le-pen')"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement des fact-checks...",
        "openai/toolInvocation/invoked": "Fact-checks chargés",
      },
    },
    async ({ slug, page, limit }) => {
      const data = await fetchAPI<PoliticianFactChecksResponse>(
        `/api/politiques/${encodeURIComponent(slug)}/factchecks`,
        { page, limit },
      );

      const lines: string[] = [];
      const party = data.politician.party ? ` (${data.politician.party.name})` : "";
      lines.push(`# Fact-checks — ${data.politician.fullName}${party}`);
      lines.push(`**${data.total} fact-check(s)**`);
      lines.push("");

      for (const fc of data.factchecks) {
        lines.push(formatFactCheck(fc));
        lines.push("");
        lines.push("---");
        lines.push("");
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      lines.push(`https://poligraph.fr/politiques/${data.politician.slug}`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          politician: {
            slug: data.politician.slug,
            fullName: data.politician.fullName,
            party: data.politician.party ? { name: data.politician.party.name, shortName: data.politician.party.shortName } : null,
          },
          total: data.total,
          factchecks: data.factchecks.map((fc) => ({
            title: fc.title,
            claimText: fc.claimText,
            claimant: fc.claimant,
            verdictRating: fc.verdictRating,
            verdict: fc.verdict,
            source: fc.source,
            sourceUrl: fc.sourceUrl,
            publishedAt: fc.publishedAt,
          })),
          url: `https://poligraph.fr/politiques/${data.politician.slug}`,
        },
      };
    },
  );

  server.registerTool(
    "get_factcheck_stats",
    {
      description:
        "Statistiques agrégées des fact-checks : répartition par verdict, par parti politique, par source et top politiciens fact-checkés.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(15)
          .describe("Nombre max de partis/politiciens retournés (max 50)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Calcul des statistiques de fact-checks...",
        "openai/toolInvocation/invoked": "Statistiques calculées",
      },
    },
    async ({ limit }) => {
      const data = await fetchAPI<FactCheckStatsResponse>("/api/factchecks/stats", { limit });

      const lines: string[] = [];

      // Global
      lines.push(`# Statistiques Fact-checks`);
      lines.push(`**${data.global.totalFactChecks} fact-checks** au total`);
      lines.push("");
      lines.push("## Répartition par verdict");
      for (const [verdict, count] of Object.entries(data.global.byVerdict).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${formatVerdict(verdict)} : **${count}**`);
      }

      // By party
      if (data.byParty.length > 0) {
        lines.push("");
        lines.push("## Par parti politique");
        for (const party of data.byParty) {
          const verdicts = Object.entries(party.byVerdict)
            .sort((a, b) => b[1] - a[1])
            .map(([v, c]) => `${formatVerdict(v)}: ${c}`)
            .join(", ");
          lines.push(`- **${party.partyShortName}** (${party.partyName}) — ${party.totalMentions} mentions — ${verdicts}`);
        }
      }

      // By politician
      if (data.byPolitician.length > 0) {
        lines.push("");
        lines.push("## Top politiciens fact-checkés");
        for (const pol of data.byPolitician) {
          const party = pol.partyShortName ? ` (${pol.partyShortName})` : "";
          const verdicts = Object.entries(pol.byVerdict)
            .sort((a, b) => b[1] - a[1])
            .map(([v, c]) => `${formatVerdict(v)}: ${c}`)
            .join(", ");
          lines.push(`- **${pol.fullName}**${party} — ${pol.totalMentions} mentions — ${verdicts}`);
        }
      }

      // By source
      if (data.bySource.length > 0) {
        lines.push("");
        lines.push("## Par source");
        for (const src of data.bySource) {
          lines.push(`- **${src.source}** : ${src.total} fact-checks`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          global: data.global,
          byParty: data.byParty.map((p) => ({
            partyShortName: p.partyShortName,
            partyName: p.partyName,
            partySlug: p.partySlug,
            totalMentions: p.totalMentions,
            byVerdict: p.byVerdict,
          })),
          byPolitician: data.byPolitician.map((p) => ({
            fullName: p.fullName,
            slug: p.slug,
            partyShortName: p.partyShortName,
            totalMentions: p.totalMentions,
            byVerdict: p.byVerdict,
          })),
          bySource: data.bySource,
        },
      };
    },
  );
}
