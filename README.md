# Poligraph MCP Server

Serveur [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) qui expose les données de [Poligraph](https://poligraph.fr/) comme tools pour Claude Desktop et Claude Code.

Permet aux journalistes, chercheurs et citoyens de requêter les données politiques françaises en langage naturel.

## Installation

```bash
git clone https://github.com/ironlam/transparence-politique-mcp.git
cd transparence-politique-mcp
npm install
npm run build
```

## Configuration Claude Desktop

Ajoutez dans votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "poligraph": {
      "command": "node",
      "args": ["/chemin/absolu/vers/transparence-politique-mcp/build/index.js"]
    }
  }
}
```

**Emplacement du fichier de config :**
- macOS : `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows : `%APPDATA%\Claude\claude_desktop_config.json`
- Linux : `~/.config/Claude/claude_desktop_config.json`

## Configuration Claude Code

Ajoutez dans `.claude/settings.json` :

```json
{
  "mcpServers": {
    "poligraph": {
      "command": "node",
      "args": ["/chemin/absolu/vers/transparence-politique-mcp/build/index.js"]
    }
  }
}
```

## Tools disponibles (18)

### Politiciens

#### `search_politicians`
Rechercher des politiciens par nom, parti ou type de mandat.

#### `get_politician`
Fiche complète d'un politicien : mandats, déclarations de patrimoine, affaires.

#### `get_politician_relations`
Relations d'un politicien : même parti, gouvernement, législature, département, groupe européen.

### Affaires judiciaires

#### `list_affairs`
Liste des affaires judiciaires avec filtres (statut, catégorie).

#### `get_politician_affairs`
Affaires judiciaires d'un politicien avec sources et détails.

### Votes parlementaires

#### `list_votes`
Scrutins parlementaires (Assemblée nationale et Sénat).

#### `get_politician_votes`
Votes d'un parlementaire avec statistiques de participation.

#### `get_vote_stats`
Statistiques de vote par parti : cohésion, scrutins divisifs.

### Mandats

#### `list_mandates`
Liste des mandats politiques avec filtres (type, institution, statut actif/terminé).

### Partis politiques

#### `list_parties`
Liste des partis politiques avec filtres (position, statut actif/dissous).

#### `get_party`
Fiche complète d'un parti : membres, filiation, position politique.

### Fact-checks

#### `list_factchecks`
Fact-checks sur des politiciens français (AFP Factuel, Les Décodeurs, etc.).

#### `get_politician_factchecks`
Fact-checks mentionnant un politicien spécifique.

### Élections

#### `list_elections`
Élections françaises avec filtres (type, statut, année).

#### `get_election`
Détail d'une élection : candidatures, résultats, participation.

### Géographie

#### `get_department_stats`
Statistiques par département : nombre d'élus, parti dominant, répartition.

#### `get_deputies_by_department`
Députés en exercice dans un département donné.

### Recherche

#### `search_advanced`
Recherche avancée avec filtres combinés (département, statut actif, etc.).

## Développement

```bash
npm run dev          # Compilation en mode watch
npm run build        # Build production
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
