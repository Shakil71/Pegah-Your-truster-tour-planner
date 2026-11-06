import { Fragment } from "react";

/**
 * Renders stored plain text: blank-line paragraphs, "## " headings and "• "
 * bullet lines. Never renders HTML.
 */
export function TextBlocks({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className={className ?? "grid gap-3 text-[0.92rem] text-ink-2"}>
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h3 key={i} className="mt-1 text-[0.95rem] font-semibold text-ink">
              {block.slice(3)}
            </h3>
          );
        }
        const lines = block.split("\n");
        const bullets = lines.filter((l) => l.startsWith("• "));
        if (bullets.length > 0 && bullets.length === lines.length) {
          return (
            <ul key={i} className="grid list-disc gap-1 pl-5">
              {bullets.map((l, k) => (
                <li key={k}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {lines.map((l, k) => (
              <Fragment key={k}>
                {k > 0 && "\n"}
                {l}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
