import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI } from "../api.js";

interface SearchResult {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  currentParty: {
    shortName: string;
    color: string;
  } | null;
  currentMandate: {
    type: string;
    constituency: string;
  } | null;
  affairsCount: number;
}

interface AdvancedSearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  suggestions?: string[];
}

function formatMandateType(type: string): string {
  const labels: Record<string, string> = {
    DEPUTE: "Député(e)",
    SENATEUR: "Sénateur/trice",
    DEPUTE_EUROPEEN: "Député(e) européen(ne)",
    PRESIDENT: "Président(e) de la République",
    PREMIER_MINISTRE: "Premier(e) ministre",
    MINISTRE: "Ministre",
    MINISTRE_DELEGUE: "Ministre délégué(e)",
    SECRETAIRE_ETAT: "Secrétaire d'État",
    MAIRE: "Maire",
    PRESIDENT_REGION: "Président(e) de région",
    PRESIDENT_DEPARTEMENT: "Président(e) de département",
  };
  return labels[type] || type;
}

export function registerLegislationTools(server: McpServer): void {
  server.registerTool(
    "search_advanced",
    {
      description: "Recherche avancée de politiciens avec filtres combinés : parti, mandat, département, affaires, statut actif.",
      inputSchema: {
        query: z.string().optional().describe("Recherche par nom ou prénom (min 2 caractères)"),
        party: z.string().optional().describe("Filtrer par ID de parti"),
        mandate: z
          .enum([
            "DEPUTE",
            "SENATEUR",
            "MINISTRE",
            "PREMIER_MINISTRE",
            "MINISTRE_DELEGUE",
            "SECRETAIRE_ETAT",
            "DEPUTE_EUROPEEN",
          ])
          .optional()
          .describe("Filtrer par type de mandat"),
        department: z.string().optional().describe("Filtrer par département (ex: 'Paris', 'Bouches-du-Rhône')"),
        hasAffairs: z.boolean().optional().describe("Filtrer par présence d'affaires judiciaires"),
        isActive: z.boolean().optional().describe("Filtrer les politiciens ayant un mandat actuel"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche avancée en cours...",
        "openai/toolInvocation/invoked": "Résultats trouvés",
      },
    },
    async ({ query, party, mandate, department, hasAffairs, isActive, page, limit }) => {
      const data = await fetchAPI<AdvancedSearchResponse>("/api/search/advanced", {
        q: query,
        party,
        mandate,
        department,
        hasAffairs: hasAffairs !== undefined ? hasAffairs : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.total} résultats** (page ${data.page}/${data.totalPages})`);
      lines.push("");

      for (const r of data.results) {
        const party = r.currentParty ? ` (${r.currentParty.shortName})` : "";
        const mandate = r.currentMandate
          ? ` — ${formatMandateType(r.currentMandate.type)}${r.currentMandate.constituency ? `, ${r.currentMandate.constituency}` : ""}`
          : "";
        const affairs = r.affairsCount > 0 ? ` [${r.affairsCount} affaire(s)]` : "";
        lines.push(`- **${r.fullName}**${party}${mandate}${affairs}`);
        lines.push(`  /politiques/${r.slug}`);
      }

      if (data.suggestions && data.suggestions.length > 0) {
        lines.push("");
        lines.push("**Suggestions** : " + data.suggestions.join(", "));
      }

      if (data.page < data.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.page + 1}_`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          total: data.total,
          page: data.page,
          totalPages: data.totalPages,
          results: data.results.map((r) => ({
            slug: r.slug,
            fullName: r.fullName,
            party: r.currentParty ? { shortName: r.currentParty.shortName } : null,
            mandate: r.currentMandate ? { type: r.currentMandate.type, constituency: r.currentMandate.constituency } : null,
            affairsCount: r.affairsCount,
            url: `https://poligraph.fr/politiques/${r.slug}`,
          })),
          suggestions: data.suggestions ?? [],
        },
      };
    },
  );
}
