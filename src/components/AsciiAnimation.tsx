"use client";

import { useState, useEffect, useMemo } from "react";
import { frames } from "@/data/frames";

interface Segment {
  text: string;
  cls: string;
}

function parseLineSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  let currentCls = "violet";
  let currentText = "";

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    let cls: string;

    if (i === 0 || i === line.length - 1) {
      cls = "violet";
    } else if (ch === "%") {
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
    () => frames.map((frame) => frame.map((line) => parseLineSegments(line))),
    []
  );

  const frame = parsedFrames[currentFrame];

  return (
    <div className={`ascii-container ${mounted ? "fade-in" : ""}`}>
      <pre className="ascii-art">
        {frame.map((segments, lineIdx) => (
          <div key={lineIdx}>
            {segments.map((seg, segIdx) => (
              <span key={segIdx} className={seg.cls}>
                {seg.text}
              </span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}
