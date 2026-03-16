"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaperItem } from "@/components/today/paper-card";

interface CompareViewProps {
  content: string;
  papers: PaperItem[];
  onBack: () => void;
}

export function CompareView({ content, papers, onBack }: CompareViewProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="size-4" />
        Back to Vault
      </Button>

      <h1 className="text-2xl font-bold tracking-tight">Comparison</h1>

      <div className="flex flex-wrap gap-2">
        {papers.map((paper) => (
          <Badge key={paper.id} variant="secondary" className="max-w-[240px]">
            <span className="truncate">{paper.title}</span>
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
