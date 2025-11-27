# DSA5 Fork - Installation Guide

Installation guide for the DSA5-enabled fork of foundry-vtt-mcp.

## Prerequisites

- **Foundry VTT v13+** with DSA5 system installed
- **Node.js 18+** (check with `node --version`)
- **Claude Desktop** with MCP support
- **Git** (for cloning the repository)

## Installation Steps

### 1. Clone the DSA5 Fork

```bash
# Clone from your fork
git clone https://github.com/frankyh75/foundry-vtt-mcp-dsa.git
cd foundry-vtt-mcp-dsa

# Checkout the DSA5 branch
git checkout claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9
```

**Alternative:** Download as ZIP from GitHub and extract.

### 2. Install Dependencies

```bash
npm install
```

This will install ~851 packages for all workspaces (foundry-module, mcp-server, shared).

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folders.

**Expected output:**
```
> @foundry-mcp/module@0.6.0 build
> tsc

> @foundry-mcp/server@0.6.0 build
> npm -w @foundry-mcp/shared run build && tsc

> @foundry-mcp/shared@0.6.0 build
> tsc
```

If successful, you'll see compiled files in:
- `packages/mcp-server/dist/`
- `packages/foundry-module/dist/`

### 4. Configure Claude Desktop

#### Windows
Edit: `%APPDATA%\Claude\claude_desktop_config.json`

#### Mac/Linux
Edit: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the foundry-mcp server configuration:

```json
{
  "mcpServers": {
    "foundry-mcp-dsa5": {
      "command": "node",
      "args": [
        "C:/Users/Frank/foundry-vtt-mcp-dsa/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "FOUNDRY_HOST": "localhost",
        "FOUNDRY_PORT": "31415"
      }
    }
  }
}
```

**Important:** Replace the path with your actual installation path!

- **Windows:** Use forward slashes `/` or escaped backslashes `\\`
- **Mac/Linux:** Use absolute paths like `/Users/Frank/foundry-vtt-mcp-dsa/...`

### 5. Install Foundry Module

You have two options:

#### Option A: Symlink (Development - Recommended)

**Windows (Admin CMD/PowerShell):**
```powershell
mklink /D "%APPDATA%\FoundryVTT\Data\modules\foundry-mcp" "C:\Users\Frank\foundry-vtt-mcp-dsa\packages\foundry-module\dist"
```

**Mac/Linux:**
```bash
ln -s ~/foundry-vtt-mcp-dsa/packages/foundry-module/dist ~/.local/share/FoundryVTT/Data/modules/foundry-mcp
```

After rebuilding (`npm run build`), changes are automatically available.

#### Option B: Manual Copy

Copy `packages/foundry-module/dist/*` to your Foundry modules folder:
- Windows: `%APPDATA%\FoundryVTT\Data\modules\foundry-mcp\`
- Mac/Linux: `~/.local/share/FoundryVTT/Data/modules/foundry-mcp/`

You must recopy after every rebuild.

### 6. Enable Module in Foundry VTT

1. Start Foundry VTT v13+
2. Load your DSA5 world
3. Go to **Settings** → **Manage Modules**
4. Find **"Foundry MCP Integration"** and enable it
5. Save and reload

### 7. Start Foundry & Test

1. **Start Foundry VTT** with your DSA5 world
2. **Restart Claude Desktop** (required for config reload)
3. In Claude Desktop, check the MCP icon (🔌) - it should show "foundry-mcp-dsa5" as connected
4. Test with a prompt like:
   ```
   List all my DSA5 characters
   ```

## Verification

### Check MCP Connection

In Claude Desktop, the MCP server should appear with status:
- ✅ **Connected** (green)
- Available tools should include `get-character`, `search-compendium`, etc.

### Test DSA5 Features

Try these prompts in Claude:

```
Show me my DSA5 character named "Thorwal"
```

```
Search for DSA5 creatures with experience level 3
```

```
List all DSA5 characters in the current world
```

## Troubleshooting

### MCP Server Not Connecting

1. Check Claude Desktop logs:
   - Windows: `%APPDATA%\Claude\logs\`
   - Mac: `~/Library/Logs/Claude/`
2. Verify the path in `claude_desktop_config.json` is correct
3. Ensure Foundry is running on port 31415
4. Restart Claude Desktop after config changes

### Module Not Appearing in Foundry

1. Check symlink/copy worked:
   ```bash
   # Windows
   dir %APPDATA%\FoundryVTT\Data\modules\foundry-mcp

   # Mac/Linux
   ls -la ~/.local/share/FoundryVTT/Data/modules/foundry-mcp
   ```
2. Verify `module.json` exists in the module folder
3. Check Foundry console (F12) for errors

### Build Errors

If `npm run build` fails:

1. **Clean and rebuild:**
   ```bash
   npm run clean
   npm install
   npm run build
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+
   ```

3. **Common issues:**
   - ESLint config errors: Safe to ignore, build still succeeds
   - tsconfig errors: Not critical if build completes

### DSA5 System Not Detected

1. Ensure DSA5 system is installed in Foundry:
   - **Settings** → **Manage Systems** → Install "Das Schwarze Auge 5"
2. Create or load a DSA5 world (not DnD5e!)
3. Verify system ID in Foundry console:
   ```javascript
   game.system.id  // Should return "dsa5"
   ```

## Differences from Upstream

This DSA5 fork includes:

- ✅ **DSA5 System Adapter** - Full support for DSA5 characters/creatures
- ✅ **Experience Level 1-7** - Erfahrungsgrad classification (900 AP intervals)
- ✅ **8 Eigenschaften** - MU/KL/IN/CH/FF/GE/KO/KK attribute extraction
- ✅ **DSA5 Filters** - Filter by species, culture, level, size, spells
- ✅ **German UI** - "Kreaturen-Index", "Erfahrungsgrad" etc.

Everything else works identically to upstream foundry-vtt-mcp.

## Development Workflow

If you're developing or testing changes:

```bash
# Make code changes in src/

# Rebuild
npm run build

# If using symlink, restart Foundry to reload module

# Restart Claude Desktop to reload MCP server
```

## Updating the Fork

To get latest upstream changes:

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/adambdooley/foundry-vtt-mcp.git

# Fetch upstream
git fetch upstream

# Merge upstream changes (may have conflicts)
git merge upstream/main
npm install
npm run build
```

**Note:** DSA5 adapter is isolated in `packages/mcp-server/src/systems/dsa5/`, so upstream merges should be conflict-free.

## Uninstallation

1. Remove from Claude config:
   - Delete the `"foundry-mcp-dsa5"` entry from `claude_desktop_config.json`
2. Remove Foundry module:
   - Delete symlink/folder: `FoundryVTT/Data/modules/foundry-mcp`
3. Restart Claude Desktop

## Support

- **DSA5 Fork Issues:** https://github.com/frankyh75/foundry-vtt-mcp-dsa/issues
- **Upstream Issues:** https://github.com/adambdooley/foundry-vtt-mcp/issues
- **DSA5 System:** https://foundryvtt.com/packages/dsa5

## Next Steps

After successful installation:
1. Explore DSA5 character extraction with `get-character`
2. Test creature search with DSA5 filters
3. Try story generation with DSA5 NPCs
4. Report any bugs or issues on GitHub

Viel Spaß mit DSA5 MCP Integration! 🎲
