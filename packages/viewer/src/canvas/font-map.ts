/**
 * Font mapping: 한/글 font names → CSS font-family with fallbacks
 * Also provides canvas-compatible font strings.
 */

const FONT_MAP: Record<string, string> = {
  // 바탕 계열 (Serif)
  '함초롬바탕': "'HCR Batang', 'Batang', '바탕', 'AppleMyungjo', serif",
  '바탕': "'Batang', '바탕', 'AppleMyungjo', serif",
  '바탕체': "'BatangChe', '바탕체', serif",
  '궁서': "'Gungsuh', '궁서', serif",
  '궁서체': "'GungsuhChe', '궁서체', serif",
  '신명조': "'New Batang', serif",
  '휴먼명조': "'HumanMyeongjo', 'AppleMyungjo', serif",
  '한양신명조': "'HYSinMyeongJo', 'AppleMyungjo', serif",

  // 돋움 계열 (Sans-serif)
  '함초롬돋움': "'HCR Dotum', 'Dotum', '돋움', 'Apple SD Gothic Neo', sans-serif",
  '돋움': "'Dotum', '돋움', 'Apple SD Gothic Neo', sans-serif",
  '돋움체': "'DotumChe', '돋움체', monospace",
  '맑은 고딕': "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif",
  '굴림': "'Gulim', '굴림', sans-serif",
  '굴림체': "'GulimChe', '굴림체', monospace",
  '휴먼고딕': "'HumanGothic', 'Apple SD Gothic Neo', sans-serif",
  '한양중고딕': "'HYJungGothic', 'Apple SD Gothic Neo', sans-serif",

  // Latin
  'Times New Roman': "'Times New Roman', serif",
  'Arial': "'Arial', sans-serif",
  'Courier New': "'Courier New', monospace",
};

/** Default font if nothing matches */
const DEFAULT_FONT = "'Batang', '바탕', 'AppleMyungjo', serif";

/** Get CSS font-family string for a 한/글 font name */
export function getFontFamily(fontName: string | undefined): string {
  if (!fontName) return DEFAULT_FONT;
  return FONT_MAP[fontName] ?? `'${fontName}', ${DEFAULT_FONT}`;
}

/**
 * Build a canvas-compatible font string
 * Format: "[italic] [bold] <size>px <family>"
 */
export function canvasFont(
  fontFamily: string,
  sizePt: number,
  bold: boolean = false,
  italic: boolean = false,
  dpi: number = 96,
): string {
  const sizePx = (sizePt / 72) * dpi;
  const parts: string[] = [];
  if (italic) parts.push('italic');
  if (bold) parts.push('bold');
  parts.push(`${sizePx.toFixed(1)}px`);
  // For canvas, use first font name only (simplified)
  parts.push(fontFamily);
  return parts.join(' ');
}

/**
 * Resolve font name from HanDoc header fontFaces
 */
export function resolveFontFromHeader(
  fontFaces: Array<{ lang: string; fonts: Array<{ id: number; face: string }> }>,
  fontRefId: number,
  lang: string = 'HANGUL',
): string | undefined {
  const langFaces = fontFaces.find(f => f.lang === lang);
  if (!langFaces) return undefined;
  const font = langFaces.fonts.find(f => f.id === fontRefId);
  return font?.face;
}
