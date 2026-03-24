/**
 * feed.js - WebSocket event feed handler
 * v2
 */
export class EventFeed {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.ws = null;
        this.maxItems = 100;
        this.callbacks = [];
    }

    connect() {
        console.log("EventFeed: Starting connection and establishing handshake...");
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            console.log("EventFeed: WebSocket instance created", wsUrl);

            this.ws.onopen = () => {
                console.log("EventFeed: Connection opened successfully");
                const statusEl = document.getElementById("ws-status");
                if (statusEl) statusEl.remove();
                this.addSystemMessage("Universe synchronization active. System ready.");
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "ping") return;
                if (data.type === "info") {
                    this.addSystemMessage(data.message);
                    return;
                }
                this.handleEvent(data);
            };
            
            this.ws.onclose = (e) => {
                console.warn("EventFeed: Connection closed", e.code, e.reason);
                this.addSystemMessage("Connection lost. Reconnecting in 5s...", "error");
                setTimeout(() => this.connect(), 5000);
            };

            this.ws.onerror = (err) => {
                console.error("EventFeed: WebSocket error detected", err);
            };
        } catch (err) {
            console.error("EventFeed: Failed to create WebSocket", err);
        }
    }

    onEvent(callback) {
        this.callbacks.push(callback);
    }

    handleEvent(data) {
        const type = data.event_type;
        if (!type) return;

        // Parse JSON-encoded list fields that come back as strings from Redis Streams
        const topics = (() => { try { return JSON.parse(data.topics || "[]"); } catch { return []; } })();

        let title = "Unknown Event";
        let message = "";
        let style = "";

        if (type === "NODE_CREATED") {
            title = "New Node Discovered";
            const topicStr = topics.length ? ` · ${topics.slice(0, 3).join(", ")}` : "";
            message = `[${data.content_type}] ${data.title}${topicStr}`;
        } else if (type === "EDGE_CREATED") {
            title = "Knowledge Link Formed";
            message = `${(data.relation_type || "").toUpperCase()} connection established.`;
        } else if (type === "INGESTION_COMPLETED") {
            title = data.was_duplicate === "true" ? "Node Updated" : "Ingestion Complete";
            message = `${data.edges_created} new edge(s) · task <code>${(data.task_id || "").slice(0, 8)}</code>`;
        } else if (type === "INGESTION_FAILED") {
            title = "Ingestion Failed";
            style = "error";
            message = `<b>${data.error || "unknown error"}</b><br><small>${data.url}</small>`;
        } else if (type === "INGESTION_PROGRESS") {
            title = `Step ${data.step_index}/6: ${data.step}`;
            style = "progress";
            const detail = data.detail ? ` — ${data.detail}` : "";
            message = `task <code>${(data.task_id || "").slice(0, 8)}</code>${detail}`;
        } else {
            return; // Ignore unknown internal events
        }

        const item = document.createElement("div");
        item.className = `feed-item ${type.toLowerCase()} ${style}`.trim();

        const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});

        item.innerHTML = `
            <span class="feed-time">${timeStr}</span>
            <span class="feed-title">${title}</span>
            <div class="feed-desc">${message}</div>
        `;
        
        this.container.insertBefore(item, this.container.firstChild);
        
        // Prune old
        while (this.container.children.length > this.maxItems) {
            this.container.removeChild(this.container.lastChild);
        }

        // Notify subscribers (e.g. app.js to increment stats or refresh graph)
        this.callbacks.forEach(cb => cb(data));
    }

    addSystemMessage(msg, style="info") {
        const item = document.createElement("div");
        item.className = `feed-item sys-msg ${style}`;
        item.innerHTML = `<span class="feed-title">System</span><div class="feed-desc">${msg}</div>`;
        this.container.insertBefore(item, this.container.firstChild);
    }
}
