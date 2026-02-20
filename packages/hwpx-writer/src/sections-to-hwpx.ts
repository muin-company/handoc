/**
 * sections-to-hwpx.ts — Convenience function to convert sections to HWPX
 */

import type { Section, DocumentHeader, FontFaceDecl, CharProperty, ParaProperty, StyleDecl } from '@handoc/document-model';
import { writeHwpx } from './index';

/**
 * Convert an array of sections to a complete HWPX file.
 * Creates a minimal header with basic styles and properties.
 */
export function sectionsToHwpx(sections: Section[]): Uint8Array {
  const header = createMinimalHeader(sections.length);
  return writeHwpx({ header, sections });
}

/**
 * Create a minimal document header with default styles.
 */
function createMinimalHeader(sectionCount: number): DocumentHeader {
  // Default font faces
  const fontFaces: FontFaceDecl[] = [
    {
      lang: 'hangul',
      fonts: [
        { id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false },
      ],
    },
    {
      lang: 'latin',
      fonts: [
        { id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false },
      ],
    },
    {
      lang: 'hanja',
      fonts: [
        { id: 0, face: '맑은 고딕', type: 'ttf', isEmbedded: false },
      ],
    },
  ];

  // Default character property (10pt, normal)
  const charProperties: CharProperty[] = [
    {
      id: 0,
      height: 1000, // 10pt in hundredths
      bold: false,
      italic: false,
      attrs: {
        id: '0',
        height: '1000',
        textColor: '0',
      },
      children: [
        {
          tag: 'fontRef',
          attrs: {
            hangul: '0',
            latin: '0',
            hanja: '0',
          },
          children: [],
          text: null,
        },
      ],
    },
    // Bold character property (for headings, bold text)
    {
      id: 1,
      height: 1000,
      bold: true,
      italic: false,
      attrs: {
        id: '1',
        height: '1000',
        textColor: '0',
        bold: '1',
      },
      children: [
        {
          tag: 'fontRef',
          attrs: {
            hangul: '0',
            latin: '0',
            hanja: '0',
          },
          children: [],
          text: null,
        },
      ],
    },
  ];

  // Default paragraph property (left-aligned, normal spacing)
  const paraProperties: ParaProperty[] = [
    {
      id: 0,
      align: 'left',
      lineSpacing: { type: 'percent', value: 160 },
      margin: { left: 0, indent: 0 },
      attrs: {
        id: '0',
      },
      children: [
        {
          tag: 'align',
          attrs: {
            horizontal: 'LEFT',
          },
          children: [],
          text: null,
        },
        {
          tag: 'lineSpacing',
          attrs: {
            type: 'percent',
            value: '160',
          },
          children: [],
          text: null,
        },
      ],
    },
  ];

  // Default styles
  const styles: StyleDecl[] = [
    {
      id: 0,
      type: 'para',
      name: '바탕글',
      engName: 'Normal',
      paraPrIDRef: 0,
      charPrIDRef: 0,
      attrs: {
        id: '0',
        type: 'para',
        name: '바탕글',
        engName: 'Normal',
        paraPrIDRef: '0',
        charPrIDRef: '0',
        nextStyleIDRef: '0',
      },
    },
    // Heading style 1
    {
      id: 1,
      type: 'para',
      name: '제목 1',
      engName: 'Heading 1',
      paraPrIDRef: 0,
      charPrIDRef: 1,
      attrs: {
        id: '1',
        type: 'para',
        name: '제목 1',
        engName: 'Heading 1',
        paraPrIDRef: '0',
        charPrIDRef: '1',
        nextStyleIDRef: '0',
      },
    },
    // Heading style 2
    {
      id: 2,
      type: 'para',
      name: '제목 2',
      engName: 'Heading 2',
      paraPrIDRef: 0,
      charPrIDRef: 1,
      attrs: {
        id: '2',
        type: 'para',
        name: '제목 2',
        engName: 'Heading 2',
        paraPrIDRef: '0',
        charPrIDRef: '1',
        nextStyleIDRef: '0',
      },
    },
    // Heading style 3
    {
      id: 3,
      type: 'para',
      name: '제목 3',
      engName: 'Heading 3',
      paraPrIDRef: 0,
      charPrIDRef: 1,
      attrs: {
        id: '3',
        type: 'para',
        name: '제목 3',
        engName: 'Heading 3',
        paraPrIDRef: '0',
        charPrIDRef: '1',
        nextStyleIDRef: '0',
      },
    },
    // Heading style 4
    {
      id: 4,
      type: 'para',
      name: '제목 4',
      engName: 'Heading 4',
      paraPrIDRef: 0,
      charPrIDRef: 1,
      attrs: {
        id: '4',
        type: 'para',
        name: '제목 4',
        engName: 'Heading 4',
        paraPrIDRef: '0',
        charPrIDRef: '1',
        nextStyleIDRef: '0',
      },
    },
    // Heading style 5
    {
      id: 5,
      type: 'para',
      name: '제목 5',
      engName: 'Heading 5',
      paraPrIDRef: 0,
      charPrIDRef: 1,
      attrs: {
        id: '5',
        type: 'para',
        name: '제목 5',
        engName: 'Heading 5',
        paraPrIDRef: '0',
        charPrIDRef: '1',
        nextStyleIDRef: '0',
      },
    },
    // Heading style 6
    {
      id: 6,
      type: 'para',
      name: '제목 6',
      engName: 'Heading 6',
      paraPrIDRef: 0,
      charPrIDRef: 1,
      attrs: {
        id: '6',
        type: 'para',
        name: '제목 6',
        engName: 'Heading 6',
        paraPrIDRef: '0',
        charPrIDRef: '1',
        nextStyleIDRef: '0',
      },
    },
  ];

  return {
    version: '1.5',
    secCnt: sectionCount,
    beginNum: {
      page: 1,
      footnote: 1,
      endnote: 1,
      pic: 1,
      tbl: 1,
      equation: 1,
    },
    refList: {
      fontFaces,
      borderFills: [],
      charProperties,
      tabProperties: [],
      numberings: [],
      bullets: [],
      paraProperties,
      styles,
      others: [],
    },
  };
}
