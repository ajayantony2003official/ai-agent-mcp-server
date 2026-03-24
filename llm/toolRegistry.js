const getFiltersDefinition = require("./definitions/getFilters");
const getStageLeadsDefinition = require("./definitions/getStageLeads");
const getAuditFormDefinition = require("./definitions/getAuditForm");
const setReminderDefinition = require("./definitions/setReminder");
const getTemplateDataDefinition = require("./definitions/getTemplateData");
const submitTemplateDataDefinition = require("./definitions/submitTemplateData");

const toolRegistry = [
    getFiltersDefinition,
    getStageLeadsDefinition,
    getAuditFormDefinition,
    setReminderDefinition,
    getTemplateDataDefinition,
    submitTemplateDataDefinition
];

module.exports = { toolRegistry };
