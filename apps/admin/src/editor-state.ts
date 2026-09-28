export type EditorView = 'markdown' | 'rendered' | 'split';

export interface SplitPreferences {
  readonly ratio: number;
  readonly syncScroll: boolean;
}

export interface PreferenceStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

const SPLIT_PREFERENCES_KEY = 'gcake:editor:split-preferences';

export class InMemoryPreferenceStore implements PreferenceStore {
  readonly #values = new Map<string, string>();
  get(key: string): string | undefined { return this.#values.get(key); }
  set(key: string, value: string): void { this.#values.set(key, value); }
}

function clampRatio(value: number): number {
  return Math.min(80, Math.max(20, Math.round(value)));
}

export function loadSplitPreferences(storage: PreferenceStore): SplitPreferences {
  const stored = storage.get(SPLIT_PREFERENCES_KEY);
  if (!stored) return { ratio: 50, syncScroll: true };
  try {
    const parsed = JSON.parse(stored) as Partial<SplitPreferences>;
    return {
      ratio: typeof parsed.ratio === 'number' ? clampRatio(parsed.ratio) : 50,
      syncScroll: typeof parsed.syncScroll === 'boolean' ? parsed.syncScroll : true,
    };
  } catch {
    return { ratio: 50, syncScroll: true };
  }
}

export function saveSplitPreferences(storage: PreferenceStore, value: SplitPreferences): void {
  storage.set(SPLIT_PREFERENCES_KEY, JSON.stringify({
    ratio: clampRatio(value.ratio),
    syncScroll: value.syncScroll,
  }));
}

export class EditorState {
  source: string;
  cursorPosition: number;
  readingPosition: number;
  view: EditorView = 'markdown';
  splitRatio = 50;
  syncScroll = true;

  constructor(source: string, cursorPosition = 0, readingPosition = 0) {
    this.source = source;
    this.cursorPosition = cursorPosition;
    this.readingPosition = readingPosition;
  }

  cycleView(): EditorView {
    this.view = this.view === 'markdown' ? 'rendered' : this.view === 'rendered' ? 'split' : 'markdown';
    return this.view;
  }

  resizeSplit(deltaPercentagePoints: number): number {
    this.splitRatio = clampRatio(this.splitRatio + deltaPercentagePoints);
    return this.splitRatio;
  }
}

export interface PreviewLimitation {
  readonly code: 'UNSUPPORTED_MDX';
  readonly message: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderPortableMarkdown(source: string): string {
  const lines = source.split('\n');
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith('```')) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      output.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\|.*\|$/.test(line) && /^\|[\s:|-]+\|$/.test(lines[index + 1] ?? '')) {
      const rows: string[][] = [];
      const parse = (row: string) => row.slice(1, -1).split('|').map((cell) => cell.trim());
      const header = parse(line);
      index += 2;
      while (index < lines.length && /^\|.*\|$/.test(lines[index] ?? '')) {
        rows.push(parse(lines[index] ?? ''));
        index += 1;
      }
      index -= 1;
      output.push(`<table><thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (line.startsWith('# ')) output.push(`<h1>${renderInline(line.slice(2))}</h1>`);
    else if (line.startsWith('## ')) output.push(`<h2>${renderInline(line.slice(3))}</h2>`);
    else if (line.trim()) output.push(`<p>${renderInline(line)}</p>`);
  }
  return output.join('\n');
}

export function renderImmediatePreview(source: string): {
  readonly source: string;
  readonly html: string;
  readonly limitations: readonly PreviewLimitation[];
} {
  const hasMdx = /<[A-Z][A-Za-z0-9]*(?:\s|\/?>)|\{[^}\n]+\}/.test(source);
  return {
    source,
    html: renderPortableMarkdown(source),
    limitations: hasMdx ? [{
      code: 'UNSUPPORTED_MDX',
      message: '即時預覽不支援互動式 MDX，請使用正式 Astro 預覽確認結果。',
    }] : [],
  };
}
