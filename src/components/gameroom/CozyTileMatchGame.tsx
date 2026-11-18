import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Clapperboard,
  Brain,
  Wallet,
  Rocket,
  Headphones,
  Flame,
  Compass,
  RotateCcw,
  Trophy,
} from "lucide-react";
import type { GameRoomState } from "../../types/studio";

interface CozyTileMatchGameProps {
  tileMatch: GameRoomState["tileMatch"];
  onUpdateTileMatch: (next: GameRoomState["tileMatch"]) => void;
}

const PAIR_DEFS = [
  { key: "sparkles", label: "Spark", color: "#A855F7", icon: Sparkles },
  { key: "film", label: "Edit", color: "#22C55E", icon: Clapperboard },
  { key: "brain", label: "Brain", color: "#0EA5E9", icon: Brain },
  { key: "wallet", label: "Cash", color: "#F59E0B", icon: Wallet },
  { key: "rocket", label: "Launch", color: "#F26B5B", icon: Rocket },
  { key: "audio", label: "Sound", color: "#EC4899", icon: Headphones },
  { key: "flame", label: "Streak", color: "#22C55E", icon: Flame },
  { key: "compass", label: "North", color: "#6366F1", icon: Compass },
];

interface TileCard {
  id: string;
  pairKey: string;
  matched: boolean;
}

function createShuffledDeck(): TileCard[] {
  const doubled = [...PAIR_DEFS, ...PAIR_DEFS].map((p, idx) => ({
    id: `tile-${idx}-${p.key}`,
    pairKey: p.key,
    matched: false,
  }));
  for (let i = doubled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
  }
  return doubled;
}

export const CozyTileMatchGame: React.FC<CozyTileMatchGameProps> = ({
  tileMatch,
  onUpdateTileMatch,
}) => {
  const [cards, setCards] = useState<TileCard[]>(() => createShuffledDeck());
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [locked, setLocked] = useState(false);

  const allMatched = cards.every((c) => c.matched);

  useEffect(() => {
    if (allMatched || (moves === 0 && flippedIndices.length === 0)) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [allMatched, moves, flippedIndices.length]);

  const handleRestart = () => {
    setCards(createShuffledDeck());
    setFlippedIndices([]);
    setMoves(0);
    setSeconds(0);
    setLocked(false);
  };

  const handleFlip = (idx: number) => {
    if (locked || allMatched) return;
    if (cards[idx].matched || flippedIndices.includes(idx)) return;

    const nextFlipped = [...flippedIndices, idx];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [a, b] = nextFlipped;

      if (cards[a].pairKey === cards[b].pairKey) {
        const updated = cards.map((c, i) =>
          i === a || i === b ? { ...c, matched: true } : c
        );
        setCards(updated);
        setFlippedIndices([]);

        if (updated.every((c) => c.matched)) {
          onUpdateTileMatch({
            gamesWon: tileMatch.gamesWon + 1,
            bestMoves:
              tileMatch.bestMoves === null
                ? nextMoves
                : Math.min(tileMatch.bestMoves, nextMoves),
          });
        }
      } else {
        setLocked(true);
        window.setTimeout(() => {
          setFlippedIndices([]);
          setLocked(false);
        }, 650);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
            Cozy Tile-Match Arcade
          </h3>
          <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
            Match all 8 creator studio icon pairs · 100% Offline &amp; Touch Friendly
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
          <span className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
            Moves: {moves}
          </span>
          <span className="font-mono text-[#6E685F] dark:text-[#9A9389]">
            {seconds}s
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[#22C55E]">
            <Trophy className="h-3.5 w-3.5" />
            Best: {tileMatch.bestMoves !== null ? `${tileMatch.bestMoves} moves` : "—"}
          </span>
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs font-semibold hover:border-[#A855F7]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Shuffle
          </button>
        </div>
      </div>

      {allMatched && (
        <div className="rounded-xl border border-[#22C55E]/50 bg-[#22C55E]/12 px-4 py-3 text-center text-xs sm:text-sm font-semibold text-[#15803D] dark:text-[#86EFAC]">
          Board cleared in {moves} moves ({seconds}s)! Tap Shuffle for another round.
        </div>
      )}

      <div className="mx-auto grid max-w-md grid-cols-4 gap-2.5 sm:gap-3">
        {cards.map((card, idx) => {
          const isOpen = card.matched || flippedIndices.includes(idx);
          const def = PAIR_DEFS.find((d) => d.key === card.pairKey)!;
          const Icon = def.icon;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleFlip(idx)}
              aria-label={isOpen ? def.label : "Hidden memory tile"}
              className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                card.matched
                  ? "border-[#22C55E] bg-[#22C55E]/14"
                  : isOpen
                  ? "border-[#A855F7] bg-[#A855F7]/12"
                  : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] hover:border-[#A855F7]/60"
              }`}
            >
              {isOpen ? (
                <>
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: def.color }} />
                  <span className="text-[10px] font-bold text-[#5C5750] dark:text-[#A69F96]">
                    {def.label}
                  </span>
                </>
              ) : (
                <span className="h-3 w-3 rounded-full bg-[#A855F7]/30" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
