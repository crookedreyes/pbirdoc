# 🔧 PBIR Parser CLI Tool

A command-line interface for parsing and analyzing Power BI Report (.pbir) files with schema validation and detailed reporting.

## Features

- ✅ **Schema-Aware Parsing**: Uses official Microsoft JSON schemas for validation
- 🔍 **Deep Analysis**: Extracts visuals, fields, filters, formatting, and layout information
- 📊 **Comprehensive Reporting**: Detailed summaries with visual type counts and field analysis
- 🛡️ **Error Handling**: Robust error reporting with warnings and validation messages
- 💾 **Export Options**: Save parsed data to JSON files
- 🎯 **Multiple Output Modes**: Summary, detailed, and verbose reporting

## Installation

Ensure you have Node.js 14+ installed:

```bash
node --version  # Should be 14.0.0 or higher
```

Make the CLI executable:
```bash
chmod +x cli-parser.js
```

## Usage

### Basic Usage

```bash
# Parse a PBIR folder
node cli-parser.js /path/to/your/pbir/folder

# Show only summary
node cli-parser.js /path/to/your/pbir/folder --summary

# Verbose output with detailed information
node cli-parser.js /path/to/your/pbir/folder --verbose
```

### Advanced Options

```bash
# Save results to JSON file
node cli-parser.js /path/to/your/pbir/folder --output analysis.json

# Run with schema validation
node cli-parser.js /path/to/your/pbir/folder --validate --verbose

# Summary with validation
node cli-parser.js /path/to/your/pbir/folder --summary --validate
```

## Command-Line Options

| Option | Description |
|--------|-------------|
| `--output <file>` | Save parsed data to JSON file |
| `--summary` | Show only summary information |
| `--validate` | Perform detailed schema validation |
| `--verbose` | Show detailed parsing information |

## PBIR Folder Structure

The parser expects a standard PBIR folder structure:

```
your-report/
├── definition/
│   ├── report.json              # Main report configuration
│   ├── version.json             # Version metadata
│   ├── reportExtensions.json    # Report extensions (optional)
│   ├── pages/
│   │   ├── pages.json           # Pages metadata
│   │   └── PageName/
│   │       ├── page.json        # Page configuration
│   │       └── visuals/
│   │           └── VisualName/
│   │               ├── visual.json    # Visual configuration
│   │               └── mobile.json    # Mobile layout (optional)
│   └── bookmarks/
│       ├── bookmarks.json       # Bookmarks metadata
│       └── BookmarkName.bookmark.json
```

## Schema Support

The CLI tool uses the official Microsoft JSON schemas for validation:

- **Report Schema**: Validates main report structure and settings
- **Page Schema**: Validates page configuration and layout
- **Visual Container Schema**: Validates visual positioning and configuration
- **Filter Configuration Schema**: Validates filter definitions and metadata
- **Semantic Query Schema**: Validates data queries and expressions

## Output Examples

### Summary Output
```
📊 Report Summary:
  📄 Pages: 3
  📊 Visuals: 12
  🔖 Bookmarks: 2

📈 Visual Types:
  • columnChart: 4
  • tableEx: 3
  • card: 2
  • slicer: 3
```

### Detailed Output
```
📑 Pages Detail:
  • Sales Overview: 5 visuals
    ◦ SalesChart (columnChart): 3 fields, 1 filters
    ◦ SalesTable (tableEx): 8 fields, 2 filters
    ◦ TotalSales (card): 1 fields, 0 filters
  • Product Analysis: 4 visuals
    ◦ ProductChart (barChart): 4 fields, 1 filters
```

## Error Handling

The parser provides detailed error reporting:

- **Parse Errors**: JSON syntax errors, missing files
- **Schema Validation Warnings**: Field mismatches, missing required properties
- **Structure Warnings**: Unexpected folder structures, missing optional files

## Testing

Use the included test script to verify your setup:

```bash
# Run the test script
./test-parser.sh

# Or manually test with a sample folder
node cli-parser.js ./sample-report --summary --verbose
```

## Integration with Web App

The CLI parser can be used alongside the web application:

- **Development**: Test parser improvements before web integration
- **Batch Processing**: Analyze multiple reports programmatically
- **CI/CD**: Automate report validation in build pipelines
- **Documentation**: Generate report documentation automatically

## Enhanced Features

The CLI includes enhanced parsing capabilities:

### Field Analysis
- Measures with aggregation functions
- Dimensions and hierarchies
- Visual calculations and transformations
- Data roles and field bindings

### Filter Analysis
- Categorical, Range, Advanced, TopN filters
- Query-level and visual-level filters
- Filter expressions and conditions
- Cross-filter relationships

### Layout Analysis
- Position coordinates (x, y, z)
- Visual dimensions (width, height)
- Tab order and angles
- Mobile layout support

### Formatting Analysis
- Background and border properties
- Font and color configurations
- Theme and styling information
- Visual-specific formatting

## Performance

- **Fast Parsing**: Efficiently processes large PBIR files
- **Memory Optimized**: Streams file processing for large reports
- **Concurrent Processing**: Parallel file parsing where possible
- **Progress Reporting**: Real-time feedback during processing

## Troubleshooting

### Common Issues

1. **Node.js Version**: Ensure Node.js 14+ is installed
2. **File Permissions**: Make sure the CLI script is executable
3. **Folder Structure**: Verify the PBIR folder has the correct structure
4. **JSON Syntax**: Check for malformed JSON files in the PBIR folder

### Debug Options

```bash
# Maximum verbosity
node cli-parser.js /path/to/folder --verbose --validate

# Check folder structure
ls -la /path/to/folder/definition/
```

## Contributing

To improve the parser:

1. Add new schema definitions to `json-schemas/`
2. Enhance parsing logic in `cli-parser.js`
3. Update field extraction methods
4. Add new validation rules
5. Test with various PBIR files

## Future Enhancements

- [ ] DAX expression parsing
- [ ] Relationship analysis
- [ ] Performance metrics
- [ ] Visual dependency mapping
- [ ] Automated documentation generation
- [ ] Integration with Power BI REST API