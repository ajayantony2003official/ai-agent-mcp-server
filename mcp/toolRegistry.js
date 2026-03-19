// mcp/toolRegistry.js
import { getFiltersTool } from "../tools/getFilters";
import { getStageLeadsTool } from "../tools/getStageLeads";
import { getAuditFormTool } from "../tools/getleadFulldeatils";

export const toolRegistry = [
    getFiltersTool,
    getStageLeadsTool,
    getAuditFormTool
];