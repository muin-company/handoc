/**
 * Table editing keymap
 */
import { goToNextCell, addRowAfter } from 'prosemirror-tables';

export function tableKeymap() {
  return {
    Tab: goToNextCell(1),
    'Shift-Tab': goToNextCell(-1),
    Enter: addRowAfter,
  };
}
