import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

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
  server.tool(
    "list_factchecks",
    "Lister les fact-checks sur des politiciens français. Sources : AFP Factuel, Les Décodeurs, etc.",
    {
      search: z.string().optional().describe("Recherche dans le titre ou la déclaration vérifiée"),
      politician: z.string().optional().describe("Filtrer par slug du politicien (ex: 'marine-le-pen')"),
      source: z.string().optional().describe("Filtrer par source (ex: 'AFP Factuel', 'Les Décodeurs')"),
      verdict: z
        .enum(["TRUE", "MOSTLY_TRUE", "HALF_TRUE", "MISLEADING", "OUT_OF_CONTEXT", "MOSTLY_FALSE", "FALSE", "UNVERIFIABLE"])
        .optional()
        .describe("Filtrer par verdict : TRUE, FALSE, MISLEADING, etc."),
      page: z.number().int().min(1).default(1).describe("Numéro de page"),
      limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
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

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "get_politician_factchecks",
    "Obtenir les fact-checks mentionnant un politicien spécifique.",
    {
      slug: z.string().describe("Identifiant du politicien (ex: 'marine-le-pen')"),
      page: z.number().int().min(1).default(1).describe("Numéro de page"),
      limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
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

      lines.push(`🔗 https://poligraph.fr/politiques/${data.politician.slug}`);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
