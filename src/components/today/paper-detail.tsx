"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Star,
  ThumbsDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { QAThread } from "./qa-thread";
import type { PaperItem } from "./paper-card";

interface PaperDetailProps {
  paper: PaperItem;
  session: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
  isStarred?: boolean;
  onBack: () => void;
  onStar: (paperId: string) => void;
  onDislike: (paperId: string) => void;
}

export function PaperDetail({
  paper,
  session,
  isStarred = false,
  onBack,
  onStar,
  onDislike,
}: PaperDetailProps) {
  const [starred, setStarred] = useState(isStarred);
  const [dislikeState, setDislikeState] = useState<
    "idle" | "input" | "submitting" | "done"
  >("idle");
  const [dislikeReason, setDislikeReason] = useState("");

  const handleStar = () => {
    setStarred((prev) => !prev);
    onStar(paper.id);
  };

  const handleDislikeClick = () => {
    if (dislikeState === "idle") {
      setDislikeState("input");
    }
  };

  const handleDislikeSubmit = async () => {
    setDislikeState("submitting");
    try {
      await fetch(`/api/papers/${paper.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dislike",
          reason: dislikeReason,
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      onDislike(paper.id);
    } catch (err) {
      console.error("Failed to submit dislike:", err);
    }
    setDislikeState("done");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="size-4" />
        Back
      </Button>

      {/* Source badge */}
      <Badge variant={paper.source === "arxiv" ? "default" : "secondary"}>
        {paper.source === "arxiv" ? "arXiv" : "News"}
      </Badge>

      {/* Title */}
      <h1 className="text-2xl font-bold leading-tight">{paper.title}</h1>

      {/* Authors */}
      {paper.authors.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {paper.authors.join(", ")}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant={starred ? "default" : "outline"}
          size="sm"
          onClick={handleStar}
        >
          <Star className={`size-4 ${starred ? "fill-current" : ""}`} />
          {starred ? "Starred" : "Star"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDislikeClick}
          disabled={dislikeState !== "idle"}
        >
          <ThumbsDown className="size-4" />
          Dislike
        </Button>

        {paper.sourceUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(paper.sourceUrl!, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="size-4" />
            Open source
          </Button>
        )}
      </div>

      {/* Dislike flow */}
      {dislikeState === "input" && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Why didn't you like this?"
            value={dislikeReason}
            onChange={(e) => setDislikeReason(e.target.value)}
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDislikeSubmit();
            }}
          />
          <Button size="sm" onClick={handleDislikeSubmit}>
            Submit
          </Button>
        </div>
      )}
      {dislikeState === "submitting" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Submitting...
        </div>
      )}
      {dislikeState === "done" && (
        <p className="text-sm text-muted-foreground italic">
          Thanks, we&apos;ll consider this.
        </p>
      )}

      {/* Keywords */}
      {paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {paper.keywords.map((kw) => (
            <Badge key={kw} variant="outline" className="text-xs">
              {kw}
            </Badge>
          ))}
        </div>
      )}

      <Separator />

      {/* AI Summary */}
      {paper.summary && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-tight">AI Summary</h2>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {paper.summary}
            </p>
          </section>
          <Separator />
        </>
      )}

      {/* Q&A Thread */}
      <QAThread
        paperId={paper.id}
        apiKey={session.apiKey}
        provider={session.provider}
        model={session.model}
        baseUrl={session.baseUrl}
      />
    </div>
  );
}
