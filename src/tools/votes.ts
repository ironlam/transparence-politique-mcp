import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface ScrutinListItem {
  id: string;
  externalId: string;
  title: string;
  votingDate: string;
  legislature: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: string;
  sourceUrl: string;
  totalVotes: number;
}

interface VoteListResponse {
  data: ScrutinListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PartyStats {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string;
  partySlug: string;
  totalVotes: number;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  absent: number;
  cohesionRate: number;
  participationRate: number;
}

interface DivisiveScrutin {
  id: string;
  slug: string;
  title: string;
  votingDate: string;
  chamber: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  divisionScore: number;
}

interface VoteStatsResponse {
  parties: PartyStats[];
  divisiveScrutins: DivisiveScrutin[];
  global: {
    totalScrutins: number;
    totalVotes: number;
    totalVotesFor: number;
    totalVotesAgainst: number;
    totalVotesAbstain: number;
    participationRate: number;
    adoptes: number;
    rejetes: number;
  };
}

interface PoliticianVotesResponse {
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
  stats: {
    total: number;
    pour: number;
    contre: number;
    abstention: number;
    nonVotant: number;
    absent: number;
    participationRate: number;
  };
  votes: Array<{
    id: string;
    position: string;
    scrutin: {
      id: string;
      externalId: string;
      title: string;
      votingDate: string;
      legislature: number;
      votesFor: number;
      votesAgainst: number;
      votesAbstain: number;
      result: string;
      sourceUrl: string;
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatResult(result: string): string {
  return result === "ADOPTED" ? "Adopté" : "Rejeté";
}

function formatPosition(position: string): string {
  const labels: Record<string, string> = {
    POUR: "Pour",
    CONTRE: "Contre",
    ABSTENTION: "Abstention",
    NON_VOTANT: "Non votant",
    ABSENT: "Absent",
  };
  return labels[position] || position;
}

export function registerVoteTools(server: McpServer): void {
  server.registerTool(
    "list_votes",
    {
      description: "Lister les scrutins parlementaires (Assemblée nationale et Sénat) avec filtres.",
      inputSchema: {
        search: z.string().optional().describe("Recherche dans le titre du scrutin"),
        result: z.enum(["ADOPTED", "REJECTED"]).optional().describe("Filtrer par résultat : ADOPTED ou REJECTED"),
        legislature: z.number().int().optional().describe("Filtrer par législature (ex: 16, 17)"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche de scrutins...",
        "openai/toolInvocation/invoked": "Scrutins trouvés",
      },
    },
    async ({ search, result, legislature, page, limit }) => {
      const data = await fetchAPI<VoteListResponse>("/api/votes", {
        search,
        result,
        legislature,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.pagination.total} scrutins** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const s of data.data) {
        const resultLabel = formatResult(s.result);
        lines.push(`- **${s.title}** (${formatDate(s.votingDate)})`);
        lines.push(`  ${resultLabel} — Pour: ${s.votesFor}, Contre: ${s.votesAgainst}, Abstention: ${s.votesAbstain}`);
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
          items: data.data.map((s) => ({
            title: s.title,
            votingDate: s.votingDate,
            legislature: s.legislature,
            result: s.result,
            votesFor: s.votesFor,
            votesAgainst: s.votesAgainst,
            votesAbstain: s.votesAbstain,
            sourceUrl: s.sourceUrl,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_politician_votes",
    {
      description: "Obtenir les votes d'un politicien spécifique avec ses statistiques de participation.",
      inputSchema: {
        slug: z.string().describe("Identifiant du politicien (ex: 'jean-luc-melenchon')"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement des votes...",
        "openai/toolInvocation/invoked": "Votes chargés",
      },
    },
    async ({ slug, page, limit }) => {
      const data = await fetchAPI<PoliticianVotesResponse>(
        `/api/politiques/${encodeURIComponent(slug)}/votes`,
        { page, limit },
      );

      const lines: string[] = [];
      const party = data.politician.party ? ` (${data.politician.party.name})` : "";
      lines.push(`# Votes — ${data.politician.fullName}${party}`);
      lines.push("");

      const s = data.stats;
      lines.push("## Statistiques");
      lines.push(`- **Total** : ${s.total} votes`);
      lines.push(`- **Pour** : ${s.pour} (${s.total ? Math.round((s.pour / s.total) * 100) : 0}%)`);
      lines.push(`- **Contre** : ${s.contre} (${s.total ? Math.round((s.contre / s.total) * 100) : 0}%)`);
      lines.push(`- **Abstention** : ${s.abstention}`);
      lines.push(`- **Absent** : ${s.absent}`);
      lines.push(`- **Taux de participation** : ${s.participationRate}%`);
      lines.push("");

      lines.push(`## Derniers votes (page ${data.pagination.page}/${data.pagination.totalPages})`);
      for (const v of data.votes) {
        const resultLabel = formatResult(v.scrutin.result);
        lines.push(`- **${v.scrutin.title}** (${formatDate(v.scrutin.votingDate)})`);
        lines.push(`  Vote : ${formatPosition(v.position)} — Résultat : ${resultLabel}`);
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          politician: { slug: data.politician.slug, fullName: data.politician.fullName },
          stats: data.stats,
          votes: data.votes.map((v) => ({
            position: v.position,
            scrutin: {
              title: v.scrutin.title,
              votingDate: v.scrutin.votingDate,
              result: v.scrutin.result,
              votesFor: v.scrutin.votesFor,
              votesAgainst: v.scrutin.votesAgainst,
              votesAbstain: v.scrutin.votesAbstain,
            },
          })),
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
        },
      };
    },
  );

  server.registerTool(
    "get_vote_stats",
    {
      description: "Obtenir les statistiques de vote par parti : cohésion, scrutins divisifs, distribution globale.",
      inputSchema: {
        chamber: z.enum(["AN", "SENAT"]).optional().describe("Filtrer par chambre : AN (Assemblée) ou SÉNAT"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Calcul des statistiques de vote...",
        "openai/toolInvocation/invoked": "Statistiques calculées",
      },
    },
    async ({ chamber }) => {
      const data = await fetchAPI<VoteStatsResponse>("/api/votes/stats", {
        chamber,
      });

      const lines: string[] = [];
      const chamberLabel = chamber === "AN" ? "Assemblée nationale" : chamber === "SENAT" ? "Sénat" : "Toutes chambres";
      lines.push(`# Statistiques de vote — ${chamberLabel}`);
      lines.push("");

      lines.push("## Vue globale");
      lines.push(`- **Total scrutins** : ${data.global.totalScrutins}`);
      lines.push(`- **Total votes** : ${data.global.totalVotes}`);
      lines.push(`- Pour : ${data.global.totalVotesFor}`);
      lines.push(`- Contre : ${data.global.totalVotesAgainst}`);
      lines.push(`- Abstention : ${data.global.totalVotesAbstain}`);
      lines.push(`- **Adoptés** : ${data.global.adoptes} — **Rejetés** : ${data.global.rejetes}`);
      lines.push(`- **Taux de participation** : ${data.global.participationRate}%`);
      lines.push("");

      lines.push("## Cohésion par parti");
      const sorted = [...data.parties].sort((a, b) => b.cohesionRate - a.cohesionRate);
      for (const p of sorted) {
        lines.push(`- **${p.partyShortName}** (${p.partyName}) : ${p.cohesionRate}% de cohésion (${p.totalVotes} votes)`);
      }
      lines.push("");

      if (data.divisiveScrutins.length > 0) {
        lines.push("## Scrutins les plus divisifs");
        for (const s of data.divisiveScrutins.slice(0, 10)) {
          lines.push(`- **${s.title}** (${formatDate(s.votingDate)})`);
          lines.push(`  Pour: ${s.votesFor}, Contre: ${s.votesAgainst}, Abstention: ${s.votesAbstain} — Score de division : ${s.divisionScore}%`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          global: data.global,
          parties: data.parties.map((p) => ({
            shortName: p.partyShortName,
            name: p.partyName,
            cohesionRate: p.cohesionRate,
            participationRate: p.participationRate,
            totalVotes: p.totalVotes,
          })),
          divisiveScrutins: data.divisiveScrutins.slice(0, 10).map((s) => ({
            title: s.title,
            votingDate: s.votingDate,
            votesFor: s.votesFor,
            votesAgainst: s.votesAgainst,
            votesAbstain: s.votesAbstain,
            divisionScore: s.divisionScore,
          })),
        },
      };
    },
  );
}
