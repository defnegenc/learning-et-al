"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { PaperItem } from "./paper-card";

interface Session {
  apiKey: string;
  provider: string;
  model: string;
  baseUrl: string;
}

interface SynthesisChatProps {
  digestId: string;
  papers: PaperItem[];
  session: Session;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function topicHint(paper: PaperItem): string {
  // Use first keyword or first few words of title as a casual topic reference
  if (paper.keywords.length > 0) return paper.keywords[0].toLowerCase();
  const words = paper.title.split(" ").slice(0, 4).join(" ").toLowerCase();
  return words;
}

function buildPreparedQuestions(papers: PaperItem[]) {
  const p0 = papers[0];
  const p1 = papers[1];
  const p2 = papers[2];

  const questions: string[] = [];

  if (p0 && p1) {
    questions.push(`Do the ${topicHint(p0)} and ${topicHint(p1)} findings agree or clash?`);
  }
  if (p0) {
    questions.push(`What did they actually find about ${topicHint(p0)}?`);
  }
  if (p2 && p2.source === "rss") {
    questions.push(`How does the news about ${topicHint(p2)} change the picture?`);
  }
  questions.push("What's the most surprising takeaway here?");
  questions.push("What should I read next to go deeper?");

  return questions.slice(0, 4);
}

function ChatMessage({ msg }: { msg: Message }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = msg.role === "assistant" && msg.content.length > 400;
  const displayContent = isLong && !expanded ? msg.content.slice(0, 400) + "..." : msg.content;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "90%", padding: "10px 14px",
        background: msg.role === "user" ? "#1a1a1a" : "#f5f5f5",
        border: msg.role === "user" ? "none" : "2px solid #e5e7eb",
        color: msg.role === "user" ? "white" : "#1a1a1a",
        fontSize: "0.88rem", lineHeight: 1.7,
        fontFamily: msg.role === "user" ? "var(--font-mono), monospace" : "inherit",
      }}>
        {msg.role === "assistant" ? (
          <div className="prose prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-[#111]">
            <ReactMarkdown>{displayContent}</ReactMarkdown>
          </div>
        ) : (
          msg.content
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: "4px", background: "none", border: "none", cursor: "pointer",
            fontSize: "0.7rem", color: "#888", fontFamily: "var(--font-mono), monospace",
            display: "flex", alignItems: "center", gap: "4px",
          }}
        >
          {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
        </button>
      )}
    </div>
  );
}

export function SynthesisChat({ digestId, papers, session }: SynthesisChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const preparedQuestions = buildPreparedQuestions(papers);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setError(null);
    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/digest/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          digestId,
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to get answer.");
        setMessages((prev) => prev.slice(0, -1));
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      }
    } catch {
      setError("Network error.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        border: "3px solid #1a1a1a",
        background: "white",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
      }}
    >
      {/* Header — black bar */}
      <div
        style={{
          background: "#1a1a1a",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "2px",
            fontFamily: "var(--font-mono), monospace",
            color: "white",
          }}
        >
          Ask about this digest
        </span>
      </div>

      {/* Prepared questions — hidden once conversation starts */}
      {messages.length === 0 && (
      <div style={{ padding: "16px 20px", borderBottom: "2px solid #e5e7eb" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {preparedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={loading}
              style={{
                padding: "8px 16px",
                border: "2px solid #1a1a1a",
                background: "white",
                fontSize: "0.8rem",
                fontWeight: 600,
                fontFamily: "inherit",
                color: "#1a1a1a",
                textAlign: "left",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.1s, color 0.1s",
                lineHeight: 1.4,
                opacity: loading ? 0.5 : 1,
                boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
              }}
              onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; (e.currentTarget as HTMLElement).style.color = "white"; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "white"; (e.currentTarget as HTMLElement).style.color = "#1a1a1a"; }}
            >
              {q}
            </button>
          ))}
        </div>

      </div>
      )}

      {/* Message thread */}
      {messages.length > 0 && (
        <div
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {messages.map((msg, i) => (
            <ChatMessage key={i} msg={msg} />
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite", color: "#888" }} />
              <span style={{ fontSize: "0.7rem", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
                thinking...
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "8px 20px" }}>
          <span style={{ fontSize: "0.7rem", color: "#ff007f", fontFamily: "var(--font-mono), monospace" }}>
            {error}
          </span>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          borderTop: "3px solid #1a1a1a",
          padding: "14px 20px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
          background: "#fafafa",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          placeholder="Ask anything about these papers..."
          disabled={loading}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            color: "#1a1a1a",
            background: "transparent",
          }}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: "8px",
            border: "none",
            background: input.trim() && !loading ? "#1a1a1a" : "#d1d5db",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            transition: "background 0.15s",
          }}
        >
          <Send style={{ width: "14px", height: "14px", color: "white" }} />
        </button>
      </div>
    </div>
  );
}
