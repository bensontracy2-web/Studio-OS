import React, { useState } from "react";
import { Gamepad2, Grid3X3, Brain, Sparkles } from "lucide-react";
import { FounderWordleGame } from "./FounderWordleGame";
import { AiQuizArenaGame } from "./AiQuizArenaGame";
import { CozyTileMatchGame } from "./CozyTileMatchGame";
import type {
  AcademyLesson,
  BrainNote,
  GameRoomState,
} from "../../types/studio";

interface GameRoomWorkspaceProps {
  gameRoom: GameRoomState;
  notes: BrainNote[];
  lessons: AcademyLesson[];
  isOnline: boolean;
  onUpdateGameRoom: (updater: (prev: GameRoomState) => GameRoomState) => void;
}

export const GameRoomWorkspace: React.FC<GameRoomWorkspaceProps> = ({
  gameRoom,
  notes,
  lessons,
  isOnline,
  onUpdateGameRoom,
}) => {
  const [game, setGame] = useState<"wordle" | "quiz" | "tiles">("wordle");

  return (
    <div className="space-y-6">
      {/* Mint & Lilac Header Card */}
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              background: "linear-gradient(135deg, #22C55E 0%, #A855F7 100%)",
            }}
          >
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Cozy Game Room
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[#5C5750] dark:text-[#A69F96] tabular-nums">
              Wordle Streak: {gameRoom.wordle.bestStreak} · Quiz Best:{" "}
              {gameRoom.quiz.highScore} pts · Tile-Match Clears:{" "}
              {gameRoom.tileMatch.gamesWon} · 100% Offline Playable
            </p>
          </div>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#FAF7F2] dark:bg-[#161513] p-1 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setGame("wordle")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              game === "wordle"
                ? "bg-[#22C55E] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Founder Wordle
          </button>
          <button
            type="button"
            onClick={() => setGame("quiz")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              game === "quiz"
                ? "bg-[#A855F7] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            AI Quiz Arena
          </button>
          <button
            type="button"
            onClick={() => setGame("tiles")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              game === "tiles"
                ? "bg-[#22C55E] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Cozy Tile-Match
          </button>
        </div>
      </div>

      {game === "wordle" && (
        <FounderWordleGame
          wordle={gameRoom.wordle}
          onUpdateWordle={(next) =>
            onUpdateGameRoom((prev) => ({ ...prev, wordle: next }))
          }
        />
      )}

      {game === "quiz" && (
        <AiQuizArenaGame
          quizState={gameRoom.quiz}
          notes={notes}
          lessons={lessons}
          isOnline={isOnline}
          onUpdateQuizState={(next) =>
            onUpdateGameRoom((prev) => ({ ...prev, quiz: next }))
          }
        />
      )}

      {game === "tiles" && (
        <CozyTileMatchGame
          tileMatch={gameRoom.tileMatch}
          onUpdateTileMatch={(next) =>
            onUpdateGameRoom((prev) => ({ ...prev, tileMatch: next }))
          }
        />
      )}
    </div>
  );
};
