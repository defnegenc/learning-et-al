"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface QAPair {
  id: string;
  question: string;
  answer: string;
}

interface QAThreadProps {
  paperId: string;
  apiKey: string;
  provider: string;
  model: string;
  baseUrl: string;
}

export function QAThread({ paperId, apiKey, provider, model, baseUrl }: QAThreadProps) {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchQA = useCallback(async () => {
    try {
      const res = await fetch(`/api/papers/${paperId}/qa`);
      if (!res.ok) return;
      const data = await res.json();
      setPairs(data.qaPairs ?? []);
    } catch (err) {
      console.error("Failed to fetch Q&A:", err);
    } finally {
      setFetching(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchQA();
  }, [fetchQA]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setQuestion("");

    try {
      const res = await fetch(`/api/papers/${paperId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, apiKey, provider, model, baseUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        const newPair: QAPair = data.qaPair;
        setPairs((prev) => [...prev, newPair]);
        setExpandedIds((prev) => new Set(prev).add(newPair.id));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch (err) {
      console.error("Failed to submit question:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3
          className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          Q&amp;A // {pairs.length} THREADS
        </h3>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-[#555]" />
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.map((pair) => {
            const expanded = expandedIds.has(pair.id);
            return (
              <div
                key={pair.id}
                className="border border-[#1a1a1a] transition-colors hover:bg-[#f0f0f0]"
                style={{ borderWidth: "1.5px", cursor: "crosshair" }}
                onClick={() => toggleExpand(pair.id)}
              >
                <div className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    {expanded ? (
                      <ChevronDown className="size-3 mt-0.5 shrink-0 text-[#555]" />
                    ) : (
                      <ChevronRight className="size-3 mt-0.5 shrink-0 text-[#555]" />
                    )}
                    <p
                      className="text-[0.8rem] font-bold text-[#1a1a1a] uppercase"
                      style={{ fontFamily: '"Courier New", Courier, monospace', letterSpacing: "0.5px" }}
                    >
                      {pair.question}
                    </p>
                  </div>
                  {expanded && (
                    <div className="ml-5 border-t border-[#1a1a1a] pt-2" style={{ borderTopWidth: "1px" }}>
                      <p className="text-[0.8rem] text-[#555] whitespace-pre-wrap leading-relaxed">
                        {pair.answer}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Question input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <textarea
            placeholder="ASK A QUESTION ABOUT THIS PAPER..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="w-full border border-[#1a1a1a] bg-transparent px-3 py-2 text-[0.8rem] placeholder:text-[#555] placeholder:uppercase placeholder:tracking-[1px] focus:outline-none disabled:opacity-50 min-h-10"
            style={{
              borderWidth: "1.5px",
              resize: "none",
              fontFamily: '"Courier New", Courier, monospace',
              borderRadius: 0,
              cursor: "crosshair",
            }}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-3 animate-spin text-[#555]" />
            </div>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !question.trim()}
          className="border border-[#1a1a1a] px-4 py-2 text-[0.65rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-[#e8e8e8] transition-colors disabled:opacity-50 self-start"
          style={{
            borderWidth: "1.5px",
            fontFamily: '"Courier New", Courier, monospace',
            cursor: "crosshair",
          }}
        >
          ASK
        </button>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
