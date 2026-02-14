import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPoliticianTools } from "./tools/politicians.js";
import { registerAffairTools } from "./tools/affairs.js";
import { registerVoteTools } from "./tools/votes.js";
import { registerLegislationTools } from "./tools/legislation.js";
import { registerFactCheckTools } from "./tools/factchecks.js";
import { registerPartyTools } from "./tools/parties.js";
import { registerElectionTools } from "./tools/elections.js";
import { registerMandateTools } from "./tools/mandates.js";
import { registerDepartmentTools } from "./tools/departments.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "poligraph",
    version: "2.0.0",
  });

  registerPoliticianTools(server);
  registerAffairTools(server);
  registerVoteTools(server);
  registerLegislationTools(server);
  registerFactCheckTools(server);
  registerPartyTools(server);
  registerElectionTools(server);
  registerMandateTools(server);
  registerDepartmentTools(server);

  return server;
}
