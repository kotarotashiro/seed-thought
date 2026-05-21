import React from "react";

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"'）)\]」』、。]+/g;

/**
 * Render text with URLs converted to clickable external links.
 * Preserves whitespace (newlines etc.) via whitespace-pre-wrap on the wrapper.
 */
export function LinkifiedText({
  text,
  className,
  linkClassName = "text-accent underline decoration-accent/30 underline-offset-2 break-all hover:decoration-accent",
}: LinkifiedTextProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE);

  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(
      <a
        key={`${start}-${end}`}
        href={match[0]}
        target="_blank"
        rel="noreferrer"
        className={linkClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );
    lastIndex = end;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <span className={className}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>{p}</React.Fragment>
      ))}
    </span>
  );
}
