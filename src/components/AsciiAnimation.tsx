"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  layoutWithLines,
  measureNaturalWidth,
  prepareWithSegments,
} from "@chenglou/pretext";
import {
  createDynamicFrame,
  frames,
} from "@/data/frames";
import CheatNyuWordmark from "@/components/CheatNyuWordmark";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Segment {
  text: string;
  cls: string;
}

type AsciiStyle = CSSProperties & {
  "--ascii-font-size"?: string;
};

type LayoutMetrics = {
  lineWidths: number[];
  naturalWidth: number;
  fontSize: number;
};

const BASE_FONT_SIZE = 14;
const BASE_LINE_HEIGHT = 1.15;
const TARGET_FRAME_MS = 1000 / 30;
const PRETEXT_FONT =
  '14px "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", Consolas, Monaco, monospace';

function parseLineSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  let currentCls = "violet";
  let currentText = "";

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    let cls: string;

    if (ch === "%") {
      cls = "violet";
    } else {
      cls = "center";
    }

    if (cls === currentCls) {
      currentText += ch;
    } else {
      if (currentText) segments.push({ text: currentText, cls: currentCls });
      currentCls = cls;
      currentText = ch;
    }
  }
  if (currentText) segments.push({ text: currentText, cls: currentCls });

  return segments;
}

export default function AsciiAnimation() {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [layoutMetrics, setLayoutMetrics] = useState<LayoutMetrics | null>(null);

  useEffect(() => {
    let rafId = 0;
    let previousFrameAt = 0;

    const tick = (now: number) => {
      if (now - previousFrameAt >= TARGET_FRAME_MS) {
        setAnimationPhase(now / 1000);
        previousFrameAt = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const prepared = prepareWithSegments(frames[0].join("\n"), PRETEXT_FONT, {
      whiteSpace: "pre-wrap",
      letterSpacing: 0,
    });
    const naturalWidth = measureNaturalWidth(prepared);
    const lineHeight = BASE_FONT_SIZE * BASE_LINE_HEIGHT;
    const fullLayout = layoutWithLines(prepared, naturalWidth + 1, lineHeight);

    const updateFit = () => {
      const availableWidth = Math.max(280, window.innerWidth - 48);
      const availableHeight = Math.max(220, window.innerHeight - 136);
      const fitScale = Math.min(
        availableWidth / naturalWidth,
        availableHeight / fullLayout.height,
        1.08
      );

      setLayoutMetrics({
        naturalWidth,
        lineWidths: fullLayout.lines.map((line) => line.width),
        fontSize: Math.max(4, Math.min(15, BASE_FONT_SIZE * fitScale)),
      });
    };

    updateFit();
    window.addEventListener("resize", updateFit);
    return () => window.removeEventListener("resize", updateFit);
  }, []);

  const frame = useMemo(
    () => createDynamicFrame(animationPhase),
    [animationPhase]
  );

  const parsedFrame = useMemo(
    () => frame.map((line) => parseLineSegments(line)),
    [frame]
  );

  const asciiStyle: AsciiStyle | undefined = layoutMetrics
    ? { "--ascii-font-size": `${layoutMetrics.fontSize}px` }
    : undefined;

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <div className="ascii-container flex min-h-screen w-full flex-col items-center justify-center px-6">
      <CheatNyuWordmark />
      <pre
        className="ascii-art"
        aria-label="Animated NYU torch logo"
        style={asciiStyle}
      >
        {parsedFrame.map((segments, lineIdx) => (
          <span className="ascii-row" key={lineIdx}>
            {segments.map((seg, segIdx) => (
              <span key={segIdx} className={seg.cls}>
                {seg.text}
              </span>
            ))}
          </span>
        ))}
      </pre>
      <div className="mt-6 flex justify-center">
        {submitted ? (
          <p className="text-sm text-[#8b5cf6]">You&apos;re on the list!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full max-w-sm gap-2">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#2d1b4e]/50 border-[#8b5cf6]/30 text-white placeholder:text-[#8888a0]"
            />
            <Button type="submit" className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white">
              Join
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
