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
  factchecksCount?: number;
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
    lines.push(
      `**Parti** : ${p.currentParty.name} (${p.currentParty.shortName})`,
    );
  }
  const bornLabel = p.civility === "Mme" ? "Née" : "Né";
  lines.push(
    `**${bornLabel}** le ${formatDate(p.birthDate)} à ${p.birthPlace}`,
  );
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
        lines.push(
          `- ${formatMandateType(m.type)} : ${m.title}${constituency} (depuis ${formatDate(m.startDate)})`,
        );
      }
    }
    if (past.length > 0) {
      lines.push("### Anciens mandats");
      for (const m of past) {
        const constituency = m.constituency ? ` — ${m.constituency}` : "";
        lines.push(
          `- ${formatMandateType(m.type)} : ${m.title}${constituency} (${formatDate(m.startDate)} → ${formatDate(m.endDate)})`,
        );
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
    lines.push(
      `Utilisez l'outil get_politician_affairs avec le slug "${p.slug}" pour les détails.`,
    );
  }

  if (p.factchecksCount && p.factchecksCount > 0) {
    lines.push("");
    lines.push(`## Fact-checks : ${p.factchecksCount}`);
    lines.push(
      `Utilisez l'outil get_politician_factchecks avec le slug "${p.slug}" pour les détails.`,
    );
  }

  lines.push("");
  lines.push(`https://poligraph.fr/politiques/${p.slug}`);

  return lines.join("\n");
}

interface RelationNode {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  party: { shortName: string; color: string | null } | null;
  mandateType: string;
}

interface RelationCluster {
  type: string;
  label: string;
  nodes: RelationNode[];
  links: Array<{
    source: string;
    target: string;
    type: string;
    label?: string;
  }>;
}

interface RelationsResponse {
  center: RelationNode;
  clusters: RelationCluster[];
  stats: { totalConnections: number; byType: Record<string, number> };
}

function formatRelationType(type: string): string {
  const labels: Record<string, string> = {
    SAME_GOVERNMENT: "Même gouvernement",
    SHARED_COMPANY: "Entreprises en commun",
    SAME_DEPARTMENT: "Même département",
    PARTY_HISTORY: "Anciens collègues de parti",
  };
  return labels[type] || type;
}

export function registerPoliticianTools(server: McpServer): void {
  server.registerTool(
    "search_politicians",
    {
      description:
        "Rechercher des politiciens français par nom, parti ou type de mandat. Retourne une liste paginée.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Recherche par nom (ex: 'Macron', 'Marine')"),
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
        hasAffairs: z
          .boolean()
          .optional()
          .describe("Filtrer les politiciens ayant des affaires judiciaires"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Résultats par page (max 100)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche de politiciens...",
        "openai/toolInvocation/invoked": "Politiciens trouvés",
      },
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
      lines.push(
        `**${data.pagination.total} résultats** (page ${data.pagination.page}/${data.pagination.totalPages})`,
      );
      lines.push("");

      for (const p of data.data) {
        lines.push(formatPoliticianSummary(p));
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          total: data.pagination.total,
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          items: data.data.map((p) => ({
            slug: p.slug,
            fullName: p.fullName,
            party: p.currentParty
              ? {
                  name: p.currentParty.name,
                  shortName: p.currentParty.shortName,
                }
              : null,
            birthDate: p.birthDate,
            deathDate: p.deathDate,
            url: `https://poligraph.fr/politiques/${p.slug}`,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_politician_relations",
    {
      description:
        "Obtenir les relations d'un politicien : gouvernement, entreprises en commun, département, parcours partisan.",
      inputSchema: {
        slug: z
          .string()
          .describe("Identifiant du politicien (ex: 'emmanuel-macron')"),
        types: z
          .string()
          .optional()
          .describe(
            "Types de relations séparés par virgule. Types : SAME_GOVERNMENT, SHARED_COMPANY, SAME_DEPARTMENT, PARTY_HISTORY",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Nombre max de connexions par type (max 50)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement des relations...",
        "openai/toolInvocation/invoked": "Relations chargées",
      },
    },
    async ({ slug, types, limit }) => {
      const data = await fetchAPI<RelationsResponse>(
        `/api/politiques/${encodeURIComponent(slug)}/relations`,
        { types, limit },
      );

      const lines: string[] = [];
      const party = data.center.party
        ? ` (${data.center.party.shortName})`
        : "";
      lines.push(`# Relations — ${data.center.fullName}${party}`);
      lines.push(`**${data.stats.totalConnections} connexions**`);
      lines.push("");

      const relationsByType: Record<
        string,
        Array<{ slug: string; fullName: string; party: string | null }>
      > = {};

      for (const cluster of data.clusters) {
        const count = cluster.nodes.length;
        lines.push(
          `## ${cluster.label} — ${formatRelationType(cluster.type)} (${count})`,
        );
        for (const n of cluster.nodes.slice(0, 15)) {
          const nParty = n.party ? ` (${n.party.shortName})` : "";
          const mandate = n.mandateType
            ? ` — ${formatMandateType(n.mandateType)}`
            : "";
          lines.push(`- **${n.fullName}**${nParty}${mandate}`);
        }
        if (cluster.nodes.length > 15) {
          lines.push(`_... et ${cluster.nodes.length - 15} autres_`);
        }
        lines.push("");

        relationsByType[cluster.type] = cluster.nodes.map((n) => ({
          slug: n.slug,
          fullName: n.fullName,
          party: n.party?.shortName ?? null,
        }));
      }

      lines.push(
        `https://poligraph.fr/politiques/${data.center.slug}/relations`,
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          center: { slug: data.center.slug, fullName: data.center.fullName },
          totalConnections: data.stats.totalConnections,
          byType: data.stats.byType,
          relations: relationsByType,
          url: `https://poligraph.fr/politiques/${data.center.slug}/relations`,
        },
      };
    },
  );

  server.registerTool(
    "get_politician",
    {
      description:
        "Obtenir la fiche complète d'un politicien : mandats, déclarations de patrimoine, nombre d'affaires.",
      inputSchema: {
        slug: z
          .string()
          .describe(
            "Identifiant du politicien (ex: 'emmanuel-macron', 'marine-le-pen')",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement du politicien...",
        "openai/toolInvocation/invoked": "Politicien chargé",
      },
    },
    async ({ slug }) => {
      const data = await fetchAPI<PoliticianDetail>(
        `/api/politiques/${encodeURIComponent(slug)}`,
      );
      return {
        content: [
          { type: "text" as const, text: formatPoliticianDetail(data) },
        ],
        structuredContent: {
          slug: data.slug,
          fullName: data.fullName,
          civility: data.civility,
          birthDate: data.birthDate,
          deathDate: data.deathDate,
          birthPlace: data.birthPlace,
          photoUrl: data.photoUrl,
          party: data.currentParty
            ? {
                name: data.currentParty.name,
                shortName: data.currentParty.shortName,
              }
            : null,
          mandates: data.mandates.map((m) => ({
            type: m.type,
            title: m.title,
            institution: m.institution,
            constituency: m.constituency,
            startDate: m.startDate,
            endDate: m.endDate,
            isCurrent: m.isCurrent,
          })),
          declarations: data.declarations.map((d) => ({
            type: d.type,
            year: d.year,
            url: d.url,
          })),
          affairsCount: data.affairsCount,
          factchecksCount: data.factchecksCount ?? 0,
          url: `https://poligraph.fr/politiques/${data.slug}`,
        },
      };
    },
  );
}
