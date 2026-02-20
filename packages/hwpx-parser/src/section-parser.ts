import type { Section } from './types';
import { parseXml, getChildren } from './xml-utils';
import { parseParagraph } from './paragraph-parser';

export function parseSection(xml: string): Section {
  const root = parseXml(xml);
  const paragraphs: Section['paragraphs'] = [];

  // Root could be { sec: { p: [...] } } after namespace removal
  const sec = root['sec'] as Record<string, unknown> | undefined;
  if (!sec) return { paragraphs };

  const pNodes = getChildren(sec, 'p');
  for (const pNode of pNodes) {
    paragraphs.push(parseParagraph(pNode));
  }

  return { paragraphs };
}

export function extractText(section: Section): string[] {
  return section.paragraphs.map(p =>
    p.runs
      .flatMap(r =>
        r.children
          .filter((c): c is { type: 'text'; content: string } => c.type === 'text')
          .map(c => c.content),
      )
      .join(''),
  );
}
