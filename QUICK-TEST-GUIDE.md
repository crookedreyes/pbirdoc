# 🚀 Quick Test Guide for PBIR CLI Tool

## Simple Commands to Get Started

### 1. **Full Analysis** (Overview + All Pages)
```bash
node cli-report.js "/home/cr/Shared/reports/Sales & Returns Sample v201912.Report"
```

### 2. **Quick Overview** (Just Summary)
```bash
node cli-report.js "/home/cr/Shared/reports/Sales & Returns Sample v201912.Report" --no-pages
```

### 3. **Pages Only** (Skip Overview)
```bash
node cli-report.js "/home/cr/Shared/reports/Sales & Returns Sample v201912.Report" --pages-only
```

### 4. **Export to File** (For Further Analysis)
```bash
node cli-report.js "/home/cr/Shared/reports/Sales & Returns Sample v201912.Report" --export my-analysis.json
```

## 🎯 What You'll See

### Overview Section
- **Total pages, visuals, filters**
- **Visual type breakdown** (Cards: 23, Buttons: 67, etc.)
- **Global filters** that apply to entire report

### Pages Detail Section
- **Clean page names** ("Net Sales" not "ReportSection4b3f...")
- **Page dimensions** and filter information
- **All visuals** with readable names and types

### Per Visual Information
- **Visual type** (Card, Bar Chart, Custom Visual, etc.)
- **Position & size** (x, y coordinates, width, height)
- **Measures** used (Analysis DAX.Net Sales, etc.)
- **Dimensions** used (Product.Category, Store.Store, etc.)
- **Filters** applied to that visual
- **Hidden visuals** marked with ⚠️

## 🔍 Focus on Specific Content

### See Just One Page
```bash
node cli-report.js "/path/to/report" --pages-only | grep -A 20 "Net Sales"
```

### Count Visual Types
```bash
node cli-report.js "/path/to/report" --no-pages | grep "•"
```

### Find Pages with Filters
```bash
node cli-report.js "/path/to/report" --pages-only | grep -B 2 -A 2 "Page Filters"
```

## 📊 Export Format

The `--export` option creates clean JSON with:

```json
{
  "overview": {
    "totalPages": 18,
    "totalVisuals": 166,
    "globalFilters": [...]
  },
  "pages": [
    {
      "name": "Net Sales",
      "visuals": [
        {
          "name": "Card (44929275)",
          "type": "Card",
          "measures": ["Analysis DAX.Units Sold"],
          "dimensions": [],
          "filters": []
        }
      ]
    }
  ]
}
```

## 🚀 Your Test Results

Based on your "Sales & Returns Sample v201912.Report":

- ✅ **18 pages** with clean names
- ✅ **166 visuals** properly categorized
- ✅ **Field extraction** working (Analysis DAX.Return Rate, Product.Category, etc.)
- ✅ **Filter detection** working (Sales.Status, Product.Product, etc.)
- ✅ **Layout coordinates** extracted (precise positioning)
- ✅ **Export functionality** working

## 💡 Tips

1. **Start with overview** (`--no-pages`) to get familiar
2. **Use export** (`--export`) for detailed analysis
3. **Pipe through grep** to focus on specific content
4. **Check hidden visuals** (marked with ⚠️) for complete picture

## 🎯 Next Steps

1. Test with your own PBIR files
2. Use exported JSON in your web application
3. Customize field extraction for your specific needs
4. Add new visual types as you encounter them