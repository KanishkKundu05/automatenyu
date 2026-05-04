import type { CSSProperties } from "react";

type BlockStyle = CSSProperties & {
  "--block-w": string;
  "--block-h": string;
  "--block-radius": string;
};

type LetterPattern = {
  char: string;
  rows: string[];
};

const LETTERS: LetterPattern[] = [
  {
    char: "c",
    rows: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  },
  {
    char: "h",
    rows: ["10000", "10000", "10110", "11001", "10001", "10001", "10001"],
  },
  {
    char: "e",
    rows: ["01110", "10001", "11111", "10000", "10000", "10001", "01110"],
  },
  {
    char: "a",
    rows: ["01110", "00001", "01111", "10001", "10001", "10011", "01101"],
  },
  {
    char: "t",
    rows: ["00100", "00100", "11111", "00100", "00100", "00101", "00010"],
  },
  {
    char: "N",
    rows: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  },
  {
    char: "Y",
    rows: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  },
  {
    char: "U",
    rows: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  },
];

const LETTER_DELAY_MS = 150;
const BLOCK_DELAY_MS = 18;

function getBlockStyle(
  letterIndex: number,
  rowIndex: number,
  columnIndex: number,
  blockIndex: number
): BlockStyle {
  const seed = letterIndex * 17 + rowIndex * 7 + columnIndex * 5;
  const wide = seed % 4 === 0;
  const tall = seed % 5 === 0;
  const compact = seed % 7 === 0;

  return {
    "--block-w": wide ? "1.16" : compact ? "0.82" : "1",
    "--block-h": tall ? "0.92" : compact ? "0.58" : "0.72",
    "--block-radius": tall ? "2.5px" : "2px",
    animationDelay: `${letterIndex * LETTER_DELAY_MS + blockIndex * BLOCK_DELAY_MS}ms`,
  };
}

export default function CheatNyuWordmark() {
  return (
    <div
      className="cheat-wordmark"
      aria-label="cheatNYU"
      role="img"
    >
      {LETTERS.map((letter, letterIndex) => {
        let activeBlockIndex = 0;

        return (
          <span
            aria-hidden="true"
            className={`cheat-letter ${
              letterIndex >= 5 ? "cheat-letter-accent" : ""
            }`}
            key={`${letter.char}-${letterIndex}`}
            style={
              {
                gridTemplateColumns: `repeat(${letter.rows[0].length}, var(--cheat-cell-size))`,
              } as CSSProperties
            }
          >
            {letter.rows.flatMap((row, rowIndex) =>
              [...row].map((cell, columnIndex) => {
                const isActive = cell === "1";
                const blockIndex = isActive ? activeBlockIndex++ : 0;

                return (
                  <span
                    className={isActive ? "cheat-block" : "cheat-block-empty"}
                    key={`${rowIndex}-${columnIndex}`}
                    style={
                      isActive
                        ? getBlockStyle(
                            letterIndex,
                            rowIndex,
                            columnIndex,
                            blockIndex
                          )
                        : undefined
                    }
                  />
                );
              })
            )}
          </span>
        );
      })}
    </div>
  );
}
