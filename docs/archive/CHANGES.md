# HanDoc Changes - 2025-02-21

## TASK-023: Shape & Equation Writer Support ✅

### Summary
Added programmatic API for creating shapes and equations in HWPX documents.

### Changes
- ✨ **New**: `HwpxBuilder.addShape(options)` - Create shapes (rect, ellipse, line, arc, polygon, curve)
- ✨ **New**: `HwpxBuilder.addEquation(options)` - Create equations with MathML-style script notation
- 📝 Added comprehensive tests for both methods

### Example Usage
```typescript
import { HwpxBuilder } from '@handoc/hwpx-writer';

const bytes = HwpxBuilder.create()
  .addShape({
    shapeType: 'rect',
    width: 5000,
    height: 3000,
    text: 'Hello',
  })
  .addEquation({
    script: 'x = {-b +- sqrt{b^2 - 4ac}} over {2a}',
  })
  .build();
```

### Files Modified
- `packages/hwpx-writer/src/builder.ts`
- `packages/hwpx-writer/src/__tests__/builder.test.ts`

---

## TASK-016: CharProperty Extension ✅

### Summary
Extended CharProperty interface with convenience flags for superscript/subscript detection.

### Changes
- ✨ **New**: `CharProperty.superscript?: boolean` - Auto-set when offset is positive
- ✨ **New**: `CharProperty.subscript?: boolean` - Auto-set when offset is negative
- 📝 Added test for offset-based flag detection

### Background
HWPX represents superscript/subscript using offset values:
- Positive offset → superscript (위첨자)
- Negative offset → subscript (아래첨자)

The new flags provide a simpler API while maintaining full backward compatibility.

### Example
```typescript
const charProp = header.refList.charProperties[0];

// Old way (still works):
if (charProp.offset?.hangul > 0) { /* is superscript */ }

// New way (easier):
if (charProp.superscript) { /* is superscript */ }
```

### Files Modified
- `packages/document-model/src/header-types.ts`
- `packages/hwpx-parser/src/header-parser.ts`
- `packages/hwpx-parser/src/__tests__/header-parser.test.ts`

---

## Test Results

### Full Build ✅
```
Tasks:    11 successful, 11 total
Time:     875ms
```

### Full Test Suite ✅
```
Tasks:        22 successful, 22 total
Test Files:   32 passed
Tests:        281 passed, 13 skipped
```

### Package-Specific Results
- `hwpx-parser`: 66 tests passed (includes new superscript/subscript test)
- `hwpx-writer`: 49 tests passed (includes new shape/equation tests)

---

## Backward Compatibility ✅

All changes maintain full backward compatibility:
- Only optional properties added
- No breaking changes to existing APIs
- All existing tests pass without modification
- Existing documents parse correctly

---

## Next Steps (Optional)

### Potential Enhancements
1. **Builder convenience methods for text formatting:**
   ```typescript
   .addParagraph('Text', { superscript: true })  // auto-convert to offset
   ```

2. **More shape types:**
   - Add support for grouped shapes
   - Add support for connectors/arrows
   - Add support for freeform paths

3. **Equation templates:**
   ```typescript
   .addQuadraticFormula()
   .addPythagoreanTheorem()
   ```

4. **Shape styling:**
   ```typescript
   .addShape({
     shapeType: 'rect',
     fill: '#FF0000',
     stroke: '#000000',
     strokeWidth: 2,
   })
   ```

These are not required for the current tasks but could improve the API in future iterations.

---

## Documentation

Full implementation details in: `TASK-023-016-COMPLETED.md`

Demo code (reference only): `examples/shape-equation-demo.ts`
