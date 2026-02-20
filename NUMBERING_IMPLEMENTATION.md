# Numbering/Bullet Implementation Summary

## Overview
Successfully implemented numbering (NumberingProperty) and bullet (BulletProperty) rendering in the HanDoc viewer and writer packages.

## Changes Made

### 1. Document Model (`packages/document-model/src/header-types.ts`)
- Made `tabProperties`, `numberings`, and `bullets` optional in `RefList` interface
- This allows backward compatibility with existing documents that don't have these properties

### 2. Viewer (`packages/viewer/src/render.ts`)
- **Added imports**: `NumberingProperty`, `BulletProperty` types
- **New function**: `getNumberingPrefix(para, ctx)` 
  - Extracts numbering/bullet prefix for paragraphs with `heading` property
  - Handles both `numberings` (e.g., "1.", "가.") and `bullets` (e.g., "●", "○")
  - Supports multi-level numbering patterns
- **Modified**: `paragraphToHtml()` to prepend numbering prefix with class `handoc-numbering`

### 3. Writer (`packages/hwpx-writer/src/header-writer.ts`)
- **Added imports**: `NumberingProperty`, `BulletProperty`, `ParaHead`, `TabProperty`
- **New functions**:
  - `writeTabProperties()`: Serializes tab stop definitions
  - `writeNumberings()`: Serializes numbering definitions with levels
  - `writeBullets()`: Serializes bullet definitions with levels
  - `writeParaHead()`: Serializes individual level configurations
- **Modified**: `writeRefList()` to call new serialization functions
- **Modified**: `writeParaProperties()` to serialize `heading` element when present
  - Only adds heading if not already in children (avoids duplication)

### 4. Tests (`packages/viewer/src/__tests__/render.test.ts`)
- Added test suite for numbering rendering:
  - `renders numbering prefix for OUTLINE heading`
  - `renders bullet prefix for bullet heading`
  - `does not render prefix for non-OUTLINE paragraphs`

### 5. Writer Tests (`packages/hwpx-writer/src/__tests__/index.test.ts`)
- Updated header round-trip tests to compare `tabProperties`, `numberings`, and `bullets`

## How It Works

### Rendering Flow
1. Parser extracts `numberings`/`bullets` from header XML into structured objects
2. Parser extracts `heading` from paragraph properties
3. Viewer's `paragraphToHtml()` calls `getNumberingPrefix()` for each paragraph
4. `getNumberingPrefix()`:
   - Resolves paragraph property by `paraPrIDRef`
   - Checks if paragraph has `heading` with type `OUTLINE` or `NUMBER`
   - Looks up numbering/bullet definition by `heading.idRef`
   - Finds appropriate level pattern by `heading.level`
   - Returns formatted prefix (e.g., "1. ", "● ")
5. Prefix is wrapped in `<span class="handoc-numbering">` and prepended to paragraph

### Writing Flow
1. Writer serializes `numberings` and `bullets` arrays to XML
2. Writer serializes `heading` element within `paraPr` when present
3. Round-trip parsing maintains all numbering information

## Example Output

Input paragraph with heading:
```typescript
{
  id: '2',
  paraPrIDRef: 1,  // Links to ParaProperty with heading
  runs: [{ children: [{ type: 'text', content: 'First item' }] }]
}
```

ParaProperty:
```typescript
{
  id: 1,
  heading: { type: 'OUTLINE', idRef: 0, level: 0 }
}
```

Numbering definition:
```typescript
{
  id: 0,
  levels: [{ level: 0, text: '^1.', numFormat: 'DIGIT' }]
}
```

Rendered HTML:
```html
<p class="handoc-para">
  <span class="handoc-numbering">1. </span>
  First item
</p>
```

## Testing

### Unit Tests
- ✅ All existing viewer tests pass (32 tests)
- ✅ All existing writer tests pass (49 tests)  
- ✅ All existing parser tests pass (66 tests)
- ✅ New numbering rendering tests pass (3 tests)

### Integration Test
Created `test-numbering.ts` demonstrating:
1. Writing HWPX with numbering/bullets
2. Round-trip parsing
3. HTML rendering with correct prefixes

All integration tests pass. ✨

## Completion Status

✅ **Viewer numbering display**: Implemented
✅ **Writer numbering preservation**: Implemented  
✅ **Tests added**: Completed
✅ **Full build**: Successful
✅ **Full test suite**: Passing

All completion criteria met!
