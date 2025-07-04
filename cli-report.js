#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PBIRReportGenerator {
    constructor() {
        this.reportData = null;
        this.pages = new Map();
        this.visuals = new Map();
        this.filters = new Map();
    }

    async generateReport(dirPath, options = {}) {
        console.log(`\n📊 Analyzing Power BI Report: ${path.basename(dirPath)}`);
        console.log('=' .repeat(60));
        
        const files = this.collectFiles(dirPath);
        await this.parseReportData(files);
        
        if (options.overview !== false) {
            this.printReportOverview();
        }
        
        if (options.pages !== false) {
            this.printPagesDetail();
        }
        
        if (options.export) {
            this.exportCleanReport(options.export);
        }
    }
    
    collectFiles(dirPath) {
        const files = [];
        
        const walkDir = (currentPath) => {
            const items = fs.readdirSync(currentPath);
            
            for (const item of items) {
                const fullPath = path.join(currentPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    walkDir(fullPath);
                } else if (item.endsWith('.json')) {
                    const relativePath = path.relative(dirPath, fullPath);
                    files.push({
                        name: item,
                        path: fullPath,
                        relativePath: relativePath
                    });
                }
            }
        };
        
        walkDir(dirPath);
        return files;
    }
    
    async parseReportData(files) {
        // Parse main report
        const reportFile = this.findFile(files, 'definition/report.json');
        if (reportFile) {
            this.reportData = await this.parseJsonFile(reportFile);
        }
        
        // Parse pages
        await this.parsePages(files);
        
        // Parse global filters
        await this.parseGlobalFilters(files);
    }
    
    async parsePages(files) {
        // Get pages metadata for display names
        const pagesFile = this.findFile(files, 'definition/pages/pages.json');
        let pagesMetadata = {};
        
        if (pagesFile) {
            const pagesData = await this.parseJsonFile(pagesFile);
            if (pagesData && pagesData.pages) {
                pagesData.pages.forEach(page => {
                    pagesMetadata[page.name] = page;
                });
            }
        }
        
        // Parse individual page files
        const pageFiles = files.filter(f => 
            f.relativePath.includes('/pages/') && f.relativePath.endsWith('/page.json')
        );
        
        for (const pageFile of pageFiles) {
            const pageName = this.extractPageName(pageFile.relativePath);
            const pageData = await this.parseJsonFile(pageFile);
            
            if (pageData) {
                const pageInfo = {
                    id: pageName,
                    name: pageData.displayName || pagesMetadata[pageName]?.displayName || pageName,
                    width: pageData.width,
                    height: pageData.height,
                    displayOption: pageData.displayOption,
                    visibility: pageData.visibility,
                    type: pageData.type,
                    filters: this.extractPageFilters(pageData),
                    visuals: await this.parsePageVisuals(files, pageName)
                };
                
                this.pages.set(pageName, pageInfo);
            }
        }
    }
    
    async parsePageVisuals(files, pageName) {
        const visuals = [];
        
        const visualFiles = files.filter(f => 
            f.relativePath.includes(`/pages/${pageName}/visuals/`) && 
            f.relativePath.endsWith('/visual.json')
        );
        
        for (const visualFile of visualFiles) {
            const visualName = this.extractVisualName(visualFile.relativePath);
            const visualData = await this.parseJsonFile(visualFile);
            
            if (visualData) {
                const visualInfo = this.extractVisualInfo(visualName, visualData);
                if (visualInfo) {
                    visuals.push(visualInfo);
                }
            }
        }
        
        return visuals.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    extractVisualInfo(visualName, visualData) {
        const info = {
            id: visualName,
            name: this.getVisualDisplayName(visualData),
            type: this.getVisualType(visualData),
            position: this.getVisualPosition(visualData),
            fields: this.getVisualFields(visualData),
            filters: this.getVisualFilters(visualData),
            isHidden: visualData.isHidden || false
        };
        
        return info;
    }
    
    getVisualDisplayName(visualData) {
        // Try to get custom title from visualContainerObjects (most common location)
        const containerObjects = visualData.visual?.visualContainerObjects || visualData.visualContainerObjects;
        if (containerObjects && containerObjects.title) {
            const titleConfig = containerObjects.title[0];
            if (titleConfig && titleConfig.properties && titleConfig.properties.text) {
                const textExpr = titleConfig.properties.text.expr;
                if (textExpr && textExpr.Literal && textExpr.Literal.Value) {
                    let title = textExpr.Literal.Value;
                    // Remove quotes if present
                    title = title.replace(/^'|'$/g, '').trim();
                    if (title && title !== 'Title') {
                        return title;
                    }
                }
            }
        }
        
        // Try to get title from visual configuration
        if (visualData.visual) {
            // Check for singleVisual structure
            if (visualData.visual.singleVisual && visualData.visual.singleVisual.objects) {
                const objects = visualData.visual.singleVisual.objects;
                
                // Check title object
                if (objects.title && objects.title[0] && objects.title[0].properties) {
                    const titleProp = objects.title[0].properties.text;
                    if (titleProp && titleProp.literal && titleProp.literal.value) {
                        const title = titleProp.literal.value.trim();
                        if (title) return title;
                    }
                    
                    // Check for expr structure
                    if (titleProp && titleProp.expr && titleProp.expr.Literal) {
                        let title = titleProp.expr.Literal.Value;
                        title = title.replace(/^'|'$/g, '').trim();
                        if (title && title !== 'Title') return title;
                    }
                }
                
                // For text boxes, extract the first text run
                if (objects.general && objects.general[0] && objects.general[0].properties) {
                    const paragraphs = objects.general[0].properties.paragraphs;
                    if (paragraphs && paragraphs.length > 0) {
                        const firstParagraph = paragraphs[0];
                        if (firstParagraph.textRuns && firstParagraph.textRuns.length > 0) {
                            const firstText = firstParagraph.textRuns[0].value;
                            if (firstText && firstText.trim() && firstText.length < 50) {
                                return firstText.trim();
                            }
                        }
                    }
                }
            }
            
            // Check direct objects structure
            if (visualData.visual.objects && visualData.visual.objects.title) {
                const titleObj = visualData.visual.objects.title[0];
                if (titleObj && titleObj.properties && titleObj.properties.text) {
                    if (titleObj.properties.text.literal?.value) {
                        const title = titleObj.properties.text.literal.value.trim();
                        if (title) return title;
                    }
                    
                    // Check for expr structure
                    if (titleObj.properties.text.expr && titleObj.properties.text.expr.Literal) {
                        let title = titleObj.properties.text.expr.Literal.Value;
                        title = title.replace(/^'|'$/g, '').trim();
                        if (title && title !== 'Title') return title;
                    }
                }
            }
        }
        
        // Generate name based on visual type
        const visualType = this.getVisualType(visualData);
        const shortId = visualData.name ? visualData.name.substring(0, 8) : 'unknown';
        
        if (visualType !== 'unknown') {
            return `${visualType} (${shortId})`;
        }
        
        return `Visual (${shortId})`;
    }
    
    getVisualType(visualData) {
        const typeMapping = {
            'columnChart': 'Column Chart',
            'barChart': 'Bar Chart',
            'lineChart': 'Line Chart',
            'pieChart': 'Pie Chart',
            'card': 'Card',
            'multiRowCard': 'Multi-row Card',
            'tableEx': 'Table',
            'matrix': 'Matrix',
            'slicer': 'Slicer',
            'textbox': 'Text Box',
            'image': 'Image',
            'basicShape': 'Shape',
            'actionButton': 'Button',
            'pivotTable': 'Pivot Table',
            'qnaVisual': 'Q&A Visual',
            'keyDriversVisual': 'Key Drivers',
            'decompositionTreeVisual': 'Decomposition Tree'
        };
        
        let visualType = 'unknown';
        
        // First check the direct visual.visualType property
        if (visualData.visual && visualData.visual.visualType) {
            visualType = visualData.visual.visualType;
        } else if (visualData.visual && visualData.visual.singleVisual && visualData.visual.singleVisual.visualType) {
            visualType = visualData.visual.singleVisual.visualType;
        }
        
        // Check if it's a custom visual
        if (visualType.startsWith('PBI_CV_') || visualType.includes('CV_') || visualType.length > 30) {
            return 'Custom Visual';
        }
        
        return typeMapping[visualType] || visualType;
    }
    
    getVisualPosition(visualData) {
        if (visualData.position) {
            return {
                x: Math.round(visualData.position.x || 0),
                y: Math.round(visualData.position.y || 0),
                width: Math.round(visualData.position.width || 0),
                height: Math.round(visualData.position.height || 0)
            };
        }
        return null;
    }
    
    getVisualFields(visualData) {
        const fields = {
            measures: [],
            dimensions: [],
            values: []
        };
        
        if (visualData.visual) {
            // Extract from query.queryState (newer format)
            if (visualData.visual.query && visualData.visual.query.queryState) {
                const queryState = visualData.visual.query.queryState;
                
                // Process each role in queryState
                Object.keys(queryState).forEach(roleKey => {
                    const role = queryState[roleKey];
                    if (role.projections && Array.isArray(role.projections)) {
                        role.projections.forEach(projection => {
                            const fieldInfo = this.parseProjectionField(roleKey, projection);
                            if (fieldInfo) {
                                if (fieldInfo.type === 'measure') {
                                    fields.measures.push(fieldInfo);
                                } else {
                                    fields.dimensions.push(fieldInfo);
                                }
                            }
                        });
                    }
                });
            }
            
            // Extract from singleVisual structure (legacy format)
            if (visualData.visual.singleVisual) {
                const singleVisual = visualData.visual.singleVisual;
                
                // Extract from prototypeQuery
                if (singleVisual.prototypeQuery && singleVisual.prototypeQuery.Select) {
                    singleVisual.prototypeQuery.Select.forEach(select => {
                        const fieldInfo = this.parseFieldFromSelect(select);
                        if (fieldInfo) {
                            if (fieldInfo.type === 'measure') {
                                fields.measures.push(fieldInfo);
                            } else {
                                fields.dimensions.push(fieldInfo);
                            }
                        }
                    });
                }
                
                // Extract from dataRoles
                if (singleVisual.dataRoles) {
                    Object.keys(singleVisual.dataRoles).forEach(roleKey => {
                        const role = singleVisual.dataRoles[roleKey];
                        if (Array.isArray(role)) {
                            role.forEach(item => {
                                const fieldInfo = this.parseFieldFromDataRole(roleKey, item);
                                if (fieldInfo) {
                                    fields.values.push(fieldInfo);
                                }
                            });
                        }
                    });
                }
            }
        }
        
        return fields;
    }
    
    parseProjectionField(roleKey, projection) {
        if (projection.field) {
            const field = projection.field;
            
            if (field.Measure) {
                return {
                    type: 'measure',
                    role: roleKey,
                    name: projection.queryRef || field.Measure.Property,
                    table: field.Measure.Expression?.SourceRef?.Entity || 'Unknown Table',
                    field: field.Measure.Property
                };
            } else if (field.Column) {
                return {
                    type: 'dimension',
                    role: roleKey,
                    name: projection.queryRef || field.Column.Property,
                    table: field.Column.Expression?.SourceRef?.Entity || 'Unknown Table',
                    field: field.Column.Property
                };
            } else if (field.Aggregation) {
                const aggregationTypes = {
                    0: 'Sum', 1: 'Average', 2: 'Count (Distinct)', 
                    3: 'Min', 4: 'Max', 5: 'Count'
                };
                return {
                    type: 'measure',
                    role: roleKey,
                    name: projection.queryRef || 'Aggregated Field',
                    aggregation: aggregationTypes[field.Aggregation.Function] || 'Unknown',
                    table: field.Aggregation.Expression?.Column?.Expression?.SourceRef?.Entity || 'Unknown Table',
                    field: field.Aggregation.Expression?.Column?.Property || 'Unknown Field'
                };
            }
        }
        return null;
    }
    
    parseFieldFromSelect(select) {
        if (select.Measure) {
            return {
                type: 'measure',
                name: select.Name || 'Unnamed Measure',
                table: this.extractTableName(select.Measure.Expression),
                field: select.Measure.Property
            };
        } else if (select.Column) {
            return {
                type: 'dimension',
                name: select.Name || 'Unnamed Column',
                table: this.extractTableName(select.Column.Expression),
                field: select.Column.Property
            };
        } else if (select.Aggregation) {
            const aggregationTypes = {
                0: 'Sum', 1: 'Average', 2: 'Count (Distinct)', 
                3: 'Min', 4: 'Max', 5: 'Count'
            };
            return {
                type: 'measure',
                name: select.Name || 'Aggregated Field',
                aggregation: aggregationTypes[select.Aggregation.Function] || 'Unknown',
                table: this.extractTableName(select.Aggregation.Expression),
                field: this.extractFieldName(select.Aggregation.Expression)
            };
        }
        return null;
    }
    
    parseFieldFromDataRole(roleName, item) {
        if (item.queryRef) {
            return {
                role: roleName,
                name: item.queryRef.Name || 'Unnamed Field',
                type: item.queryRef.Measure ? 'measure' : 'dimension'
            };
        }
        return null;
    }
    
    extractTableName(expression) {
        if (expression && expression.SourceRef) {
            return expression.SourceRef.Entity || 'Unknown Table';
        } else if (expression && expression.Column && expression.Column.Expression && expression.Column.Expression.SourceRef) {
            return expression.Column.Expression.SourceRef.Entity || 'Unknown Table';
        }
        return 'Unknown Table';
    }
    
    extractFieldName(expression) {
        if (expression && expression.Column) {
            return expression.Column.Property || 'Unknown Field';
        }
        return 'Unknown Field';
    }
    
    getVisualFilters(visualData) {
        const filters = [];
        
        // Extract from filterConfig
        if (visualData.filterConfig && visualData.filterConfig.filters) {
            visualData.filterConfig.filters.forEach(filter => {
                const filterInfo = this.parseFilter(filter);
                if (filterInfo) {
                    filters.push(filterInfo);
                }
            });
        }
        
        return filters;
    }
    
    extractPageFilters(pageData) {
        const filters = [];
        
        if (pageData.filterConfig && pageData.filterConfig.filters) {
            pageData.filterConfig.filters.forEach(filter => {
                const filterInfo = this.parseFilter(filter);
                if (filterInfo) {
                    filters.push(filterInfo);
                }
            });
        }
        
        return filters;
    }
    
    parseFilter(filter) {
        return {
            name: filter.displayName || filter.name || 'Unnamed Filter',
            type: this.getFilterTypeName(filter.type),
            field: this.getFilterFieldName(filter.field),
            isHidden: filter.isHiddenInViewMode || false,
            isLocked: filter.isLockedInViewMode || false
        };
    }
    
    getFilterTypeName(type) {
        const typeMapping = {
            'Categorical': 'List Filter',
            'Range': 'Range Filter',
            'Advanced': 'Advanced Filter',
            'TopN': 'Top N Filter',
            'RelativeDate': 'Relative Date Filter'
        };
        return typeMapping[type] || type;
    }
    
    getFilterFieldName(field) {
        if (field && field.Column) {
            const table = this.extractTableName(field.Column.Expression);
            const column = field.Column.Property;
            return `${table}.${column}`;
        } else if (field && field.Measure) {
            const table = this.extractTableName(field.Measure.Expression);
            const measure = field.Measure.Property;
            return `${table}.${measure}`;
        }
        return 'Unknown Field';
    }
    
    async parseGlobalFilters(files) {
        if (this.reportData && this.reportData.filterConfig) {
            // Parse global report filters
            if (this.reportData.filterConfig.filters) {
                this.reportData.filterConfig.filters.forEach(filter => {
                    const filterInfo = this.parseFilter(filter);
                    if (filterInfo) {
                        this.filters.set(filter.name, filterInfo);
                    }
                });
            }
        }
    }
    
    printReportOverview() {
        console.log(`\n📋 Report Overview`);
        console.log('-'.repeat(30));
        console.log(`Pages: ${this.pages.size}`);
        
        let totalVisuals = 0;
        let visualTypes = {};
        
        for (const [pageId, page] of this.pages) {
            totalVisuals += page.visuals.length;
            page.visuals.forEach(visual => {
                visualTypes[visual.type] = (visualTypes[visual.type] || 0) + 1;
            });
        }
        
        console.log(`Total Visuals: ${totalVisuals}`);
        console.log(`Global Filters: ${this.filters.size}`);
        
        if (Object.keys(visualTypes).length > 0) {
            console.log(`\n📊 Visual Types:`);
            Object.entries(visualTypes)
                .sort((a, b) => b[1] - a[1])
                .forEach(([type, count]) => {
                    console.log(`  • ${type}: ${count}`);
                });
        }
        
        if (this.filters.size > 0) {
            console.log(`\n🔍 Global Filters:`);
            for (const [filterId, filter] of this.filters) {
                console.log(`  • ${filter.name} (${filter.type})`);
                console.log(`    Field: ${filter.field}`);
            }
        }
    }
    
    printPagesDetail() {
        console.log(`\n\n📄 Pages Detail`);
        console.log('='.repeat(60));
        
        for (const [pageId, page] of this.pages) {
            console.log(`\n📑 Page: ${page.name}`);
            console.log(`   ID: ${pageId}`);
            console.log(`   Size: ${page.width} × ${page.height}`);
            console.log(`   Visuals: ${page.visuals.length}`);
            
            if (page.filters.length > 0) {
                console.log(`   Page Filters:`);
                page.filters.forEach(filter => {
                    console.log(`     • ${filter.name} (${filter.type}) - ${filter.field}`);
                });
            }
            
            if (page.visuals.length > 0) {
                console.log(`\n   📊 Visuals:`);
                page.visuals.forEach((visual, index) => {
                    console.log(`   ${index + 1}. ${visual.name}`);
                    console.log(`      Type: ${visual.type}`);
                    
                    if (visual.position) {
                        console.log(`      Position: (${visual.position.x}, ${visual.position.y}) Size: ${visual.position.width}×${visual.position.height}`);
                    }
                    
                    // Show measures
                    if (visual.fields.measures.length > 0) {
                        console.log(`      📏 Measures:`);
                        visual.fields.measures.forEach(measure => {
                            const aggregation = measure.aggregation ? ` (${measure.aggregation})` : '';
                            console.log(`        • ${measure.table}.${measure.field}${aggregation}`);
                        });
                    }
                    
                    // Show dimensions
                    if (visual.fields.dimensions.length > 0) {
                        console.log(`      📊 Dimensions:`);
                        visual.fields.dimensions.forEach(dimension => {
                            console.log(`        • ${dimension.table}.${dimension.field}`);
                        });
                    }
                    
                    // Show other fields
                    if (visual.fields.values.length > 0) {
                        console.log(`      📋 Fields:`);
                        visual.fields.values.forEach(field => {
                            console.log(`        • ${field.role}: ${field.name} (${field.type})`);
                        });
                    }
                    
                    // Show filters
                    if (visual.filters.length > 0) {
                        console.log(`      🔍 Filters:`);
                        visual.filters.forEach(filter => {
                            console.log(`        • ${filter.name} (${filter.type}) - ${filter.field}`);
                        });
                    }
                    
                    if (visual.isHidden) {
                        console.log(`      ⚠️  Hidden Visual`);
                    }
                    
                    console.log('');
                });
            }
        }
    }
    
    exportCleanReport(filePath) {
        const cleanReport = {
            overview: {
                totalPages: this.pages.size,
                totalVisuals: Array.from(this.pages.values()).reduce((sum, page) => sum + page.visuals.length, 0),
                globalFilters: Array.from(this.filters.values())
            },
            pages: Array.from(this.pages.values()).map(page => ({
                name: page.name,
                id: page.id,
                dimensions: `${page.width} × ${page.height}`,
                visuals: page.visuals.map(visual => ({
                    name: visual.name,
                    type: visual.type,
                    position: visual.position,
                    measures: visual.fields.measures,
                    dimensions: visual.fields.dimensions,
                    filters: visual.filters,
                    isHidden: visual.isHidden
                })),
                filters: page.filters
            }))
        };
        
        fs.writeFileSync(filePath, JSON.stringify(cleanReport, null, 2));
        console.log(`\n💾 Clean report saved to: ${filePath}`);
    }
    
    // Utility methods
    async parseJsonFile(file) {
        try {
            const content = fs.readFileSync(file.path, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error(`Error parsing ${file.relativePath}: ${error.message}`);
            return null;
        }
    }
    
    findFile(files, relativePath) {
        return files.find(f => f.relativePath.endsWith(relativePath));
    }
    
    extractPageName(path) {
        const match = path.match(/\/pages\/([^\/]+)\/page\.json$/);
        return match ? match[1] : 'unknown';
    }
    
    extractVisualName(path) {
        const match = path.match(/\/visuals\/([^\/]+)\/visual\.json$/);
        return match ? match[1] : 'unknown';
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
📊 PBIR Clean Report Generator

Usage:
  node cli-report.js <pbir-directory-path> [options]

Options:
  --export <file>     Save clean report to JSON file
  --no-overview      Skip report overview section
  --no-pages         Skip pages detail section
  --pages-only       Show only pages (skip overview)

Examples:
  node cli-report.js ./my-report-folder
  node cli-report.js ./my-report-folder --export clean-report.json
  node cli-report.js ./my-report-folder --pages-only
        `);
        process.exit(1);
    }
    
    const dirPath = args[0];
    const options = {
        export: args.includes('--export') ? args[args.indexOf('--export') + 1] : null,
        overview: !args.includes('--no-overview') && !args.includes('--pages-only'),
        pages: !args.includes('--no-pages')
    };
    
    try {
        const generator = new PBIRReportGenerator();
        await generator.generateReport(dirPath, options);
        
        console.log(`\n✅ Report analysis complete!`);
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { PBIRReportGenerator };