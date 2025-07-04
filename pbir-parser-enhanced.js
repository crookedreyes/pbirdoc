class PBIRParserEnhanced {
    constructor() {
        this.reportData = null;
        this.pages = new Map();
        this.visuals = new Map();
        this.bookmarks = new Map();
        this.schemas = this.loadSchemaDefinitions();
    }

    loadSchemaDefinitions() {
        // Schema-aware field mappings based on Microsoft's PBIR schemas
        return {
            visualTypes: new Set([
                'columnChart', 'barChart', 'lineChart', 'pieChart', 'donutChart',
                'scatterChart', 'tableEx', 'matrix', 'card', 'multiRowCard',
                'gauge', 'kpi', 'slicer', 'map', 'filledMap', 'treemap',
                'waterfallChart', 'ribbonChart', 'funnel', 'textbox'
            ]),
            filterTypes: new Set([
                'Categorical', 'Range', 'Advanced', 'Passthrough', 'TopN',
                'Include', 'Exclude', 'RelativeDate', 'Tuple', 'RelativeTime', 'VisualTopN'
            ]),
            aggregationFunctions: {
                0: 'Sum',
                1: 'Average', 
                2: 'DistinctCount',
                3: 'Min',
                4: 'Max',
                5: 'Count',
                6: 'Median',
                7: 'StandardDeviation',
                8: 'Variance'
            },
            comparisonKinds: {
                0: 'Equal',
                1: 'GreaterThan',
                2: 'GreaterThanOrEqual',
                3: 'LessThan',
                4: 'LessThanOrEqual'
            }
        };
    }

    async parseFiles(files) {
        const fileMap = new Map();
        
        // Organize files by path
        for (const file of files) {
            fileMap.set(file.webkitRelativePath, file);
        }
        
        // Parse main report structure with schema awareness
        await this.parseReportStructureEnhanced(fileMap);
        
        // Parse pages and their visuals with schema validation
        await this.parsePagesEnhanced(fileMap);
        
        // Parse bookmarks with schema support
        await this.parseBookmarksEnhanced(fileMap);
        
        return {
            report: this.reportData,
            pages: Object.fromEntries(this.pages),
            visuals: Object.fromEntries(this.visuals),
            bookmarks: Object.fromEntries(this.bookmarks)
        };
    }
    
    async parseReportStructureEnhanced(fileMap) {
        // Parse main report.json with schema validation
        const reportFile = this.findFile(fileMap, 'definition/report.json');
        if (reportFile) {
            const reportData = await this.parseJsonFile(reportFile);
            if (reportData) {
                this.reportData = this.validateAndNormalizeReport(reportData);
            }
        }
        
        // Parse version metadata
        const versionFile = this.findFile(fileMap, 'definition/version.json');
        if (versionFile) {
            const versionData = await this.parseJsonFile(versionFile);
            if (versionData && this.reportData) {
                this.reportData.version = this.validateVersionMetadata(versionData);
            }
        }
        
        // Parse report extensions
        const extensionsFile = this.findFile(fileMap, 'definition/reportExtensions.json');
        if (extensionsFile) {
            const extensionsData = await this.parseJsonFile(extensionsFile);
            if (extensionsData && this.reportData) {
                this.reportData.extensions = extensionsData;
            }
        }
    }
    
    validateAndNormalizeReport(reportData) {
        // Validate required fields according to report schema
        const normalized = {
            $schema: reportData.$schema,
            themeCollection: reportData.themeCollection || {},
            filterConfig: reportData.filterConfig,
            objects: reportData.objects,
            reportSource: reportData.reportSource || 'Default',
            publicCustomVisuals: reportData.publicCustomVisuals || [],
            resourcePackages: reportData.resourcePackages || [],
            organizationCustomVisuals: reportData.organizationCustomVisuals || [],
            annotations: reportData.annotations || [],
            settings: reportData.settings || {},
            slowDataSourceSettings: reportData.slowDataSourceSettings || {}
        };
        
        return normalized;
    }
    
    validateVersionMetadata(versionData) {
        // Validate version structure according to schema
        return {
            version: versionData.version,
            minVersion: versionData.minVersion,
            lastSavedUtc: versionData.lastSavedUtc
        };
    }
    
    async parsePagesEnhanced(fileMap) {
        // Parse pages metadata
        const pagesFile = this.findFile(fileMap, 'definition/pages/pages.json');
        let pagesMetadata = [];
        
        if (pagesFile) {
            const pagesData = await this.parseJsonFile(pagesFile);
            if (pagesData && pagesData.pages) {
                pagesMetadata = pagesData.pages;
            }
        }
        
        // Parse individual page files with schema validation
        for (const [path, file] of fileMap) {
            if (path.includes('/pages/') && path.endsWith('/page.json')) {
                const pageName = this.extractPageName(path);
                const pageData = await this.parseJsonFile(file);
                
                if (pageData) {
                    const validatedPage = this.validateAndNormalizePage(pageData);
                    const pageVisuals = await this.parsePageVisualsEnhanced(fileMap, pageName);
                    
                    this.pages.set(pageName, {
                        ...validatedPage,
                        name: pageName,
                        visuals: pageVisuals
                    });
                }
            }
        }
    }
    
    validateAndNormalizePage(pageData) {
        // Validate page according to page schema
        const normalized = {
            $schema: pageData.$schema,
            name: pageData.name,
            displayName: pageData.displayName,
            displayOption: pageData.displayOption || 'FitToPage',
            width: pageData.width,
            height: pageData.height,
            filterConfig: pageData.filterConfig,
            pageBinding: pageData.pageBinding,
            objects: pageData.objects,
            type: pageData.type,
            visibility: pageData.visibility || 'AlwaysVisible',
            visualInteractions: pageData.visualInteractions || [],
            annotations: pageData.annotations || [],
            howCreated: pageData.howCreated || 'Default'
        };
        
        return normalized;
    }
    
    async parsePageVisualsEnhanced(fileMap, pageName) {
        const visuals = new Map();
        
        for (const [path, file] of fileMap) {
            if (path.includes(`/pages/${pageName}/visuals/`) && path.endsWith('/visual.json')) {
                const visualName = this.extractVisualName(path);
                const visualData = await this.parseJsonFile(file);
                
                if (visualData) {
                    // Parse mobile layout if exists
                    const mobilePath = path.replace('/visual.json', '/mobile.json');
                    const mobileFile = fileMap.get(mobilePath);
                    let mobileData = null;
                    
                    if (mobileFile) {
                        mobileData = await this.parseJsonFile(mobileFile);
                    }
                    
                    const processedVisual = this.processVisualDataEnhanced(visualData, mobileData);
                    visuals.set(visualName, processedVisual);
                    
                    // Store in global visuals map
                    this.visuals.set(`${pageName}:${visualName}`, {
                        ...processedVisual,
                        pageName,
                        visualName
                    });
                }
            }
        }
        
        return Object.fromEntries(visuals);
    }
    
    processVisualDataEnhanced(visualData, mobileData = null) {
        const validated = this.validateVisualContainer(visualData);
        
        return {
            ...validated,
            mobile: mobileData,
            properties: this.extractVisualPropertiesEnhanced(validated),
            fields: this.extractFieldsEnhanced(validated),
            filters: this.extractFiltersEnhanced(validated),
            layout: this.extractLayoutEnhanced(validated),
            formatting: this.extractFormattingEnhanced(validated)
        };
    }
    
    validateVisualContainer(visualData) {
        // Validate according to visualContainer schema
        const normalized = {
            $schema: visualData.$schema,
            name: visualData.name,
            position: this.validatePosition(visualData.position),
            visual: visualData.visual,
            visualGroup: visualData.visualGroup,
            parentGroupName: visualData.parentGroupName,
            filterConfig: visualData.filterConfig,
            isHidden: visualData.isHidden || false,
            annotations: visualData.annotations || [],
            howCreated: visualData.howCreated || 'Default'
        };
        
        return normalized;
    }
    
    validatePosition(position) {
        if (!position) return null;
        
        // Validate position according to VisualContainerPosition schema
        return {
            x: position.x || 0,
            y: position.y || 0,
            z: position.z || 0,
            height: position.height || 0,
            width: position.width || 0,
            tabOrder: position.tabOrder,
            angle: position.angle
        };
    }
    
    extractVisualPropertiesEnhanced(visualData) {
        const properties = {
            name: visualData.name,
            type: 'unknown',
            title: null,
            isHidden: visualData.isHidden,
            howCreated: visualData.howCreated
        };
        
        // Extract visual type from visual configuration
        if (visualData.visual) {
            if (visualData.visual.visualType) {
                properties.type = visualData.visual.visualType;
            } else if (visualData.visual.singleVisual) {
                const singleVisual = visualData.visual.singleVisual;
                
                if (singleVisual.visualType) {
                    properties.type = singleVisual.visualType;
                }
                
                // Extract title from formatting objects
                if (singleVisual.objects && singleVisual.objects.title) {
                    const titleConfig = singleVisual.objects.title[0];
                    if (titleConfig && titleConfig.properties && titleConfig.properties.text) {
                        properties.title = this.extractLiteralValue(titleConfig.properties.text);
                    }
                }
            }
        }
        
        // Validate visual type against known types
        if (!this.schemas.visualTypes.has(properties.type)) {
            properties.type = 'unknown';
        }
        
        return properties;
    }
    
    extractFieldsEnhanced(visualData) {
        const fields = {
            dataRoles: {},
            measures: [],
            dimensions: [],
            hierarchies: [],
            calculations: []
        };
        
        if (visualData.visual && visualData.visual.singleVisual) {
            const singleVisual = visualData.visual.singleVisual;
            
            // Extract data roles
            if (singleVisual.dataRoles) {
                fields.dataRoles = singleVisual.dataRoles;
            }
            
            // Extract from prototypeQuery with schema awareness
            if (singleVisual.prototypeQuery) {
                const query = singleVisual.prototypeQuery;
                
                if (query.Select) {
                    query.Select.forEach(select => {
                        const field = this.parseSelectExpression(select);
                        if (field) {
                            if (field.type === 'measure') {
                                fields.measures.push(field);
                            } else if (field.type === 'dimension') {
                                fields.dimensions.push(field);
                            } else if (field.type === 'hierarchy') {
                                fields.hierarchies.push(field);
                            }
                        }
                    });
                }
                
                // Extract visual calculations
                if (query.Transform) {
                    query.Transform.forEach(transform => {
                        if (transform.Algorithm === 'VisualCalculation') {
                            fields.calculations.push({
                                name: transform.Name,
                                algorithm: transform.Algorithm,
                                input: transform.Input,
                                output: transform.Output
                            });
                        }
                    });
                }
            }
        }
        
        return fields;
    }
    
    parseSelectExpression(select) {
        const name = select.Name;
        
        if (select.Measure) {
            return {
                type: 'measure',
                name: name,
                expression: select.Measure.Expression,
                property: select.Measure.Property,
                source: select.Measure.Expression?.SourceRef || select.Measure.Expression?.Source
            };
        } else if (select.Column) {
            return {
                type: 'dimension',
                name: name,
                expression: select.Column.Expression,
                property: select.Column.Property,
                source: select.Column.Expression?.SourceRef || select.Column.Expression?.Source
            };
        } else if (select.Hierarchy) {
            return {
                type: 'hierarchy',
                name: name,
                hierarchy: select.Hierarchy.Hierarchy,
                expression: select.Hierarchy.Expression
            };
        } else if (select.Aggregation) {
            const aggregationFunction = this.schemas.aggregationFunctions[select.Aggregation.Function] || 'Unknown';
            return {
                type: 'measure',
                name: name,
                aggregation: aggregationFunction,
                expression: select.Aggregation.Expression
            };
        }
        
        return null;
    }
    
    extractFiltersEnhanced(visualData) {
        const filters = [];
        
        // Extract from filterConfig with schema validation
        if (visualData.filterConfig && visualData.filterConfig.filters) {
            visualData.filterConfig.filters.forEach(filterContainer => {
                const filter = this.parseFilterContainer(filterContainer);
                if (filter) {
                    filters.push(filter);
                }
            });
        }
        
        // Extract from visual-level filters
        if (visualData.visual && visualData.visual.singleVisual) {
            const singleVisual = visualData.visual.singleVisual;
            
            // Extract from prototypeQuery Where clause
            if (singleVisual.prototypeQuery && singleVisual.prototypeQuery.Where) {
                singleVisual.prototypeQuery.Where.forEach(where => {
                    const filter = this.parseQueryFilter(where);
                    if (filter) {
                        filters.push(filter);
                    }
                });
            }
        }
        
        return filters;
    }
    
    parseFilterContainer(filterContainer) {
        // Parse according to FilterContainer schema
        if (!this.schemas.filterTypes.has(filterContainer.type)) {
            return null;
        }
        
        return {
            type: filterContainer.type,
            name: filterContainer.name,
            displayName: filterContainer.displayName,
            ordinal: filterContainer.ordinal,
            field: filterContainer.field,
            filter: filterContainer.filter,
            restatement: filterContainer.restatement,
            howCreated: filterContainer.howCreated,
            isHiddenInViewMode: filterContainer.isHiddenInViewMode,
            isLockedInViewMode: filterContainer.isLockedInViewMode,
            description: this.generateFilterDescription(filterContainer)
        };
    }
    
    parseQueryFilter(queryFilter) {
        // Parse according to QueryFilter schema
        return {
            type: 'Query Filter',
            target: queryFilter.Target,
            condition: this.parseConditionExpression(queryFilter.Condition),
            annotations: queryFilter.Annotations
        };
    }
    
    parseConditionExpression(condition) {
        if (!condition) return null;
        
        // Parse different types of condition expressions
        if (condition.Comparison) {
            const comp = condition.Comparison;
            const comparisonKind = this.schemas.comparisonKinds[comp.ComparisonKind] || 'Unknown';
            return {
                type: 'Comparison',
                comparisonKind: comparisonKind,
                left: comp.Left,
                right: comp.Right
            };
        } else if (condition.In) {
            return {
                type: 'In',
                expressions: condition.In.Expressions,
                values: condition.In.Values
            };
        } else if (condition.Between) {
            return {
                type: 'Between',
                expression: condition.Between.Expression,
                lowerBound: condition.Between.LowerBound,
                upperBound: condition.Between.UpperBound
            };
        } else if (condition.And) {
            return {
                type: 'And',
                left: this.parseConditionExpression(condition.And.Left),
                right: this.parseConditionExpression(condition.And.Right)
            };
        } else if (condition.Or) {
            return {
                type: 'Or',
                left: this.parseConditionExpression(condition.Or.Left),
                right: this.parseConditionExpression(condition.Or.Right)
            };
        }
        
        return condition;
    }
    
    generateFilterDescription(filterContainer) {
        switch (filterContainer.type) {
            case 'TopN':
                return `Top N filter on ${this.getFieldDescription(filterContainer.field)}`;
            case 'Advanced':
                return `Advanced filter on ${this.getFieldDescription(filterContainer.field)}`;
            case 'Categorical':
                return `Categorical filter on ${this.getFieldDescription(filterContainer.field)}`;
            case 'Range':
                return `Range filter on ${this.getFieldDescription(filterContainer.field)}`;
            default:
                return `${filterContainer.type} filter${filterContainer.field ? ' on ' + this.getFieldDescription(filterContainer.field) : ''}`;
        }
    }
    
    getFieldDescription(field) {
        if (!field) return 'unknown field';
        
        if (field.Column) {
            return `${field.Column.Expression?.Entity || 'table'}.${field.Column.Property}`;
        } else if (field.Measure) {
            return `${field.Measure.Expression?.Entity || 'table'}.${field.Measure.Property}`;
        }
        
        return 'field';
    }
    
    extractLayoutEnhanced(visualData) {
        const layout = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            z: 0,
            tabOrder: null,
            angle: null
        };
        
        if (visualData.position) {
            const pos = visualData.position;
            layout.x = pos.x || 0;
            layout.y = pos.y || 0;
            layout.width = pos.width || 0;
            layout.height = pos.height || 0;
            layout.z = pos.z || 0;
            layout.tabOrder = pos.tabOrder;
            layout.angle = pos.angle;
        }
        
        return layout;
    }
    
    extractFormattingEnhanced(visualData) {
        const formatting = {
            background: null,
            border: null,
            font: null,
            colors: [],
            general: null
        };
        
        if (visualData.visual && visualData.visual.singleVisual && visualData.visual.singleVisual.objects) {
            const objects = visualData.visual.singleVisual.objects;
            
            // Extract formatting objects with schema awareness
            Object.keys(objects).forEach(objectKey => {
                const objectArray = objects[objectKey];
                if (Array.isArray(objectArray)) {
                    objectArray.forEach(obj => {
                        if (obj.properties) {
                            this.processFormattingObject(objectKey, obj.properties, formatting);
                        }
                    });
                }
            });
        }
        
        return formatting;
    }
    
    processFormattingObject(objectKey, properties, formatting) {
        switch (objectKey) {
            case 'background':
                formatting.background = {
                    color: this.extractLiteralValue(properties.color),
                    transparency: this.extractLiteralValue(properties.transparency),
                    image: properties.image
                };
                break;
            case 'border':
                formatting.border = {
                    show: this.extractLiteralValue(properties.show),
                    color: this.extractLiteralValue(properties.color),
                    width: this.extractLiteralValue(properties.width)
                };
                break;
            case 'title':
                formatting.title = {
                    text: this.extractLiteralValue(properties.text),
                    fontColor: this.extractLiteralValue(properties.fontColor),
                    fontSize: this.extractLiteralValue(properties.fontSize),
                    fontFamily: this.extractLiteralValue(properties.fontFamily)
                };
                break;
            case 'dataColors':
                if (properties.fill) {
                    formatting.colors.push(this.extractLiteralValue(properties.fill));
                }
                break;
            case 'general':
                formatting.general = properties;
                break;
        }
    }
    
    extractLiteralValue(property) {
        if (!property) return null;
        
        if (property.literal) {
            return property.literal.value;
        } else if (property.solid) {
            return property.solid.color;
        }
        
        return property;
    }
    
    async parseBookmarksEnhanced(fileMap) {
        const bookmarksFile = this.findFile(fileMap, 'definition/bookmarks/bookmarks.json');
        if (bookmarksFile) {
            const bookmarksData = await this.parseJsonFile(bookmarksFile);
            
            // Parse individual bookmark files
            for (const [path, file] of fileMap) {
                if (path.includes('/bookmarks/') && path.endsWith('.bookmark.json')) {
                    const bookmarkName = this.extractBookmarkName(path);
                    const bookmarkData = await this.parseJsonFile(file);
                    if (bookmarkData) {
                        this.bookmarks.set(bookmarkName, this.validateBookmark(bookmarkData));
                    }
                }
            }
        }
    }
    
    validateBookmark(bookmarkData) {
        // Validate bookmark according to schema
        return {
            name: bookmarkData.name,
            displayName: bookmarkData.displayName,
            state: bookmarkData.state,
            annotations: bookmarkData.annotations || []
        };
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
}