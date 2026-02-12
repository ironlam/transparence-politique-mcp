import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface MandateItem {
  id: string;
  type: string;
  title: string;
  institution: string | null;
  role: string | null;
  constituency: string | null;
  departmentCode: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  politician: {
    id: string;
    slug: string;
    fullName: string;
    photoUrl: string | null;
  };
}

interface MandateListResponse {
  data: MandateItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatMandateType(type: string): string {
  const labels: Record<string, string> = {
    DEPUTE: "Député(e)",
    SENATEUR: "Sénateur/trice",
    DEPUTE_EUROPEEN: "Député(e) européen(ne)",
    PRESIDENT_REPUBLIQUE: "Président(e) de la République",
    PREMIER_MINISTRE: "Premier(e) ministre",
    MINISTRE: "Ministre",
    MINISTRE_DELEGUE: "Ministre délégué(e)",
    SECRETAIRE_ETAT: "Secrétaire d'État",
    MAIRE: "Maire",
    ADJOINT_MAIRE: "Adjoint(e) au maire",
    PRESIDENT_REGION: "Président(e) de région",
    PRESIDENT_DEPARTEMENT: "Président(e) de département",
    CONSEILLER_REGIONAL: "Conseiller/ère régional(e)",
    CONSEILLER_DEPARTEMENTAL: "Conseiller/ère départemental(e)",
    CONSEILLER_MUNICIPAL: "Conseiller/ère municipal(e)",
    PRESIDENT_PARTI: "Président(e) de parti",
  };
  return labels[type] || type;
}

export function registerMandateTools(server: McpServer): void {
  server.tool(
    "list_mandates",
    "Lister les mandats politiques avec filtres par type, institution, statut actif/terminé et politicien.",
    {
      type: z
        .enum([
          "DEPUTE",
          "SENATEUR",
          "DEPUTE_EUROPEEN",
          "PRESIDENT_REPUBLIQUE",
          "PREMIER_MINISTRE",
          "MINISTRE",
          "SECRETAIRE_ETAT",
          "MINISTRE_DELEGUE",
          "PRESIDENT_REGION",
          "PRESIDENT_DEPARTEMENT",
          "MAIRE",
          "ADJOINT_MAIRE",
          "CONSEILLER_REGIONAL",
          "CONSEILLER_DEPARTEMENTAL",
          "CONSEILLER_MUNICIPAL",
          "PRESIDENT_PARTI",
        ])
        .optional()
        .describe("Filtrer par type de mandat"),
      isCurrent: z.boolean().optional().describe("true = mandats en cours, false = mandats terminés"),
      institution: z.string().optional().describe("Recherche sur l'institution (ex: 'Assemblée', 'Sénat')"),
      page: z.number().int().min(1).default(1).describe("Numéro de page"),
      limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
    },
    async ({ type, isCurrent, institution, page, limit }) => {
      const data = await fetchAPI<MandateListResponse>("/api/mandats", {
        type,
        isCurrent: isCurrent !== undefined ? isCurrent : undefined,
        institution,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.pagination.total} mandats** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const m of data.data) {
        const typeLabel = formatMandateType(m.type);
        const status = m.isCurrent ? "En cours" : `Terminé (${formatDate(m.endDate)})`;
        const constituency = m.constituency ? ` — ${m.constituency}` : "";
        const institution = m.institution ? ` — ${m.institution}` : "";

        lines.push(`- **${m.politician.fullName}** : ${typeLabel}${institution}${constituency}`);
        lines.push(`  ${status} — depuis ${formatDate(m.startDate)}`);
        lines.push(`  /politiques/${m.politician.slug}`);
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
