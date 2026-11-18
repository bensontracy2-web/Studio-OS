import React, { useEffect, useState } from "react";
import { RotateCcw, Delete, CornerDownLeft, Trophy, Flame } from "lucide-react";
import type { GameRoomState } from "../../types/studio";

interface FounderWordleGameProps {
  wordle: GameRoomState["wordle"];
  onUpdateWordle: (next: GameRoomState["wordle"]) => void;
}

const TECH_WORDS = [
  "PITCH",
  "STACK",
  "SCALE",
  "CHURN",
  "VIRAL",
  "HOOKS",
  "CACHE",
  "REACT",
  "CLOUD",
  "BRAND",
  "CLIPS",
  "FRAME",
  "AUDIO",
  "DRAFT",
  "TOKEN",
  "ASYNC",
  "BUILD",
  "SHIPS",
  "NODES",
  "QUERY",
  "STATE",
  "PROPS",
  "ASSET",
  "LIGHT",
  "SCENE",
  "FOCUS",
  "STAGE",
  "FUNDS",
  "ANGEL",
  "NICHE",
  "SHARE",
  "VIEWS",
  "LEADS",
  "SCORE",
  "BYTES",
  "LOGIC",
  "STYLE",
  "FOUND",
];

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

type LetterState = "correct" | "present" | "absent" | "empty";

function evaluateRow(guess: string, target: string): LetterState[] {
  const result: LetterState[] = Array(5).fill("absent");
  const targetChars = target.split("");
  const used = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (guess[i] === targetChars[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    const matchIdx = targetChars.findIndex((c, idx) => !used[idx] && c === guess[i]);
    if (matchIdx !== -1) {
      result[i] = "present";
      used[matchIdx] = true;
    }
  }
  return result;
}

export const FounderWordleGame: React.FC<FounderWordleGameProps> = ({
  wordle,
  onUpdateWordle,
}) => {
  const [currentGuess, setCurrentGuess] = useState("");
  const [hintMsg, setHintMsg] = useState<string | null>(null);

  const target = (wordle.targetWord || "PITCH").toUpperCase();
  const isFinished = wordle.status !== "playing";

  const handleKeyPress = (key: string) => {
    if (isFinished) return;
    setHintMsg(null);

    if (key === "BACK") {
      setCurrentGuess((g) => g.slice(0, -1));
      return;
    }

    if (key === "ENTER") {
      if (currentGuess.length !== 5) {
        setHintMsg("Enter 5 letters before submitting.");
        return;
      }
      const nextGuesses = [...wordle.guesses, currentGuess];
      const won = currentGuess === target;
      const lost = !won && nextGuesses.length >= 6;
      const nextStatus: "playing" | "won" | "lost" = won
        ? "won"
        : lost
        ? "lost"
        : "playing";

      const nextStreak = won
        ? wordle.currentStreak + 1
        : lost
        ? 0
        : wordle.currentStreak;

      onUpdateWordle({
        ...wordle,
        guesses: nextGuesses,
        status: nextStatus,
        gamesPlayed: nextStatus !== "playing" ? wordle.gamesPlayed + 1 : wordle.gamesPlayed,
        gamesWon: won ? wordle.gamesWon + 1 : wordle.gamesWon,
        currentStreak: nextStreak,
        bestStreak: Math.max(wordle.bestStreak, nextStreak),
      });
      setCurrentGuess("");
      return;
    }

    if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((g) => g + key);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleKeyPress("ENTER");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleKeyPress("BACK");
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleNewRound = () => {
    const candidates = TECH_WORDS.filter((w) => w !== target);
    const nextWord = candidates[Math.floor(Math.random() * candidates.length)] || "SCALE";
    setCurrentGuess("");
    setHintMsg(null);
    onUpdateWordle({
      ...wordle,
      targetWord: nextWord,
      guesses: [],
      status: "playing",
    });
  };

  // Track best known letter color for keyboard
  const keyStates: Record<string, LetterState> = {};
  wordle.guesses.forEach((guess) => {
    const evalRow = evaluateRow(guess, target);
    guess.split("").forEach((ch, idx) => {
      const prev = keyStates[ch];
      const next = evalRow[idx];
      if (
        prev === "correct" ||
        (prev === "present" && next !== "correct")
      ) {
        return;
      }
      keyStates[ch] = next;
    });
  });

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
            Founder &amp; Tech Wordle
          </h3>
          <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
            Guess the 5-letter startup, creator, or engineering word in 6 tries · 100% Offline
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
          <span className="inline-flex items-center gap-1 font-semibold text-[#22C55E]">
            <Trophy className="h-3.5 w-3.5" />
            {wordle.gamesWon}/{wordle.gamesPlayed} Won
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[#A855F7]">
            <Flame className="h-3.5 w-3.5" />
            Streak {wordle.currentStreak} (Best {wordle.bestStreak})
          </span>
          <button
            type="button"
            onClick={handleNewRound}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs font-semibold hover:border-[#22C55E]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New Word
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {wordle.status === "won" && (
        <div className="rounded-xl border border-[#22C55E]/50 bg-[#22C55E]/12 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#15803D] dark:text-[#86EFAC]">
          Cracked it in {wordle.guesses.length}/6! Word: <strong>{target}</strong>
        </div>
      )}
      {wordle.status === "lost" && (
        <div className="rounded-xl border border-[#A855F7]/50 bg-[#A855F7]/12 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#6B21A8] dark:text-[#D8B4FE]">
          Out of tries — today&apos;s word was <strong>{target}</strong>. Tap New Word!
        </div>
      )}
      {hintMsg && (
        <p className="text-center text-xs font-medium text-[#A855F7]">{hintMsg}</p>
      )}

      {/* 6x5 Wordle Grid */}
      <div className="mx-auto grid max-w-[300px] gap-1.5">
        {Array.from({ length: 6 }).map((_, rowIdx) => {
          const submitted = wordle.guesses[rowIdx];
          const isCurrentRow = !submitted && rowIdx === wordle.guesses.length && !isFinished;
          const rowChars = submitted
            ? submitted.split("")
            : isCurrentRow
            ? currentGuess.padEnd(5, " ").split("")
            : Array(5).fill(" ");
          const evalStates = submitted
            ? evaluateRow(submitted, target)
            : Array(5).fill("empty" as LetterState);

          return (
            <div key={`row-${rowIdx}`} className="grid grid-cols-5 gap-1.5">
              {rowChars.map((ch, colIdx) => {
                const st = evalStates[colIdx];
                let tileCls =
                  "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]";
                if (st === "correct") {
                  tileCls = "border-[#22C55E] bg-[#22C55E] text-white";
                } else if (st === "present") {
                  tileCls = "border-[#A855F7] bg-[#A855F7] text-white";
                } else if (st === "absent") {
                  tileCls =
                    "border-[#8C857B]/40 bg-[#8C857B]/25 text-[#5C5750] dark:text-[#9A9389]";
                } else if (isCurrentRow && ch.trim()) {
                  tileCls =
                    "border-[#22C55E] bg-[#FFFFFF] dark:bg-[#22201D] text-[#1E1E1E] dark:text-[#F5F2EC]";
                }

                return (
                  <div
                    key={`cell-${rowIdx}-${colIdx}`}
                    className={`flex h-12 sm:h-13 items-center justify-center rounded-xl border-2 font-display text-lg font-extrabold select-none transition-colors ${tileCls}`}
                  >
                    {ch.trim()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Touch-Friendly QWERTY Keyboard */}
      <div className="mx-auto max-w-lg space-y-1.5 pt-2">
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={`kb-${rIdx}`} className="flex justify-center gap-1">
            {row.map((key) => {
              const isAction = key === "ENTER" || key === "BACK";
              const st = !isAction ? keyStates[key] : undefined;
              let keyCls =
                "bg-[#FAF7F2] dark:bg-[#161513] border-[#E8E2D8] dark:border-[#322E29] text-[#1E1E1E] dark:text-[#F5F2EC]";
              if (st === "correct") {
                keyCls = "bg-[#22C55E] border-[#22C55E] text-white";
              } else if (st === "present") {
                keyCls = "bg-[#A855F7] border-[#A855F7] text-white";
              } else if (st === "absent") {
                keyCls =
                  "bg-[#8C857B]/20 border-transparent text-[#8C857B] dark:text-[#787168]";
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeyPress(key)}
                  className={`flex h-11 items-center justify-center rounded-lg border font-semibold text-xs transition-colors active:scale-95 ${
                    isAction ? "px-2.5 sm:px-3.5" : "flex-1 max-w-[42px]"
                  } ${keyCls}`}
                >
                  {key === "BACK" ? (
                    <Delete className="h-4 w-4" />
                  ) : key === "ENTER" ? (
                    <CornerDownLeft className="h-4 w-4" />
                  ) : (
                    key
                  )}
                </button>
              );
            })}
          </div>
        ))}
        <p className="text-center text-[11px] text-[#6E685F] dark:text-[#9A9389] pt-1">
          Green = Exact spot · Lilac = In word, different spot
        </p>
      </div>
    </div>
  );
};
