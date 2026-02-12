import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI } from "../api.js";

interface PartyCount {
  id: string;
  name: string;
  shortName: string;
  color: string | null;
  count: number;
}

interface DepartmentStats {
  code: string;
  name: string;
  region: string;
  totalElus: number;
  deputes: number;
  senateurs: number;
  dominantParty: PartyCount | null;
  parties: PartyCount[];
}

interface DepartmentStatsResponse {
  departments: DepartmentStats[];
  stats: {
    totalDepartments: number;
    totalElus: number;
    totalDeputes: number;
    totalSenateurs: number;
  };
  filter: string;
}

interface DeputyItem {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  constituency: string | null;
  party: {
    name: string;
    shortName: string;
    color: string | null;
  } | null;
}

export function registerDepartmentTools(server: McpServer): void {
  server.tool(
    "get_department_stats",
    "Statistiques politiques par département : nombre d'élus, parti dominant, répartition des partis.",
    {
      filter: z
        .enum(["all", "deputes", "senateurs"])
        .optional()
        .default("all")
        .describe("Filtrer par type : all (députés + sénateurs), deputes, senateurs"),
    },
    async ({ filter }) => {
      const data = await fetchAPI<DepartmentStatsResponse>("/api/stats/departments", {
        filter,
      });

      const lines: string[] = [];
      const filterLabel = filter === "deputes" ? "Députés" : filter === "senateurs" ? "Sénateurs" : "Tous les élus";
      lines.push(`# Statistiques par département — ${filterLabel}`);
      lines.push("");
      lines.push(`**${data.stats.totalDepartments} départements** — ${data.stats.totalElus} élus (${data.stats.totalDeputes} députés, ${data.stats.totalSenateurs} sénateurs)`);
      lines.push("");

      // Top 10 departments by number of elected officials
      const sorted = [...data.departments].sort((a, b) => b.totalElus - a.totalElus);
      lines.push("## Top 10 départements");
      for (const d of sorted.slice(0, 10)) {
        const dominant = d.dominantParty ? ` — Dominant : ${d.dominantParty.shortName} (${d.dominantParty.count})` : "";
        lines.push(`- **${d.name}** (${d.code}) : ${d.totalElus} élus (${d.deputes}D, ${d.senateurs}S)${dominant}`);
      }

      // Party dominance summary
      const partyDominance = new Map<string, number>();
      for (const d of data.departments) {
        if (d.dominantParty) {
          const key = d.dominantParty.shortName;
          partyDominance.set(key, (partyDominance.get(key) || 0) + 1);
        }
      }

      if (partyDominance.size > 0) {
        lines.push("");
        lines.push("## Parti dominant par nombre de départements");
        const dominanceSorted = [...partyDominance.entries()].sort((a, b) => b[1] - a[1]);
        for (const [party, count] of dominanceSorted) {
          lines.push(`- **${party}** : ${count} départements`);
        }
      }

      lines.push("");
      lines.push(`🔗 https://poligraph.fr/carte`);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "get_deputies_by_department",
    "Obtenir la liste des députés en exercice dans un département donné.",
    {
      department: z.string().describe("Nom du département (ex: 'Paris', 'Bouches-du-Rhône', 'Nord')"),
    },
    async ({ department }) => {
      const data = await fetchAPI<DeputyItem[]>("/api/deputies/by-department", {
        department,
      });

      const lines: string[] = [];
      lines.push(`# Députés — ${department}`);
      lines.push(`**${data.length} député(s) en exercice**`);
      lines.push("");

      for (const d of data) {
        const party = d.party ? ` (${d.party.shortName})` : "";
        const circ = d.constituency || "";
        lines.push(`- **${d.fullName}**${party} — ${circ}`);
        lines.push(`  /politiques/${d.slug}`);
      }

      if (data.length === 0) {
        lines.push("_Aucun député trouvé pour ce département. Vérifiez l'orthographe (ex: 'Bouches-du-Rhône', pas 'Bouches du Rhône')._");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
