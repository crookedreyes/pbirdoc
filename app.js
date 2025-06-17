class PowerBIApp {
    constructor() {
        this.parser = new PBIRParser();
        this.renderer = new LayoutRenderer('layout-canvas');
        this.currentPage = null;
        this.reportData = null;
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // File upload handler
        document.getElementById('pbir-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });
        
        // Visual selection handler
        document.addEventListener('visualSelected', (e) => {
            this.handleVisualSelection(e.detail);
        });
        
        // Page navigation handler
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-item')) {
                this.switchPage(e.target.dataset.pageName);
            }
        });
    }
    
    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) {
            return;
        }
        
        this.showLoading('Parsing PBIR files...');
        
        try {
            this.reportData = await this.parser.parseFiles(files);
            this.displayReportOverview();
            this.setupPageNavigation();
            this.showReportSections();
            
            // Load first page by default
            const firstPageName = Object.keys(this.reportData.pages)[0];
            if (firstPageName) {
                this.switchPage(firstPageName);
            }
            
        } catch (error) {
            console.error('Error parsing PBIR files:', error);
            this.showError('Error parsing PBIR files. Please ensure you selected a valid Power BI project folder.');
        } finally {
            this.hideLoading();
        }
    }
    
    displayReportOverview() {
        const summary = this.parser.getReportSummary();
        const metadataDiv = document.getElementById('report-metadata');
        
        metadataDiv.innerHTML = `
            <div class="metadata-grid">
                <div class="metadata-item">
                    <h4>📄 Pages</h4>
                    <span>${summary.totalPages}</span>
                </div>
                <div class="metadata-item">
                    <h4>📊 Visuals</h4>
                    <span>${summary.totalVisuals}</span>
                </div>
                <div class="metadata-item">
                    <h4>🔖 Bookmarks</h4>
                    <span>${summary.totalBookmarks}</span>
                </div>
            </div>
            
            <div class="visual-types-summary">
                <h4>Visual Types Used</h4>
                <div class="visual-types-list">
                    ${Object.entries(summary.visualTypes).map(([type, count]) => 
                        `<span class="visual-type-badge">${type} (${count})</span>`
                    ).join('')}
                </div>
            </div>
            
            ${summary.reportInfo ? `
                <div class="report-details">
                    <h4>Report Information</h4>
                    <div class="report-info">
                        ${summary.reportInfo.version ? `<p><strong>Version:</strong> ${JSON.stringify(summary.reportInfo.version)}</p>` : ''}
                        ${summary.reportInfo.name ? `<p><strong>Name:</strong> ${summary.reportInfo.name}</p>` : ''}
                    </div>
                </div>
            ` : ''}
        `;
    }
    
    setupPageNavigation() {
        const pagesList = document.getElementById('pages-list');
        pagesList.innerHTML = '';
        
        Object.keys(this.reportData.pages).forEach(pageName => {
            const pageItem = document.createElement('li');
            pageItem.className = 'page-item';
            pageItem.dataset.pageName = pageName;
            pageItem.textContent = pageName;
            pagesList.appendChild(pageItem);
        });
    }
    
    switchPage(pageName) {
        // Update navigation
        document.querySelectorAll('.page-item').forEach(item => {
            item.classList.toggle('active', item.dataset.pageName === pageName);
        });
        
        // Load page data
        this.currentPage = pageName;
        const pageData = this.reportData.pages[pageName];
        
        if (pageData) {
            this.renderer.renderPage(pageData);
            this.displayPageInfo(pageData);
        }
    }
    
    displayPageInfo(pageData) {
        const visualInfo = document.getElementById('visual-info');
        
        if (!pageData.visuals || Object.keys(pageData.visuals).length === 0) {
            visualInfo.innerHTML = '<p>No visuals on this page</p>';
            return;
        }
        
        const visualCount = Object.keys(pageData.visuals).length;
        visualInfo.innerHTML = `
            <div class="page-summary">
                <h4>Page Overview</h4>
                <p><strong>Visuals:</strong> ${visualCount}</p>
            </div>
            
            <div class="visuals-list">
                <h4>Visuals on Page</h4>
                ${Object.entries(pageData.visuals).map(([name, visual]) => `
                    <div class="visual-item" data-visual-name="${name}">
                        <div class="visual-header">
                            <span class="visual-name">${name}</span>
                            <span class="visual-type">${visual.properties?.type || 'unknown'}</span>
                        </div>
                        <div class="visual-metrics">
                            <small>Position: ${visual.layout?.x || 0}, ${visual.layout?.y || 0}</small>
                            <small>Size: ${visual.layout?.width || 0} × ${visual.layout?.height || 0}</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add click handlers for visual items
        visualInfo.querySelectorAll('.visual-item').forEach(item => {
            item.addEventListener('click', () => {
                const visualName = item.dataset.visualName;
                this.renderer.highlightVisual(visualName);
            });
        });
    }
    
    handleVisualSelection(visualData) {
        const visualInfo = document.getElementById('visual-info');
        
        if (!visualData) {
            this.displayPageInfo(this.reportData.pages[this.currentPage]);
            return;
        }
        
        visualInfo.innerHTML = this.generateVisualDetailsHTML(visualData);
    }
    
    generateVisualDetailsHTML(visualData) {
        const { name, data } = visualData;
        const properties = data.properties || {};
        const layout = data.layout || {};
        const fields = data.fields || {};
        const filters = data.filters || [];
        const formatting = data.formatting || {};
        
        return `
            <div class="selected-visual">
                <div class="visual-header">
                    <h4>${name}</h4>
                    <span class="visual-type">${properties.type || 'unknown'}</span>
                </div>
                
                <div class="visual-section">
                    <h5>📐 Layout</h5>
                    <ul class="property-list">
                        <li><span class="property-name">Position:</span> <span class="property-value">${layout.x || 0}, ${layout.y || 0}</span></li>
                        <li><span class="property-name">Size:</span> <span class="property-value">${layout.width || 0} × ${layout.height || 0}</span></li>
                        <li><span class="property-name">Z-Index:</span> <span class="property-value">${layout.zIndex || 0}</span></li>
                    </ul>
                </div>
                
                ${fields.measures && fields.measures.length > 0 ? `
                    <div class="visual-section">
                        <h5>📏 Measures (${fields.measures.length})</h5>
                        <ul class="property-list">
                            ${fields.measures.map(measure => `
                                <li><span class="property-name">${measure.name}:</span> <span class="property-value">${measure.expression || measure.column}</span></li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${fields.dimensions && fields.dimensions.length > 0 ? `
                    <div class="visual-section">
                        <h5>📊 Dimensions (${fields.dimensions.length})</h5>
                        <ul class="property-list">
                            ${fields.dimensions.map(dimension => `
                                <li><span class="property-name">${dimension.name}:</span> <span class="property-value">${dimension.expression || dimension.property}</span></li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${filters.length > 0 ? `
                    <div class="visual-section">
                        <h5>🔍 Filters (${filters.length})</h5>
                        <div class="filters-list">
                            ${filters.map((filter, index) => `
                                <div class="filter-item">
                                    <div class="filter-header">
                                        <span class="filter-type">${filter.type || 'Filter'}</span>
                                    </div>
                                    <div class="filter-details">
                                        ${filter.description ? `<div class="filter-description">${filter.description}</div>` : ''}
                                        ${filter.field ? `<div class="filter-field"><strong>Field:</strong> ${filter.field}</div>` : ''}
                                        ${filter.expression && !filter.description ? `<div class="filter-expression"><strong>Expression:</strong> ${filter.expression}</div>` : ''}
                                        ${filter.filter && !filter.description ? `<div class="filter-condition"><strong>Condition:</strong> ${filter.filter}</div>` : ''}
                                        ${filter.condition && !filter.description ? `<div class="filter-condition"><strong>Condition:</strong> ${filter.condition}</div>` : ''}
                                        ${filter.value ? `<div class="filter-value"><strong>Value:</strong> ${filter.value}</div>` : ''}
                                        ${filter.object && filter.property ? `<div class="filter-property"><strong>Property:</strong> ${filter.object}.${filter.property}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${formatting.colors && formatting.colors.length > 0 ? `
                    <div class="visual-section">
                        <h5>🎨 Colors</h5>
                        <div class="color-palette">
                            ${formatting.colors.map(color => `
                                <div class="color-swatch" style="background-color: ${color}" title="${color}"></div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${formatting.background || formatting.border ? `
                    <div class="visual-section">
                        <h5>🎨 Formatting</h5>
                        <ul class="property-list">
                            ${formatting.background && formatting.background.color ? `
                                <li><span class="property-name">Background:</span> <span class="property-value">${formatting.background.color}</span></li>
                            ` : ''}
                            ${formatting.border && formatting.border.color ? `
                                <li><span class="property-name">Border:</span> <span class="property-value">${formatting.border.color}</span></li>
                            ` : ''}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="visual-actions">
                    <button onclick="app.exportVisualInfo('${name}')">Export Info</button>
                </div>
            </div>
        `;
    }
    
    showReportSections() {
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('report-info').classList.remove('hidden');
        document.getElementById('pages-section').classList.remove('hidden');
    }
    
    showLoading(message) {
        // You can implement a loading overlay here
        console.log('Loading:', message);
    }
    
    hideLoading() {
        // Hide loading overlay
        console.log('Loading complete');
    }
    
    showError(message) {
        alert(message);
    }
    
    exportVisualInfo(visualName) {
        const visualData = this.parser.getVisualDetails(this.currentPage, visualName);
        if (visualData) {
            const dataStr = JSON.stringify(visualData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `${visualName}_details.json`;
            link.click();
        }
    }
    
    exportReportSummary() {
        const summary = this.parser.getReportSummary();
        const dataStr = JSON.stringify(summary, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'report_summary.json';
        link.click();
    }
}

// Initialize the application
const app = new PowerBIApp();

// Add some additional CSS for the new features
const additionalStyles = `
    .metadata-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .metadata-item {
        text-align: center;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #f7931e;
    }
    
    .metadata-item h4 {
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        color: #666;
    }
    
    .metadata-item span {
        font-size: 1.5rem;
        font-weight: bold;
        color: #333;
    }
    
    .visual-types-summary {
        margin-bottom: 1.5rem;
    }
    
    .visual-types-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }
    
    .visual-type-badge {
        background: #e9ecef;
        padding: 0.3rem 0.6rem;
        border-radius: 15px;
        font-size: 0.8rem;
        color: #495057;
    }
    
    .visual-item {
        padding: 0.8rem;
        margin-bottom: 0.5rem;
        background: #f8f9fa;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .visual-item:hover {
        background: #e9ecef;
        transform: translateX(2px);
    }
    
    .visual-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.3rem;
    }
    
    .visual-name {
        font-weight: bold;
        color: #333;
    }
    
    .visual-type {
        background: #f7931e;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 10px;
        font-size: 0.7rem;
    }
    
    .visual-metrics {
        display: flex;
        justify-content: space-between;
        color: #666;
        font-size: 0.8rem;
    }
    
    .visual-section {
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #eee;
    }
    
    .visual-section:last-child {
        border-bottom: none;
    }
    
    .visual-section h5 {
        color: #f7931e;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }
    
    .color-palette {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
    }
    
    .color-swatch {
        width: 20px;
        height: 20px;
        border-radius: 3px;
        border: 1px solid #ddd;
    }
    
    .visual-actions {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }
    
    .visual-actions button {
        background: #f7931e;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.8rem;
    }
    
    .visual-actions button:hover {
        background: #e6841a;
    }
    
    /* Filter styles */
    .filters-list {
        margin-top: 0.5rem;
    }
    
    .filter-item {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 5px;
        margin-bottom: 0.5rem;
        overflow: hidden;
    }
    
    .filter-header {
        background: #e9ecef;
        padding: 0.5rem;
        border-bottom: 1px solid #dee2e6;
    }
    
    .filter-type {
        font-weight: bold;
        color: #495057;
        font-size: 0.8rem;
        text-transform: uppercase;
    }
    
    .filter-details {
        padding: 0.5rem;
    }
    
    .filter-details > div {
        margin-bottom: 0.3rem;
        font-size: 0.85rem;
        line-height: 1.4;
    }
    
    .filter-details > div:last-child {
        margin-bottom: 0;
    }
    
    .filter-expression,
    .filter-condition,
    .filter-value,
    .filter-description,
    .filter-property {
        word-break: break-word;
    }
    
    .filter-details strong {
        color: #495057;
        margin-right: 0.3rem;
    }
`;

// Add the additional styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);