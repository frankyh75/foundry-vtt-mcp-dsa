#!/bin/bash

# Foundry MCP Server - Complete Uninstaller for Mac
# This removes ALL components for clean testing

echo "🧹 Foundry MCP Server - Complete Uninstall"
echo "=========================================="
echo ""
echo "This will remove:"
echo "  • MCP Server from /Applications"
echo "  • Claude Desktop configuration"
echo "  • ComfyUI (Python, dependencies, AI models) (~17GB)"
echo "  • Foundry VTT module (if installed)"
echo "  • AI-generated maps folder"
echo "  • Lock files and debug logs"
echo ""
echo "⚠️  This action cannot be undone!"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Get user info
if [ "$EUID" -eq 0 ]; then
    CURRENT_USER=$(stat -f '%Su' /dev/console)
    USER_HOME=$(eval echo ~$CURRENT_USER)
else
    CURRENT_USER=$USER
    USER_HOME=$HOME
fi

echo ""
echo "Uninstalling for user: $CURRENT_USER"
echo ""

# 1. Kill all running processes
echo "🛑 Stopping all running processes..."

# Kill MCP server backend
MCP_PIDS=$(pgrep -f "FoundryMCPServer.*backend.bundle.cjs" 2>/dev/null)
if [ -n "$MCP_PIDS" ]; then
    echo "   • Killing MCP server processes: $MCP_PIDS"
    kill -9 $MCP_PIDS 2>/dev/null || sudo kill -9 $MCP_PIDS 2>/dev/null
fi

# Kill any ComfyUI Python processes (including hung ones)
COMFYUI_PIDS=$(pgrep -f "ComfyUI.*python" 2>/dev/null)
if [ -n "$COMFYUI_PIDS" ]; then
    echo "   • Killing ComfyUI processes: $COMFYUI_PIDS"
    kill -9 $COMFYUI_PIDS 2>/dev/null || sudo kill -9 $COMFYUI_PIDS 2>/dev/null
fi

# Kill any Python processes from our installations (both old and new locations)
PYTHON_PIDS=$(ps aux | grep -E "(FoundryMCPServer.*python|python3.11.*FoundryMCP)" | grep -v grep | awk '{print $2}')
if [ -n "$PYTHON_PIDS" ]; then
    echo "   • Killing Python processes: $PYTHON_PIDS"
    echo "$PYTHON_PIDS" | xargs kill -9 2>/dev/null || echo "$PYTHON_PIDS" | xargs sudo kill -9 2>/dev/null
fi

sleep 1
echo "   ✅ Processes stopped"
echo ""

# 2. Remove MCP Server
if [ -d "/Applications/FoundryMCPServer.app" ]; then
    echo "🗑️  Removing MCP Server..."
    sudo rm -rf "/Applications/FoundryMCPServer.app"
    echo "   ✅ Removed"
else
    echo "   ⊘ MCP Server not found"
fi

# 3. Remove MCP Server application support directory
MCP_APP_SUPPORT="$USER_HOME/Library/Application Support/FoundryMCPServer"
if [ -d "$MCP_APP_SUPPORT" ]; then
    echo "🗑️  Removing MCP Server app support data..."
    rm -rf "$MCP_APP_SUPPORT"
    echo "   ✅ Removed"
else
    echo "   ⊘ MCP Server app support not found"
fi

# 4. Remove Claude Desktop configuration
CLAUDE_CONFIG="$USER_HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [ -f "$CLAUDE_CONFIG" ]; then
    echo "🗑️  Cleaning Claude Desktop config..."

    # Check if our MCP server is in the config
    if grep -q "foundry-vtt-mcp" "$CLAUDE_CONFIG" 2>/dev/null; then
        # Backup first
        cp "$CLAUDE_CONFIG" "$CLAUDE_CONFIG.backup"

        # Use Node.js to safely remove the entry
        node - <<'NODE_SCRIPT' "$CLAUDE_CONFIG"
const fs = require('fs');
const configPath = process.argv[2];

try {
  const content = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(content);

  if (config.mcpServers && config.mcpServers['foundry-vtt-mcp']) {
    delete config.mcpServers['foundry-vtt-mcp'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('   ✅ Removed from config');
  }
} catch (err) {
  console.error('   ❌ Failed:', err.message);
}
NODE_SCRIPT
        echo "   📝 Backup: $CLAUDE_CONFIG.backup"
    else
        echo "   ⊘ Not found in config"
    fi
else
    echo "   ⊘ Claude config not found"
fi

# 5. Remove ComfyUI Desktop (legacy)
if [ -d "/Applications/ComfyUI.app" ]; then
    echo "🗑️  Removing ComfyUI Desktop app..."
    sudo rm -rf "/Applications/ComfyUI.app"
    echo "   ✅ Removed"
else
    echo "   ⊘ ComfyUI Desktop not found"
fi

# 6. Remove headless ComfyUI from MCP Server bundle (old location from failed installs)
HEADLESS_COMFYUI="/Applications/FoundryMCPServer.app/Contents/Resources/ComfyUI"
if [ -d "$HEADLESS_COMFYUI" ]; then
    echo "🗑️  Removing headless ComfyUI installation..."
    sudo rm -rf "$HEADLESS_COMFYUI"
    echo "   ✅ Removed"
else
    echo "   ⊘ Headless ComfyUI not found"
fi

# 7. Remove old Python installations from failed attempts
OLD_PYTHON_LOCATIONS=(
    "/Applications/FoundryMCPServer.app/Contents/Resources/python3.11"
    "/Applications/FoundryMCPServer.app/Contents/Resources/Python.framework"
)

for OLD_PYTHON in "${OLD_PYTHON_LOCATIONS[@]}"; do
    if [ -d "$OLD_PYTHON" ]; then
        echo "🗑️  Removing old Python installation at $OLD_PYTHON..."
        sudo rm -rf "$OLD_PYTHON"
        echo "   ✅ Removed"
    fi
done

# 8. Remove Python 3.11 system installation (if installed by our installer)
PYTHON_SYSTEM="/Library/Frameworks/Python.framework/Versions/3.11"
if [ -d "$PYTHON_SYSTEM" ]; then
    echo "🗑️  Removing Python 3.11 system installation..."
    echo "   (This was installed by the Foundry MCP installer)"
    sudo rm -rf "$PYTHON_SYSTEM"
    sudo rm -f "/usr/local/bin/python3.11"
    echo "   ✅ Removed"
else
    echo "   ⊘ Python 3.11 not found"
fi

# 9. Remove ComfyUI models and configuration from Application Support (~13.5GB)
COMFYUI_DATA="$USER_HOME/Library/Application Support/ComfyUI"
if [ -d "$COMFYUI_DATA" ]; then
    echo "🗑️  Removing ComfyUI models and configuration (~13.5GB)..."
    # Use sudo since models may be owned by root
    sudo rm -rf "$COMFYUI_DATA"
    echo "   ✅ Removed"
else
    echo "   ⊘ ComfyUI data not found"
fi

# 10. Remove install log
if [ -f "$USER_HOME/foundry-mcp-install.log" ]; then
    echo "🗑️  Removing install log..."
    rm -f "$USER_HOME/foundry-mcp-install.log"
    echo "   ✅ Removed"
fi

# 11. Remove Foundry Module
FOUNDRY_PATHS=(
    "$USER_HOME/Library/Application Support/FoundryVTT/Data/modules/foundry-mcp-bridge"
    "$USER_HOME/FoundryVTT/Data/modules/foundry-mcp-bridge"
    "/Applications/FoundryVTT/Data/modules/foundry-mcp-bridge"
)

FOUND_MODULE=false
for MODULE_PATH in "${FOUNDRY_PATHS[@]}"; do
    if [ -d "$MODULE_PATH" ]; then
        echo "🗑️  Removing Foundry module..."
        rm -rf "$MODULE_PATH"
        echo "   ✅ Removed from $(dirname "$MODULE_PATH")"
        FOUND_MODULE=true
        break
    fi
done

if [ "$FOUND_MODULE" = false ]; then
    echo "   ⊘ Foundry module not found"
fi

# 12. Remove AI-generated maps folder (NEW - Oct 10, 2025)
FOUNDRY_AI_MAPS_PATHS=(
    "$USER_HOME/Library/Application Support/FoundryVTT/Data/ai-generated-maps"
    "$USER_HOME/FoundryVTT/Data/ai-generated-maps"
    "/Applications/FoundryVTT/Data/ai-generated-maps"
)

FOUND_MAPS=false
for MAPS_PATH in "${FOUNDRY_AI_MAPS_PATHS[@]}"; do
    if [ -d "$MAPS_PATH" ]; then
        echo "🗑️  Removing AI-generated maps..."
        rm -rf "$MAPS_PATH"
        echo "   ✅ Removed from $(dirname "$MAPS_PATH")"
        FOUND_MAPS=true
        break
    fi
done

if [ "$FOUND_MAPS" = false ]; then
    echo "   ⊘ AI-generated maps not found"
fi

# 13. Remove lock files and debug logs
echo "🗑️  Removing lock files and debug logs..."

TEMP_FILES=(
    "/tmp/foundry-mcp-backend.lock"
    "/tmp/backend.log"
    "/tmp/process-mapgen-debug.log"
    "/tmp/foundry-mcp-upload-debug.log"
)

REMOVED_COUNT=0
for TEMP_FILE in "${TEMP_FILES[@]}"; do
    if [ -f "$TEMP_FILE" ]; then
        rm -f "$TEMP_FILE"
        ((REMOVED_COUNT++))
    fi
done

if [ $REMOVED_COUNT -gt 0 ]; then
    echo "   ✅ Removed $REMOVED_COUNT temp files"
else
    echo "   ⊘ No temp files found"
fi

# 14. Remove any MCP server logs from user directory
MCP_LOG_DIR="$USER_HOME/Library/Logs/foundry-mcp-server"
if [ -d "$MCP_LOG_DIR" ]; then
    echo "🗑️  Removing MCP server logs..."
    rm -rf "$MCP_LOG_DIR"
    echo "   ✅ Removed"
fi

# 15. Remove package receipts from system
echo "🗑️  Removing package receipts..."

PKG_IDS=(
    "com.foundry-mcp.core"
    "com.foundry-mcp.foundry-module"
    "com.foundry-mcp.comfyui"
)

REMOVED_PKG_COUNT=0
for PKG_ID in "${PKG_IDS[@]}"; do
    if pkgutil --pkg-info "$PKG_ID" &>/dev/null; then
        echo "   • Forgetting package: $PKG_ID"
        sudo pkgutil --forget "$PKG_ID" &>/dev/null
        ((REMOVED_PKG_COUNT++))
    fi
done

if [ $REMOVED_PKG_COUNT -gt 0 ]; then
    echo "   ✅ Removed $REMOVED_PKG_COUNT package receipts"
else
    echo "   ⊘ No package receipts found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Uninstall Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Foundry MCP Bridge and all of its components have been uninstalled."
echo ""
echo "Summary:"
echo "  ✅ MCP Server removed"
echo "  ✅ ComfyUI and models removed (~17GB freed)"
echo "  ✅ Python 3.11 removed"
echo "  ✅ Foundry module removed"
echo "  ✅ AI-generated maps removed"
echo "  ✅ Lock files and logs removed"
echo "  ✅ Claude Desktop config cleaned"
echo "  ✅ Package receipts removed"
echo ""
echo "System is now in a clean state for reinstallation."
echo ""
