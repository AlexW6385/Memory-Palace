/**
 * api.js - API Client for Universe and Agent services
 * v2
 */
const API_BASE = window.location.origin;

export const api = {
    // ── Universe API (Reads) ────────────────────────────────────────────────
    async getNodes(limit = 20, offset = 0) {
        const res = await fetch(`${API_BASE}/nodes?limit=${limit}&offset=${offset}`);
        if (!res.ok) throw new Error("Failed to fetch nodes");
        return res.json();
    },

    async getNode(id) {
        const res = await fetch(`${API_BASE}/nodes/${id}`);
        if (!res.ok) throw new Error("Node not found");
        return res.json();
    },

    async getNeighbors(id, depth = 1) {
        const res = await fetch(`${API_BASE}/graph/${id}/neighbors?depth=${depth}&limit=50`);
        if (!res.ok) throw new Error("Failed to fetch neighbors");
        return res.json();
    },

    async search(query, mode = "hybrid") {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&mode=${mode}&limit=10`);
        if (!res.ok) throw new Error("Search failed");
        return res.json();
    },

    async getStats() {
        const res = await fetch(`${API_BASE}/nodes/count`);
        if (!res.ok) return { count: "?" };
        return res.json();
    },

    // ── Agent API (Writes/Ingestion) ─────────────────────────────────────────
    async ingestUrl(url, depth = 0) {
        const res = await fetch(`${API_BASE}/tasks/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, depth })
        });
        if (!res.ok) throw new Error("Ingestion failed to start");
        return res.json();
    },

    async ingestDirectText(text) {
        const res = await fetch(`${API_BASE}/tasks/ingest/direct`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`Direct ingestion failed (${res.status}): ${body}`);
        }
        return res.json();
    },

    async getTaskStatus(taskId) {
        const res = await fetch(`${API_BASE}/tasks/${taskId}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Task status fetch failed (${res.status})`);
        return res.json();
    },

    async exploreTopic(topic, depth = 2) {
        const res = await fetch(`${API_BASE}/tasks/explore`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, depth, max_nodes: 20 })
        });
        if (!res.ok) throw new Error("Exploration failed to start");
        return res.json();
    }
};
