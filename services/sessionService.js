const { createModel } = require('./geminiService');

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 30 * 60 * 1000);
const sessionStore = new Map();

function cleanupExpiredSessions() {
    const now = Date.now();

    for (const [sessionId, state] of sessionStore.entries()) {
        if (now - (state.lastActiveAt || 0) > SESSION_TTL_MS) {
            sessionStore.delete(sessionId);
        }
    }
}

function getSessionState(sessionId) {
    cleanupExpiredSessions();

    const resolvedSessionId = String(sessionId || `session_${Date.now()}`);
    let state = sessionStore.get(resolvedSessionId);

    if (!state) {
        state = {
            chat: createModel().startChat(),
            discoveredFiltersByStage: new Map(),
            lastActiveAt: Date.now()
        };
        sessionStore.set(resolvedSessionId, state);
    } else {
        state.lastActiveAt = Date.now();
    }

    return state;
}

module.exports = {
    sessionStore,
    cleanupExpiredSessions,
    getSessionState
};
