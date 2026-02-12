#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPoliticianTools } from "./tools/politicians.js";
import { registerAffairTools } from "./tools/affairs.js";
import { registerVoteTools } from "./tools/votes.js";
import { registerLegislationTools } from "./tools/legislation.js";
import { registerFactCheckTools } from "./tools/factchecks.js";
import { registerPartyTools } from "./tools/parties.js";
import { registerElectionTools } from "./tools/elections.js";
import { registerMandateTools } from "./tools/mandates.js";
import { registerDepartmentTools } from "./tools/departments.js";

const server = new McpServer({
  name: "poligraph",
  version: "2.0.0",
});

// Register all tools
registerPoliticianTools(server);
registerAffairTools(server);
registerVoteTools(server);
registerLegislationTools(server);
registerFactCheckTools(server);
registerPartyTools(server);
registerElectionTools(server);
registerMandateTools(server);
registerDepartmentTools(server);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Poligraph MCP server running on stdio");
