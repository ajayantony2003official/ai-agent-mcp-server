const getFiltersDefinition = require("./definitions/getFilters");
const getStageLeadsDefinition = require("./definitions/getStageLeads");
const getAuditFormDefinition = require("./definitions/getAuditForm");
const setReminderDefinition = require("./definitions/setReminder");

const toolRegistry = [
    getFiltersDefinition,
    getStageLeadsDefinition,
    getAuditFormDefinition,
    setReminderDefinition
];

module.exports = { toolRegistry };
