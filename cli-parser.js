#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple JSON Schema validator
class SchemaValidator {
    constructor() {
        this.schemas = new Map();
        this.loadSchemas();
    }
    
    loadSchemas() {
        const schemaDir = path.join(__dirname, 'json-schemas');
        if (!fs.existsSync(schemaDir)) {
            console.warn('JSON schemas directory not found');
            return;
        }
        
        const schemaFiles = fs.readdirSync(schemaDir).filter(f => f.endsWith('.json'));
        for (const file of schemaFiles) {
            try {
                const schemaPath = path.join(schemaDir, file);
                const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
                const schemaName = file.replace('_schema.json', '').replace('.json', '');
                this.schemas.set(schemaName, schema);
            } catch (error) {
                console.warn(`Failed to load schema ${file}:`, error.message);
            }
        }
        console.log(`Loaded ${this.schemas.size} schemas`);
    }
    
    validate(data, schemaName) {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            return { valid: false, errors: [`Schema ${schemaName} not found`] };
        }
        
        // Basic validation - you can extend this with a full JSON Schema validator
        return this.basicValidate(data, schema);
    }
    
    basicValidate(data, schema) {
        const errors = [];
        
        if (schema.required) {
            for (const requiredField of schema.required) {
                if (!(requiredField in data)) {
                    errors.push(`Missing required field: ${requiredField}`);
                }
            }
        }
        
        return { valid: errors.length === 0, errors };
    }
}

// Enhanced PBIR Parser with schema validation
class EnhancedPBIRParser {
    constructor() {
        this.validator = new SchemaValidator();
        this.reportData = null;
        this.pages = new Map();
        this.visuals = new Map();
        this.bookmarks = new Map();
        this.parseErrors = [];
        this.parseWarnings = [];
    }

    async parseDirectory(dirPath) {
        console.log(`\n🔍 Parsing PBIR directory: ${dirPath}`);
        
        if (!fs.existsSync(dirPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }
        
        const files = this.collectFiles(dirPath);
        console.log(`📁 Found ${files.length} JSON files`);
        
        // Parse main report structure
        await this.parseReportStructure(files, dirPath);
        
        // Parse pages and their visuals
        await this.parsePages(files, dirPath);
        
        // Parse bookmarks if available
        await this.parseBookmarks(files, dirPath);
        
        return {
            report: this.reportData,
            pages: Object.fromEntries(this.pages),
            visuals: Object.fromEntries(this.visuals),
            bookmarks: Object.fromEntries(this.bookmarks),
            errors: this.parseErrors,
            warnings: this.parseWarnings
        };
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
    
    async parseReportStructure(files, basePath) {
        console.log('\n📊 Parsing report structure...');
        
        // Parse main report.json
        const reportFile = this.findFile(files, 'definition/report.json');
        if (reportFile) {
            console.log(`  ✓ Found report.json`);
            this.reportData = await this.parseJsonFileWithValidation(reportFile, 'report');
        } else {
            this.parseWarnings.push('No main report.json found');
        }
        
        // Parse version info
        const versionFile = this.findFile(files, 'definition/version.json');
        if (versionFile) {
            console.log(`  ✓ Found version.json`);
            const versionData = await this.parseJsonFileWithValidation(versionFile, 'versionMetadata');
            if (this.reportData && versionData) {
                this.reportData = { ...this.reportData, version: versionData };
            }
        }
        
        // Parse report extensions
        const extensionsFile = this.findFile(files, 'definition/reportExtensions.json');
        if (extensionsFile) {
            console.log(`  ✓ Found reportExtensions.json`);
            const extensionsData = await this.parseJsonFileWithValidation(extensionsFile, 'reportExtension');
            if (this.reportData && extensionsData) {
                this.reportData = { ...this.reportData, extensions: extensionsData };
            }
        }
    }
    
    async parsePages(files, basePath) {
        console.log('\n📄 Parsing pages...');
        
        // Parse pages.json for page list
        const pagesFile = this.findFile(files, 'definition/pages/pages.json');
        let pagesList = [];
        
        if (pagesFile) {
            console.log(`  ✓ Found pages.json`);
            const pagesData = await this.parseJsonFileWithValidation(pagesFile, 'pagesMetadata');
            if (pagesData && pagesData.pages) {
                pagesList = pagesData.pages;
            }
        }
        
        // Parse individual page files
        const pageFiles = files.filter(f => 
            f.relativePath.includes('/pages/') && f.relativePath.endsWith('/page.json')
        );
        
        console.log(`  📑 Found ${pageFiles.length} page files`);
        
        for (const pageFile of pageFiles) {
            const pageName = this.extractPageName(pageFile.relativePath);
            console.log(`    Processing page: ${pageName}`);
            
            const pageData = await this.parseJsonFileWithValidation(pageFile, 'page');
            if (pageData) {
                // Parse visuals for this page
                const pageVisuals = await this.parsePageVisuals(files, pageName);
                
                this.pages.set(pageName, {
                    ...pageData,
                    name: pageName,
                    visuals: pageVisuals
                });
                
                console.log(`      ✓ Parsed ${Object.keys(pageVisuals).length} visuals`);
            }
        }
    }
    
    async parsePageVisuals(files, pageName) {
        const visuals = new Map();
        
        const visualFiles = files.filter(f => 
            f.relativePath.includes(`/pages/${pageName}/visuals/`) && 
            f.relativePath.endsWith('/visual.json')
        );
        
        for (const visualFile of visualFiles) {
            const visualName = this.extractVisualName(visualFile.relativePath);
            const visualData = await this.parseJsonFileWithValidation(visualFile, 'visualContainer');
            
            if (visualData) {
                // Parse mobile layout if exists
                const mobilePath = visualFile.relativePath.replace('/visual.json', '/mobile.json');
                const mobileFile = files.find(f => f.relativePath === mobilePath);
                let mobileData = null;
                
                if (mobileFile) {
                    mobileData = await this.parseJsonFileWithValidation(mobileFile, 'visualContainerMobileState');
                }
                
                const processedVisual = this.processVisualData(visualData, mobileData);
                visuals.set(visualName, processedVisual);
                
                // Also store in global visuals map
                this.visuals.set(`${pageName}:${visualName}`, {
                    ...processedVisual,
                    pageName,
                    visualName
                });
            }
        }
        
        return Object.fromEntries(visuals);
    }
    
    async parseBookmarks(files, basePath) {
        console.log('\n🔖 Parsing bookmarks...');
        
        // Parse bookmarks.json
        const bookmarksFile = this.findFile(files, 'definition/bookmarks/bookmarks.json');
        if (bookmarksFile) {
            console.log(`  ✓ Found bookmarks.json`);
            await this.parseJsonFileWithValidation(bookmarksFile, 'bookmarksMetadata');
            
            // Parse individual bookmark files
            const bookmarkFiles = files.filter(f => 
                f.relativePath.includes('/bookmarks/') && f.relativePath.endsWith('.bookmark.json')
            );
            
            console.log(`  📑 Found ${bookmarkFiles.length} bookmark files`);
            
            for (const bookmarkFile of bookmarkFiles) {
                const bookmarkName = this.extractBookmarkName(bookmarkFile.relativePath);
                console.log(`    Processing bookmark: ${bookmarkName}`);
                
                const bookmarkData = await this.parseJsonFileWithValidation(bookmarkFile, 'bookmark');
                if (bookmarkData) {
                    this.bookmarks.set(bookmarkName, bookmarkData);
                }
            }
        }
    }
    
    async parseJsonFileWithValidation(file, schemaName) {
        try {
            const content = fs.readFileSync(file.path, 'utf8');
            const data = JSON.parse(content);
            
            // Validate against schema if available
            if (schemaName) {
                const validation = this.validator.validate(data, schemaName);
                if (!validation.valid) {
                    this.parseWarnings.push(`Schema validation failed for ${file.relativePath} (${schemaName}): ${validation.errors.join(', ')}`);
                }
            }
            
            return data;
        } catch (error) {
            this.parseErrors.push(`Error parsing ${file.relativePath}: ${error.message}`);
            return null;
        }
    }
    
    processVisualData(visualData, mobileData = null) {
        const processed = {
            ...visualData,
            mobile: mobileData,
            properties: this.extractVisualProperties(visualData),
            fields: this.extractFields(visualData),
            filters: this.extractFilters(visualData),
            layout: this.extractLayout(visualData),
            formatting: this.extractFormatting(visualData)
        };
        
        return processed;
    }
    
    extractVisualProperties(visualData) {
        const properties = {};
        
        // Extract visual type and properties from the schema-compliant structure
        if (visualData.visual && visualData.visual.visualType) {
            properties.type = visualData.visual.visualType;
        }
        
        if (visualData.name) {
            properties.name = visualData.name;
        }
        
        // Extract from visual configuration if available
        if (visualData.visual && visualData.visual.singleVisual) {
            const singleVisual = visualData.visual.singleVisual;
            
            if (singleVisual.visualType) {
                properties.type = singleVisual.visualType;
            }
            
            // Extract title from objects
            if (singleVisual.objects && singleVisual.objects.title) {
                const titleObj = singleVisual.objects.title;
                if (titleObj && titleObj[0] && titleObj[0].properties && titleObj[0].properties.text) {
                    properties.title = titleObj[0].properties.text.literal?.value;
                }
            }
        }
        
        if (!properties.type) {
            properties.type = 'unknown';
        }
        
        return properties;
    }
    
    extractFields(visualData) {
        const fields = {
            dataRoles: {},
            measures: [],
            dimensions: []
        };
        
        if (visualData.visual && visualData.visual.singleVisual) {
            const singleVisual = visualData.visual.singleVisual;
            
            // Extract data roles
            if (singleVisual.dataRoles) {
                fields.dataRoles = singleVisual.dataRoles;
            }
            
            // Extract from prototypeQuery using schema structure
            if (singleVisual.prototypeQuery && singleVisual.prototypeQuery.Select) {
                singleVisual.prototypeQuery.Select.forEach(select => {
                    if (select.Measure) {
                        fields.measures.push({
                            name: select.Name,
                            expression: select.Measure.Expression,
                            property: select.Measure.Property
                        });
                    } else if (select.Column) {
                        fields.dimensions.push({
                            name: select.Name,
                            expression: select.Column.Expression,
                            property: select.Column.Property
                        });
                    }
                });
            }
        }
        
        return fields;
    }
    
    extractFilters(visualData) {
        const filters = [];
        
        // Extract from filterConfig using schema structure
        if (visualData.filterConfig && visualData.filterConfig.filters) {
            visualData.filterConfig.filters.forEach(filter => {
                filters.push(this.parseFilterFromSchema(filter));
            });
        }
        
        // Extract from visual configuration
        if (visualData.visual && visualData.visual.singleVisual) {
            const singleVisual = visualData.visual.singleVisual;
            
            // Extract from prototypeQuery Where clause
            if (singleVisual.prototypeQuery && singleVisual.prototypeQuery.Where) {
                singleVisual.prototypeQuery.Where.forEach(where => {
                    filters.push({
                        type: 'Query Filter',
                        condition: where.Condition,
                        target: where.Target,
                        raw: where
                    });
                });
            }
        }
        
        return filters;
    }
    
    parseFilterFromSchema(filter) {
        // Parse filter according to filterConfiguration schema
        return {
            type: filter.type || 'Unknown',
            name: filter.name,
            displayName: filter.displayName,
            field: filter.field,
            filter: filter.filter,
            restatement: filter.restatement,
            howCreated: filter.howCreated,
            isHiddenInViewMode: filter.isHiddenInViewMode,
            isLockedInViewMode: filter.isLockedInViewMode
        };
    }
    
    extractLayout(visualData) {
        const layout = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            z: 0,
            tabOrder: 0
        };
        
        // Extract from position property according to schema
        if (visualData.position) {
            layout.x = visualData.position.x || 0;
            layout.y = visualData.position.y || 0;
            layout.width = visualData.position.width || 0;
            layout.height = visualData.position.height || 0;
            layout.z = visualData.position.z || 0;
            layout.tabOrder = visualData.position.tabOrder || 0;
        }
        
        return layout;
    }
    
    extractFormatting(visualData) {
        const formatting = {
            background: null,
            border: null,
            font: null,
            colors: []
        };
        
        // Extract formatting from visual configuration objects
        if (visualData.visual && visualData.visual.singleVisual && visualData.visual.singleVisual.objects) {
            const objects = visualData.visual.singleVisual.objects;
            
            // Extract background
            if (objects.background) {
                formatting.background = objects.background[0]?.properties;
            }
            
            // Extract border
            if (objects.border) {
                formatting.border = objects.border[0]?.properties;
            }
            
            // Extract colors
            if (objects.dataColors) {
                objects.dataColors.forEach(colorObj => {
                    if (colorObj.properties && colorObj.properties.fill) {
                        formatting.colors.push(colorObj.properties.fill);
                    }
                });
            }
        }
        
        return formatting;
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
    
    extractBookmarkName(path) {
        const match = path.match(/\/([^\/]+)\.bookmark\.json$/);
        return match ? match[1] : 'unknown';
    }
    
    getReportSummary() {
        const summary = {
            totalPages: this.pages.size,
            totalVisuals: this.visuals.size,
            totalBookmarks: this.bookmarks.size,
            visualTypes: this.getVisualTypesSummary(),
            reportInfo: this.reportData,
            parseErrors: this.parseErrors,
            parseWarnings: this.parseWarnings
        };
        
        return summary;
    }
    
    getVisualTypesSummary() {
        const types = new Map();
        
        for (const [key, visual] of this.visuals) {
            const type = visual.properties?.type || 'unknown';
            types.set(type, (types.get(type) || 0) + 1);
        }
        
        return Object.fromEntries(types);
    }
}

// CLI functionality
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🔧 PBIR Parser CLI Tool

Usage:
  node cli-parser.js <pbir-directory-path> [options]

Options:
  --output <file>    Save parsed data to JSON file
  --summary          Show only summary information
  --validate         Perform detailed schema validation
  --verbose          Show detailed parsing information

Examples:
  node cli-parser.js ./my-report-folder
  node cli-parser.js ./my-report-folder --output parsed-report.json
  node cli-parser.js ./my-report-folder --summary --validate
        `);
        process.exit(1);
    }
    
    const dirPath = args[0];
    const options = {
        output: args.includes('--output') ? args[args.indexOf('--output') + 1] : null,
        summary: args.includes('--summary'),
        validate: args.includes('--validate'),
        verbose: args.includes('--verbose')
    };
    
    try {
        const parser = new EnhancedPBIRParser();
        const startTime = Date.now();
        
        console.log('🚀 Starting PBIR analysis...');
        const result = await parser.parseDirectory(dirPath);
        const endTime = Date.now();
        
        console.log(`\n✅ Parsing completed in ${endTime - startTime}ms`);
        
        if (result.errors.length > 0) {
            console.log(`\n❌ Parse Errors (${result.errors.length}):`);
            result.errors.forEach(error => console.log(`  • ${error}`));
        }
        
        if (result.warnings.length > 0) {
            console.log(`\n⚠️  Parse Warnings (${result.warnings.length}):`);
            result.warnings.forEach(warning => console.log(`  • ${warning}`));
        }
        
        // Generate summary
        const summary = parser.getReportSummary();
        
        console.log(`\n📊 Report Summary:`);
        console.log(`  📄 Pages: ${summary.totalPages}`);
        console.log(`  📊 Visuals: ${summary.totalVisuals}`);
        console.log(`  🔖 Bookmarks: ${summary.totalBookmarks}`);
        
        if (Object.keys(summary.visualTypes).length > 0) {
            console.log(`\n📈 Visual Types:`);
            Object.entries(summary.visualTypes).forEach(([type, count]) => {
                console.log(`  • ${type}: ${count}`);
            });
        }
        
        if (!options.summary) {
            console.log(`\n📑 Pages Detail:`);
            for (const [pageName, page] of Object.entries(result.pages)) {
                const visualCount = Object.keys(page.visuals || {}).length;
                console.log(`  • ${pageName}: ${visualCount} visuals`);
                
                if (options.verbose && page.visuals) {
                    Object.entries(page.visuals).forEach(([visualName, visual]) => {
                        const type = visual.properties?.type || 'unknown';
                        const fields = (visual.fields?.measures?.length || 0) + (visual.fields?.dimensions?.length || 0);
                        const filters = visual.filters?.length || 0;
                        console.log(`    ◦ ${visualName} (${type}): ${fields} fields, ${filters} filters`);
                    });
                }
            }
        }
        
        // Save output if requested
        if (options.output) {
            const outputData = options.summary ? summary : result;
            fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
            console.log(`\n💾 Results saved to: ${options.output}`);
        }
        
        console.log('\n🎉 Analysis complete!');
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        if (options.verbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { EnhancedPBIRParser, SchemaValidator };