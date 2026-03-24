/**
 * feed.js - WebSocket event feed handler
 */
export class EventFeed {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.ws = null;
        this.maxItems = 100;
        this.callbacks = [];
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Connect to the Nginx /ws route which proxies to Universe
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.addSystemMessage("Connected to Knowledge Universe stream.");
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "ping") return; // Keepalive
                this.handleEvent(data);
            } catch (err) {
                console.error("Feed parse error", err);
            }
        };
        
        this.ws.onclose = () => {
            this.addSystemMessage("Connection lost. Reconnecting in 5s...", "error");
            setTimeout(() => this.connect(), 5000);
        };
    }

    onEvent(callback) {
        this.callbacks.push(callback);
    }

    handleEvent(data) {
        const type = data.event_type;
        if (!type) return;

        let title = "Unknown Event";
        let message = "";
        
        if (type === "NODE_CREATED") {
            title = "New Node Discovered";
            message = `[${data.content_type}] ${data.title}`;
        } else if (type === "EDGE_CREATED") {
            title = "Knowledge Link Formed";
            message = `${data.relation_type.toUpperCase()} connection established.`;
        } else if (type === "INGESTION_COMPLETED") {
            title = data.was_duplicate ? "Node Updated" : "Ingestion Complete";
            message = `Added ${data.edges_created} new edges from ${data.url}`;
        } else if (type === "INGESTION_FAILED") {
            title = "Ingestion Failed";
            message = `Error on ${data.url}`;
        } else {
            return; // Ignore other internal events
        }

        const item = document.createElement("div");
        item.className = `feed-item ${type.toLowerCase()}`;
        
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
