import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface PartyListItem {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  color: string;
  politicalPosition: string | null;
  logoUrl: string | null;
  foundedDate: string | null;
  dissolvedDate: string | null;
  website: string | null;
  memberCount: number;
}

interface PartyListResponse {
  data: PartyListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PartyMember {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  currentMandate: { type: string; title: string } | null;
  affairsCount: number;
}

interface PartyDetailResponse {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  color: string;
  politicalPosition: string | null;
  logoUrl: string | null;
  foundedDate: string | null;
  dissolvedDate: string | null;
  website: string | null;
  description: string | null;
  ideology: string | null;
  memberCount: number;
  members: PartyMember[];
  externalIds: Array<{ source: string; externalId: string; url: string | null }>;
  predecessor: { id: string; slug: string; name: string; shortName: string } | null;
  successors: Array<{ id: string; slug: string; name: string; shortName: string }>;
}

function formatPosition(position: string | null): string {
  if (!position) return "Non classé";
  const labels: Record<string, string> = {
    FAR_LEFT: "Extrême gauche",
    LEFT: "Gauche",
    CENTER_LEFT: "Centre-gauche",
    CENTER: "Centre",
    CENTER_RIGHT: "Centre-droit",
    RIGHT: "Droite",
    FAR_RIGHT: "Extrême droite",
  };
  return labels[position] || position;
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
    PRESIDENT_PARTI: "Président(e) de parti",
  };
  return labels[type] || type;
}

export function registerPartyTools(server: McpServer): void {
  server.registerTool(
    "list_parties",
    {
      description: "Lister les partis politiques français avec filtres par position politique et statut.",
      inputSchema: {
        search: z.string().optional().describe("Recherche par nom ou abréviation (ex: 'LFI', 'Républicains')"),
        position: z
          .enum(["FAR_LEFT", "LEFT", "CENTER_LEFT", "CENTER", "CENTER_RIGHT", "RIGHT", "FAR_RIGHT"])
          .optional()
          .describe("Filtrer par position sur l'échiquier politique"),
        active: z.boolean().optional().describe("true = partis actifs (non dissous avec des membres), false = partis dissous"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche de partis politiques...",
        "openai/toolInvocation/invoked": "Partis trouvés",
      },
    },
    async ({ search, position, active, page, limit }) => {
      const data = await fetchAPI<PartyListResponse>("/api/partis", {
        search,
        position,
        active: active !== undefined ? active : undefined,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.pagination.total} partis** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const p of data.data) {
        const pos = formatPosition(p.politicalPosition);
        const dissolved = p.dissolvedDate ? " [Dissous]" : "";
        lines.push(`- **${p.name}** (${p.shortName}) — ${pos}, ${p.memberCount} membre(s)${dissolved}`);
        lines.push(`  /partis/${p.slug}`);
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
            name: p.name,
            shortName: p.shortName,
            politicalPosition: p.politicalPosition,
            memberCount: p.memberCount,
            dissolvedDate: p.dissolvedDate,
            url: `https://poligraph.fr/partis/${p.slug}`,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_party",
    {
      description: "Obtenir la fiche complète d'un parti politique : membres, position, filiation, liens externes.",
      inputSchema: {
        slug: z.string().describe("Identifiant du parti (ex: 'renaissance', 'rassemblement-national', 'la-france-insoumise')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement du parti...",
        "openai/toolInvocation/invoked": "Parti chargé",
      },
    },
    async ({ slug }) => {
      const data = await fetchAPI<PartyDetailResponse>(`/api/partis/${encodeURIComponent(slug)}`);

      const lines: string[] = [];

      lines.push(`# ${data.name} (${data.shortName})`);
      lines.push(`**Position** : ${formatPosition(data.politicalPosition)}`);
      lines.push(`**Membres** : ${data.memberCount}`);

      if (data.foundedDate) {
        lines.push(`**Fondé** le ${formatDate(data.foundedDate)}`);
      }
      if (data.dissolvedDate) {
        lines.push(`**Dissous** le ${formatDate(data.dissolvedDate)}`);
      }
      if (data.website) {
        lines.push(`**Site web** : ${data.website}`);
      }
      if (data.ideology) {
        lines.push(`**Idéologie** : ${data.ideology}`);
      }
      if (data.description) {
        lines.push("");
        lines.push(data.description);
      }

      // Filiation
      if (data.predecessor) {
        lines.push("");
        lines.push(`**Succède à** : ${data.predecessor.name} (${data.predecessor.shortName}) — /partis/${data.predecessor.slug}`);
      }
      if (data.successors.length > 0) {
        for (const s of data.successors) {
          lines.push(`**Succédé par** : ${s.name} (${s.shortName}) — /partis/${s.slug}`);
        }
      }

      // Members with current mandates
      if (data.members.length > 0) {
        lines.push("");
        lines.push(`## Membres (${data.members.length})`);
        const withMandate = data.members.filter((m) => m.currentMandate);
        const withoutMandate = data.members.filter((m) => !m.currentMandate);

        if (withMandate.length > 0) {
          lines.push("### Avec mandat actuel");
          for (const m of withMandate.slice(0, 30)) {
            const mandate = m.currentMandate ? ` — ${formatMandateType(m.currentMandate.type)}` : "";
            const affairs = m.affairsCount > 0 ? ` [${m.affairsCount} affaire(s)]` : "";
            lines.push(`- **${m.fullName}**${mandate}${affairs}`);
          }
          if (withMandate.length > 30) {
            lines.push(`_... et ${withMandate.length - 30} autres avec mandat_`);
          }
        }

        if (withoutMandate.length > 0) {
          lines.push(`### Anciens (${withoutMandate.length})`);
          for (const m of withoutMandate.slice(0, 10)) {
            lines.push(`- ${m.fullName}`);
          }
          if (withoutMandate.length > 10) {
            lines.push(`_... et ${withoutMandate.length - 10} autres_`);
          }
        }
      }

      lines.push("");
      lines.push(`https://poligraph.fr/partis/${data.slug}`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          slug: data.slug,
          name: data.name,
          shortName: data.shortName,
          politicalPosition: data.politicalPosition,
          memberCount: data.memberCount,
          foundedDate: data.foundedDate,
          dissolvedDate: data.dissolvedDate,
          website: data.website,
          ideology: data.ideology,
          description: data.description,
          predecessor: data.predecessor ? { slug: data.predecessor.slug, name: data.predecessor.name, shortName: data.predecessor.shortName } : null,
          successors: data.successors.map((s) => ({ slug: s.slug, name: s.name, shortName: s.shortName })),
          membersWithMandate: data.members.filter((m) => m.currentMandate).length,
          url: `https://poligraph.fr/partis/${data.slug}`,
        },
      };
    },
  );
}
