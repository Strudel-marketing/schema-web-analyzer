<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Schema Web Analyzer - Advanced Schema.org Analysis Tool</title>
    <meta name="description" content="Comprehensive Schema.org markup analysis with @id consistency checking and entity relationship mapping">
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- D3.js for visualizations -->
    <script src="https://d3js.org/d3.v7.min.js"></script>
    
    <!-- Custom styles -->
    <link rel="stylesheet" href="style.css">
    
    <!-- Favicon -->
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕸️</text></svg>">
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center py-4">
                <div class="flex items-center space-x-3">
                    <div class="text-3xl">🕸️</div>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Schema Web Analyzer</h1>
                        <p class="text-sm text-gray-600">Advanced Schema.org markup analysis & consistency checking</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="text-sm text-gray-500" id="statusIndicator">
                        <span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        API Ready
                    </div>
                    <button id="settingsBtn" class="p-2 text-gray-400 hover:text-gray-600">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        <!-- URL Analysis Input -->
        <div class="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                    <span class="text-2xl mr-2">🔍</span>
                    URL Analysis
                </h2>
                <div class="flex space-x-2">
                    <button id="singleAnalysisTab" class="tab-button active">Single Page</button>
                    <button id="siteAnalysisTab" class="tab-button">Full Site</button>
                </div>
            </div>
            
            <!-- Single Page Analysis -->
            <div id="singleAnalysisPanel" class="analysis-panel">
                <div class="flex space-x-4 mb-4">
                    <div class="flex-1">
                        <input 
                            type="url" 
                            id="urlInput" 
                            placeholder="https://example.com/page"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value="https://schema.org"
                        >
                    </div>
                    <button 
                        id="analyzeBtn" 
                        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium flex items-center space-x-2"
                    >
                        <span>🚀</span>
                        <span>Analyze</span>
                    </button>
                </div>
                
                <div class="flex flex-wrap gap-3">
                    <label class="flex items-center space-x-2">
                        <input type="checkbox" id="deepScan" checked class="rounded">
                        <span class="text-sm text-gray-700">Deep Scan</span>
                    </label>
                    <label class="flex items-center space-x-2">
                        <input type="checkbox" id="entityAnalysis" checked class="rounded">
                        <span class="text-sm text-gray-700">Entity Analysis</span>
                    </label>
                    <label class="flex items-center space-x-2">
                        <input type="checkbox" id="consistencyCheck" checked class="rounded">
                        <span class="text-sm text-gray-700">@id Consistency</span>
                    </label>
                    <label class="flex items-center space-x-2">
                        <input type="checkbox" id="recommendations" checked class="rounded">
                        <span class="text-sm text-gray-700">Recommendations</span>
                    </label>
                </div>
            </div>

            <!-- Site Analysis -->
            <div id="siteAnalysisPanel" class="analysis-panel hidden">
                <div class="flex space-x-4 mb-4">
                    <div class="flex-1">
                        <input 
                            type="url" 
                            id="siteUrlInput" 
                            placeholder="https://example.com"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                    </div>
                    <button 
                        id="scanSiteBtn" 
                        class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 font-medium flex items-center space-x-2"
                    >
                        <span>🗺️</span>
                        <span>Scan Site</span>
                    </button>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Max Pages</label>
                        <select id="maxPages" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="10">10 pages</option>
                            <option value="25" selected>25 pages</option>
                            <option value="50">50 pages</option>
                            <option value="100">100 pages</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Crawl Depth</label>
                        <select id="crawlDepth" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="1">1 level</option>
                            <option value="2">2 levels</option>
                            <option value="3" selected>3 levels</option>
                            <option value="4">4 levels</option>
                        </select>
                    </div>
                    <div class="col-span-2">
                        <label class="flex items-center space-x-2 mt-6">
                            <input type="checkbox" id="includeSitemaps" checked class="rounded">
                            <span class="text-sm text-gray-700">Include Sitemaps</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div id="loadingState" class="hidden">
            <div class="bg-white rounded-lg shadow-sm border p-6 mb-6">
                <div class="flex items-center justify-center py-8">
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">Analyzing Schema Markup</h3>
                        <p class="text-gray-600" id="loadingMessage">Initializing analysis...</p>
                        <div class="mt-4 bg-gray-200 rounded-full h-2 w-64 mx-auto">
                            <div id="progressBar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Results Section -->
        <div id="resultsSection" class="hidden">
            
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="bg-white rounded-lg shadow-sm border p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="text-3xl">⚠️</div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Issues</p>
                            <p class="text-2xl font-bold text-gray-900" id="issueCount">--</p>
                            <p class="text-xs text-gray-500" id="issueDetails">to fix</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-sm border p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="text-3xl">🔗</div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">@id Consistency</p>
                      text-3xl">📊</div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">SEO Score</p>
                            <p class="text-2xl font-bold text-gray-900" id="seoScore">--</p>
                            <p class="text-xs text-gray-500" id="seoTrend">out of 100</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-sm border p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="text-3xl">🕸️</div>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Entities</p>
                            <p class="text-2xl font-bold text-gray-900" id="entityCount">--</p>
                            <p class="text-xs text-gray-500" id="entityDetails">types found</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-sm border p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="
