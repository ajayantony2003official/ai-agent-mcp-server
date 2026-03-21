function makeEvent({ type, turnId, sessionId, payload }) {
    return {
        type,
        timestamp: new Date().toISOString(),
        eventId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        turnId,
        sessionId,
        payload
    };
}

function writeEvent(res, event) {
    res.write(`${JSON.stringify(event)}\n`);
}

module.exports = {
    makeEvent,
    writeEvent
};
