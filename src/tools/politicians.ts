import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface PoliticianListItem {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  lastName: string;
  civility: string;
  birthDate: string;
  deathDate: string | null;
  birthPlace: string;
  photoUrl: string | null;
  currentParty: {
    id: string;
    name: string;
    shortName: string;
    color: string;
  } | null;
}

interface PoliticianListResponse {
  data: PoliticianListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Mandate {
  id: string;
  type: string;
  title: string;
  institution: string;
  constituency: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}

interface Declaration {
  id: string;
  type: string;
  year: number;
  url: string;
}

interface PoliticianDetail extends PoliticianListItem {
  mandates: Mandate[];
  declarations: Declaration[];
  affairsCount: number;
}

function formatPoliticianSummary(p: PoliticianListItem): string {
  const party = p.currentParty ? ` (${p.currentParty.shortName})` : "";
  const deceased = p.deathDate ? ` [Décédé(e)]` : "";
  return `- **${p.fullName}**${party}${deceased} — /politiques/${p.slug}`;
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
    CONSEILLER_REGIONAL: "Conseiller/ère régional(e)",
    CONSEILLER_DEPARTEMENTAL: "Conseiller/ère départemental(e)",
    CONSEILLER_MUNICIPAL: "Conseiller/ère municipal(e)",
    PRESIDENT_PARTI: "Président(e) de parti",
  };
  return labels[type] || type;
}

function formatPoliticianDetail(p: PoliticianDetail): string {
  const lines: string[] = [];

  lines.push(`# ${p.fullName}`);
  if (p.currentParty) {
    lines.push(`**Parti** : ${p.currentParty.name} (${p.currentParty.shortName})`);
  }
  const bornLabel = p.civility === "Mme" ? "Née" : "Né";
  lines.push(`**${bornLabel}** le ${formatDate(p.birthDate)} à ${p.birthPlace}`);
  if (p.deathDate) {
    lines.push(`**Décédé(e)** le ${formatDate(p.deathDate)}`);
  }

  if (p.mandates.length > 0) {
    lines.push("");
    lines.push("## Mandats");
    const current = p.mandates.filter((m) => m.isCurrent);
    const past = p.mandates.filter((m) => !m.isCurrent);

    if (current.length > 0) {
      lines.push("### En cours");
      for (const m of current) {
        const constituency = m.constituency ? ` — ${m.constituency}` : "";
        lines.push(`- ${formatMandateType(m.type)} : ${m.title}${constituency} (depuis ${formatDate(m.startDate)})`);
      }
    }
    if (past.length > 0) {
      lines.push("### Anciens mandats");
      for (const m of past) {
        const constituency = m.constituency ? ` — ${m.constituency}` : "";
        lines.push(`- ${formatMandateType(m.type)} : ${m.title}${constituency} (${formatDate(m.startDate)} → ${formatDate(m.endDate)})`);
      }
    }
  }

  if (p.declarations.length > 0) {
    lines.push("");
    lines.push("## Déclarations HATVP");
    for (const d of p.declarations) {
      lines.push(`- ${d.type} (${d.year}) : ${d.url}`);
    }
  }

  if (p.affairsCount > 0) {
    lines.push("");
    lines.push(`## Affaires judiciaires : ${p.affairsCount}`);
    lines.push(`Utilisez l'outil get_politician_affairs avec le slug "${p.slug}" pour les détails.`);
  }

  lines.push("");
  lines.push(`🔗 https://politic-tracker.vercel.app/politiques/${p.slug}`);

  return lines.join("\n");
}

export function registerPoliticianTools(server: McpServer): void {
  server.tool(
    "search_politicians",
    "Rechercher des politiciens français par nom, parti ou type de mandat. Retourne une liste paginée.",
    {
      query: z.string().optional().describe("Recherche par nom (ex: 'Macron', 'Marine')"),
      party: z.string().optional().describe("Filtrer par ID de parti"),
      mandateType: z
        .enum([
          "DEPUTE",
          "SENATEUR",
          "DEPUTE_EUROPEEN",
          "PRESIDENT",
          "PREMIER_MINISTRE",
          "MINISTRE",
          "SECRETAIRE_ETAT",
          "MAIRE",
          "PRESIDENT_REGION",
          "PRESIDENT_DEPARTEMENT",
          "CONSEILLER_REGIONAL",
          "CONSEILLER_DEPARTEMENTAL",
          "CONSEILLER_MUNICIPAL",
        ])
        .optional()
        .describe("Filtrer par type de mandat"),
      hasAffairs: z.boolean().optional().describe("Filtrer les politiciens ayant des affaires judiciaires"),
      page: z.number().int().min(1).default(1).describe("Numéro de page"),
      limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
    },
    async ({ query, party, mandateType, hasAffairs, page, limit }) => {
      const data = await fetchAPI<PoliticianListResponse>("/api/politiques", {
        search: query,
        partyId: party,
        mandateType,
        hasAffairs: hasAffairs !== undefined ? hasAffairs : undefined,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.pagination.total} résultats** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const p of data.data) {
        lines.push(formatPoliticianSummary(p));
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "get_politician",
    "Obtenir la fiche complète d'un politicien : mandats, déclarations de patrimoine, nombre d'affaires.",
    {
      slug: z.string().describe("Identifiant du politicien (ex: 'emmanuel-macron', 'marine-le-pen')"),
    },
    async ({ slug }) => {
      const data = await fetchAPI<PoliticianDetail>(`/api/politiques/${encodeURIComponent(slug)}`);
      return { content: [{ type: "text" as const, text: formatPoliticianDetail(data) }] };
    },
  );
}
