"use client";

import { useEffect, useMemo, useState } from "react";
import { frames } from "@/data/frames";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <div className="ascii-container flex min-h-screen w-full flex-col items-center justify-center px-6">
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
