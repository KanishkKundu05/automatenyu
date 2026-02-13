"use client";

import { useState, useEffect, useMemo } from "react";
import { frames } from "@/data/frames";

interface ParsedSegment {
  text: string;
  bright: boolean;
}

function parseLine(line: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("<b>");
    if (openIdx === -1) {
      segments.push({ text: remaining, bright: false });
      break;
    }
    if (openIdx > 0) {
      segments.push({ text: remaining.slice(0, openIdx), bright: false });
    }
    const closeIdx = remaining.indexOf("</b>", openIdx);
    if (closeIdx === -1) {
      segments.push({ text: remaining.slice(openIdx + 3), bright: true });
      break;
    }
    segments.push({
      text: remaining.slice(openIdx + 3, closeIdx),
      bright: true,
    });
    remaining = remaining.slice(closeIdx + 4);
  }

  return segments;
}

export default function AsciiAnimation() {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % frames.length);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const parsedFrames = useMemo(
    () => frames.map((frame) => frame.map((line) => parseLine(line))),
    []
  );

  const frame = parsedFrames[currentFrame];

  return (
    <div className={`ascii-container ${mounted ? "fade-in" : ""}`}>
      <pre className="ascii-art">
        {frame.map((segments, lineIdx) => (
          <div key={lineIdx}>
            {segments.map((seg, segIdx) =>
              seg.bright ? (
                <span key={segIdx} className="bright">
                  {seg.text}
                </span>
              ) : (
                <span key={segIdx}>{seg.text}</span>
              )
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}
