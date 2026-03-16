"use client";

import { Star, ThumbsDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PaperItem {
  id: string;
  title: string;
  summary: string | null;
  source: "arxiv" | "rss";
  sourceUrl: string | null;
  keywords: string[];
  authors: string[];
}

interface PaperCardProps {
  paper: PaperItem;
  highlighted?: boolean;
  onSelect: (paper: PaperItem) => void;
  onStar: (paperId: string) => void;
  onDislike: (paperId: string) => void;
}

export function PaperCard({
  paper,
  highlighted = false,
  onSelect,
  onStar,
  onDislike,
}: PaperCardProps) {
  return (
    <Card
      className={`group relative cursor-pointer transition-shadow hover:shadow-md ${
        highlighted ? "ring-2 ring-primary/40" : ""
      }`}
      onClick={() => onSelect(paper)}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant={paper.source === "arxiv" ? "default" : "secondary"}
          >
            {paper.source === "arxiv" ? "arXiv" : "News"}
          </Badge>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onStar(paper.id);
              }}
            >
              <Star className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDislike(paper.id);
              }}
            >
              <ThumbsDown className="size-3.5" />
            </Button>
          </div>
        </div>
        <CardTitle className="line-clamp-2 text-sm leading-snug">
          {paper.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {paper.summary && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {paper.summary}
          </p>
        )}
        {paper.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {paper.keywords.slice(0, 3).map((kw) => (
              <Badge key={kw} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {kw}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
