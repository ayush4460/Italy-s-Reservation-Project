import React from "react";

interface Props {
  content: string;
}

export const MessageFormatter: React.FC<Props> = ({ content }) => {
  return (
    <div className="whitespace-pre-wrap wrap-break-word text-sm">
      {content.split("\n").map((line, i) => (
        <React.Fragment key={i}>
          {line.split(/(?:\*(.*?)\*)/g).map((part, j) => {
            // If it matches *bold*, it will be captured in group 1.
            // However, split with capturing group includes the separator.
            // For "Hello *World*", split gives ["Hello ", "World", ""]
            // But wait, regex split behavior depends.

            // Let's use a simpler approach: Match bold segments or regular text.
            // Actually, implementing a robust parser is better than split.
            // But split with capturing group `(\*(?:[^*]+)\*)` includes the delimiter too if wrapped in parens? No.

            // Simplest React-safe Bold Parser:
            // Split by `*`? No, because * can be part of text? Assuming WhatsApp markdown style: *bold*

            // Let's iterate segments.
            if (j % 2 === 1) {
              // Odd indices are the captured groups (the bold text without asterisks if we used `\*(.*?)\*`)
              // Or if we just split by `\*`, then every odd one is inside stars? "A *B* C" -> ["A ", "B", " C"]
              return <strong key={j}>{part}</strong>;
            }

            // Even indices are normal text.
            // Now parse links in normal text.
            return (
              <span
                key={j}
                dangerouslySetInnerHTML={{
                  __html: part.replace(
                    /(https?:\/\/[^\s]+)/g,
                    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-primary hover:opacity-80 pointer-events-auto">$1</a>',
                  ),
                }}
              />
            );
          })}
          {i < content.split("\n").length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
};
