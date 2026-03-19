function pad(value) {
    return String(value).padStart(2, "0");
}

function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatLocalDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function startOfWeek(date) {
    const current = stripTime(date);
    const day = current.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(current, diff);
}

function endOfWeek(date) {
    return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function parseDirectDate(query) {
    const isoMatch = query.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (isoMatch) {
        return { from: isoMatch[1], to: isoMatch[1] };
    }

    const dmyMatch = query.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/);
    if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        return { from: `${year}-${month}-${day}`, to: `${year}-${month}-${day}` };
    }

    return null;
}

function reformatDateString(value, expectedFormat) {
    const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!isoMatch) {
        return value;
    }

    const [, year, month, day] = isoMatch;

    if (expectedFormat === "DD-MM-YYYY") {
        return `${day}-${month}-${year}`;
    }

    return `${year}-${month}-${day}`;
}

function detectDateFormatFromSample(sampleValue) {
    if (typeof sampleValue !== "string") {
        return null;
    }

    if (/^\d{2}-\d{2}-\d{4}(?:\s|$)/.test(sampleValue)) {
        return "DD-MM-YYYY";
    }

    if (/^\d{4}-\d{2}-\d{2}(?:\s|$)/.test(sampleValue)) {
        return "YYYY-MM-DD";
    }

    return null;
}

function pickSampleValueForField(sampleData, fieldKey) {
    const firstRow = Array.isArray(sampleData) ? sampleData[0] : null;

    return (
        firstRow?.audit_obj?.[fieldKey] ??
        firstRow?.table_obj?.[fieldKey]?.masked_value ??
        firstRow?.table_obj?.[fieldKey]?.original_value ??
        null
    );
}

function decorateLocalFilters(localFilters, sampleData) {
    const filters = Array.isArray(localFilters)
        ? localFilters.map((filter) => ({ ...filter }))
        : [];

    const byKey = new Map(filters.map((filter) => [filter.key, filter]));

    for (const filter of filters) {
        if (!filter?.key || !filter.key.startsWith("from_")) {
            continue;
        }

        const suffix = filter.key.slice("from_".length);
        const pairedFilter = byKey.get(`to_${suffix}`);

        if (!pairedFilter) {
            continue;
        }

        const sampleValue = pickSampleValueForField(sampleData, suffix);
        const expectedFormat =
            detectDateFormatFromSample(sampleValue) ||
            filter.expected_format ||
            pairedFilter.expected_format ||
            "YYYY-MM-DD";

        filter.expected_format = expectedFormat;
        pairedFilter.expected_format = expectedFormat;

        if (sampleValue !== null && sampleValue !== undefined) {
            filter.example_value = sampleValue;
            pairedFilter.example_value = sampleValue;
        }
    }

    return filters;
}

function resolveDateRangeFromMessage(message, now = new Date()) {
    const query = message.toLowerCase();
    const today = stripTime(now);

    if (query.includes("day before yesterday")) {
        const day = addDays(today, -2);
        return { from: formatLocalDate(day), to: formatLocalDate(day) };
    }

    if (query.includes("yesterday")) {
        const day = addDays(today, -1);
        return { from: formatLocalDate(day), to: formatLocalDate(day) };
    }

    if (query.includes("today")) {
        return { from: formatLocalDate(today), to: formatLocalDate(today) };
    }

    if (query.includes("tomorrow")) {
        const day = addDays(today, 1);
        return { from: formatLocalDate(day), to: formatLocalDate(day) };
    }

    if (query.includes("last week")) {
        const start = addDays(startOfWeek(today), -7);
        const end = addDays(endOfWeek(today), -7);
        return { from: formatLocalDate(start), to: formatLocalDate(end) };
    }

    if (query.includes("this week")) {
        return {
            from: formatLocalDate(startOfWeek(today)),
            to: formatLocalDate(endOfWeek(today))
        };
    }

    if (query.includes("last month")) {
        const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return {
            from: formatLocalDate(startOfMonth(previousMonth)),
            to: formatLocalDate(endOfMonth(previousMonth))
        };
    }

    if (query.includes("this month")) {
        return {
            from: formatLocalDate(startOfMonth(today)),
            to: formatLocalDate(endOfMonth(today))
        };
    }

    return parseDirectDate(query);
}

function buildDateRangeCandidates(localFilters) {
    const filters = Array.isArray(localFilters) ? localFilters : [];
    const byKey = new Map(filters.map((filter) => [filter.key, filter]));
    const candidates = [];

    for (const filter of filters) {
        if (!filter?.key || !filter.key.startsWith("from_")) {
            continue;
        }

        const suffix = filter.key.slice("from_".length);
        const toKey = `to_${suffix}`;
        const pairedFilter = byKey.get(toKey);

        if (!pairedFilter) {
            continue;
        }

        const searchableText = [
            suffix,
            filter.name,
            pairedFilter.name,
            filter.type,
            pairedFilter.type
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        candidates.push({
            fromKey: filter.key,
            toKey,
            searchableText,
            expectedFormat: filter.expected_format || pairedFilter.expected_format || "YYYY-MM-DD"
        });
    }

    return candidates;
}

function normalizeOption(option) {
    if (
        typeof option === "string" ||
        typeof option === "number" ||
        typeof option === "boolean"
    ) {
        return {
            label: String(option),
            value: option
        };
    }

    if (!option || typeof option !== "object") {
        return null;
    }

    const value =
        option.value ??
        option.id ??
        option.key ??
        option.code ??
        option.name ??
        option.label;

    const label =
        option.label ??
        option.name ??
        option.value ??
        option.id ??
        option.key ??
        option.code;

    if (value === undefined && label === undefined) {
        return null;
    }

    return {
        label: String(label ?? value),
        value: value ?? label
    };
}

function inferOptionFiltersFromMessage(message, localFilters) {
    const query = message.toLowerCase();
    const filters = Array.isArray(localFilters) ? localFilters : [];
    const inferred = {};

    for (const filter of filters) {
        if (!filter?.key || filter.key.startsWith("from_") || filter.key.startsWith("to_")) {
            continue;
        }

        const options = Array.isArray(filter.value)
            ? filter.value.map(normalizeOption).filter(Boolean)
            : [];

        if (!options.length) {
            continue;
        }

        const match = options.find((option) => {
            const label = String(option.label).toLowerCase();
            const value = String(option.value).toLowerCase();

            return query.includes(label) || (value !== label && query.includes(value));
        });

        if (match) {
            inferred[filter.key] = match.value;
        }
    }

    return inferred;
}

function buildFilterGuide(localFilters) {
    const filters = Array.isArray(localFilters) ? localFilters : [];
    const dateRangeFilters = buildDateRangeCandidates(filters).map((candidate) => ({
        kind: "date_range",
        from_key: candidate.fromKey,
        to_key: candidate.toKey,
        hint: candidate.searchableText,
        expected_format: candidate.expectedFormat,
        example_value:
            filters.find((filter) => filter.key === candidate.fromKey)?.example_value || null
    }));

    const valueFilters = filters
        .filter(
            (filter) =>
                filter?.key &&
                !filter.key.startsWith("from_") &&
                !filter.key.startsWith("to_") &&
                Array.isArray(filter.value) &&
                filter.value.length > 0
        )
        .map((filter) => ({
            kind: "value_picker",
            key: filter.key,
            name: filter.name,
            type: filter.type,
            options: filter.value
                .map(normalizeOption)
                .filter(Boolean)
                .map((option) => option.label)
        }));

    return {
        date_range_filters: dateRangeFilters,
        value_filters: valueFilters
    };
}

function pickBestCandidate(message, candidates) {
    if (!candidates.length) {
        return null;
    }

    if (candidates.length === 1) {
        return candidates[0];
    }

    const query = message.toLowerCase();
    const priorities = [
        ["created", "create"],
        ["enquiry", "inquiry"],
        ["date"]
    ];

    for (const terms of priorities) {
        if (!terms.some((term) => query.includes(term))) {
            continue;
        }

        const match = candidates.find((candidate) =>
            terms.some((term) => candidate.searchableText.includes(term))
        );

        if (match) {
            return match;
        }
    }

    return candidates[0];
}

function inferFiltersFromMessage(message, localFilters, now = new Date()) {
    const inferred = inferOptionFiltersFromMessage(message, localFilters);
    const dateRange = resolveDateRangeFromMessage(message, now);

    if (!dateRange) {
        return inferred;
    }

    const candidates = buildDateRangeCandidates(localFilters);
    const candidate = pickBestCandidate(message, candidates);

    if (!candidate) {
        return inferred;
    }

    return {
        ...inferred,
        [candidate.fromKey]: reformatDateString(dateRange.from, candidate.expectedFormat),
        [candidate.toKey]: reformatDateString(dateRange.to, candidate.expectedFormat)
    };
}

module.exports = {
    buildFilterGuide,
    decorateLocalFilters,
    formatLocalDate,
    inferFiltersFromMessage
};
