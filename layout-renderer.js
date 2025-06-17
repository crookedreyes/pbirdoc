class LayoutRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.selectedVisual = null;
        this.visualElements = [];
        this.pageData = null;
        
        this.setupCanvas();
        this.bindEvents();
    }
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Set canvas display size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    bindEvents() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    renderPage(pageData) {
        this.pageData = pageData;
        this.visualElements = [];
        this.clearCanvas();
        
        if (!pageData || !pageData.visuals) {
            this.drawEmptyState();
            return;
        }
        
        // Calculate optimal scale and offset
        this.calculateViewport(pageData.visuals);
        
        // Draw page background
        this.drawPageBackground();
        
        // Draw all visuals
        Object.entries(pageData.visuals).forEach(([visualName, visualData]) => {
            this.drawVisual(visualName, visualData);
        });
        
        // Draw grid if needed
        this.drawGrid();
    }
    
    calculateViewport(visuals) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        Object.values(visuals).forEach(visual => {
            const layout = visual.layout || {};
            const x = layout.x || 0;
            const y = layout.y || 0;
            const width = layout.width || 100;
            const height = layout.height || 100;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });
        
        // Add padding
        const padding = 50;
        const contentWidth = maxX - minX + (padding * 2);
        const contentHeight = maxY - minY + (padding * 2);
        
        // Calculate scale to fit content
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        
        this.scale = Math.min(
            canvasWidth / contentWidth,
            canvasHeight / contentHeight,
            1 // Don't scale up beyond 100%
        );
        
        // Center the content
        this.offsetX = (canvasWidth - (contentWidth * this.scale)) / 2 - (minX * this.scale) + (padding * this.scale);
        this.offsetY = (canvasHeight - (contentHeight * this.scale)) / 2 - (minY * this.scale) + (padding * this.scale);
    }
    
    drawPageBackground() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
        
        // Draw page border
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            this.offsetX,
            this.offsetY,
            1280 * this.scale, // Standard Power BI page width
            720 * this.scale   // Standard Power BI page height
        );
    }
    
    drawVisual(visualName, visualData) {
        const layout = visualData.layout || {};
        const x = (layout.x || 0) * this.scale + this.offsetX;
        const y = (layout.y || 0) * this.scale + this.offsetY;
        const width = (layout.width || 100) * this.scale;
        const height = (layout.height || 100) * this.scale;
        
        // Store visual element for click detection
        this.visualElements.push({
            name: visualName,
            data: visualData,
            bounds: { x: x, y: y, width: width, height: height }
        });
        
        // Draw visual background
        const bgColor = this.getVisualBackgroundColor(visualData);
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(x, y, width, height);
        
        // Draw visual border
        const borderColor = visualData === this.selectedVisual ? '#f7931e' : '#d0d0d0';
        const borderWidth = visualData === this.selectedVisual ? 3 : 1;
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = borderWidth;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw visual type indicator
        this.drawVisualTypeIndicator(x, y, width, height, visualData);
        
        // Draw visual title
        this.drawVisualTitle(x, y, width, visualName, visualData);
        
        // Draw field indicators
        this.drawFieldIndicators(x, y, width, height, visualData);
    }
    
    getVisualBackgroundColor(visualData) {
        if (visualData.formatting && visualData.formatting.background && visualData.formatting.background.color) {
            return visualData.formatting.background.color;
        }
        
        const visualType = visualData.properties?.type || 'unknown';
        const colorMap = {
            'columnChart': '#e8f4fd',
            'barChart': '#e8f4fd',
            'lineChart': '#f0f8e8',
            'pieChart': '#fdf2e8',
            'donutChart': '#fdf2e8',
            'scatterChart': '#f8e8f8',
            'tableEx': '#f8f8f8',
            'matrix': '#f8f8f8',
            'card': '#e8f8f8',
            'multiRowCard': '#e8f8f8',
            'gauge': '#f8f0e8',
            'kpi': '#f8f0e8',
            'slicer': '#f0e8f8',
            'map': '#e8f8f0',
            'filledMap': '#e8f8f0',
            'treemap': '#f8e8e8',
            'waterfallChart': '#e8e8f8',
            'ribbonChart': '#f8f8e8'
        };
        
        return colorMap[visualType] || '#f5f5f5';
    }
    
    drawVisualTypeIndicator(x, y, width, height, visualData) {
        const visualType = visualData.properties?.type || 'unknown';
        const icon = this.getVisualTypeIcon(visualType);
        
        // Draw type indicator in top-right corner
        const indicatorSize = Math.min(24, width * 0.15, height * 0.15);
        const indicatorX = x + width - indicatorSize - 5;
        const indicatorY = y + 5;
        
        this.ctx.fillStyle = '#666';
        this.ctx.fillRect(indicatorX, indicatorY, indicatorSize, indicatorSize);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${indicatorSize * 0.6}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(icon, indicatorX + indicatorSize/2, indicatorY + indicatorSize * 0.7);
    }
    
    getVisualTypeIcon(visualType) {
        const iconMap = {
            'columnChart': '📊',
            'barChart': '📈',
            'lineChart': '📉',
            'pieChart': '🥧',
            'donutChart': '🍩',
            'scatterChart': '🔵',
            'tableEx': '📋',
            'matrix': '⊞',
            'card': '🃏',
            'multiRowCard': '🗂️',
            'gauge': '⏱️',
            'kpi': '🎯',
            'slicer': '🔍',
            'map': '🗺️',
            'filledMap': '🌍',
            'treemap': '🌳',
            'waterfallChart': '💧',
            'ribbonChart': '🎀'
        };
        
        return iconMap[visualType] || '❓';
    }
    
    drawVisualTitle(x, y, width, visualName, visualData) {
        const title = visualData.properties?.title || visualName;
        
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'left';
        
        // Truncate title if too long
        const maxWidth = width - 10;
        let displayTitle = title;
        
        if (this.ctx.measureText(displayTitle).width > maxWidth) {
            while (this.ctx.measureText(displayTitle + '...').width > maxWidth && displayTitle.length > 0) {
                displayTitle = displayTitle.slice(0, -1);
            }
            displayTitle += '...';
        }
        
        this.ctx.fillText(displayTitle, x + 5, y + 20);
    }
    
    drawFieldIndicators(x, y, width, height, visualData) {
        const fields = visualData.fields || {};
        const measures = fields.measures || [];
        const dimensions = fields.dimensions || [];
        
        let yOffset = 35;
        const lineHeight = 14;
        
        // Draw measures
        if (measures.length > 0) {
            this.ctx.fillStyle = '#0078d4';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(`📏 ${measures.length} measure(s)`, x + 5, y + yOffset);
            yOffset += lineHeight;
        }
        
        // Draw dimensions
        if (dimensions.length > 0) {
            this.ctx.fillStyle = '#107c10';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(`📊 ${dimensions.length} dimension(s)`, x + 5, y + yOffset);
            yOffset += lineHeight;
        }
        
        // Draw filter indicator
        const filters = visualData.filters || [];
        if (filters.length > 0) {
            this.ctx.fillStyle = '#d83b01';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(`🔍 ${filters.length} filter(s)`, x + 5, y + yOffset);
        }
    }
    
    drawGrid() {
        const gridSize = 20 * this.scale;
        const rect = this.canvas.getBoundingClientRect();
        
        this.ctx.strokeStyle = '#f0f0f0';
        this.ctx.lineWidth = 0.5;
        
        // Draw vertical lines
        for (let x = this.offsetX % gridSize; x < rect.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, rect.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = this.offsetY % gridSize; y < rect.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(rect.width, y);
            this.ctx.stroke();
        }
    }
    
    drawEmptyState() {
        const rect = this.canvas.getBoundingClientRect();
        
        this.ctx.fillStyle = '#666';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('No visuals found in this page', rect.width / 2, rect.height / 2);
    }
    
    clearCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
    }
    
    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Find clicked visual
        for (const element of this.visualElements) {
            const bounds = element.bounds;
            if (clickX >= bounds.x && clickX <= bounds.x + bounds.width &&
                clickY >= bounds.y && clickY <= bounds.y + bounds.height) {
                
                this.selectVisual(element);
                return;
            }
        }
        
        // No visual clicked, deselect
        this.selectVisual(null);
    }
    
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Check if hovering over a visual
        let isHovering = false;
        for (const element of this.visualElements) {
            const bounds = element.bounds;
            if (mouseX >= bounds.x && mouseX <= bounds.x + bounds.width &&
                mouseY >= bounds.y && mouseY <= bounds.y + bounds.height) {
                isHovering = true;
                break;
            }
        }
        
        this.canvas.style.cursor = isHovering ? 'pointer' : 'default';
    }
    
    selectVisual(element) {
        this.selectedVisual = element ? element.data : null;
        
        // Redraw to show selection
        if (this.pageData) {
            this.renderPage(this.pageData);
        }
        
        // Dispatch event for visual selection
        const event = new CustomEvent('visualSelected', {
            detail: element ? {
                name: element.name,
                data: element.data
            } : null
        });
        document.dispatchEvent(event);
    }
    
    highlightVisual(visualName) {
        const element = this.visualElements.find(el => el.name === visualName);
        if (element) {
            this.selectVisual(element);
        }
    }
    
    exportAsImage() {
        const link = document.createElement('a');
        link.download = 'powerbi-layout.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }
}