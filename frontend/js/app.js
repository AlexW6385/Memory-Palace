/**
 * app.js - Main Application Controller
 */
import { api } from "./api.js";
import { EventFeed } from "./feed.js";
import { UniverseGraph } from "./graph.js";

class App {
    constructor() {
        this.feed = new EventFeed("event-feed");
        this.graph = new UniverseGraph("graph-container", this.onNodeClick.bind(this));
        
        this.explorationPath = [];
        this.init();
    }

    async init() {
        this.bindTabs();
        this.bindForms();
        this.bindSearch();
        this.bindDrawer();

        // Start WebSocket
        this.feed.onEvent(this.handleLiveEvent.bind(this));
        this.feed.connect();

        // Load initial graph data (recent nodes)
        await this.loadInitialGraph();
        this.updateStats();
    }

    bindTabs() {
        const tabs = document.querySelectorAll(".tab-btn");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
                
                tab.classList.add("active");
                document.getElementById(tab.dataset.target).classList.add("active");
            });
        });
    }

    bindForms() {
        // URL Ingestion
        document.getElementById("btn-ingest-url").addEventListener("click", async () => {
            const url = document.getElementById("ingest-url").value;
            const depth = parseInt(document.getElementById("url-depth").value, 10);
            if (!url) return alert("Enter a URL");
            
            try {
                this.feed.addSystemMessage(`Submitting URL: ${url}`);
                await api.ingestUrl(url, depth);
                document.getElementById("ingest-url").value = "";
            } catch (err) {
                alert("Task failed: " + err.message);
            }
        });

        // Direct Text Ingestion
        document.getElementById("btn-ingest-text").addEventListener("click", async () => {
            const text = document.getElementById("ingest-text").value;
            if (!text) return alert("Enter some text");
            
            try {
                this.feed.addSystemMessage(`Submitting direct text...`);
                await api.ingestDirectText(text);
                document.getElementById("ingest-text").value = "";
            } catch (err) {
                alert("Task failed: " + err.message);
            }
        });

        // Topic Exploration
        document.getElementById("btn-explore-topic").addEventListener("click", async () => {
            const topic = document.getElementById("explore-topic").value;
            const depth = parseInt(document.getElementById("topic-depth").value, 10);
            if (!topic) return alert("Enter a topic");
            
            try {
                this.feed.addSystemMessage(`Agent launched for topic: ${topic}`);
                await api.exploreTopic(topic, depth);
                document.getElementById("explore-topic").value = "";
            } catch (err) {
                alert("Task failed: " + err.message);
            }
        });
    }

    bindSearch() {
        const input = document.getElementById("search-input");
        const resultsBox = document.getElementById("search-results");
        let timeout = null;

        input.addEventListener("input", (e) => {
            clearTimeout(timeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                resultsBox.classList.add("hidden");
                return;
            }
            
            timeout = setTimeout(async () => {
                try {
                    const data = await api.search(query, "hybrid");
                    if (data.results && data.results.length > 0) {
                        resultsBox.innerHTML = data.results.map(r => `
                            <div class="search-item" data-id="${r.id}">
                                <strong>${r.title}</strong>
                                <span>Score: ${Number(r.similarity || 1).toFixed(2)} | Type: ${r.content_type}</span>
                            </div>
                        `).join("");
                        resultsBox.classList.remove("hidden");
                        
                        // Bind click on results
                        document.querySelectorAll(".search-item").forEach(item => {
                            item.addEventListener("click", async () => {
                                const id = item.dataset.id;
                                resultsBox.classList.add("hidden");
                                input.value = "";
                                
                                // Fetch and center
                                const node = await api.getNode(id);
                                this.onNodeClick(node);
                                
                                // Expand visual graph if not present
                                await this.loadNeighbors(id, 1);
                                this.graph.highlightNode(id);
                            });
                        });
                    } else {
                        resultsBox.innerHTML = `<div class="search-item">No results found</div>`;
                        resultsBox.classList.remove("hidden");
                    }
                } catch (err) {}
            }, 300); // 300ms debounce
        });

        // Hide on click outside
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".search-box")) {
                resultsBox.classList.add("hidden");
            }
        });
    }

    bindDrawer() {
        document.getElementById("close-drawer").addEventListener("click", () => {
            document.getElementById("node-drawer").classList.add("hidden");
        });

        document.getElementById("btn-load-neighbors").addEventListener("click", async (e) => {
            const nodeId = e.target.dataset.id;
            if (nodeId) {
                this.feed.addSystemMessage(`Traversing neighborhood...`);
                await this.loadNeighbors(nodeId, 1);
            }
        });
    }

    async loadInitialGraph() {
        try {
            const nodes = await api.getNodes(50, 0);
            this.graph.updateData(nodes, []);
            
            // For root nodes, fetch 1 level of edges to tie them together visually
            for (let n of nodes.slice(0, 5)) {
                await this.loadNeighbors(n.id, 1);
            }
        } catch (err) {
            console.error("Failed to load initial graph", err);
        }
    }

    async loadNeighbors(nodeId, depth = 1) {
        try {
            const data = await api.getNeighbors(nodeId, depth);
            this.graph.updateData(data.nodes, data.edges);
        } catch (err) {
            console.error("Network error on traversal", err);
        }
    }

    async updateStats() {
        const stats = await api.getStats();
        document.getElementById("stat-nodes").innerText = stats.count || 0;
    }

    handleLiveEvent(event) {
        // Automatically inject new nodes/edges into graph if they arrive
        if (event.event_type === "NODE_CREATED") {
            const partialNode = {
                id: event.node_id,
                title: event.title,
                content_type: event.content_type,
                topics: event.topics || []
            };
            this.graph.updateData([partialNode], []);
            this.updateStats();
        } 
        else if (event.event_type === "EDGE_CREATED") {
            const partialEdge = {
                id: event.edge_id,
                source_node_id: event.source_node_id,
                target_node_id: event.target_node_id,
                relation_type: event.relation_type || "relates_to"
            };
            this.graph.updateData([], [partialEdge]);
        }
    }

    onNodeClick(node) {
        // Append to breadcrumbs
        this.addToPath(node);

        // Update Drawer Drawer
        document.getElementById("nd-title").innerText = node.title;
        document.getElementById("nd-type").innerText = node.content_type || "unknown";
        document.getElementById("nd-confidence").innerText = `Score: ${(node.confidence || 1.0).toFixed(2)}`;
        document.getElementById("nd-summary").innerText = node.summary || "No summary available.";
        
        const tagsHtml = (node.topics || []).map(t => `<span class="tag">${t}</span>`).join("");
        document.getElementById("nd-tags").innerHTML = tagsHtml;
        
        const urlLink = document.getElementById("nd-url");
        if (node.canonical_url) {
            urlLink.href = node.canonical_url;
            urlLink.style.display = "block";
        } else {
            urlLink.style.display = "none";
        }

        document.getElementById("btn-load-neighbors").dataset.id = node.id;
        document.getElementById("node-drawer").classList.remove("hidden");
    }

    addToPath(node) {
        // Prevent immediate duplicates
        if (this.explorationPath.length > 0 && this.explorationPath[this.explorationPath.length - 1].id === node.id) {
            return;
        }

        this.explorationPath.push({id: node.id, title: node.title});
        if (this.explorationPath.length > 5) {
            this.explorationPath.shift(); // Keep last 5
        }

        const pathContainer = document.getElementById("exploration-path");
        pathContainer.innerHTML = this.explorationPath.map(p => 
            `<span class="path-node" data-id="${p.id}">${p.title.length > 15 ? p.title.substring(0,15)+"..." : p.title}</span>`
        ).join("");

        // Re-bind click
        pathContainer.querySelectorAll(".path-node").forEach(pn => {
            pn.addEventListener("click", async () => {
                const id = pn.dataset.id;
                const fetched = await api.getNode(id);
                this.onNodeClick(fetched);
                this.graph.highlightNode(id);
            });
        });
    }
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    window.app = new App();
});
