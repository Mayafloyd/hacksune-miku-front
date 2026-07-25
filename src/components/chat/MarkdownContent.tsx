import type { ReactNode } from 'react';

interface MarkdownContentProps {
  readonly content: string;
  readonly className?: string;
}

const INLINE_TOKEN =
  /(\[[^\]\n]+\]\((?:https?:\/\/|\/)[^\s)]+\)|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|`[^`\n]+?`|\*[^*\n]+?\*|_[^_\n]+?_)/g;

function textWithLineBreaks(text: string, keyPrefix: string): ReactNode[] {
  return text.split('\n').flatMap((line, index, lines) => {
    const nodes: ReactNode[] = [line];
    if (index < lines.length - 1) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }
    return nodes;
  });
}

function inlineContent(source: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of source.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    const token = match[0];

    if (index > cursor) {
      nodes.push(...textWithLineBreaks(source.slice(cursor, index), `${keyPrefix}-text-${tokenIndex}`));
    }

    const key = `${keyPrefix}-token-${tokenIndex}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key}>{inlineContent(token.slice(2, -2), `${key}-strong`)}</strong>);
    } else if (token.startsWith('__') && token.endsWith('__')) {
      nodes.push(<strong key={key}>{inlineContent(token.slice(2, -2), `${key}-strong`)}</strong>);
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(<del key={key}>{inlineContent(token.slice(2, -2), `${key}-del`)}</del>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)$/);
      if (link) {
        const label = link[1] ?? '';
        const href = link[2] ?? '';
        const external = href.startsWith('http');
        nodes.push(
          <a
            key={key}
            href={href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(<em key={key}>{inlineContent(token.slice(1, -1), `${key}-em`)}</em>);
    }

    cursor = index + token.length;
    tokenIndex += 1;
  }

  if (cursor < source.length) {
    nodes.push(...textWithLineBreaks(source.slice(cursor), `${keyPrefix}-tail`));
  }

  return nodes;
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

function isHorizontalRule(line: string) {
  const compact = line.trim().replace(/\s/g, '');
  return /^([-*_])\1{2,}$/.test(compact) || /^[━─—]{3,}$/.test(compact);
}

function beginsNewBlock(lines: string[], index: number) {
  const line = lines[index] ?? '';
  const next = lines[index + 1] ?? '';

  return (
    line.trim() === '' ||
    /^```/.test(line.trim()) ||
    /^#{1,4}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-+*]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    isHorizontalRule(line) ||
    (line.includes('|') && isTableSeparator(next))
  );
}

function renderMarkdown(content: string) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  let blockIndex = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    const key = `markdown-block-${blockIndex}`;

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={key} className="markdown-content__code-block">
          <code className={language ? `language-${language}` : undefined}>{code.join('\n')}</code>
        </pre>,
      );
      blockIndex += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min((heading[1] ?? '').length + 1, 6);
      const Heading = `h${level}` as keyof React.JSX.IntrinsicElements;
      blocks.push(<Heading key={key}>{inlineContent(heading[2] ?? '', `${key}-heading`)}</Heading>);
      index += 1;
      blockIndex += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push(<hr key={key} />);
      index += 1;
      blockIndex += 1;
      continue;
    }

    if (line.includes('|') && isTableSeparator(lines[index + 1] ?? '')) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && (lines[index] ?? '').includes('|') && (lines[index] ?? '').trim()) {
        rows.push(tableCells(lines[index] ?? ''));
        index += 1;
      }

      blocks.push(
        <div key={key} className="markdown-content__table-wrap" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th key={`${key}-header-${cellIndex}`} scope="col">
                    {inlineContent(cell, `${key}-header-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`${key}-cell-${rowIndex}-${cellIndex}`}>
                      {inlineContent(row[cellIndex] ?? '', `${key}-cell-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      blockIndex += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      const itemPattern = orderedList ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/;

      while (index < lines.length) {
        const item = (lines[index] ?? '').match(itemPattern);
        if (!item) break;
        items.push(item[1] ?? '');
        index += 1;
      }

      const List = orderedList ? 'ol' : 'ul';
      blocks.push(
        <List key={key}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-item-${itemIndex}`}>
              {inlineContent(item, `${key}-item-${itemIndex}`)}
            </li>
          ))}
        </List>,
      );
      blockIndex += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={key}>{inlineContent(quote.join('\n'), `${key}-quote`)}</blockquote>,
      );
      blockIndex += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && !beginsNewBlock(lines, index)) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    blocks.push(<p key={key}>{inlineContent(paragraph.join('\n'), `${key}-paragraph`)}</p>);
    blockIndex += 1;
  }

  return blocks;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={['markdown-content', className].filter(Boolean).join(' ')}>
      {renderMarkdown(content)}
    </div>
  );
}
