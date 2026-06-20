"use client";

import React from "react";

// Inline text renderer: handles **bold** and plain text
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-[#223149]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: { text: string; checked?: boolean }[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const hasCheckboxes = listItems.some((li) => li.checked !== undefined);
    nodes.push(
      hasCheckboxes ? (
        <ul key={key++} className="space-y-1.5 mb-3 ml-1">
          {listItems.map((li, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#5F7C84]">
              <span
                className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center ${
                  li.checked
                    ? "bg-[#223149] border-[#223149]"
                    : "border-[#9BADB7]"
                }`}
              >
                {li.checked && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <InlineText text={li.text} />
            </li>
          ))}
        </ul>
      ) : (
        <ul key={key++} className="list-disc list-inside space-y-1 mb-3 ml-1 text-sm text-[#5F7C84]">
          {listItems.map((li, i) => (
            <li key={i}>
              <InlineText text={li.text} />
            </li>
          ))}
        </ul>
      )
    );
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith("### ")) {
      flushList();
      nodes.push(
        <h3 key={key++} className="text-sm font-bold text-[#223149] mt-4 mb-1.5">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h2 key={key++} className="text-base font-bold text-[#223149] mt-5 mb-2 pb-1.5 border-b border-[#ECE3DF]">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      flushList();
      nodes.push(
        <h1 key={key++} className="text-lg font-bold text-[#223149] mt-4 mb-2">
          {line.slice(2)}
        </h1>
      );
    }
    // Checkboxes: - [ ] text or - [x] text
    else if (/^- \[[ x]\] /.test(line)) {
      const checked = line.startsWith("- [x]");
      listItems.push({ text: line.slice(6), checked });
    }
    // Bullet list
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push({ text: line.slice(2) });
    }
    // Blank line
    else if (line.trim() === "") {
      flushList();
    }
    // Paragraph
    else {
      flushList();
      nodes.push(
        <p key={key++} className="text-sm text-[#5F7C84] mb-2 leading-relaxed">
          <InlineText text={line} />
        </p>
      );
    }
  }

  flushList();

  return <div className="space-y-0">{nodes}</div>;
}
