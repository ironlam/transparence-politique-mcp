# Poligraph MCP Server

Serveur [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) qui expose les données de [Poligraph](https://poligraph.fr/) comme tools pour Claude, ChatGPT et tout client MCP compatible.

Permet aux journalistes, chercheurs et citoyens de requêter les données politiques françaises en langage naturel.

## Utilisation rapide

### Serveur distant (aucune installation)

Le serveur est déployé sur Vercel et accessible directement :

```
https://poligraph-mcp-ld-company.vercel.app/mcp
```

#### Claude Desktop

Ajoutez dans votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "poligraph": {
      "type": "streamable-http",
      "url": "https://poligraph-mcp-ld-company.vercel.app/mcp"
    }
  }
}
```

#### Claude Code

```bash
claude mcp add poligraph --transport http https://poligraph-mcp-ld-company.vercel.app/mcp
```

#### ChatGPT Apps

Le serveur est compatible avec [ChatGPT Apps](https://platform.openai.com/docs/actions/mcp-servers) via le protocole MCP.

**Créer un connector ChatGPT :**

1. Allez sur [platform.openai.com](https://platform.openai.com/) > **Actions** > **Create new action**
2. Sélectionnez **MCP Server** comme type de connector
3. Entrez l'URL du serveur :
   ```
   https://poligraph-mcp-ld-company.vercel.app/mcp
   ```
4. Les 18 tools seront automatiquement détectés
5. Publiez l'action dans votre GPT ou App

**Fonctionnalités ChatGPT :**
- `annotations` : tous les tools sont marqués `readOnlyHint: true` (lecture seule)
- `_meta` OpenAI : messages de statut pendant l'invocation (ex: "Recherche de politiciens...")
- `structuredContent` : données JSON structurées en plus du texte markdown

### Installation locale (stdio)

```bash
git clone https://github.com/ironlam/poligraph-mcp.git
cd poligraph-mcp
npm install
npm run build
```

Ajoutez dans la configuration de votre client MCP :

```json
{
  "mcpServers": {
    "poligraph": {
      "command": "node",
      "args": ["/chemin/absolu/vers/poligraph-mcp/build/index.js"]
    }
  }
}
```

**Emplacement du fichier de config Claude Desktop :**
- macOS : `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows : `%APPDATA%\Claude\claude_desktop_config.json`
- Linux : `~/.config/Claude/claude_desktop_config.json`

## Tools disponibles (18)

### Politiciens

| Tool | Description |
|------|-------------|
| `search_politicians` | Rechercher des politiciens par nom, parti ou type de mandat |
| `get_politician` | Fiche complète : mandats, déclarations de patrimoine, affaires |
| `get_politician_relations` | Relations : même parti, gouvernement, législature, département |

### Affaires judiciaires

| Tool | Description |
|------|-------------|
| `list_affairs` | Liste des affaires judiciaires avec filtres (statut, catégorie) |
| `get_politician_affairs` | Affaires judiciaires d'un politicien avec sources et détails |

### Votes parlementaires

| Tool | Description |
|------|-------------|
| `list_votes` | Scrutins parlementaires (Assemblée nationale et Sénat) |
| `get_politician_votes` | Votes d'un parlementaire avec statistiques de participation |
| `get_vote_stats` | Statistiques de vote par parti : cohésion, scrutins divisifs |

### Mandats

| Tool | Description |
|------|-------------|
| `list_mandates` | Liste des mandats politiques (type, institution, statut actif/terminé) |

### Partis politiques

| Tool | Description |
|------|-------------|
| `list_parties` | Liste des partis avec filtres (position, statut actif/dissous) |
| `get_party` | Fiche complète : membres, filiation, position politique |

### Fact-checks

| Tool | Description |
|------|-------------|
| `list_factchecks` | Fact-checks (AFP Factuel, Les Décodeurs, etc.) |
| `get_politician_factchecks` | Fact-checks mentionnant un politicien spécifique |

### Elections

| Tool | Description |
|------|-------------|
| `list_elections` | Elections françaises avec filtres (type, statut, année) |
| `get_election` | Détail : candidatures, résultats, participation |

### Géographie

| Tool | Description |
|------|-------------|
| `get_department_stats` | Statistiques par département : élus, parti dominant, répartition |
| `get_deputies_by_department` | Députés en exercice dans un département donné |

### Recherche

| Tool | Description |
|------|-------------|
| `search_advanced` | Recherche avancée avec filtres combinés (département, statut, etc.) |

## Architecture

```
src/
├── index.ts          # Point d'entrée CLI (transport stdio)
├── server.ts         # Factory MCP server & enregistrement des tools
├── http.ts           # Serveur Express (transport HTTP Streamable)
├── api.ts            # Client API (https://poligraph.fr)
├── tools/
│   ├── politicians.ts
│   ├── affairs.ts
│   ├── votes.ts
│   ├── legislation.ts
│   ├── factchecks.ts
│   ├── parties.ts
│   ├── elections.ts
│   ├── mandates.ts
│   └── departments.ts
└── tests/
    └── api-contract.test.ts
api/
└── mcp.ts            # Handler Vercel (serverless)
```

**Transports supportés :**
- **stdio** — Claude Desktop / Claude Code en local
- **HTTP Streamable** — serveur Express ou Vercel, compatible ChatGPT Actions

## Développement

```bash
npm run dev          # Compilation en mode watch
npm run build        # Build production
npm run start:http   # Serveur HTTP local (port 3001)
npm run inspect      # Tester interactivement avec MCP Inspector
npm run test:build   # Build + tests de contrat API
```

## Source des données

Toutes les données proviennent de sources officielles :
- [Assemblée nationale](https://data.assemblee-nationale.fr/)
- [Sénat](https://data.senat.fr/)
- [HATVP](https://www.hatvp.fr/)
- [Wikidata](https://www.wikidata.org/)

Voir [poligraph.fr/sources](https://poligraph.fr/sources) pour la liste complète.

## Licence

MIT
