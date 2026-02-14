import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface ElectionListItem {
  id: string;
  slug: string;
  type: string;
  title: string;
  shortTitle: string | null;
  status: string;
  scope: string | null;
  suffrage: string | null;
  round1Date: string | null;
  round2Date: string | null;
  dateConfirmed: boolean;
  totalSeats: number | null;
  candidacyCount: number;
}

interface ElectionListResponse {
  data: ElectionListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Candidacy {
  id: string;
  candidateName: string;
  partyLabel: string | null;
  constituencyName: string | null;
  isElected: boolean | null;
  round1Votes: number | null;
  round1Pct: number | null;
  round2Votes: number | null;
  round2Pct: number | null;
  politician: {
    id: string;
    slug: string;
    fullName: string;
    photoUrl: string | null;
  } | null;
  party: {
    id: string;
    slug: string;
    shortName: string;
    color: string;
  } | null;
}

interface Round {
  round: number;
  date: string | null;
  registeredVoters: number | null;
  actualVoters: number | null;
  participationRate: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
}

interface ElectionDetailResponse {
  id: string;
  slug: string;
  type: string;
  title: string;
  shortTitle: string | null;
  status: string;
  scope: string | null;
  suffrage: string | null;
  round1Date: string | null;
  round2Date: string | null;
  dateConfirmed: boolean;
  totalSeats: number | null;
  candidacies: Candidacy[];
  rounds: Round[];
}

function formatElectionType(type: string): string {
  const labels: Record<string, string> = {
    PRESIDENTIELLE: "Présidentielle",
    LEGISLATIVES: "Législatives",
    SENATORIALES: "Sénatoriales",
    MUNICIPALES: "Municipales",
    DEPARTEMENTALES: "Départementales",
    REGIONALES: "Régionales",
    EUROPEENNES: "Européennes",
    REFERENDUM: "Référendum",
  };
  return labels[type] || type;
}

function formatElectionStatus(status: string): string {
  const labels: Record<string, string> = {
    UPCOMING: "À venir",
    REGISTRATION: "Inscriptions ouvertes",
    CANDIDACIES: "Dépôt des candidatures",
    CAMPAIGN: "Campagne en cours",
    ROUND_1: "1er tour",
    BETWEEN_ROUNDS: "Entre-deux-tours",
    ROUND_2: "2nd tour",
    COMPLETED: "Terminée",
  };
  return labels[status] || status;
}

export function registerElectionTools(server: McpServer): void {
  server.registerTool(
    "list_elections",
    {
      description: "Lister les élections françaises (présidentielle, législatives, municipales, etc.) avec filtres.",
      inputSchema: {
        type: z
          .enum(["PRESIDENTIELLE", "LEGISLATIVES", "SENATORIALES", "MUNICIPALES", "DEPARTEMENTALES", "REGIONALES", "EUROPEENNES", "REFERENDUM"])
          .optional()
          .describe("Filtrer par type d'élection"),
        status: z
          .enum(["UPCOMING", "REGISTRATION", "CANDIDACIES", "CAMPAIGN", "ROUND_1", "BETWEEN_ROUNDS", "ROUND_2", "COMPLETED"])
          .optional()
          .describe("Filtrer par statut"),
        year: z.number().int().optional().describe("Filtrer par année (ex: 2027)"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche d'élections...",
        "openai/toolInvocation/invoked": "Élections trouvées",
      },
    },
    async ({ type, status, year, page, limit }) => {
      const data = await fetchAPI<ElectionListResponse>("/api/elections", {
        type,
        status,
        year,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.pagination.total} élection(s)** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const e of data.data) {
        const typeLabel = formatElectionType(e.type);
        const statusLabel = formatElectionStatus(e.status);
        const date = e.round1Date ? formatDate(e.round1Date) : "Date non confirmée";
        const seats = e.totalSeats ? ` — ${e.totalSeats} sièges` : "";
        const candidacies = e.candidacyCount > 0 ? ` — ${e.candidacyCount} candidat(s)` : "";

        lines.push(`- **${e.title}** (${typeLabel})`);
        lines.push(`  ${statusLabel} — ${date}${seats}${candidacies}`);
        lines.push(`  /elections/${e.slug}`);
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
          items: data.data.map((e) => ({
            slug: e.slug,
            type: e.type,
            title: e.title,
            status: e.status,
            round1Date: e.round1Date,
            round2Date: e.round2Date,
            totalSeats: e.totalSeats,
            candidacyCount: e.candidacyCount,
            url: `https://poligraph.fr/elections/${e.slug}`,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_election",
    {
      description: "Obtenir le détail d'une élection : candidatures, résultats par tour, participation.",
      inputSchema: {
        slug: z.string().describe("Identifiant de l'élection (ex: 'municipales-2026', 'présidentielle-2027')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement de l'élection...",
        "openai/toolInvocation/invoked": "Élection chargée",
      },
    },
    async ({ slug }) => {
      const data = await fetchAPI<ElectionDetailResponse>(`/api/elections/${encodeURIComponent(slug)}`);

      const lines: string[] = [];

      lines.push(`# ${data.title}`);
      lines.push(`**Type** : ${formatElectionType(data.type)}`);
      lines.push(`**Statut** : ${formatElectionStatus(data.status)}`);

      if (data.round1Date) {
        lines.push(`**1er tour** : ${formatDate(data.round1Date)}${!data.dateConfirmed ? " (non confirmé)" : ""}`);
      }
      if (data.round2Date) {
        lines.push(`**2nd tour** : ${formatDate(data.round2Date)}`);
      }
      if (data.totalSeats) {
        lines.push(`**Sièges** : ${data.totalSeats}`);
      }
      if (data.scope) {
        lines.push(`**Portée** : ${data.scope}`);
      }
      if (data.suffrage) {
        lines.push(`**Suffrage** : ${data.suffrage}`);
      }

      // Rounds
      if (data.rounds.length > 0) {
        lines.push("");
        lines.push("## Tours de scrutin");
        for (const r of data.rounds) {
          lines.push(`### Tour ${r.round}${r.date ? ` — ${formatDate(r.date)}` : ""}`);
          if (r.registeredVoters) lines.push(`- Inscrits : ${r.registeredVoters.toLocaleString("fr-FR")}`);
          if (r.actualVoters) lines.push(`- Votants : ${r.actualVoters.toLocaleString("fr-FR")}`);
          if (r.participationRate) lines.push(`- Participation : ${r.participationRate}%`);
          if (r.blankVotes) lines.push(`- Bulletins blancs : ${r.blankVotes.toLocaleString("fr-FR")}`);
          if (r.nullVotes) lines.push(`- Bulletins nuls : ${r.nullVotes.toLocaleString("fr-FR")}`);
        }
      }

      // Candidacies
      if (data.candidacies.length > 0) {
        lines.push("");
        lines.push(`## Candidatures (${data.candidacies.length})`);

        const elected = data.candidacies.filter((c) => c.isElected);
        const others = data.candidacies.filter((c) => !c.isElected);

        if (elected.length > 0) {
          lines.push("### Élu(e)s");
          for (const c of elected) {
            const party = c.party ? ` (${c.party.shortName})` : c.partyLabel ? ` (${c.partyLabel})` : "";
            const r1 = c.round1Pct ? ` — T1: ${c.round1Pct}%` : "";
            const r2 = c.round2Pct ? `, T2: ${c.round2Pct}%` : "";
            lines.push(`- **${c.candidateName}**${party}${r1}${r2}`);
          }
        }

        if (others.length > 0) {
          lines.push("### Autres candidat(e)s");
          for (const c of others.slice(0, 20)) {
            const party = c.party ? ` (${c.party.shortName})` : c.partyLabel ? ` (${c.partyLabel})` : "";
            const r1 = c.round1Pct ? ` — T1: ${c.round1Pct}%` : "";
            const r2 = c.round2Pct ? `, T2: ${c.round2Pct}%` : "";
            lines.push(`- ${c.candidateName}${party}${r1}${r2}`);
          }
          if (others.length > 20) {
            lines.push(`_... et ${others.length - 20} autres candidat(s)_`);
          }
        }
      }

      lines.push("");
      lines.push(`https://poligraph.fr/elections/${data.slug}`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          slug: data.slug,
          type: data.type,
          title: data.title,
          status: data.status,
          round1Date: data.round1Date,
          round2Date: data.round2Date,
          totalSeats: data.totalSeats,
          rounds: data.rounds.map((r) => ({
            round: r.round,
            date: r.date,
            registeredVoters: r.registeredVoters,
            actualVoters: r.actualVoters,
            participationRate: r.participationRate,
          })),
          candidacies: data.candidacies.map((c) => ({
            candidateName: c.candidateName,
            party: c.party ? c.party.shortName : c.partyLabel,
            isElected: c.isElected,
            round1Pct: c.round1Pct,
            round2Pct: c.round2Pct,
            politicianSlug: c.politician?.slug ?? null,
          })),
          url: `https://poligraph.fr/elections/${data.slug}`,
        },
      };
    },
  );
}
