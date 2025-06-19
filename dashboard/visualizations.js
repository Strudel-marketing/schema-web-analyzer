// dashboard/visualizations.js - D3.js Visualizations for Schema Web Analyzer
class Visualizations {
    constructor() {
        this.currentGraph = null;
        this.simulation = null;
        this.svg = null;
        this.g = null;
        this.zoom = null;
    }

    /**
     * Render entity relationship graph
     */
    renderEntityGraph(entityData) {
        console.log('🎨 Rendering entity graph', entityData);
        
        // Clear previous graph
        this.clearGraph();
        
        if (!entityData || !entityData.entities) {
            this.showEmptyGraph();
            return;
        }

        // Prepare data
        const graphData = this.prepareGraphData(entityData);
        
        if (graphData.nodes.length === 0) {
            this.showEmptyGraph();
            return;
        }

        // Setup SVG
        this.setupSVG();
        
        // Create force simulation
        this.createSimulation(graphData);
        
        // Draw graph
        this.drawGraph(graphData);
        
        this.currentGraph = graphData;
        
        console.log('✅ Entity graph rendered successfully');
    }

    /**
     * Prepare data for D3.js
     */
    prepareGraphData(entityData) {
        const nodes = [];
        const links = [];
        
        // Convert entities to nodes
        if (entityData.entities) {
            Object.entries(entityData.entities).forEach(([id, entity]) => {
                const hasValidId = entity.schema['@id'] && entity.schema['@id'].startsWith('schema:');
                const isOrphaned = entityData.orphanedEntities?.includes(id);
                
                nodes.push({
                    id: id,
                    type: entity.type,
                    label: entity.schema.name || entity.schema.headline || id,
                    hasValidId: hasValidId,
                    isOrphaned: isOrphaned,
                    connections: entity.connections?.length || 0,
                    schema: entity.schema
                });
            });
        }
        
        // Convert relationships to links
        if (entityData.relationships) {
            entityData.relationships.forEach(rel => {
                const sourceExists = nodes.find(n => n.id === rel.source);
                const targetExists = nodes.find(n => n.id === rel.target);
                
                if (sourceExists && targetExists) {
                    links.push({
                        source: rel.source,
                        target: rel.target,
                        relationship: rel.property,
                        type: 'valid'
                    });
                }
            });
        }
        
        // Add broken references as links
        if (entityData.brokenReferences) {
            entityData.brokenReferences.forEach(ref => {
                const sourceExists = nodes.find(n => n.id === ref.source);
                
                if (sourceExists) {
                    // Create phantom node for broken reference
                    const phantomId = `phantom_${ref.target}`;
                    if (!nodes.find(n => n.id === phantomId)) {
                        nodes.push({
                            id: phantomId,
                            type: 'broken',
                            label: ref.target,
                            hasValidId: false,
                            isOrphaned: true,
                            connections: 0,
                            phantom: true
                        });
                    }
                    
                    links.push({
                        source: ref.source,
                        target: phantomId,
                        relationship: ref.property,
                        type: 'broken'
                    });
                }
            });
        }
