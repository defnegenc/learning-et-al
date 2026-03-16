"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

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
      setPairs(data.qa ?? []);
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
        const newPair: QAPair = data.qa;
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
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">
          Q&amp;A ({pairs.length})
        </h3>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.map((pair) => {
            const expanded = expandedIds.has(pair.id);
            return (
              <Card
                key={pair.id}
                className="cursor-pointer transition-shadow hover:shadow-sm"
                onClick={() => toggleExpand(pair.id)}
              >
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-start gap-2">
                    {expanded ? (
                      <ChevronDown className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">{pair.question}</p>
                  </div>
                  {expanded && (
                    <div className="ml-6 border-t pt-2">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {pair.answer}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Textarea
          placeholder="Ask a question about this paper..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="pr-10 min-h-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
