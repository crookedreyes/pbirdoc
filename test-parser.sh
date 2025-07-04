#!/bin/bash

echo "🧪 PBIR Parser Test Script"
echo "========================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to run the parser."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if the CLI tool exists
if [ ! -f "cli-parser.js" ]; then
    echo "❌ cli-parser.js not found in current directory"
    exit 1
fi

echo "✅ CLI parser found"

# Show help
echo ""
echo "📖 Showing parser help:"
echo "======================"
node cli-parser.js

echo ""
echo "🔧 Test Commands:"
echo "================="
echo ""
echo "To test the parser with a PBIR folder:"
echo "  node cli-parser.js /path/to/your/pbir/folder"
echo ""
echo "To test with verbose output:"
echo "  node cli-parser.js /path/to/your/pbir/folder --verbose"
echo ""
echo "To test with summary only:"
echo "  node cli-parser.js /path/to/your/pbir/folder --summary"
echo ""
echo "To save output to file:"
echo "  node cli-parser.js /path/to/your/pbir/folder --output report-analysis.json"
echo ""
echo "To run with schema validation:"
echo "  node cli-parser.js /path/to/your/pbir/folder --validate --verbose"
echo ""

# Check if any PBIR folders exist in current directory
echo "🔍 Looking for PBIR folders in current directory..."
pbir_folders=()

for dir in */; do
    if [ -d "$dir" ]; then
        # Check if it looks like a PBIR folder (has definition folder)
        if [ -d "${dir}definition" ]; then
            pbir_folders+=("$dir")
        fi
    fi
done

if [ ${#pbir_folders[@]} -gt 0 ]; then
    echo "📁 Found potential PBIR folders:"
    for folder in "${pbir_folders[@]}"; do
        echo "  • $folder"
    done
    echo ""
    echo "💡 You can test with one of these folders:"
    echo "  node cli-parser.js \"${pbir_folders[0]}\" --summary"
else
    echo "📂 No PBIR folders detected in current directory"
    echo "💡 Create a test folder with this structure:"
    echo "   test-report/"
    echo "   ├── definition/"
    echo "   │   ├── report.json"
    echo "   │   ├── version.json"
    echo "   │   ├── pages/"
    echo "   │   │   ├── pages.json"
    echo "   │   │   └── PageName/"
    echo "   │   │       ├── page.json"
    echo "   │   │       └── visuals/"
    echo "   │   │           └── VisualName/"
    echo "   │   │               └── visual.json"
    echo "   │   └── bookmarks/"
    echo "   │       └── bookmarks.json"
fi

echo ""
echo "🎯 Ready to test! Use the commands above with your PBIR folder path."