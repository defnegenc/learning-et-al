"use client";

import { useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Interest {
  id: string;
  keyword: string;
  weight: number | null;
  source: "seed" | "star" | "engagement" | "dislike";
}

interface KnowledgeGraphProps {
  interests: Interest[];
  onNodeClick?: (keyword: string) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  seed: "#6366f1",
  star: "#eab308",
  engagement: "#22c55e",
  dislike: "#94a3b8",
};

interface Node {
  x: number;
  y: number;
  radius: number;
  keyword: string;
  color: string;
}

export function KnowledgeGraph({ interests, onNodeClick }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 250 * dpr;
    canvas.height = 250 * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, 250, 250);

    if (interests.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No interests yet", 125, 125);
      return;
    }

    // Create nodes in a circular layout
    const cx = 125;
    const cy = 115;
    const layoutRadius = 70;
    const maxWeight = Math.max(...interests.map((i) => i.weight ?? 1));

    const nodes: Node[] = interests.slice(0, 12).map((interest, idx, arr) => {
      const angle = (2 * Math.PI * idx) / arr.length - Math.PI / 2;
      const w = interest.weight ?? 1;
      const radius = 6 + (w / maxWeight) * 14;
      return {
        x: cx + layoutRadius * Math.cos(angle),
        y: cy + layoutRadius * Math.sin(angle),
        radius,
        keyword: interest.keyword,
        color: SOURCE_COLORS[interest.source] ?? SOURCE_COLORS.dislike,
      };
    });

    nodesRef.current = nodes;

    // Draw edges between nearby nodes
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < layoutRadius * 1.5) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = "#64748b";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      const label =
        node.keyword.length > 10
          ? node.keyword.slice(0, 9) + "\u2026"
          : node.keyword;
      ctx.fillText(label, node.x, node.y + node.radius + 10);
    }
  }, [interests]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNodeClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 4) {
        onNodeClick(node.keyword);
        return;
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Knowledge Graph</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pb-4">
        <canvas
          ref={canvasRef}
          width={250}
          height={250}
          style={{ width: 250, height: 250 }}
          className="cursor-pointer"
          onClick={handleClick}
        />
      </CardContent>
    </Card>
  );
}
