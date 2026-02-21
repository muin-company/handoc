/**
 * Additional paragraph-parser tests for uncovered branches.
 */
import { describe, it, expect } from 'vitest';
import { parseParagraph } from '../paragraph-parser';

describe('parseParagraph - hiddenComment', () => {
  it('parses hiddenComment element', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        hiddenComment: {
          p: {
            '@_paraPrIDRef': '0',
            run: {
              '@_charPrIDRef': '0',
              t: 'Hidden comment text',
            },
          },
        },
      },
    };

    const para = parseParagraph(paraNode);
    expect(para.runs).toHaveLength(1);
    expect(para.runs[0].children).toHaveLength(1);
    expect(para.runs[0].children[0].type).toBe('hiddenComment');
    
    const hiddenComment = para.runs[0].children[0] as any;
    expect(hiddenComment.paragraphs).toHaveLength(1);
    expect(hiddenComment.paragraphs[0].runs[0].children[0]).toEqual({
      type: 'text',
      content: 'Hidden comment text',
    });
  });

  it('parses HIDDENCOMMENT element (uppercase)', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        HIDDENCOMMENT: {
          p: [
            {
              '@_paraPrIDRef': '0',
              run: {
                '@_charPrIDRef': '0',
                t: 'First comment para',
              },
            },
            {
              '@_paraPrIDRef': '0',
              run: {
                '@_charPrIDRef': '0',
                t: 'Second comment para',
              },
            },
          ],
        },
      },
    };

    const para = parseParagraph(paraNode);
    expect(para.runs[0].children[0].type).toBe('hiddenComment');
    
    const hiddenComment = para.runs[0].children[0] as any;
    expect(hiddenComment.paragraphs).toHaveLength(2);
    expect(hiddenComment.paragraphs[0].runs[0].children[0].content).toBe('First comment para');
    expect(hiddenComment.paragraphs[1].runs[0].children[0].content).toBe('Second comment para');
  });

  it('handles hiddenComment with no paragraphs', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        hiddenComment: {
          // No 'p' elements
          '@_id': 'comment1',
        },
      },
    };

    const para = parseParagraph(paraNode);
    expect(para.runs[0].children[0].type).toBe('hiddenComment');
    const hiddenComment = para.runs[0].children[0] as any;
    expect(hiddenComment.paragraphs).toEqual([]);
  });
});

describe('parseParagraph - unknown elements as inlineObject', () => {
  it('parses unknown element as inlineObject', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        unknownElement: {
          '@_customAttr': 'value',
          customChild: {
            '@_id': '123',
          },
        },
      },
    };

    const para = parseParagraph(paraNode);
    expect(para.runs[0].children).toHaveLength(1);
    expect(para.runs[0].children[0].type).toBe('inlineObject');
    
    const inlineObj = para.runs[0].children[0] as any;
    expect(inlineObj.name).toBe('unknownElement');
    expect(inlineObj.element).toBeDefined();
    expect(inlineObj.element.tag).toBe('unknownElement');
    expect(inlineObj.element.attrs.customAttr).toBe('value');
  });

  it('parses multiple unknown elements', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        customElement1: {
          '@_attr1': 'val1',
        },
        customElement2: {
          '@_attr2': 'val2',
        },
      },
    };

    const para = parseParagraph(paraNode);
    const children = para.runs[0].children;
    
    // Find the unknown elements
    const unknowns = children.filter(c => c.type === 'inlineObject');
    expect(unknowns.length).toBeGreaterThanOrEqual(2);
  });

  it('handles non-object value for unknown element', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        weirdElement: 'string value',
      },
    };

    const para = parseParagraph(paraNode);
    const inlineObjs = para.runs[0].children.filter(c => c.type === 'inlineObject');
    
    // Should still parse as inlineObject with text
    expect(inlineObjs.length).toBeGreaterThan(0);
  });
});

describe('parseParagraph - complex mixed content', () => {
  it('parses paragraph with text, hiddenComment, and unknown elements', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: [
        {
          '@_charPrIDRef': '0',
          t: 'Normal text',
        },
        {
          '@_charPrIDRef': '0',
          hiddenComment: {
            subList: {
              p: {
                '@_paraPrIDRef': '0',
                run: {
                  '@_charPrIDRef': '0',
                  t: 'Comment',
                },
              },
            },
          },
        },
        {
          '@_charPrIDRef': '0',
          customWidget: {
            '@_type': 'special',
          },
        },
      ],
    };

    const para = parseParagraph(paraNode);
    expect(para.runs).toHaveLength(3);
    
    // First run: normal text
    expect(para.runs[0].children[0]).toEqual({
      type: 'text',
      content: 'Normal text',
    });
    
    // Second run: hiddenComment
    expect(para.runs[1].children[0].type).toBe('hiddenComment');
    
    // Third run: unknown element
    const unknowns = para.runs[2].children.filter(c => c.type === 'inlineObject');
    expect(unknowns.length).toBeGreaterThan(0);
  });

  it('handles run with only unknown elements (no text)', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        widget1: { '@_id': '1' },
        widget2: { '@_id': '2' },
        // No text element
      },
    };

    const para = parseParagraph(paraNode);
    expect(para.runs).toHaveLength(1);
    
    // All children should be inlineObjects (or other known types)
    const hasInlineObj = para.runs[0].children.some(c => c.type === 'inlineObject');
    expect(hasInlineObj).toBe(true);
  });

  it('handles empty hiddenComment node', () => {
    const paraNode = {
      '@_paraPrIDRef': '0',
      run: {
        '@_charPrIDRef': '0',
        hiddenComment: null,
      },
    };

    const para = parseParagraph(paraNode);
    expect(para.runs[0].children[0].type).toBe('hiddenComment');
    const hiddenComment = para.runs[0].children[0] as any;
    expect(hiddenComment.paragraphs).toEqual([]);
  });
});
