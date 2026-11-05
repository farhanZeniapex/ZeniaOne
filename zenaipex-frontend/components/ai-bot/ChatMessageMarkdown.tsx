"use client";

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageMarkdownProps {
  content: string;
}

const markdownComponents = {
  ul: ({ children }: any) => <ul className="list-none space-y-1 pl-0">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-none space-y-1 pl-0">{children}</ol>,
  li: ({ children }: any) => (
    <li className="relative block rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1 pl-6 leading-snug before:absolute before:left-2.5 before:top-[0.7rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-500 before:content-['']">
      {children}
    </li>
  ),
  hr: () => <hr className="!my-1 border-slate-200" />,
  h3: ({ children }: any) => <h3 className="!mb-0 !mt-0 text-base font-bold text-[#0C4A31]">{children}</h3>,
  table: ({ children }: any) => (
    <div className="my-2.5 w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-sm">
      <table className="w-full text-left text-[12.5px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-[#F0F6F2] text-[#1E4D38] font-bold border-b border-slate-200/80">{children}</thead>
  ),
  th: ({ children }: any) => (
    <th className="px-3.5 py-2 text-[#1E4D38] font-semibold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="px-3.5 py-2 border-b border-slate-100 text-slate-700 last:border-b-0">{children}</td>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="my-2.5 rounded-xl border-l-4 border-emerald-500 bg-emerald-50/70 p-3 text-[13.5px] text-emerald-950 shadow-sm">
      {children}
    </blockquote>
  ),
};

export const ChatMessageMarkdown = memo(function ChatMessageMarkdown({ content }: ChatMessageMarkdownProps) {
  return (
    <div className="prose prose-sm max-w-none text-[14px] prose-p:my-1 prose-p:leading-snug prose-headings:mb-1.5 prose-headings:mt-2 prose-headings:font-bold prose-headings:text-[#0C4A31] prose-h3:text-base prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:leading-snug prose-strong:font-bold prose-strong:text-[#0C4A31] prose-code:rounded-md prose-code:border prose-code:border-emerald-100 prose-code:bg-emerald-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-semibold prose-code:text-[#17613C] prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800 prose-a:text-sage-600 prose-p:last:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

