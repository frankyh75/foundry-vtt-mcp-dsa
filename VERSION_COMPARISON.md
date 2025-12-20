# Version Comparison & Recommendations

**Date:** 2024-12-20
**Branch:** `claude/fix-dsa5-bug-S84Ey`
**Upstream:** https://github.com/adambdooley/foundry-vtt-mcp
**Fork:** https://github.com/frankyh75/foundry-vtt-mcp-dsa

---

## 📊 Current Version Comparison

| Package | Your Version | Adam's Upstream | Status |
|---------|--------------|-----------------|--------|
| **Root package.json** | 0.6.0 | 0.6.1 | ⚠️ Behind by 1 patch |
| **@foundry-mcp/server** | 0.6.0 | 0.6.1 | ⚠️ Behind by 1 patch |
| **@foundry-mcp/module** (module.json) | 0.6.0 | 0.6.1 | ⚠️ Behind by 1 patch |
| **@foundry-mcp/shared** | ^0.5.0 (dep) | N/A | ℹ️ Dependency version |

---

## 🎯 Changes Since Fork (0.6.0)

### Major Architectural Changes
1. ✅ **Complete SystemRegistry Pattern Implementation**
   - Added `packages/mcp-server/src/systems/` directory (18 new files)
   - `system-registry.ts` (2,949 bytes)
   - `index-builder-registry.ts` (2,349 bytes)
   - `types.ts` (6,601 bytes)
   - **Impact:** Fundamental architecture change following v0.6.0 pattern

2. ✅ **DSA5 (Das Schwarze Auge 5) Support**
   - New adapter: `packages/mcp-server/src/systems/dsa5/` (8 files)
   - DSA5-specific character extraction
   - Experience levels 1-7 (instead of CR)
   - Species filtering (Mensch, Elf, Zwerg, Ork, etc.)
   - Eigenschaften support (MU, KL, IN, CH, FF, GE, KO, KK)
   - **Impact:** New game system support (first non-D&D system)

3. ✅ **DnD5e & PF2e Adapter Migration**
   - Migrated existing logic to adapter pattern
   - `packages/mcp-server/src/systems/dnd5e/` (3 files)
   - `packages/mcp-server/src/systems/pf2e/` (3 files)
   - **Impact:** Refactoring for consistency

### Bug Fixes
4. ✅ **Creature Actor Type Support (BUG #2)**
   - Fixed `packages/foundry-module/src/data-access.ts`
   - Extended validActorTypes: `['character', 'npc', 'creature']`
   - **Impact:** Bug fix (was 66.7% coverage, now 100%)

5. ✅ **Removed Deprecated Handlers**
   - Removed `get-character-entity` from backend.ts and queries.ts
   - **Impact:** Build fix (deprecated code removal)

### Changes Summary
- **Files changed:** 22 files
- **Insertions:** +3,953 lines
- **Deletions:** -148 lines
- **New directories:** 4 (systems/, dsa5/, dnd5e/, pf2e/)
- **New files:** 18 (adapters, filters, index builders, tests)

---

## 🚧 Pending Improvements

### Not Yet Implemented (Planned)
1. ⏳ **Stats Extraction Fix**
   - Missing `getGameSystem()` method in CharacterTools
   - **Impact:** DSA5 stats currently empty (MU/KL/IN not visible)

2. ⏳ **CR-Filter Warning**
   - DSA5 should give helpful error for CR-based queries
   - **Impact:** UX improvement (better error messages)

---

## 🎯 Version Bump Recommendations

### Option 1: **0.7.0** (RECOMMENDED)
**Reasoning:**
- ✅ Major new feature: Complete DSA5 system support
- ✅ Architectural improvement: SystemRegistry Pattern
- ✅ Bug fixes: Creature type support
- ✅ Follows semantic versioning (MINOR bump for new features)
- ✅ Differentiates from Adam's 0.6.1 (your fork has significant additions)

**When to use:**
- When you want to emphasize the new DSA5 support as a feature release
- When you consider the Registry Pattern a significant enhancement
- When you want to clearly distinguish your fork from upstream

**Version updates:**
```json
// package.json
"version": "0.7.0"

// packages/foundry-module/module.json
"version": "0.7.0"

// packages/mcp-server/package.json
"version": "0.7.0"
```

---

### Option 2: **0.6.2** (CONSERVATIVE)
**Reasoning:**
- ✅ Aligns closer to Adam's 0.6.1
- ✅ Treats changes as incremental improvements
- ✅ Easier to merge upstream changes later
- ⚠️ Understates the significance of DSA5 + Registry Pattern

**When to use:**
- When you plan to merge back to Adam's repo soon
- When you want to minimize version divergence
- When you consider this a patch/extension of 0.6.x line

**Version updates:**
```json
// package.json
"version": "0.6.2"

// packages/foundry-module/module.json
"version": "0.6.2"

// packages/mcp-server/package.json
"version": "0.6.2"
```

---

### Option 3: **1.0.0** (BOLD)
**Reasoning:**
- ✅ Signals production-ready status
- ✅ Emphasizes multi-system architecture (no longer D&D-only)
- ✅ Reflects architectural maturity (Registry Pattern)
- ⚠️ May be premature (pending improvements still exist)
- ⚠️ Big jump from 0.6.0

**When to use:**
- After completing pending improvements (stats fix, CR warning)
- When you want to signal this as a stable, multi-system MCP server
- When you consider the Registry Pattern + DSA5 a "1.0" milestone

**Version updates:**
```json
// package.json
"version": "1.0.0"

// packages/foundry-module/module.json
"version": "1.0.0"

// packages/mcp-server/package.json
"version": "1.0.0"
```

---

## 📋 Recommended Versioning Strategy

### **Immediate Release: v0.7.0**
**Rationale:**
1. You've added **DSA5 support** (major new feature)
2. You've implemented **SystemRegistry Pattern** (architectural improvement)
3. You've fixed **creature type bug** (bug fix)
4. Version 0.7.0 clearly signals "new features beyond upstream 0.6.1"
5. Follows semantic versioning: MAJOR.MINOR.PATCH
   - MAJOR (0): Still in beta/development
   - MINOR (7): New features added (DSA5, Registry Pattern)
   - PATCH (0): First release of this feature set

### **Future Release: v1.0.0** (After Pending Improvements)
**When to bump to 1.0.0:**
- ✅ Complete stats extraction fix (getGameSystem method)
- ✅ Implement CR-Filter warning
- ✅ All tests pass (including real-world Foundry testing)
- ✅ Documentation complete
- ✅ Considered stable for production use

---

## 🔄 Comparison with Adam's Upstream

### What Adam has (0.6.1) that you might be missing:
- Unknown (need to check his changelog/commits between 0.6.0 → 0.6.1)
- Possible bug fixes or minor improvements
- **Recommendation:** Check his git history to see what changed

### What you have that Adam doesn't:
- ✅ Complete DSA5 support
- ✅ SystemRegistry Pattern (multi-system architecture)
- ✅ Creature type fix for all systems
- ✅ Experience levels (1-7) for DSA5
- ✅ 18 new files in systems/ directory

---

## 📝 Version Bump Checklist

If you choose **v0.7.0** (recommended), update these files:

- [ ] `/home/user/foundry-vtt-mcp-dsa/package.json` (line 3)
- [ ] `/home/user/foundry-vtt-mcp-dsa/packages/foundry-module/module.json` (line 5)
- [ ] `/home/user/foundry-vtt-mcp-dsa/packages/mcp-server/package.json` (line 3)
- [ ] `/home/user/foundry-vtt-mcp-dsa/packages/foundry-module/package.json` (if exists)
- [ ] Update CHANGELOG.md (create if doesn't exist)
- [ ] Git tag: `git tag v0.7.0`
- [ ] Update PR description with version info

---

## 📊 Semantic Versioning Reference

**Format:** MAJOR.MINOR.PATCH (e.g., 1.2.3)

- **MAJOR (1.x.x):** Breaking changes, incompatible API changes
- **MINOR (x.2.x):** New features, backwards-compatible
- **PATCH (x.x.3):** Bug fixes, backwards-compatible

**Your changes:**
- Registry Pattern: MINOR (new architecture, backwards-compatible)
- DSA5 Support: MINOR (new feature)
- Creature fix: PATCH (bug fix)
- **Combined:** MINOR bump → 0.6.0 → 0.7.0

---

## 🎯 Final Recommendation

### **Use Version 0.7.0**

**Immediate actions:**
1. Bump all version numbers to 0.7.0
2. Create CHANGELOG.md documenting changes
3. Complete pending improvements (stats fix, CR warning)
4. Tag release: `v0.7.0-dsa5` or `v0.7.0`
5. Merge PR to your master branch
6. Consider upstreaming to Adam's repo (separate PR)

**Future path:**
- **v0.7.1** - After stats fix + CR warning (patch improvements)
- **v0.8.0** - If you add another game system (PF1e, SWADE, etc.)
- **v1.0.0** - When you consider multi-system support stable + production-ready

---

## 📌 Notes

**Dependencies:**
- Your `@foundry-mcp/shared` is at ^0.5.0 (as dependency)
- Check if Adam's shared package updated to 0.6.x
- May need to align shared package version

**Git Strategy:**
- Current branch: `claude/fix-dsa5-bug-S84Ey`
- Merging to: `master` (your fork)
- Upstream: Adam's `main` branch (0.6.1)
- **Recommendation:** Keep your fork versioned independently (0.7.0)

**Contributor Attribution:**
- ✅ Already added frankyh75 to contributors in module.json (line 20)
- Consider adding DSA5 support to description/features list

---

**Created:** 2024-12-20
**Author:** Claude Code
**Status:** Ready for version bump to v0.7.0
