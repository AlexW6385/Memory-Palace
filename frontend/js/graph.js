/**
 * graph.js - Wraps ForceGraph for rendering the Knowledge Universe
 */
export class UniverseGraph {
    constructor(containerId, onNodeClick) {
        this.container = document.getElementById(containerId);
        this.onNodeClick = onNodeClick;
        
        this.graphData = { nodes: [], links: [] };
        this.nodesMap = new Map();
        
        // Instantiate ForceGraph (from CDN)
        this.fg = ForceGraph()(this.container)
            .backgroundColor("transparent")
            .nodeId("id")
            .nodeLabel("title")
            .nodeVal(n => Math.max(4, (n.topics?.length || 1) * 2))
            .nodeColor(n => this.getColorForType(n.content_type))
            .linkSource("source_node_id")
            .linkTarget("target_node_id")
            .linkLabel("relation_type")
            .linkColor(() => "rgba(255, 255, 255, 0.2)")
            .linkWidth(1.5)
            .linkDirectionalParticles(2)
            .linkDirectionalParticleSpeed(0.005)
            .onNodeClick(node => {
                this.centerAt(node);
                if (this.onNodeClick) this.onNodeClick(node);
            })
            // Custom node rendering for glow effect
            .nodeCanvasObject((node, ctx, globalScale) => {
                const label = node.title || "";
                const fontSize = 14 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                
                const r = Math.sqrt(Math.max(4, (node.topics?.length || 1) * 2)) * 2;
                
                // Glow
                ctx.shadowBlur = 10 * globalScale;
                ctx.shadowColor = this.getColorForType(node.content_type);
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                ctx.fillStyle = this.getColorForType(node.content_type);
                ctx.fill();
                ctx.shadowBlur = 0; // reset

                // Text
                if (globalScale > 1.5) {
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                    ctx.fillText(label.length > 20 ? label.substring(0, 20) + "..." : label, node.x, node.y + r + fontSize);
                }
            });

        // Handle resize
        window.addEventListener('resize', () => {
            this.fg.width(this.container.clientWidth);
            this.fg.height(this.container.clientHeight);
        });
    }

    getColorForType(type) {
        const colors = {
            "wiki": "#06B6D4",      // Cyan
            "paper": "#8B5CF6",     // Purple
            "article": "#10B981",   // Emerald
            "pdf": "#F59E0B",       // Amber
            "note": "#EC4899",      // Pink
            "code": "#6366F1",      // Indigo
            "unknown": "#94A3B8"
        };
        return colors[type] || colors["unknown"];
    }

    updateData(nodes, edges) {
        // Merge into existing data
        let updated = false;
        
        nodes.forEach(n => {
            if (!this.nodesMap.has(n.id)) {
                this.nodesMap.set(n.id, n);
                this.graphData.nodes.push(n);
                updated = true;
            }
        });

        // Ensure links have valid source/target to prevent D3 crashes
        edges.forEach(e => {
            const exists = this.graphData.links.some(l => 
                l.source_node_id === e.source_node_id && 
                l.target_node_id === e.target_node_id &&
                l.relation_type === e.relation_type
            );
            if (!exists && this.nodesMap.has(e.source_node_id) && this.nodesMap.has(e.target_node_id)) {
                this.graphData.links.push(e);
                updated = true;
            }
        });

        if (updated) {
            // Must pass a new object to trigger update
            this.fg.graphData({
                nodes: [...this.graphData.nodes],
                links: [...this.graphData.links]
            });
        }
    }

    centerAt(node) {
        this.fg.centerAt(node.x, node.y, 1000);
        this.fg.zoom(2.5, 1000);
    }
    
    highlightNode(nodeId) {
        const node = this.nodesMap.get(nodeId);
        if (node && node.x !== undefined) {
            this.centerAt(node);
        }
    }

    clear() {
        this.graphData = { nodes: [], links: [] };
        this.nodesMap.clear();
        this.fg.graphData(this.graphData);
    }
}
