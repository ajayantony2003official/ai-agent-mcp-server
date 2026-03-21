const { inferFiltersFromMessage } = require("./filterInference");

const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "by",
    "created",
    "createdon",
    "date",
    "details",
    "fetch",
    "find",
    "for",
    "from",
    "get",
    "give",
    "id",
    "in",
    "is",
    "lead",
    "leads",
    "me",
    "note",
    "notes",
    "of",
    "on",
    "open",
    "please",
    "record",
    "search",
    "show",
    "stage",
    "that",
    "the",
    "this",
    "to",
    "with",
    "yesterday",
    "today",
    "tomorrow"
]);

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function compactText(value) {
    return normalizeText(value).replace(/\s+/g, "");
}

function extractStageId(message) {
    const patterns = [
        /\b(?:stage|satge)\s*id\s*(?:is|=|:)?\s*(\d+)\b/i,
        /\b(?:stageid|satgeid)\s*(?:is|=|:)?\s*(\d+)\b/i,
        /\b(?:stage|satge)\s+(\d+)\b/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            return Number(match[1]);
        }
    }

    return null;
}

function extractMobileNumber(message) {
    const match = message.match(/\b\d{10,15}\b/);
    return match ? match[0] : null;
}

function extractTicketId(message) {
    const match = message.match(/\bticket(?:\s*id)?\s*(?:is|=|:)?\s*([a-z0-9_-]+)\b/i);
    return match ? match[1] : null;
}

function extractTransUniqueId(message) {
    const match = message.match(/\btrans(?:\s*unique)?(?:\s*id)?\s*(?:is|=|:)?\s*(\d+)\b/i);
    return match ? match[1] : null;
}

function extractModelPhrase(message) {
    const match = message.match(
        /\b(?:model|interested model)\s*(?:is|=|:)?\s*([a-z0-9][a-z0-9\s-]*)/i
    );
    return match ? match[1].trim() : null;
}

function extractLikelyName(message) {
    const match = message.match(
        /\b(?:show|find|get|open|search|fetch|display)\s+(.+?)(?=\s+(?:created|stage|with|from|to|where|note|notes|mobile|number|ticket|trans|model|enquiry|inquiry|on|before|after|between|today|yesterday|tomorrow|this|last)\b|$)/i
    );

    if (!match) {
        return null;
    }

    const phrase = match[1]
        .replace(/\b(lead|leads|details|detail|record|records)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!phrase || /\d/.test(phrase)) {
        return null;
    }

    return phrase;
}

function tokenizeMessage(message) {
    return normalizeText(message)
        .split(/\s+/)
        .filter((token) => token && !STOP_WORDS.has(token) && token.length > 1);
}

function getCustomerName(lead) {
    const audit = lead?.audit_obj || {};

    for (const key of Object.keys(audit)) {
        if (key.toLowerCase().includes("customer_name")) {
            return audit[key];
        }
    }

    return lead?.parsed?.["CUSTOMER NAME"] || "";
}

function stringifyLead(lead) {
    return JSON.stringify({
        parsed: lead?.parsed || {},
        audit_obj: lead?.audit_obj || {}
    });
}

function scoreLead(lead, criteria) {
    const haystack = compactText(stringifyLead(lead));
    const customerName = compactText(getCustomerName(lead));
    let score = 0;

    if (criteria.mobileNumber) {
        if (!haystack.includes(compactText(criteria.mobileNumber))) {
            return Number.NEGATIVE_INFINITY;
        }
        score += 1000;
    }

    if (criteria.ticketId) {
        if (!haystack.includes(compactText(criteria.ticketId))) {
            return Number.NEGATIVE_INFINITY;
        }
        score += 1000;
    }

    if (criteria.transUniqueId) {
        if (!haystack.includes(compactText(criteria.transUniqueId))) {
            return Number.NEGATIVE_INFINITY;
        }
        score += 1000;
    }

    if (criteria.modelPhrase) {
        const modelText = compactText(criteria.modelPhrase);
        if (haystack.includes(modelText)) {
            score += 250;
        } else {
            score -= 50;
        }
    }

    if (criteria.likelyName) {
        const nameText = compactText(criteria.likelyName);

        if (customerName === nameText) {
            score += 700;
        } else if (customerName.includes(nameText)) {
            score += 500;
        } else if (haystack.includes(nameText)) {
            score += 200;
        } else {
            score -= 100;
        }
    }

    for (const token of criteria.tokens) {
        const tokenText = compactText(token);
        if (tokenText && haystack.includes(tokenText)) {
            score += 25;
        }
    }

    return score;
}

function findBestLead(message, leads) {
    const criteria = {
        mobileNumber: extractMobileNumber(message),
        ticketId: extractTicketId(message),
        transUniqueId: extractTransUniqueId(message),
        modelPhrase: extractModelPhrase(message),
        likelyName: extractLikelyName(message),
        tokens: tokenizeMessage(message)
    };

    if (!Array.isArray(leads) || leads.length === 0) {
        return null;
    }

    const hasTarget =
        criteria.mobileNumber ||
        criteria.ticketId ||
        criteria.transUniqueId ||
        criteria.modelPhrase ||
        criteria.likelyName ||
        criteria.tokens.length > 0;

    if (!hasTarget) {
        return leads[0];
    }

    const scored = leads
        .map((lead) => ({ lead, score: scoreLead(lead, criteria) }))
        .filter((item) => item.score > Number.NEGATIVE_INFINITY)
        .sort((left, right) => right.score - left.score);

    if (!scored.length) {
        return null;
    }

    return scored[0].lead;
}

function isCountQuery(message) {
    return /\b(count|how many|total)\b/i.test(message);
}

function formatFilters(filtersUsed) {
    const filters = filtersUsed || {};
    const entries = Object.entries(filters);

    if (!entries.length) {
        return "No filters were applied.";
    }

    return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function formatLeadResponse(leadsResult, selectedLead) {
    const parsed = selectedLead?.parsed || {};
    const audit = selectedLead?.audit_obj || {};
    const lines = [
        `I found a matching lead in stage ${audit.StageId || "unknown"}.`,
        `Customer Name: ${parsed["CUSTOMER NAME"] || audit.Salekvr_CUSTOMER_NAME || "-"}`,
        `Mobile Number: ${parsed["MOBILE NUMBER"] || audit.Mobicxw_MOBILE_NUMBER || "-"}`,
        `Interested Model: ${parsed["INTERESTED MODEL"] || audit.Sale_INTERESTED_MODEL || "-"}`,
        `Created On: ${audit.CreatedOn || parsed.CreatedOn || "-"}`,
        `Ticket ID: ${audit.TicketId || parsed.TicketId || "-"}`,
        `Trans Unique Id: ${audit.Trans_Unique_Id || parsed["Trans Unique Id"] || "-"}`,
        `Filters Used: ${formatFilters(leadsResult.filters_used)}`
    ];

    return lines.join("\n");
}

async function runDeterministicFallback(message, dependencies) {
    const { accessToken, getFilters, getStageLeads } = dependencies;
    const stageId = extractStageId(message);

    if (!stageId) {
        return null;
    }

    const filtersResult = await getFilters({ stageId }, { accessToken });
    const localFilters = filtersResult.local_filters || [];
    const inferredFilters = inferFiltersFromMessage(message, localFilters);
    const toolArgs = {
        stageId,
        filters: inferredFilters
    };

    const leadsResult = await getStageLeads(toolArgs, { accessToken });

    if (isCountQuery(message)) {
        return [
            `I found ${leadsResult.total_count ?? 0} lead(s) in stage ${stageId}.`,
            `Filters Used: ${formatFilters(leadsResult.filters_used || inferredFilters)}`
        ].join("\n");
    }

    const bestLead = findBestLead(message, leadsResult.leads || []);

    if (!bestLead) {
        return `No matching lead found for stage ${stageId}.`;
    }

    return formatLeadResponse(leadsResult, bestLead);
}

module.exports = {
    extractStageId,
    findBestLead,
    runDeterministicFallback
};
