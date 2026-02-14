import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface Source {
  id: string;
  url: string;
  title: string;
  publisher: string;
  publishedAt: string | null;
}

interface AffairListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  category: string;
  factsDate: string | null;
  startDate: string;
  verdictDate: string | null;
  sentence: string | null;
  appeal: string | null;
  politician: {
    id: string;
    slug: string;
    fullName: string;
    currentParty: {
      shortName: string;
      name: string;
    } | null;
  };
  partyAtTime: {
    shortName: string;
    name: string;
  } | null;
  sources: Source[];
}

interface AffairListResponse {
  data: AffairListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PoliticianAffairsResponse {
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
  affairs: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    status: string;
    category: string;
    factsDate: string | null;
    startDate: string;
    verdictDate: string | null;
    sentence: string | null;
    appeal: string | null;
    partyAtTime: {
      shortName: string;
      name: string;
    } | null;
    sources: Source[];
  }>;
  total: number;
}

const PRESUMPTION_NOTICE =
  "**Rappel** : Toute personne mise en examen est présumée innocente jusqu'à ce que sa culpabilité ait été établie par une décision de justice définitive.";

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    ENQUETE_PRELIMINAIRE: "Enquête préliminaire",
    MISE_EN_EXAMEN: "Mise en examen",
    PROCES_EN_COURS: "Procès en cours",
    CONDAMNATION_PREMIERE_INSTANCE: "Condamnation (1ère instance)",
    CONDAMNATION_DEFINITIVE: "Condamnation définitive",
    APPEL_EN_COURS: "Appel en cours",
    RELAXE: "Relaxe",
    NON_LIEU: "Non-lieu",
    PRESCRIPTION: "Prescription",
  };
  return labels[status] || status;
}

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    CORRUPTION: "Corruption",
    FRAUDE_FISCALE: "Fraude fiscale",
    BLANCHIMENT: "Blanchiment",
    TRAFIC_INFLUENCE: "Trafic d'influence",
    PRISE_ILLEGALE_INTERET: "Prise illégale d'intérêts",
    VIOLENCE: "Violence",
    HARCELEMENT_SEXUEL: "Harcèlement sexuel",
    AGRESSION_SEXUELLE: "Agression sexuelle",
    VIOL: "Viol",
    DIFFAMATION: "Diffamation",
    ABUS_BIENS_SOCIAUX: "Abus de biens sociaux",
    DETOURNEMENT_FONDS: "Détournement de fonds",
    EMPLOI_FICTIF: "Emploi fictif",
    FINANCEMENT_ILLEGAL: "Financement illégal",
    HARCELEMENT_MORAL: "Harcèlement moral",
    MENACE: "Menace",
    OUTRAGE: "Outrage",
    RECEL: "Recel",
  };
  return labels[category] || category;
}

function needsPresumption(status: string): boolean {
  return [
    "ENQUETE_PRELIMINAIRE",
    "MISE_EN_EXAMEN",
    "PROCES_EN_COURS",
    "APPEL_EN_COURS",
  ].includes(status);
}

function formatAffairDetail(affair: AffairListItem | PoliticianAffairsResponse["affairs"][0], politicianName?: string): string {
  const lines: string[] = [];

  lines.push(`### ${affair.title}`);
  if (politicianName) {
    lines.push(`**Politicien** : ${politicianName}`);
  }
  lines.push(`**Statut** : ${formatStatus(affair.status)}`);
  lines.push(`**Catégorie** : ${formatCategory(affair.category)}`);

  if (affair.factsDate) lines.push(`**Date des faits** : ${formatDate(affair.factsDate)}`);
  if (affair.startDate) lines.push(`**Début de procédure** : ${formatDate(affair.startDate)}`);
  if (affair.verdictDate) lines.push(`**Verdict** : ${formatDate(affair.verdictDate)}`);
  if (affair.sentence) lines.push(`**Peine** : ${affair.sentence}`);
  if (affair.appeal) lines.push(`**Appel** : ${affair.appeal}`);

  if (affair.partyAtTime) {
    lines.push(`**Parti au moment des faits** : ${affair.partyAtTime.name} (${affair.partyAtTime.shortName})`);
  }

  lines.push("");
  lines.push(affair.description);

  if (affair.sources.length > 0) {
    lines.push("");
    lines.push("**Sources** :");
    for (const s of affair.sources) {
      const date = s.publishedAt ? ` (${formatDate(s.publishedAt)})` : "";
      lines.push(`- [${s.title}](${s.url}) — ${s.publisher}${date}`);
    }
  }

  if (needsPresumption(affair.status)) {
    lines.push("");
    lines.push(PRESUMPTION_NOTICE);
  }

  return lines.join("\n");
}

export function registerAffairTools(server: McpServer): void {
  server.registerTool(
    "list_affairs",
    {
      description: "Lister les affaires judiciaires impliquant des politiciens français, avec filtres par statut et catégorie.",
      inputSchema: {
        status: z
          .enum([
            "ENQUETE_PRELIMINAIRE",
            "MISE_EN_EXAMEN",
            "PROCES_EN_COURS",
            "CONDAMNATION_PREMIERE_INSTANCE",
            "CONDAMNATION_DEFINITIVE",
            "APPEL_EN_COURS",
            "RELAXE",
            "NON_LIEU",
            "PRESCRIPTION",
          ])
          .optional()
          .describe("Filtrer par statut judiciaire"),
        category: z
          .enum([
            "CORRUPTION",
            "FRAUDE_FISCALE",
            "BLANCHIMENT",
            "TRAFIC_INFLUENCE",
            "PRISE_ILLEGALE_INTERET",
            "VIOLENCE",
            "HARCELEMENT_SEXUEL",
            "DIFFAMATION",
          ])
          .optional()
          .describe("Filtrer par catégorie d'infraction"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche d'affaires judiciaires...",
        "openai/toolInvocation/invoked": "Affaires trouvées",
      },
    },
    async ({ status, category, page, limit }) => {
      const data = await fetchAPI<AffairListResponse>("/api/affaires", {
        status,
        category,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.pagination.total} affaires** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const affair of data.data) {
        const party = affair.politician.currentParty
          ? ` (${affair.politician.currentParty.shortName})`
          : "";
        lines.push(formatAffairDetail(affair, `${affair.politician.fullName}${party}`));
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
          items: data.data.map((a) => ({
            slug: a.slug,
            title: a.title,
            status: a.status,
            category: a.category,
            politician: { slug: a.politician.slug, fullName: a.politician.fullName },
            factsDate: a.factsDate,
            startDate: a.startDate,
            verdictDate: a.verdictDate,
            sentence: a.sentence,
            sources: a.sources.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher })),
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_politician_affairs",
    {
      description: "Obtenir les affaires judiciaires d'un politicien spécifique, avec sources et détails.",
      inputSchema: {
        slug: z.string().describe("Identifiant du politicien (ex: 'nicolas-sarkozy')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement des affaires...",
        "openai/toolInvocation/invoked": "Affaires chargées",
      },
    },
    async ({ slug }) => {
      const data = await fetchAPI<PoliticianAffairsResponse>(
        `/api/politiques/${encodeURIComponent(slug)}/affaires`,
      );

      const lines: string[] = [];
      const party = data.politician.party
        ? ` (${data.politician.party.name})`
        : "";
      lines.push(`# Affaires judiciaires — ${data.politician.fullName}${party}`);
      lines.push(`**${data.total} affaire(s)**`);
      lines.push("");

      if (data.affairs.some((a) => needsPresumption(a.status))) {
        lines.push(PRESUMPTION_NOTICE);
        lines.push("");
      }

      for (const affair of data.affairs) {
        lines.push(formatAffairDetail(affair));
        lines.push("");
        lines.push("---");
        lines.push("");
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
          affairs: data.affairs.map((a) => ({
            slug: a.slug,
            title: a.title,
            status: a.status,
            category: a.category,
            factsDate: a.factsDate,
            startDate: a.startDate,
            verdictDate: a.verdictDate,
            sentence: a.sentence,
            sources: a.sources.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher })),
          })),
          url: `https://poligraph.fr/politiques/${data.politician.slug}`,
        },
      };
    },
  );
}
