import { Fragment } from "react";

function renderInline(text: string): React.ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>;
    }
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return <code key={i} className="bg-border-light rounded px-1 py-0.5 text-xs font-mono break-all">{seg.slice(1, -1)}</code>;
    }
    return <Fragment key={i}>{seg}</Fragment>;
  });
}

export function MarkdownText({ content, className = "" }: { content: string; className?: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-sm font-bold text-text mt-3 mb-1 first:mt-0">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-text mt-2 mb-0.5">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 list-none">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 text-sm leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-muted" />
              <span className="min-w-0 break-words">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
        num++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm leading-relaxed">
              <span className="flex-shrink-0 font-mono text-xs text-text-muted mt-0.5">{j + 1}.</span>
              <span className="min-w-0 break-words">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      void num;
    } else if (line === "") {
      if (elements.length > 0) {
        elements.push(<div key={`sp-${i}`} className="h-2" />);
      }
      i++;
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>
      );
      i++;
    }
  }

  return <div className={`space-y-0.5 break-words ${className}`}>{elements}</div>;
}
