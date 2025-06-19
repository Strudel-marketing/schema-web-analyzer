let currentSchemas = [];
let siteMapperResults = null;
let isSiteMapperResults = false;
let idConsistencyAnalysis = {}; // Track @id usage patterns

// Load schemas when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Results page loaded - Schema ID Consistency Focus');
    await loadSchemas();
});

async function loadSchemas() {
    try {
        const result = await chrome.storage.local.get(['pendingSchemas']);
        
        if (result.pendingSchemas && result.pendingSchemas.schemas) {
            const data = result.pendingSchemas;
            
            // Check if this is from site mapper
            if (data.isSiteMapperResults && data.siteMapperResults) {
                isSiteMapperResults = true;
                siteMapperResults = data.siteMapperResults;
                displayConsistentIdSiteMapperResults(data.schemas, data.originalUrl, data.siteMapperResults);
            } else {
                // Regular schema results - limited analysis for single page
                displaySinglePageIdAnalysis(data.schemas, data.originalUrl);
            }
            
            await chrome.storage.local.remove(['pendingSchemas']);
        } else {
            showNoSchemas();
        }
    } catch (error) {
        console.error('Error loading schemas:', error);
        showError('Failed to load schema data: ' + error.message);
    }
}

function extractPageTitle(url) {
    if (!url || url === 'Current Page') return 'Current Page';
    
    try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        
        if (pathSegments.length === 0) return 'Home Page';
        
        const lastSegment = pathSegments[pathSegments.length - 1];
        return lastSegment
            .replace(/\.(html|php|asp|aspx)$/i, '')
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || 'Page';
    } catch (e) {
        return 'Unknown Page';
    }
}

async function fetchPageTitleFromUrl(url) {
    if (!url || url === 'Current Page') return 'Current Page';
    
    try {
        // Try to get page title via background script
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ 
                action: 'fetchPageTitle', 
                url: url 
            }, (response) => {
                if (chrome.runtime.lastError || !response?.title) {
                    // Fallback to URL-based title
                    resolve(extractPageTitle(url));
                } else {
                    resolve(response.title);
                }
            });
        });
    } catch (error) {
        console.warn('Could not fetch page title for', url, error);
        return extractPageTitle(url);
    }
}

// Extract title from WebPage schema
function extractTitleFromSchema(schema) {
    if (schema['@type'] === 'WebPage' && schema.name) {
        return schema.name;
    }
    if (schema['@type'] === 'WebPage' && schema.headline) {
        return schema.headline;
    }
    return null;
}

// Enhanced analyzeIdConsistency that fetches real page titles
async function analyzeIdConsistencyWithTitles(schemas) {
    console.log('🔍 Analyzing @id consistency with real page titles...');
    
    const analysis = {
        idGroups: new Map(),
        typeGroups: new Map(),
        consistentIds: new Map(),
        inconsistentTypes: new Map(),
        bestPracticeScore: 0,
        recommendations: []
    };
    
    // Process schemas with enhanced title fetching
    for (let index = 0; index < schemas.length; index++) {
        const schema = schemas[index];
        const cleanSchema = {...schema};
        delete cleanSchema._siteMapperInfo;
        
        const schemaId = cleanSchema['@id'];
        const schemaType = Array.isArray(cleanSchema['@type']) ? cleanSchema['@type'][0] : cleanSchema['@type'];
        const pageUrl = schema._siteMapperInfo?.foundOnUrl || 'Current Page';
        
        // Enhanced title extraction - try multiple sources
        let pageTitle = schema._siteMapperInfo?.pageTitle;
        
        if (!pageTitle && pageUrl !== 'Current Page') {
            // Try to extract from WebPage schema first
            pageTitle = extractTitleFromSchema(cleanSchema);
            
            // If still no title, fetch from URL
            if (!pageTitle) {
                pageTitle = await fetchPageTitleFromUrl(pageUrl);
            }
        }
        
        if (!pageTitle) {
            pageTitle = extractPageTitle(pageUrl);
        }
        
        if (schemaId) {
            // Group by @id
            if (!analysis.idGroups.has(schemaId)) {
                analysis.idGroups.set(schemaId, []);
            }
            analysis.idGroups.get(schemaId).push({
                schema: cleanSchema,
                pageUrl: pageUrl,
                pageTitle: pageTitle,
                index: index,
                type: schemaType
            });
            
            // Count @id usage
            analysis.consistentIds.set(schemaId, (analysis.consistentIds.get(schemaId) || 0) + 1);
        }
        
        if (schemaType) {
            // Group by @type to find inconsistencies
            if (!analysis.typeGroups.has(schemaType)) {
                analysis.typeGroups.set(schemaType, new Set());
            }
            if (schemaId) {
                analysis.typeGroups.get(schemaType).add(schemaId);
            }
        }
    }
    
    // Find inconsistent @type usage
    analysis.typeGroups.forEach((idSet, schemaType) => {
        if (idSet.size > 1) {
            analysis.inconsistentTypes.set(schemaType, Array.from(idSet));
        }
    });
    
    // Generate recommendations
    analysis.recommendations = generateIdConsistencyRecommendations(analysis, schemas);
    
    // Calculate best practice score
    const scoreResult = calculateIdConsistencyScore(analysis, schemas);
    analysis.bestPracticeScore = scoreResult.score;
    analysis.scoreBreakdown = scoreResult.breakdown;
    analysis.scoreSummary = scoreResult.summary;

    console.log(`📊 ID Consistency Analysis: ${analysis.idGroups.size} unique @ids, ${analysis.inconsistentTypes.size} inconsistent types`);
    return analysis;
}

function generateIdConsistencyRecommendations(analysis, schemas) {
    const recommendations = [];
    
    // Extract base URL for examples
    const baseUrl = extractBaseUrl(schemas);
    
    // Check for schemas without @id
    const schemasWithoutId = schemas.filter(schema => {
        const cleanSchema = {...schema};
        delete cleanSchema._siteMapperInfo;
        return !cleanSchema['@id'];
    });
    
    if (schemasWithoutId.length > 0) {
        recommendations.push({
            type: 'Missing @id',
            level: 'high',
            message: `${schemasWithoutId.length} schemas are missing @id properties. Add consistent @id values using the pattern "schema:EntityType".`,
            example: '"@id": "schema:WebPageElement"',
            affectedSchemas: schemasWithoutId.length
        });
    }
    
    // Check for inconsistent @type usage with dynamic examples
    analysis.inconsistentTypes.forEach((ids, schemaType) => {
        const badExample = ids.find(id => !id.startsWith('schema:')) || ids[0];
        recommendations.push({
            type: 'Inconsistent @id Usage',
            level: 'high',
            message: `The schema type "${schemaType}" uses ${ids.length} different @id values. Use a single consistent @id across all pages.`,
            example: `"@id": "schema:${schemaType}"`,
            details: `Found @ids: ${ids.join(', ')}`,
            badExample: `"@id": "${badExample}"`,
            affectedSchemas: ids.length
        });
    });
    
    // Check for non-standard @id patterns with dynamic examples
    analysis.idGroups.forEach((instances, schemaId) => {
        if (!schemaId.startsWith('schema:')) {
            recommendations.push({
                type: 'Non-standard @id Pattern',
                level: 'medium',
                message: `The @id "${schemaId}" doesn't follow the recommended "schema:EntityType" pattern.`,
                example: `"@id": "schema:${instances[0].type}"`,
                badExample: `"@id": "${schemaId}"`,
                affectedSchemas: instances.length
            });
        }
    });
    
    // Positive reinforcement for good practices
    const goodPractices = [];
    analysis.idGroups.forEach((instances, schemaId) => {
        if (schemaId.startsWith('schema:') && instances.length > 1) {
            goodPractices.push({
                type: 'Excellent Consistency',
                level: 'success',
                message: `Great! The @id "${schemaId}" is used consistently across ${instances.length} pages.`,
                affectedSchemas: instances.length
            });
        }
    });
    
    return [...recommendations, ...goodPractices];
}

function extractBaseUrl(schemas) {
    for (const schema of schemas) {
        if (schema._siteMapperInfo?.foundOnUrl) {
            try {
                const url = new URL(schema._siteMapperInfo.foundOnUrl);
                return url.origin;
            } catch (e) {
                continue;
            }
        }
    }
    return 'https://example.com';
}

function calculateIdConsistencyScore(analysis, schemas) {
    const totalSchemas = schemas.length;
    if (totalSchemas === 0) return { score: 0, breakdown: [], summary: {} };
    
    let score = 0;
    let breakdown = [];
    
    // Category 1: Having @id (up to 40 points)
    const schemasWithId = Array.from(analysis.idGroups.values()).reduce((count, instances) => count + instances.length, 0);
    const idCoverage = (schemasWithId / totalSchemas) * 40;
    score += idCoverage;
    
    breakdown.push({
        category: '@id Coverage',
        description: `${schemasWithId} of ${totalSchemas} schemas have @id properties`,
        points: Math.round(idCoverage),
        maxPoints: 40,
        percentage: Math.round((schemasWithId / totalSchemas) * 100),
        status: schemasWithId === totalSchemas ? 'excellent' : schemasWithId >= totalSchemas * 0.8 ? 'good' : 'poor',
        issues: totalSchemas - schemasWithId > 0 ? [`${totalSchemas - schemasWithId} schemas missing @id`] : []
    });
    
    // Category 2: Using schema: pattern (up to 30 points)
    const totalUniqueIds = analysis.idGroups.size;
    const schemaPatternIds = Array.from(analysis.idGroups.keys()).filter(id => id.startsWith('schema:')).length;
    const patternScore = totalUniqueIds > 0 ? (schemaPatternIds / totalUniqueIds) * 30 : 0;
    score += patternScore;
    
    const nonStandardIds = Array.from(analysis.idGroups.keys()).filter(id => !id.startsWith('schema:'));
    breakdown.push({
        category: 'Standard Pattern Usage',
        description: `${schemaPatternIds} of ${totalUniqueIds} unique @ids use "schema:" pattern`,
        points: Math.round(patternScore),
        maxPoints: 30,
        percentage: totalUniqueIds > 0 ? Math.round((schemaPatternIds / totalUniqueIds) * 100) : 0,
        status: schemaPatternIds === totalUniqueIds ? 'excellent' : schemaPatternIds >= totalUniqueIds * 0.8 ? 'good' : 'poor',
        issues: nonStandardIds.length > 0 ? nonStandardIds.map(id => `"${id}" doesn't follow schema: pattern`) : []
    });
    
    // Category 3: Consistency penalty (subtract 5 points per inconsistent type)
    const inconsistentPenalty = analysis.inconsistentTypes.size * 5;
    score = Math.max(0, score - inconsistentPenalty);
    
    if (analysis.inconsistentTypes.size > 0) {
        const inconsistentDetails = Array.from(analysis.inconsistentTypes.entries()).map(([type, ids]) => 
            `${type}: uses ${ids.length} different @ids (${ids.join(', ')})`
        );
        
        breakdown.push({
            category: 'Type Consistency',
            description: `${analysis.inconsistentTypes.size} schema types use inconsistent @ids`,
            points: -inconsistentPenalty,
            maxPoints: 0,
            percentage: 0,
            status: 'poor',
            issues: inconsistentDetails
        });
    } else {
        breakdown.push({
            category: 'Type Consistency',
            description: 'All schema types use consistent @ids',
            points: 0,
            maxPoints: 0,
            percentage: 100,
            status: 'excellent',
            issues: []
        });
    }
    
    // Category 4: Cross-page consistency bonus (up to 30 points)
    const reusedIds = Array.from(analysis.consistentIds.values()).filter(count => count > 1).length;
    const crossPageBonus = Math.min(30, reusedIds * 5);
    score += crossPageBonus;
    
    breakdown.push({
        category: 'Cross-Page Reuse',
        description: `${reusedIds} @ids are reused across multiple pages`,
        points: crossPageBonus,
        maxPoints: 30,
        percentage: reusedIds > 0 ? Math.round((crossPageBonus / 30) * 100) : 0,
        status: crossPageBonus >= 20 ? 'excellent' : crossPageBonus >= 10 ? 'good' : 'poor',
        issues: reusedIds === 0 ? ['No @ids are reused across pages'] : []
    });
    
    const finalScore = Math.round(Math.min(100, score));
    
    return {
        score: finalScore,
        breakdown: breakdown,
        summary: {
            totalIssues: breakdown.reduce((sum, cat) => sum + cat.issues.length, 0),
            excellentCategories: breakdown.filter(cat => cat.status === 'excellent').length,
            poorCategories: breakdown.filter(cat => cat.status === 'poor').length
        }
    };
}

async function displayConsistentIdSiteMapperResults(schemas, baseUrl, mapperResults) {
    console.log('🗺️ Displaying ID consistency site mapper results');
    
    currentSchemas = schemas;
    isSiteMapperResults = true;
    
    // Analyze ID consistency
    idConsistencyAnalysis = await analyzeIdConsistencyWithTitles(schemas);
    
    // Hide loading
    document.getElementById('loadingMessage').style.display = 'none';
    
    // Update page header
    updateIdConsistencyHeader(baseUrl, mapperResults);
    
    // Update stats
    updateIdConsistencyStats(mapperResults);
    
    // Display ID consistency focused view
    displayIdConsistencyView();
    
    // Show ID consistency actions
    showIdConsistencyActions();
}

function displaySinglePageIdAnalysis(schemas, pageUrl) {
    console.log('📊 Displaying single page ID analysis');
    
    currentSchemas = schemas;
    
    // Limited analysis for single page
    idConsistencyAnalysis = {
        idGroups: new Map(),
        typeGroups: new Map(),
        consistentIds: new Map(),
        inconsistentTypes: new Map(),
        bestPracticeScore: 0,
        recommendations: []
    };
    
    // Hide loading
    document.getElementById('loadingMessage').style.display = 'none';
    
    // Update page info
    if (pageUrl) {
        document.getElementById('pageUrl').textContent = pageUrl;
    }
    
    // Update header
    const header = document.querySelector('.header h1');
    if (header) {
        header.textContent = '🔗 Schema @id Analysis (Single Page)';
    }
    
    // Show single page analysis
    displaySinglePageView(schemas);
    
    // Show actions
    showIdConsistencyActions();
}

function updateIdConsistencyHeader(baseUrl, mapperResults) {
    const pageUrl = document.getElementById('pageUrl');
    if (pageUrl) {
        pageUrl.innerHTML = `
            <strong>Site:</strong> ${baseUrl}<br>
            <small>Schema @id Consistency Analysis - Score: ${idConsistencyAnalysis.bestPracticeScore}/100</small>
        `;
    }
    
    const header = document.querySelector('.header h1');
    if (header) {
        header.textContent = '🔗 Schema @id Consistency Analysis';
    }
}

function updateIdConsistencyStats(mapperResults) {
    document.getElementById('schemaCount').textContent = mapperResults.totalSchemas;
    document.getElementById('typeCount').textContent = mapperResults.summary?.topSchemaTypes?.length || 0;
    
    // Enhanced stats for ID consistency
    const statsContainer = document.querySelector('.stats');
    if (statsContainer) {
        const additionalStats = `
            <div class="stat-box" style="background: #28a745;">
                <span class="stat-number">${idConsistencyAnalysis.idGroups.size}</span>
                <span>Unique @ids</span>
            </div>
            <div class="stat-box" style="background: ${idConsistencyAnalysis.bestPracticeScore >= 80 ? '#28a745' : idConsistencyAnalysis.bestPracticeScore >= 60 ? '#ffc107' : '#dc3545'}; color: ${idConsistencyAnalysis.bestPracticeScore >= 60 ? 'white' : 'black'};">
                <span class="stat-number">${idConsistencyAnalysis.bestPracticeScore}</span>
                <span>Consistency Score</span>
            </div>
            <div class="stat-box" style="background: #17a2b8;">
                <span class="stat-number">${Array.from(idConsistencyAnalysis.consistentIds.values()).filter(count => count > 1).length}</span>
                <span>Reused @ids</span>
            </div>
        `;
        statsContainer.innerHTML += additionalStats;
    }
}

function displayIdConsistencyView() {
    const container = document.getElementById('schemasContainer');
    container.innerHTML = '';
    
    // Add overview section
    const overviewSection = createIdConsistencyOverview();
    container.appendChild(overviewSection);
    
    // Add visual diagram
    const diagramSection = createConnectionDiagram();
    container.appendChild(diagramSection);
    
    // Display schemas grouped by @id
    const idGroupsSection = createIdGroupsSection();
    container.appendChild(idGroupsSection);
    
    // Display recommendations
    const recommendationsSection = createRecommendationsSection();
    container.appendChild(recommendationsSection);
}

function createConnectionDiagram() {
    const section = document.createElement('div');
    section.className = 'diagram-section';
    
    section.innerHTML = `
        <h2 style="margin: 0 0 20px 0;">🎯 @id Connection Diagram</h2>
        <div id="diagramContainer" style="min-height: 400px; border: 2px solid #e9ecef; border-radius: 8px; position: relative; overflow: hidden;">
            <svg id="connectionDiagram" width="100%" height="400">
                <!-- Diagram will be generated here -->
            </svg>
        </div>
        <div style="margin-top: 15px; font-size: 14px; color: #6c757d;">
            <p><strong>How to read this diagram:</strong></p>
            <ul style="margin: 5px 0; padding-left: 20px;">
                <li>Each <strong>circle</strong> represents a page on your website</li>
                <li><strong>Connected circles</strong> show pages using the same @id</li>
                <li><strong>Isolated circles</strong> show pages with unique @ids (potential consistency issues)</li>
                <li><strong>Color coding:</strong> Green = good consistency, Yellow = some issues, Red = needs improvement</li>
            </ul>
        </div>
    `;
    
    // Generate the diagram after adding to DOM
    setTimeout(() => generateConnectionDiagram(), 100);
    
    return section;
}

function generateConnectionDiagram() {
    const svg = document.getElementById('connectionDiagram');
    if (!svg || !idConsistencyAnalysis.idGroups) return;
    
    const width = svg.clientWidth || 800;
    const height = 400;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    
    // Clear existing content
    svg.innerHTML = '';
    
    // Create nodes for each page
    const pageNodes = new Map();
    const connections = [];
    
    // Extract unique pages and their @ids
    idConsistencyAnalysis.idGroups.forEach((instances, schemaId) => {
        instances.forEach(instance => {
            const pageKey = instance.pageUrl;
            if (!pageNodes.has(pageKey)) {
                pageNodes.set(pageKey, {
                    url: instance.pageUrl,
                    title: instance.pageTitle || extractPageTitle(instance.pageUrl),
                    ids: new Set(),
                    consistency: 0
                });
            }
            pageNodes.get(pageKey).ids.add(schemaId);
        });
        
        // Create connections between pages that share the same @id
        for (let i = 0; i < instances.length; i++) {
            for (let j = i + 1; j < instances.length; j++) {
                connections.push({
                    source: instances[i].pageUrl,
                    target: instances[j].pageUrl,
                    schemaId: schemaId,
                    consistent: schemaId.startsWith('schema:')
                });
            }
        }
    });
    
    // Calculate positions
    const nodes = Array.from(pageNodes.values());
    const radius = Math.min(width, height) * 0.35;
    const centerX = width / 2;
    const centerY = height / 2;
    
    nodes.forEach((node, index) => {
        const angle = (index / nodes.length) * 2 * Math.PI;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
        
        // Calculate consistency score for this page
        const goodIds = Array.from(node.ids).filter(id => id.startsWith('schema:')).length;
        node.consistency = node.ids.size > 0 ? (goodIds / node.ids.size) : 0;
    });
    
    // Draw connections
    connections.forEach(conn => {
        const sourceNode = nodes.find(n => n.url === conn.source);
        const targetNode = nodes.find(n => n.url === conn.target);
        
        if (sourceNode && targetNode) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', sourceNode.x);
            line.setAttribute('y1', sourceNode.y);
            line.setAttribute('x2', targetNode.x);
            line.setAttribute('y2', targetNode.y);
            line.setAttribute('stroke', conn.consistent ? '#28a745' : '#ffc107');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('opacity', '0.7');
            
            // Add title for tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `Shared @id: ${conn.schemaId}`;
            line.appendChild(title);
            
            svg.appendChild(line);
        }
    });
    
    // Draw nodes
    nodes.forEach((node, index) => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Node circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', '20');
        circle.setAttribute('fill', node.consistency >= 0.8 ? '#28a745' : 
                                   node.consistency >= 0.5 ? '#ffc107' : '#dc3545');
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '3');
        circle.style.cursor = 'pointer';
        
        // Add click handler using data attribute instead of inline onclick
        circle.setAttribute('data-node-info', JSON.stringify({
            title: node.title,
            url: node.url,
            ids: Array.from(node.ids),
            consistency: Math.round(node.consistency * 100)
        }));
        
        circle.addEventListener('click', handleNodeClick);
        
        // Node label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y + 35);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('fill', '#495057');
        text.textContent = node.title.length > 15 ? 
            node.title.substring(0, 12) + '...' : node.title;
        
        // Tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${node.title}\n@ids: ${Array.from(node.ids).join(', ')}\nConsistency: ${Math.round(node.consistency * 100)}%`;
        circle.appendChild(title);
        
        group.appendChild(circle);
        group.appendChild(text);
        svg.appendChild(group);
    });
    
    // Add legend
    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legend.setAttribute('transform', 'translate(20, 20)');
    
    const legendItems = [
        { color: '#28a745', text: 'Good consistency (80%+)' },
        { color: '#ffc107', text: 'Some issues (50-80%)' },
        { color: '#dc3545', text: 'Needs improvement (<50%)' }
    ];
    
    legendItems.forEach((item, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '10');
        circle.setAttribute('cy', index * 20 + 10);
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', item.color);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '25');
        text.setAttribute('y', index * 20 + 15);
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.textContent = item.text;
        
        legend.appendChild(circle);
        legend.appendChild(text);
    });
    
    svg.appendChild(legend);
}

// FIXED: Separate function for node click handling
function handleNodeClick(event) {
    const nodeData = JSON.parse(event.target.getAttribute('data-node-info'));
    alert(`Page: ${nodeData.title}\nURL: ${nodeData.url}\n@ids: ${nodeData.ids.join(', ')}\nConsistency: ${nodeData.consistency}%`);
}

function createIdConsistencyOverview() {
    const section = document.createElement('div');
    section.className = 'id-consistency-overview';
    section.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 25px;
        border-radius: 12px;
        margin-bottom: 30px;
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    `;
    
    const scoreColor = idConsistencyAnalysis.bestPracticeScore >= 80 ? '#4CAF50' : 
                      idConsistencyAnalysis.bestPracticeScore >= 60 ? '#FF9800' : '#F44336';
    
    // Get base URL for dynamic poor example
    const baseUrl = extractBaseUrl(currentSchemas);
    
    section.innerHTML = `
        <h2 style="margin: 0 0 20px 0;">🔗 Schema @id Consistency Analysis</h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">${idConsistencyAnalysis.idGroups.size}</div>
                <div style="font-size: 14px;">Unique @id Values</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.3s ease;" class="clickable-score" id="clickableScore">
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px; color: ${scoreColor};">${idConsistencyAnalysis.bestPracticeScore}/100</div>
                <div style="font-size: 14px;">Consistency Score</div>
                <div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">Click for breakdown</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">${Array.from(idConsistencyAnalysis.consistentIds.values()).filter(count => count > 1).length}</div>
                <div style="font-size: 14px;">Cross-Page @ids</div>
            </div>
        </div>
        
        ${idConsistencyAnalysis.scoreSummary ? `
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Score Summary:</strong>
                        ${idConsistencyAnalysis.scoreSummary.excellentCategories} excellent • 
                        ${idConsistencyAnalysis.scoreSummary.poorCategories} need improvement • 
                        ${idConsistencyAnalysis.scoreSummary.totalIssues} total issues
                    </div>
                    <button class="score-breakdown-btn" id="scoreBreakdownBtn" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid white; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                        View Details
                    </button>
                </div>
        ` : ''}
        
        <div style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0;">💡 Best Practice: Consistent @id Values</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #4CAF50;">✅ Good Example:</h4>
                    <code style="background: rgba(0,0,0,0.3); padding: 10px; display: block; border-radius: 4px; font-size: 13px;">
                        // Page 1<br>
                        "@id": "schema:WebPageElement"<br><br>
                        // Page 2<br>
                        "@id": "schema:WebPageElement"<br><br>
                        // Page 3<br>
                        "@id": "schema:WebPageElement"
                    </code>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #F44336;">❌ Poor Example (from your site):</h4>
                    <code style="background: rgba(0,0,0,0.3); padding: 10px; display: block; border-radius: 4px; font-size: 13px;">
                        // Page 1<br>
                        "@id": "${baseUrl}#webpage1"<br><br>
                        // Page 2<br>
                        "@id": "${baseUrl}#WebPage"<br><br>
                        // Page 3<br>
                        "@id": "${baseUrl}#main-content"
                    </code>
                </div>
            </div>
        </div>
    `;
    
    // Add click event listeners after inserting HTML
    setTimeout(() => {
        const clickableScore = section.querySelector('.clickable-score');
        const scoreBtn = section.querySelector('.score-breakdown-btn');
        
        if (clickableScore) {
            clickableScore.addEventListener('click', showScoreBreakdown);
            clickableScore.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(255,255,255,0.15)';
                this.style.transform = 'scale(1.05)';
            });
            clickableScore.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(255,255,255,0.1)';
                this.style.transform = 'scale(1)';
            });
        }
        
        if (scoreBtn) {
            scoreBtn.addEventListener('click', showScoreBreakdown);
        }
    }, 100);
    
    return section;
}
function showScoreBreakdown() {
    if (!idConsistencyAnalysis.scoreBreakdown) {
        alert('Score breakdown not available');
        return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 900px;
        max-height: 80vh;
        overflow-y: auto;
        width: 90%;
    `;
    
    let breakdownHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
            <h2 style="margin: 0;">📊 Consistency Score Breakdown</h2>
            <button class="close-modal-btn" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">×</button>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 25px;">
            <h1 style="margin: 0; font-size: 3rem;">${idConsistencyAnalysis.bestPracticeScore}/100</h1>
            <div style="font-size: 1.2rem; margin-top: 10px;">Overall Consistency Score</div>
        </div>
    `;
    
    // Enhanced Key Findings section that shows BOTH good and bad
    breakdownHTML += `
        <h3>🎯 Key Findings:</h3>
        <div style="margin-bottom: 25px;">
    `;
    
    // Show GOOD @ids first
    const goodIds = Array.from(idConsistencyAnalysis.idGroups.entries()).filter(([schemaId, instances]) => {
        return schemaId.startsWith('schema:') && instances.length > 1;
    });
    
    goodIds.forEach(([schemaId, instances]) => {
        breakdownHTML += `
            <div style="border-left: 4px solid #28a745; background: #f8fff8; padding: 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
                <div style="font-weight: bold; color: #28a745;">
                    ✅ "${schemaId}"
                </div>
                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                    Used ${instances.length} times for ${instances[0].type} schemas • Good pattern • Excellent consistency
                </div>
            </div>
        `;
    });
    
    // Show BAD @ids - THE PROBLEMS!
    const badIds = Array.from(idConsistencyAnalysis.idGroups.entries()).filter(([schemaId, instances]) => {
        return !schemaId.startsWith('schema:') || instances.length === 1;
    });
    
    badIds.forEach(([schemaId, instances]) => {
        const isNonStandard = !schemaId.startsWith('schema:');
        const isNotReused = instances.length === 1;
        
        let issues = [];
        if (isNonStandard) issues.push('Non-standard pattern');
        if (isNotReused) issues.push('Not reused across pages');
        
        breakdownHTML += `
            <div style="border-left: 4px solid ${isNonStandard ? '#dc3545' : '#ffc107'}; background: ${isNonStandard ? '#fff5f5' : '#fffbf0'}; padding: 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
                <div style="font-weight: bold; color: ${isNonStandard ? '#dc3545' : '#856404'};">
                    ${isNonStandard ? '❌' : '⚠️'} "${schemaId}"
                </div>
                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                    Used ${instances.length} time${instances.length === 1 ? '' : 's'} for ${instances[0].type} schemas • ${issues.join(' • ')}
                </div>
                <div style="font-size: 12px; color: #dc3545; margin-top: 8px; font-weight: bold;">
                    💡 Recommended: "schema:${instances[0].type}"
                </div>
            </div>
        `;
    });
    
    // Show TYPE INCONSISTENCIES - Major problems!
    if (idConsistencyAnalysis.inconsistentTypes.size > 0) {
        breakdownHTML += `<h4 style="color: #dc3545; margin-top: 20px;">🚨 Major Issues - Same Type, Different @ids:</h4>`;
        
        Array.from(idConsistencyAnalysis.inconsistentTypes.entries()).forEach(([schemaType, ids]) => {
            breakdownHTML += `
                <div style="border-left: 4px solid #dc3545; background: #fff5f5; padding: 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
                    <div style="font-weight: bold; color: #dc3545;">
                        ❌ ${schemaType} schemas use ${ids.length} different @ids
                    </div>
                    <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                        Found @ids: ${ids.join(', ')}
                    </div>
                    <div style="font-size: 12px; color: #dc3545; margin-top: 8px; font-weight: bold;">
                        💡 Use only one: "schema:${schemaType}" on all pages
                    </div>
                    <div style="font-size: 12px; color: #dc3545; margin-top: 4px;">
                        This inconsistency costs you -${ids.length * 5} points
                    </div>
                </div>
            `;
        });
    }
    
    // Show schemas missing @id
    const schemasWithoutId = currentSchemas.filter(schema => {
        const cleanSchema = {...schema};
        delete cleanSchema._siteMapperInfo;
        return !cleanSchema['@id'];
    });
    
    if (schemasWithoutId.length > 0) {
        breakdownHTML += `
            <div style="border-left: 4px solid #dc3545; background: #fff5f5; padding: 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
                <div style="font-weight: bold; color: #dc3545;">
                    ❌ ${schemasWithoutId.length} schemas missing @id entirely
                </div>
                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                    Schemas without @id properties reduce your coverage score
                </div>
                <div style="font-size: 12px; color: #dc3545; margin-top: 8px; font-weight: bold;">
                    💡 Add @id properties to all schemas for maximum consistency
                </div>
            </div>
        `;
    }
    
    breakdownHTML += `</div>`;
    
    // Score calculation breakdown
    idConsistencyAnalysis.scoreBreakdown.forEach(category => {
        const statusColor = category.status === 'excellent' ? '#28a745' : 
                           category.status === 'good' ? '#ffc107' : '#dc3545';
        const statusIcon = category.status === 'excellent' ? '✅' : 
                          category.status === 'good' ? '⚠️' : '❌';
        
        breakdownHTML += `
            <div style="border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 15px; background: ${category.status === 'excellent' ? '#f8fff8' : category.status === 'good' ? '#fffbf0' : '#fff5f5'};">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0; color: ${statusColor};">
                            ${statusIcon} ${category.category}
                        </h3>
                        <p style="margin: 5px 0; color: #6c757d;">${category.description}</p>
                    </div>
                    <div style="text-align: right; margin-left: 20px;">
                        <div style="font-size: 24px; font-weight: bold; color: ${statusColor};">
                            ${category.points >= 0 ? '+' : ''}${category.points}
                        </div>
                        <div style="font-size: 12px; color: #6c757d;">
                            ${category.maxPoints > 0 ? `out of ${category.maxPoints}` : 'penalty'}
                        </div>
                    </div>
                </div>
                
                ${category.percentage !== undefined && category.maxPoints > 0 ? `
                    <div style="background: #e9ecef; border-radius: 10px; height: 8px; margin-bottom: 15px;">
                        <div style="background: ${statusColor}; height: 8px; border-radius: 10px; width: ${category.percentage}%;"></div>
                    </div>
                ` : ''}
                
                ${category.issues.length > 0 ? `
                    <div style="background: #f8f9fa; border-radius: 6px; padding: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #495057;">Issues Found:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #6c757d;">
                            ${category.issues.map(issue => `<li style="margin-bottom: 5px;">${issue}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    });
    const singlePageIds = Array.from(idConsistencyAnalysis.idGroups.entries()).filter(([schemaId, instances]) => {
    return instances.length === 1;
});

const multiPageIds = Array.from(idConsistencyAnalysis.idGroups.entries()).filter(([schemaId, instances]) => {
    return instances.length > 1;
});

// Group single-page @ids by schema type for better analysis
const singlePageByType = new Map();
singlePageIds.forEach(([schemaId, instances]) => {
    const schemaType = instances[0].type;
    if (!singlePageByType.has(schemaType)) {
        singlePageByType.set(schemaType, []);
    }
    singlePageByType.get(schemaType).push({
        id: schemaId,
        pageTitle: instances[0].pageTitle,
        pageUrl: instances[0].pageUrl
    });
});

breakdownHTML += `
    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 20px; margin-top: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #1565c0;">📈 Quick Wins to Improve Your Score</h3>
        <div style="color: #1565c0;">
            ${idConsistencyAnalysis.bestPracticeScore < 100 ? `
                <ul style="margin: 0; padding-left: 20px;">
                    ${badIds.length > 0 ? `<li style="margin-bottom: 8px;"><strong>Fix non-standard @ids:</strong> Change to "schema:EntityType" pattern (+${Math.min(30, badIds.length * 5)} potential points)</li>` : ''}
                    ${idConsistencyAnalysis.inconsistentTypes.size > 0 ? `<li style="margin-bottom: 8px;"><strong>Fix type inconsistencies:</strong> Use same @id for same schema type across all pages (+${idConsistencyAnalysis.inconsistentTypes.size * 5} points)</li>` : ''}
                    ${schemasWithoutId.length > 0 ? `<li style="margin-bottom: 8px;"><strong>Add missing @ids:</strong> ${schemasWithoutId.length} schemas need @id properties (+${Math.min(40, (schemasWithoutId.length / currentSchemas.length) * 40)} potential points)</li>` : ''}
                </ul>
            ` : `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
                    <h4 style="margin: 0 0 10px 0; color: #1565c0;">Perfect Score!</h4>
                    <p style="margin: 0; font-weight: bold;">Your @id consistency is excellent. No improvements needed!</p>
                </div>
            `}
            
            ${singlePageIds.length > 0 ? `
                <div style="margin-top: 20px; background: rgba(255,255,255,0.3); border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 15px 0; color: #1565c0;">🎯 Cross-Page Reuse Opportunities</h4>
                    <p style="margin: 0 0 15px 0; font-size: 14px;">
                        <strong>Current:</strong> ${multiPageIds.length} @ids reused across pages (+${multiPageIds.length * 5} points)<br>
                        <strong>Potential:</strong> Up to ${Math.min(6, multiPageIds.length + singlePageIds.length)} reused @ids (+${Math.min(30, (multiPageIds.length + singlePageIds.length) * 5)} points)
                    </p>
                    
                    <div style="background: rgba(255,255,255,0.4); border-radius: 6px; padding: 12px; margin-bottom: 15px;">
                        <strong>📋 @ids Currently Used on Single Pages Only:</strong>
                        <div style="margin-top: 10px; font-size: 13px; font-family: monospace;">
                            ${Array.from(singlePageByType.entries()).map(([schemaType, items]) => `
                                <div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.3); border-radius: 4px;">
                                    <div style="font-weight: bold; color: #0d47a1; margin-bottom: 6px;">${schemaType} schemas:</div>
                                    ${items.map(item => `
                                        <div style="margin-left: 15px; margin-bottom: 4px;">
                                            <span style="color: #1565c0; font-weight: bold;">"${item.id}"</span> 
                                            <span style="color: #666;">on ${item.pageTitle}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div style="background: rgba(76, 175, 80, 0.1); border-left: 4px solid #4caf50; padding: 12px; border-radius: 0 6px 6px 0;">
                        <h5 style="margin: 0 0 8px 0; color: #2e7d32;">💡 Recommended Actions:</h5>
                        <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #2e7d32;">
                            <li style="margin-bottom: 6px;"><strong>Standardize navigation schemas:</strong> Use the same @id for WebPageElement schemas across all pages with navigation</li>
                            <li style="margin-bottom: 6px;"><strong>Consolidate similar types:</strong> If you have multiple ${Array.from(singlePageByType.keys())[0] || 'WebPage'} schemas, use "schema:${Array.from(singlePageByType.keys())[0] || 'WebPage'}" where appropriate</li>
                            <li style="margin-bottom: 6px;"><strong>BreadcrumbList consistency:</strong> Use same @id for breadcrumbs across all pages (except homepage)</li>
                            <li><strong>Target:</strong> Aim for 6 different @id values reused across pages = +30 points</li>
                        </ol>
                        
                        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.3); border-radius: 4px; font-size: 13px;">
                            <strong>📝 Schema Best Practices:</strong><br>
                            • <strong>WebSite schema:</strong> Only on homepage, not needed on other pages<br>
                            • <strong>Organization schema:</strong> Typically on About/Contact pages only. Use on multiple pages only in special cases (organizations with multiple departments, or websites about multiple different organizations)<br>
                            • <strong>WebPageElement:</strong> Perfect for cross-page reuse (navigation, headers, footers)<br>
                            • <strong>BreadcrumbList:</strong> Great for multi-page consistency
                        </div>
                    </div>
                </div>
            ` : multiPageIds.length < 6 ? `
                <div style="margin-top: 20px; background: rgba(255,255,255,0.3); border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #1565c0;">🎯 Cross-Page Reuse Strategy</h4>
                    <p style="margin: 0 0 15px 0; font-size: 14px;">
                        You have <strong>${multiPageIds.length} @ids</strong> reused across pages (+${multiPageIds.length * 5} points). 
                        To maximize your score, aim for <strong>6 reused @ids</strong> (+30 points).
                    </p>
                    <div style="background: rgba(76, 175, 80, 0.1); border-left: 4px solid #4caf50; padding: 12px; border-radius: 0 6px 6px 0;">
                        <h5 style="margin: 0 0 8px 0; color: #2e7d32;">💡 Smart Reuse Opportunities:</h5>
                        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #2e7d32;">
                            <li>Standardize navigation elements (WebPageElement) with identical @ids</li>
                            <li>Use consistent BreadcrumbList @ids across all pages (except homepage)</li>
                            <li>Consolidate similar content types with unified @ids</li>
                            <li>Focus on schemas that naturally appear on multiple pages</li>
                        </ul>
                        
                        <div style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.3); border-radius: 4px; font-size: 12px;">
                            <strong>⚠️ Avoid schema bloat:</strong> Only add schemas where they provide real value. WebSite schema belongs only on homepage, Organization schema typically only on About/Contact pages.
                        </div>
                    </div>
                </div>
            ` : ''}
            
            ${idConsistencyAnalysis.bestPracticeScore >= 80 && idConsistencyAnalysis.bestPracticeScore < 100 ? `
                <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #1565c0;">💡 Pro Tips for the Final Points:</h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                        <li><strong>Schema standardization:</strong> Use "schema:EntityType" for ALL @ids</li>
                        <li><strong>Meaningful consistency:</strong> Same entity = same @id everywhere it appears</li>
                        <li><strong>Complete coverage:</strong> Every schema should have an @id</li>
                        <li><strong>Quality over quantity:</strong> Focus on appropriate schemas that naturally repeat across pages</li>
                    </ul>
                </div>
            ` : ''}
        </div>
    </div>
`;
    
    modalContent.innerHTML = breakdownHTML;
    modal.appendChild(modalContent);
    
    // Add close functionality
    const closeBtn = modalContent.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// Make the function globally available
window.showScoreBreakdown = showScoreBreakdown;

function createIdGroupsSection() {
    const section = document.createElement('div');
    section.className = 'id-groups-section';
    section.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 25px;
        margin-bottom: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    `;
    
    let content = '<h2 style="margin: 0 0 20px 0;">📋 @id Usage Groups</h2>';
    
    if (idConsistencyAnalysis.idGroups.size === 0) {
        content += '<p style="text-align: center; color: #6c757d; font-style: italic;">No schemas with @id found.</p>';
    } else {
        // Sort by usage count (most used first)
        const sortedGroups = Array.from(idConsistencyAnalysis.idGroups.entries())
            .sort((a, b) => b[1].length - a[1].length);
        
        sortedGroups.forEach(([schemaId, instances]) => {
            const isGoodPattern = schemaId.startsWith('schema:');
            const isConsistent = instances.length > 1;
            
            content += `
                <div style="border: 2px solid ${isGoodPattern && isConsistent ? '#28a745' : isGoodPattern ? '#ffc107' : '#dc3545'}; 
                           border-radius: 8px; padding: 20px; margin-bottom: 15px; 
                           background: ${isGoodPattern && isConsistent ? '#f8fff8' : isGoodPattern ? '#fffbf0' : '#fff5f5'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <h3 style="margin: 0; color: ${isGoodPattern && isConsistent ? '#155724' : isGoodPattern ? '#856404' : '#721c24'};">
                                ${isGoodPattern && isConsistent ? '✅' : isGoodPattern ? '⚠️' : '❌'} @id: "${schemaId}"
                            </h3>
                            <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                                Used on ${instances.length} page${instances.length === 1 ? '' : 's'} • 
                                Type: ${instances[0].type}
                                ${isGoodPattern ? ' • Follows schema: pattern' : ' • Non-standard pattern'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${isGoodPattern && isConsistent ? '#28a745' : isGoodPattern ? '#ffc107' : '#dc3545'}; 
                                        color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                                ${isGoodPattern && isConsistent ? 'EXCELLENT' : isGoodPattern ? 'GOOD' : 'NEEDS IMPROVEMENT'}
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                        ${instances.map((instance, index) => `
                            <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px;">
                                <div style="font-weight: bold; color: #495057; margin-bottom: 8px;">
                                    📄 ${instance.pageTitle || `Page ${index + 1}`}
                                </div>
                                <div style="font-size: 12px; color: #6c757d; font-family: monospace; margin-bottom: 10px; word-break: break-all;">
                                    ${instance.pageUrl}
                                </div>
                                <button class="view-schema-btn" data-schema-index="${instance.index}" 
                                        style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    View Schema
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }
    
    section.innerHTML = content;
    
    // FIXED: Add event listeners to all view schema buttons after creating the HTML
    section.querySelectorAll('.view-schema-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-schema-index'));
            showSchemaDetails(index);
        });
    });
    
    return section;
}

function createRecommendationsSection() {
    const section = document.createElement('div');
    section.className = 'recommendations-section';
    section.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 25px;
        margin-bottom: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    `;
    
    let content = '<h2 style="margin: 0 0 20px 0;">💡 Recommendations & Best Practices</h2>';
    
    if (idConsistencyAnalysis.recommendations.length === 0) {
        content += '<p style="text-align: center; color: #28a745; font-weight: bold;">🎉 Perfect! No recommendations needed.</p>';
    } else {
        const recommendations = idConsistencyAnalysis.recommendations;
        const issues = recommendations.filter(r => r.level !== 'success');
        const successes = recommendations.filter(r => r.level === 'success');
        
        // Show issues first
        if (issues.length > 0) {
            content += '<h3 style="color: #dc3545; margin-bottom: 15px;">🔧 Issues to Fix:</h3>';
            issues.forEach(rec => {
                const levelColor = rec.level === 'high' ? '#dc3545' : rec.level === 'medium' ? '#ffc107' : '#17a2b8';
                const levelBg = rec.level === 'high' ? '#f8d7da' : rec.level === 'medium' ? '#fff3cd' : '#d1ecf1';
                
                content += `
                    <div style="border-left: 4px solid ${levelColor}; background: ${levelBg}; padding: 15px; margin-bottom: 15px; border-radius: 0 8px 8px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: ${levelColor};">${rec.type}</h4>
                            <span style="background: ${levelColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; text-transform: uppercase;">
                                ${rec.level}
                            </span>
                        </div>
                        <p style="margin: 10px 0; color: #495057;">${rec.message}</p>
                        ${rec.example ? `
                            <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0;">
                                <strong>✅ Recommended:</strong> <code>${rec.example}</code>
                            </div>
                        ` : ''}
                        ${rec.badExample ? `
                            <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0;">
                                <strong>❌ Bad example from your site:</strong> <code>${rec.badExample}</code>
                            </div>
                        ` : ''}
                        ${rec.details ? `<div style="font-size: 12px; color: #6c757d; margin-top: 8px;">${rec.details}</div>` : ''}
                    </div>
                `;
            });
        }
        
        // Show successes
        if (successes.length > 0) {
            content += '<h3 style="color: #28a745; margin: 25px 0 15px 0;">🎉 What You\'re Doing Right:</h3>';
            successes.forEach(rec => {
                content += `
                    <div style="border-left: 4px solid #28a745; background: #d4edda; padding: 15px; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0; color: #155724;"><strong>${rec.message}</strong></p>
                    </div>
                `;
            });
        }
    }
    
    // Add best practices guide
    content += `
        <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 20px; margin-top: 25px;">
            <h3 style="margin: 0 0 15px 0; color: #1565c0;">📚 @id Best Practices Guide</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #1976d2;">✅ DO:</h4>
                    <ul style="margin: 0; color: #1565c0; font-size: 14px;">
                        <li>Use "schema:EntityType" pattern</li>
                        <li>Keep same @id across all pages for same entity</li>
                        <li>Use descriptive entity names</li>
                        <li>Be consistent across your entire site</li>
                    </ul>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #d32f2f;">❌ DON'T:</h4>
                    <ul style="margin: 0; color: #c62828; font-size: 14px;">
                        <li>Use different @ids for same entity type</li>
                        <li>Use generic values like #1, #main, #content</li>
                        <li>Change @id values between pages</li>
                        <li>Skip @id on reusable entities</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = content;
    return section;
}

function displaySinglePageView(schemas) {
    const container = document.getElementById('schemasContainer');
    container.innerHTML = '';
    
    // Single page limitation notice
    const notice = document.createElement('div');
    notice.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 25px;
        text-align: center;
    `;
    
    notice.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #856404;">ℹ️ Single Page Analysis</h3>
        <p style="margin: 0; color: #856404;">
            @id consistency analysis requires multiple pages. Use the <strong>Site Mapper</strong> to scan your entire site 
            and see how @id values are used across different pages.
        </p>
    `;
    
    container.appendChild(notice);
    
    // Show current page schemas with @id focus
    const schemasSection = document.createElement('div');
    schemasSection.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    `;
    
    let content = '<h2 style="margin: 0 0 20px 0;">📋 Current Page Schemas</h2>';
    
    schemas.forEach((schema, index) => {
        const cleanSchema = {...schema};
        delete cleanSchema._siteMapperInfo;
        
        const schemaId = cleanSchema['@id'];
        const schemaType = cleanSchema['@type'];
        const hasId = !!schemaId;
        const goodPattern = schemaId && schemaId.startsWith('schema:');
        
        content += `
            <div style="border: 2px solid ${hasId ? (goodPattern ? '#28a745' : '#ffc107') : '#dc3545'}; 
                       border-radius: 8px; padding: 20px; margin-bottom: 15px;
                       background: ${hasId ? (goodPattern ? '#f8fff8' : '#fffbf0') : '#fff5f5'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; color: ${hasId ? (goodPattern ? '#155724' : '#856404') : '#721c24'};">
                            ${hasId ? (goodPattern ? '✅' : '⚠️') : '❌'} ${schemaType}
                        </h3>
                        <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                            ${hasId ? `@id: "${schemaId}"` : 'Missing @id property'}
                            ${hasId ? (goodPattern ? ' • Good pattern' : ' • Non-standard pattern') : ''}
                        </div>
                    </div>
                    <button class="view-schema-btn" data-schema-index="${index}" 
                            style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        View Schema
                    </button>
                </div>
            </div>
        `;
    });
    
    schemasSection.innerHTML = content;
    
    // FIXED: Add event listeners after creating HTML
    schemasSection.querySelectorAll('.view-schema-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-schema-index'));
            showSchemaDetails(index);
        });
    });
    
    container.appendChild(schemasSection);
}

// FIXED: showSchemaDetails function without inline JavaScript
function showSchemaDetails(index) {
    console.log('🔍 Showing schema details for index:', index);
    
    if (!currentSchemas || !currentSchemas[index]) {
        console.error('Schema not found at index:', index);
        alert('Error: Schema not found');
        return;
    }
    
    const schema = currentSchemas[index];
    const cleanSchema = {...schema};
    delete cleanSchema._siteMapperInfo;
    
    const schemaType = cleanSchema['@type'] || 'Unknown';
    const schemaId = cleanSchema['@id'] || 'No @id';
    
    const modal = document.createElement('div');
    modal.className = 'schema-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const isGoodId = schemaId !== 'No @id' && schemaId.startsWith('schema:');
    const hasId = schemaId !== 'No @id';
    const baseUrl = extractBaseUrl(currentSchemas);
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        width: 90%;
    `;
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
                <h2 style="margin: 0;">${schemaType}</h2>
                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                    @id: ${schemaId}
                    ${hasId ? (isGoodId ? ' ✅ Good pattern' : ' ⚠️ Non-standard pattern') : ' ❌ Missing @id'}
                </div>
            </div>
            <button class="close-modal-btn" 
                    style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">×</button>
        </div>
        
        ${!hasId ? `
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #721c24;">❌ Missing @id Property</h4>
                <p style="margin: 0 0 10px 0; color: #721c24;">This schema should have an @id for consistency across pages.</p>
                <div style="background: #fff; padding: 10px; border-radius: 4px;">
                    <strong>Recommended:</strong> <code>"@id": "schema:${schemaType}"</code>
                </div>
            </div>
        ` : !isGoodId ? `
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Non-standard @id Pattern</h4>
                <p style="margin: 0 0 10px 0; color: #856404;">Consider using the "schema:EntityType" pattern for better consistency.</p>
                <div style="background: #fff; padding: 10px; border-radius: 4px;">
                    <strong>Current:</strong> <code>"@id": "${schemaId}"</code><br>
                    <strong>Recommended:</strong> <code>"@id": "schema:${schemaType}"</code><br>
                    <strong>Bad example from your site:</strong> <code>"@id": "${baseUrl}#${schemaType}"</code>
                </div>
            </div>
        ` : `
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #155724;">✅ Excellent @id Pattern</h4>
                <p style="margin: 0; color: #155724;">This schema follows the recommended "schema:EntityType" pattern!</p>
            </div>
        `}
        
        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
            <button class="copy-original-btn" 
                    style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                📋 Copy Schema
            </button>
            ${!hasId || !isGoodId ? `
                <button class="copy-improved-btn" 
                        style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    📋 Copy Improved Version
                </button>
            ` : ''}
        </div>
        
        <pre class="schema-content" style="background: #f8f9fa; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.4;">${JSON.stringify(cleanSchema, null, 2)}</pre>
    `;
    
    modal.appendChild(modalContent);
    
    // Add event listeners
    const closeBtn = modalContent.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => modal.remove());
    
    const copyOriginalBtn = modalContent.querySelector('.copy-original-btn');
    copyOriginalBtn.addEventListener('click', () => copySchemaToClipboard(cleanSchema, copyOriginalBtn));
    
    const copyImprovedBtn = modalContent.querySelector('.copy-improved-btn');
    if (copyImprovedBtn) {
        copyImprovedBtn.addEventListener('click', () => copyImprovedSchemaToClipboard(cleanSchema, schemaType, copyImprovedBtn));
    }
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// Copy functions
function copySchemaToClipboard(schema, button) {
    const text = JSON.stringify(schema, null, 2);
    
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback(button, '✅ Copied!', '#28a745');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showCopyFeedback(button, '❌ Failed', '#dc3545');
    });
}

function copyImprovedSchemaToClipboard(schema, schemaType, button) {
    const improvedSchema = {...schema};
    if (schemaType) {
        improvedSchema['@id'] = `schema:${schemaType}`;
    }
    
    const text = JSON.stringify(improvedSchema, null, 2);
    
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback(button, '✅ Improved Copied!', '#007bff');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showCopyFeedback(button, '❌ Failed', '#dc3545');
    });
}

function showCopyFeedback(button, text, color) {
    const originalText = button.textContent;
    const originalColor = button.style.background;
    
    button.textContent = text;
    button.style.background = color;
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalColor;
    }, 2000);
}

function showIdConsistencyActions() {
    const actionsContainer = document.getElementById('actionsContainer');
    if (actionsContainer) {
        const actionType = isSiteMapperResults ? 'Site ID Analysis' : 'Page ID Analysis';
        
        actionsContainer.innerHTML = `
            <button class="btn btn-secondary" data-action="export">📥 Export ${actionType}</button>
            <button class="btn btn-secondary" data-action="consistency-report">📊 Consistency Report</button>
            <button class="btn btn-secondary" data-action="id-guide">💡 @id Best Practices</button>
            <button class="btn" data-action="close">Close</button>
        `;
        actionsContainer.style.display = 'block';
        
        // Add event listeners properly
        const exportBtn = actionsContainer.querySelector('[data-action="export"]');
        const reportBtn = actionsContainer.querySelector('[data-action="consistency-report"]');
        const guideBtn = actionsContainer.querySelector('[data-action="id-guide"]');
        const closeBtn = actionsContainer.querySelector('[data-action="close"]');
        
        if (exportBtn) exportBtn.addEventListener('click', exportIdConsistencyResults);
        if (reportBtn) reportBtn.addEventListener('click', showIdConsistencyReport);
        if (guideBtn) guideBtn.addEventListener('click', showIdBestPracticesGuide);
        if (closeBtn) closeBtn.addEventListener('click', closeWindow);
    }
}

function exportIdConsistencyResults() {
    let data;
    
    if (isSiteMapperResults && siteMapperResults) {
        data = {
            timestamp: new Date().toISOString(),
            type: 'schema-id-consistency-analysis',
            baseUrl: siteMapperResults.baseUrl,
            totalPages: siteMapperResults.totalPages,
            totalSchemas: siteMapperResults.totalSchemas,
            consistencyAnalysis: {
                bestPracticeScore: idConsistencyAnalysis.bestPracticeScore,
                uniqueIds: idConsistencyAnalysis.idGroups.size,
                reusedIds: Array.from(idConsistencyAnalysis.consistentIds.values()).filter(count => count > 1).length,
                inconsistentTypes: idConsistencyAnalysis.inconsistentTypes.size,
                recommendations: idConsistencyAnalysis.recommendations,
                idGroups: Object.fromEntries(idConsistencyAnalysis.idGroups),
                typeInconsistencies: Object.fromEntries(idConsistencyAnalysis.inconsistentTypes)
            },
            schemas: currentSchemas
        };
    } else {
        data = {
            timestamp: new Date().toISOString(),
            type: 'single-page-id-analysis',
            pageUrl: document.getElementById('pageUrl').textContent,
            schemaCount: currentSchemas.length,
            schemas: currentSchemas
        };
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const filename = isSiteMapperResults 
        ? `schema-id-consistency-${new Date().toISOString().split('T')[0]}.json`
        : `page-schema-id-analysis-${new Date().toISOString().split('T')[0]}.json`;
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showIdConsistencyReport() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const scoreColor = idConsistencyAnalysis.bestPracticeScore >= 80 ? '#28a745' : 
                      idConsistencyAnalysis.bestPracticeScore >= 60 ? '#ffc107' : '#dc3545';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        width: 90%;
    `;
    
    // FIXED: Show BAD items first, then GOOD items in the consistency report
    let badItemsHTML = '';
    let goodItemsHTML = '';
    
    Array.from(idConsistencyAnalysis.idGroups.entries()).forEach(([schemaId, instances]) => {
        const isGoodPattern = schemaId.startsWith('schema:');
        const isConsistent = instances.length > 1;
        const statusIcon = isGoodPattern && isConsistent ? '✅' : isGoodPattern ? '⚠️' : '❌';
        const statusColor = isGoodPattern && isConsistent ? '#28a745' : isGoodPattern ? '#ffc107' : '#dc3545';
        
        const itemHTML = `
            <div style="border-left: 4px solid ${statusColor}; background: #f8f9fa; padding: 15px; margin-bottom: 10px;">
                <div style="font-weight: bold; color: ${statusColor};">
                    ${statusIcon} "${schemaId}"
                </div>
                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                    Used ${instances.length} time${instances.length === 1 ? '' : 's'} for ${instances[0].type} schemas
                    ${isGoodPattern ? ' • Good pattern' : ' • Non-standard pattern'}
                    ${isConsistent ? ' • Cross-page consistency' : ' • Single page only'}
                </div>
            </div>
        `;
        
        if (isGoodPattern && isConsistent) {
            goodItemsHTML += itemHTML;
        } else {
            badItemsHTML += itemHTML;
        }
    });
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">📊 @id Consistency Report</h2>
            <button class="close-modal-btn" 
                    style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">×</button>
        </div>
        
        <div style="background: ${scoreColor}; color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 25px;">
            <h1 style="margin: 0; font-size: 3rem;">${idConsistencyAnalysis.bestPracticeScore}/100</h1>
            <div style="font-size: 1.2rem; margin-top: 10px;">Consistency Score</div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #007bff;">${idConsistencyAnalysis.idGroups.size}</div>
                <div style="font-size: 14px; color: #6c757d;">Unique @ids</div>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #28a745;">${Array.from(idConsistencyAnalysis.consistentIds.values()).filter(count => count > 1).length}</div>
                <div style="font-size: 14px; color: #6c757d;">Cross-Page @ids</div>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #dc3545;">${idConsistencyAnalysis.inconsistentTypes.size}</div>
                <div style="font-size: 14px; color: #6c757d;">Inconsistent Types</div>
            </div>
        </div>
        
        ${badItemsHTML ? `
            <h3 style="color: #dc3545; margin-bottom: 15px;">🚨 Issues Found (Fix These First):</h3>
            <div>${badItemsHTML}</div>
        ` : ''}
        
        ${goodItemsHTML ? `
            <h3 style="color: #28a745; margin: ${badItemsHTML ? '25px' : '0'} 0 15px 0;">🎉 What's Working Well:</h3>
            <div>${goodItemsHTML}</div>
        ` : ''}
        
        ${idConsistencyAnalysis.inconsistentTypes.size > 0 ? `
            <h3 style="color: #dc3545; margin-top: 25px;">⚠️ Type Inconsistencies:</h3>
            <div>
                ${Array.from(idConsistencyAnalysis.inconsistentTypes.entries()).map(([schemaType, ids]) => `
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                        <div style="font-weight: bold; color: #721c24;">Type: ${schemaType}</div>
                        <div style="font-size: 14px; color: #721c24; margin-top: 5px;">
                            Uses ${ids.length} different @ids: ${ids.join(', ')}
                        </div>
                        <div style="background: #fff; padding: 8px; border-radius: 4px; margin-top: 8px;">
                            <strong>Recommended:</strong> Use single @id: <code>schema:${schemaType}</code>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    modal.appendChild(modalContent);
    
    // Add close functionality
    const closeBtn = modalContent.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

function showIdBestPracticesGuide() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 900px;
        max-height: 80vh;
        overflow-y: auto;
        width: 90%;
    `;
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">💡 Schema @id Best Practices Guide</h2>
            <button class="close-modal-btn" 
                    style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">×</button>
        </div>
        
        <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px 0; color: #1565c0;">🎯 The Golden Rule</h3>
            <p style="margin: 0; color: #1565c0; font-size: 16px; font-weight: 500;">
                Use the <strong>same @id value</strong> for the <strong>same entity type</strong> across <strong>all pages</strong> of your website.
            </p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px;">
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #155724;">✅ EXCELLENT Examples</h3>
                <div>
                    <div>
                        <h4 style="margin: 0 0 8px 0; color: #155724;">WebPageElement:</h4>
                        <code style="background: rgba(0,0,0,0.1); padding: 8px; display: block; border-radius: 4px; font-size: 13px;">
                            "@id": "schema:WebPageElement"
                        </code>
                        <small style="color: #155724;">Use on ALL pages with navigation</small>
                    </div>
                    <div style="margin-top: 15px;">
                        <h4 style="margin: 0 0 8px 0; color: #155724;">Organization:</h4>
                        <code style="background: rgba(0,0,0,0.1); padding: 8px; display: block; border-radius: 4px; font-size: 13px;">
                            "@id": "schema:Organization"
                        </code>
                        <small style="color: #155724;">Use on ALL pages referencing your company</small>
                    </div>
                </div>
            </div>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #721c24;">❌ POOR Examples</h3>
                <div>
                    <div>
                        <h4 style="margin: 0 0 8px 0; color: #721c24;">Inconsistent:</h4>
                        <code style="background: rgba(0,0,0,0.1); padding: 8px; display: block; border-radius: 4px; font-size: 13px;">
                            Page 1: "@id": "#webpage1"<br>
                            Page 2: "@id": "schema:WebPage"<br>
                            Page 3: "@id": "#main-content"
                        </code>
                        <small style="color: #721c24;">Different @ids for same entity type</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.appendChild(modalContent);
    
    // Add close functionality
    const closeBtn = modalContent.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

function closeWindow() {
    window.close();
}

function showError(message) {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('errorText').textContent = message;
}

function showNoSchemas() {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('noSchemas').style.display = 'block';
}

// Make showScoreBreakdown globally available for debugging
window.showScoreBreakdown = showScoreBreakdown;d(overviewSection);