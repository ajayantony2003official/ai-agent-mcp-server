const getFiltersDefinition = require("./definitions/getFilters");
const getStageLeadsDefinition = require("./definitions/getStageLeads");
const getAuditFormDefinition = require("./definitions/getAuditForm");

const toolRegistry = [
    getFiltersDefinition,
    getStageLeadsDefinition,
    getAuditFormDefinition
];

module.exports = { toolRegistry };
