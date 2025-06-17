class PBIRParser {
    constructor() {
        this.reportData = null;
        this.pages = new Map();
        this.visuals = new Map();
        this.bookmarks = new Map();
    }

    async parseFiles(files) {
        const fileMap = new Map();
        
        // Organize files by path
        for (const file of files) {
            fileMap.set(file.webkitRelativePath, file);
        }
        
        // Parse main report structure
        await this.parseReportStructure(fileMap);
        
        // Parse pages and their visuals
        await this.parsePages(fileMap);
        
        // Parse bookmarks if available
        await this.parseBookmarks(fileMap);
        
        return {
            report: this.reportData,
            pages: Object.fromEntries(this.pages),
            visuals: Object.fromEntries(this.visuals),
            bookmarks: Object.fromEntries(this.bookmarks)
        };
    }
    
    async parseReportStructure(fileMap) {
        // Parse main report.json
        const reportFile = this.findFile(fileMap, 'definition/report.json');
        if (reportFile) {
            this.reportData = await this.parseJsonFile(reportFile);
        }
        
        // Parse version info
        const versionFile = this.findFile(fileMap, 'definition/version.json');
        if (versionFile) {
            const versionData = await this.parseJsonFile(versionFile);
            this.reportData = { ...this.reportData, version: versionData };
        }
        
        // Parse report extensions
        const extensionsFile = this.findFile(fileMap, 'definition/reportExtensions.json');
        if (extensionsFile) {
            const extensionsData = await this.parseJsonFile(extensionsFile);
            this.reportData = { ...this.reportData, extensions: extensionsData };
        }
    }
    
    async parsePages(fileMap) {
        // Parse pages.json for page list
        const pagesFile = this.findFile(fileMap, 'definition/pages/pages.json');
        let pagesList = [];
        
        if (pagesFile) {
            const pagesData = await this.parseJsonFile(pagesFile);
            pagesList = pagesData.pages || [];
        }
        
        // Parse individual page files
        for (const [path, file] of fileMap) {
            if (path.includes('/pages/') && path.endsWith('/page.json')) {
                const pageName = this.extractPageName(path);
                const pageData = await this.parseJsonFile(file);
                
                // Parse visuals for this page
                const pageVisuals = await this.parsePageVisuals(fileMap, pageName);
                
                this.pages.set(pageName, {
                    ...pageData,
                    name: pageName,
                    visuals: pageVisuals
                });
            }
        }
    }
    
    async parsePageVisuals(fileMap, pageName) {
        const visuals = new Map();
        
        for (const [path, file] of fileMap) {
            if (path.includes(`/pages/${pageName}/visuals/`) && path.endsWith('/visual.json')) {
                const visualName = this.extractVisualName(path);
                const visualData = await this.parseJsonFile(file);
                
                // Parse mobile layout if exists
                const mobilePath = path.replace('/visual.json', '/mobile.json');
                const mobileFile = fileMap.get(mobilePath);
                let mobileData = null;
                
                if (mobileFile) {
                    mobileData = await this.parseJsonFile(mobileFile);
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
    
    async parseBookmarks(fileMap) {
        // Parse bookmarks.json
        const bookmarksFile = this.findFile(fileMap, 'definition/bookmarks/bookmarks.json');
        if (bookmarksFile) {
            const bookmarksData = await this.parseJsonFile(bookmarksFile);
            
            // Parse individual bookmark files
            for (const [path, file] of fileMap) {
                if (path.includes('/bookmarks/') && path.endsWith('.bookmark.json')) {
                    const bookmarkName = this.extractBookmarkName(path);
                    const bookmarkData = await this.parseJsonFile(file);
                    this.bookmarks.set(bookmarkName, bookmarkData);
                }
            }
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
        
        // PBIR format stores visual type in different locations
        if (visualData.visual) {
            // Check for visual type in the visual configuration
            if (visualData.visual.visualType) {
                properties.type = visualData.visual.visualType;
            } else if (visualData.visual.singleVisual && visualData.visual.singleVisual.visualType) {
                properties.type = visualData.visual.singleVisual.visualType;
            } else if (visualData.visual.singleVisual && visualData.visual.singleVisual.objects && visualData.visual.singleVisual.objects.general) {
                // Sometimes visual type is in general objects
                const general = visualData.visual.singleVisual.objects.general;
                if (general && general[0] && general[0].properties && general[0].properties.visualType) {
                    properties.type = general[0].properties.visualType.literal.value;
                }
            }
            
            // Extract title from visual configuration
            if (visualData.visual.singleVisual && visualData.visual.singleVisual.objects && visualData.visual.singleVisual.objects.title) {
                const titleObj = visualData.visual.singleVisual.objects.title;
                if (titleObj && titleObj[0] && titleObj[0].properties && titleObj[0].properties.text) {
                    properties.title = titleObj[0].properties.text.literal.value;
                }
            }
        }
        
        // Also check the root level for visual name
        if (visualData.name) {
            properties.name = visualData.name;
        }
        
        // Fallback to 'unknown' if no type found
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
        
        // Check for visual data in the correct PBIR structure
        if (visualData.visual && visualData.visual.singleVisual) {
            const singleVisual = visualData.visual.singleVisual;
            
            // Extract data roles
            if (singleVisual.dataRoles) {
                fields.dataRoles = singleVisual.dataRoles;
            }
            
            // Extract from prototypeQuery
            if (singleVisual.prototypeQuery) {
                const query = singleVisual.prototypeQuery;
                
                if (query.Select) {
                    query.Select.forEach(select => {
                        if (select.Measure) {
                            fields.measures.push({
                                name: select.Name,
                                expression: select.Measure.Expression,
                                column: select.Measure.Property
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
            
            // Also try to extract from vcObjects (visual container objects)
            if (singleVisual.vcObjects) {
                // Parse data roles from visual container objects
                Object.keys(singleVisual.vcObjects).forEach(key => {
                    const obj = singleVisual.vcObjects[key];
                    if (obj && obj.dataRoles) {
                        Object.assign(fields.dataRoles, obj.dataRoles);
                    }
                });
            }
        }
        
        return fields;
    }
    
    extractFilters(visualData) {
        const filters = [];
        
        // Check filters at the root level
        if (visualData.filters) {
            visualData.filters.forEach(filter => {
                const filterInfo = this.parseFilterExpression(filter);
                filters.push(filterInfo);
            });
        }
        
        // Check filters in visual configuration
        if (visualData.visual && visualData.visual.singleVisual) {
            const singleVisual = visualData.visual.singleVisual;
            
            // Extract from prototypeQuery Where clause
            if (singleVisual.prototypeQuery && singleVisual.prototypeQuery.Where) {
                singleVisual.prototypeQuery.Where.forEach(where => {
                    filters.push({
                        type: 'Query Filter',
                        condition: where.Condition,
                        expression: this.formatExpression(where.Expression),
                        raw: where
                    });
                });
            }
            
            // Extract from objects (visual-level filters)
            if (singleVisual.objects) {
                Object.keys(singleVisual.objects).forEach(objectKey => {
                    const objectArray = singleVisual.objects[objectKey];
                    if (Array.isArray(objectArray)) {
                        objectArray.forEach(obj => {
                            if (obj.properties) {
                                Object.keys(obj.properties).forEach(propKey => {
                                    const prop = obj.properties[propKey];
                                    if (this.isFilterProperty(propKey, prop)) {
                                        filters.push({
                                            type: 'Visual Property Filter',
                                            object: objectKey,
                                            property: propKey,
                                            value: this.formatPropertyValue(prop),
                                            raw: prop
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
        
        // Check for filterConfig at the container level
        if (visualData.filterConfig) {
            const filterConfigInfo = this.parseFilterConfig(visualData.filterConfig);
            if (Array.isArray(filterConfigInfo)) {
                // If it returned an array of filters, add them all
                filters.push(...filterConfigInfo);
            } else {
                // If it returned a single filter object, add it
                filters.push(filterConfigInfo);
            }
        }
        
        return filters;
    }
    
    parseFilterExpression(filter) {
        // Handle TopN/BottomN filters
        if (filter.type === 'TopN' || filter.type === 'BottomN') {
            const field = this.extractFieldName(filter.field);
            const topValue = this.extractTopNValue(filter.filter);
            return {
                type: `${filter.type} Filter`,
                description: `${filter.type} ${topValue}`,
                field: field,
                expression: `Show ${filter.type.toLowerCase()} ${topValue} by ${field}`
            };
        }
        
        // Handle Advanced filters
        if (filter.type === 'Advanced') {
            const field = this.extractFieldName(filter.field);
            return {
                type: 'Advanced Filter',
                field: field,
                description: `Advanced filter on ${field}`,
                expression: `Advanced filtering applied to ${field}`
            };
        }
        
        // Handle Basic filters
        if (filter.type === 'Basic') {
            const field = this.extractFieldName(filter.field);
            return {
                type: 'Basic Filter',
                field: field,
                description: `Basic filter on ${field}`,
                expression: `Basic filtering applied to ${field}`
            };
        }
        
        // Handle other filter types
        if (filter.expression && filter.filter) {
            return {
                type: 'Expression Filter',
                expression: this.formatExpression(filter.expression),
                filter: this.formatFilterObject(filter.filter),
                raw: filter
            };
        } else if (filter.expression) {
            return {
                type: 'Expression Filter',
                expression: this.formatExpression(filter.expression),
                raw: filter
            };
        } else {
            return {
                type: 'Unknown Filter',
                description: JSON.stringify(filter, null, 2),
                raw: filter
            };
        }
    }
    
    extractFieldName(field) {
        if (field && field.Column && field.Column.Property) {
            return field.Column.Property;
        } else if (field && field.Aggregation && field.Aggregation.Expression && field.Aggregation.Expression.Column) {
            const aggFunction = this.getAggregationFunction(field.Aggregation.Function);
            return `${aggFunction}(${field.Aggregation.Expression.Column.Property})`;
        } else if (typeof field === 'string') {
            return field;
        } else {
            return 'Unknown Field';
        }
    }
    
    getAggregationFunction(funcId) {
        const functions = {
            0: 'Sum',
            1: 'Average',
            2: 'Min',
            3: 'Max',
            4: 'Count',
            5: 'CountDistinct'
        };
        return functions[funcId] || 'Unknown';
    }
    
    extractTopNValue(filterObj) {
        try {
            if (filterObj && filterObj.From && filterObj.From[0] && filterObj.From[0].Expression && 
                filterObj.From[0].Expression.Subquery && filterObj.From[0].Expression.Subquery.Query && 
                filterObj.From[0].Expression.Subquery.Query.Top) {
                return filterObj.From[0].Expression.Subquery.Query.Top;
            }
        } catch (e) {
            // Ignore parsing errors
        }
        return 'N';
    }
    
    parseFilterConfig(filterConfig) {
        const formatted = this.formatFilterConfig(filterConfig);
        
        // If formatFilterConfig returned an array of parsed filters, return them directly
        if (Array.isArray(formatted)) {
            return formatted;
        }
        
        return {
            type: 'Visual Filter Config',
            description: formatted,
            raw: filterConfig
        };
    }
    
    formatExpression(expression) {
        if (typeof expression === 'string') {
            return expression;
        } else if (expression && expression.Column) {
            return `${expression.Column.Expression}.${expression.Column.Property}`;
        } else if (expression && expression.Aggregation) {
            return `${expression.Aggregation.Expression} (${expression.Aggregation.Function})`;
        } else if (expression && expression.Literal) {
            return expression.Literal.Value;
        } else {
            return JSON.stringify(expression);
        }
    }
    
    formatFilterObject(filterObj) {
        if (filterObj.In && filterObj.In.Expressions) {
            const values = filterObj.In.Expressions.map(expr => this.formatExpression(expr));
            return `IN (${values.join(', ')})`;
        } else if (filterObj.Between) {
            return `BETWEEN ${this.formatExpression(filterObj.Between.LowerBound)} AND ${this.formatExpression(filterObj.Between.UpperBound)}`;
        } else if (filterObj.And) {
            const conditions = filterObj.And.map(cond => this.formatFilterObject(cond));
            return `(${conditions.join(' AND ')})`;
        } else if (filterObj.Or) {
            const conditions = filterObj.Or.map(cond => this.formatFilterObject(cond));
            return `(${conditions.join(' OR ')})`;
        } else if (filterObj.Not) {
            return `NOT (${this.formatFilterObject(filterObj.Not)})`;
        } else if (filterObj.Comparison) {
            return `${filterObj.Comparison.ComparisonKind} ${this.formatExpression(filterObj.Comparison.Right)}`;
        } else {
            return JSON.stringify(filterObj);
        }
    }
    
    formatFilterConfig(config) {
        if (config.filters && Array.isArray(config.filters)) {
            return config.filters.map(f => this.parseFilterExpression(f)).join('; ');
        } else if (config.expression) {
            return this.formatExpression(config.expression);
        } else if (typeof config === 'string') {
            // Handle semicolon-separated filter strings
            const filterStrings = config.split(';').map(s => s.trim()).filter(s => s);
            return filterStrings.map(filterStr => {
                try {
                    const filterObj = JSON.parse(filterStr);
                    return this.parseFilterExpression(filterObj);
                } catch (e) {
                    return {
                        type: 'String Filter',
                        description: filterStr,
                        expression: filterStr
                    };
                }
            });
        } else {
            return JSON.stringify(config);
        }
    }
    
    isFilterProperty(propKey, prop) {
        // Common filter-related properties in Power BI visuals
        const filterProps = ['filter', 'where', 'condition', 'filterType', 'advanced', 'basic'];
        return filterProps.some(fp => propKey.toLowerCase().includes(fp.toLowerCase()));
    }
    
    formatPropertyValue(prop) {
        if (prop.literal) {
            return prop.literal.value;
        } else if (prop.expression) {
            return this.formatExpression(prop.expression);
        } else {
            return JSON.stringify(prop);
        }
    }
    
    extractLayout(visualData) {
        const layout = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            zIndex: 0
        };
        
        // Check for position property (PBIR format)
        if (visualData.position) {
            layout.x = visualData.position.x || 0;
            layout.y = visualData.position.y || 0;
            layout.width = visualData.position.width || 0;
            layout.height = visualData.position.height || 0;
            layout.zIndex = visualData.position.z || 0;
        }
        
        // Fallback to direct properties
        if (visualData.x !== undefined) layout.x = visualData.x;
        if (visualData.y !== undefined) layout.y = visualData.y;
        if (visualData.width !== undefined) layout.width = visualData.width;
        if (visualData.height !== undefined) layout.height = visualData.height;
        if (visualData.z !== undefined) layout.zIndex = visualData.z;
        
        return layout;
    }
    
    extractFormatting(visualData) {
        const formatting = {
            background: null,
            border: null,
            font: null,
            colors: []
        };
        
        // Check for visual formatting in the correct PBIR structure
        if (visualData.visual && visualData.visual.singleVisual && visualData.visual.singleVisual.objects) {
            const objects = visualData.visual.singleVisual.objects;
            
            // Extract background formatting
            if (objects.background) {
                formatting.background = {
                    color: objects.background[0]?.properties?.color?.solid?.color,
                    transparency: objects.background[0]?.properties?.transparency?.literal?.value
                };
            }
            
            // Extract border formatting
            if (objects.border) {
                formatting.border = {
                    color: objects.border[0]?.properties?.color?.solid?.color,
                    show: objects.border[0]?.properties?.show?.literal?.value
                };
            }
            
            // Extract color palette
            if (objects.dataColors) {
                objects.dataColors.forEach(colorObj => {
                    if (colorObj.properties && colorObj.properties.fill) {
                        formatting.colors.push(colorObj.properties.fill.solid.color);
                    }
                });
            }
            
            // Extract font formatting
            if (objects.title && objects.title[0] && objects.title[0].properties) {
                const titleProps = objects.title[0].properties;
                formatting.font = {
                    fontFamily: titleProps.fontFamily?.literal?.value,
                    fontSize: titleProps.fontSize?.literal?.value,
                    fontColor: titleProps.fontColor?.solid?.color
                };
            }
        }
        
        return formatting;
    }
    
    async parseJsonFile(file) {
        try {
            const text = await file.text();
            return JSON.parse(text);
        } catch (error) {
            console.error(`Error parsing JSON file ${file.name}:`, error);
            return null;
        }
    }
    
    findFile(fileMap, relativePath) {
        for (const [path, file] of fileMap) {
            if (path.endsWith(relativePath)) {
                return file;
            }
        }
        return null;
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
        return {
            totalPages: this.pages.size,
            totalVisuals: this.visuals.size,
            totalBookmarks: this.bookmarks.size,
            visualTypes: this.getVisualTypesSummary(),
            reportInfo: this.reportData
        };
    }
    
    getVisualTypesSummary() {
        const types = new Map();
        
        for (const [key, visual] of this.visuals) {
            const type = visual.properties?.type || 'unknown';
            types.set(type, (types.get(type) || 0) + 1);
        }
        
        return Object.fromEntries(types);
    }
    
    getPageVisuals(pageName) {
        const page = this.pages.get(pageName);
        return page ? page.visuals : {};
    }
    
    getVisualDetails(pageName, visualName) {
        return this.visuals.get(`${pageName}:${visualName}`);
    }
    
    // Debug function to help troubleshoot parsing issues
    debugVisualStructure(visualData) {
        console.log('Visual Data Structure:', {
            hasVisual: !!visualData.visual,
            hasSingleVisual: !!(visualData.visual && visualData.visual.singleVisual),
            hasPosition: !!visualData.position,
            hasName: !!visualData.name,
            visualType: visualData.visual?.visualType || 'not found',
            singleVisualType: visualData.visual?.singleVisual?.visualType || 'not found',
            positionKeys: visualData.position ? Object.keys(visualData.position) : 'no position',
            rootKeys: Object.keys(visualData)
        });
        return visualData;
    }
}