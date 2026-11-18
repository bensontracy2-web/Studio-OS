import React, { useState } from "react";
import { TrendingUp, Grid3X3 } from "lucide-react";
import type { DailyMetricPoint, HabitPill } from "../../types/studio";

interface AnalyticsAndMatrixCardProps {
  weeklyMetrics: DailyMetricPoint[];
  habits: HabitPill[];
  onToggleMatrixDot: (dateKey: string, habitId: string) => void;
}

export const AnalyticsAndMatrixCard: React.FC<AnalyticsAndMatrixCardProps> = ({
  weeklyMetrics,
  habits,
  onToggleMatrixDot,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(
    Math.max(0, weeklyMetrics.length - 1)
  );

  const safeMetrics = weeklyMetrics.slice(-7);
  const activePoint = safeMetrics[Math.min(selectedIdx, safeMetrics.length - 1)];

  const totalPosts7d = safeMetrics.reduce((sum, p) => sum + p.posts, 0);
  const totalGrowth7d = safeMetrics.reduce((sum, p) => sum + p.audienceGrowth, 0);
  const avgHabitRate =
    safeMetrics.length > 0
      ? Math.round(
          safeMetrics.reduce((sum, p) => sum + p.habitRate, 0) / safeMetrics.length
        )
      : 0;

  // SVG Geometry
  const width = 600;
  const height = 190;
  const padLeft = 34;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxGrowth = Math.max(500, ...safeMetrics.map((m) => m.audienceGrowth));
  const maxPosts = Math.max(4, ...safeMetrics.map((m) => m.posts));

  const coords = safeMetrics.map((point, idx) => {
    const x =
      safeMetrics.length > 1
        ? padLeft + (idx / (safeMetrics.length - 1)) * plotW
        : padLeft + plotW / 2;
    const yGrowth =
      padTop + plotH - (point.audienceGrowth / maxGrowth) * plotH;
    const barH = (point.posts / maxPosts) * (plotH * 0.48);
    return { x, yGrowth, barH, point, idx };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.yGrowth.toFixed(1)}`)
    .join(" ");

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : "";

  return (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* 7-Day Content & Growth SVG Chart */}
      <div className="xl:col-span-7 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10B981]/18 text-[#059669] dark:text-[#10B981]">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                7-Day Content &amp; Growth
              </h3>
              <p className="text-xs text-[#6E685F] dark:text-[#9A9389] tabular-nums">
                {totalPosts7d} posts shipped · +{totalGrowth7d.toLocaleString()} audience reach
              </p>
            </div>
          </div>

          {activePoint && (
            <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-1.5 text-xs tabular-nums">
              <span className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                {activePoint.dayLabel}:
              </span>{" "}
              <span className="text-[#059669] dark:text-[#10B981] font-mono font-semibold">
                +{activePoint.audienceGrowth} reach
              </span>{" "}
              ·{" "}
              <span className="text-[#92400E] dark:text-[#FACC15] font-mono font-semibold">
                {activePoint.posts} posts
              </span>
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[440px] h-auto select-none"
            role="img"
            aria-label="7-day Content and Audience Growth chart"
          >
            <defs>
              <linearGradient id="growthAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal gridlines */}
            {[0, 0.5, 1].map((ratio) => {
              const y = padTop + plotH * (1 - ratio);
              const val = Math.round(maxGrowth * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="currentColor"
                    className="text-[#E8E2D8] dark:text-[#322E29]"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-[#8C857B] text-[10px] font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            {areaPath && <path d={areaPath} fill="url(#growthAreaGrad)" />}

            {/* Daily Posts Bars (Butter Yellow) */}
            {coords.map(({ x, barH, point, idx }) => (
              <rect
                key={`bar-${point.dateKey}`}
                x={x - 10}
                y={padTop + plotH - barH}
                width={20}
                height={Math.max(4, barH)}
                rx={5}
                fill="#FACC15"
                opacity={idx === selectedIdx ? 0.95 : 0.65}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
              />
            ))}

            {/* Audience Growth Line (Emerald) */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#10B981"
                strokeWidth={2.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Nodes & X-Axis Labels */}
            {coords.map(({ x, yGrowth, point, idx }) => {
              const isSelected = idx === selectedIdx;
              return (
                <g
                  key={`node-${point.dateKey}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <circle
                    cx={x}
                    cy={yGrowth}
                    r={isSelected ? 6 : 4}
                    fill={isSelected ? "#10B981" : "#FFFFFF"}
                    stroke="#10B981"
                    strokeWidth={2.5}
                  />
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className={`text-[11px] font-medium ${
                      isSelected
                        ? "fill-[#1E1E1E] dark:fill-[#F5F2EC] font-bold"
                        : "fill-[#6E685F] dark:fill-[#9A9389]"
                    }`}
                  >
                    {point.dayLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-5 text-xs text-[#6E685F] dark:text-[#9A9389]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" />
            Audience Reach
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#FACC15]" />
            Daily Posts Published
          </span>
        </div>
      </div>

      {/* 7-Day Habit Dot Matrix */}
      <div className="xl:col-span-5 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FACC15]/20 text-[#92400E] dark:text-[#FACC15]">
                <Grid3X3 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  Habit Dot Matrix
                </h3>
                <p className="text-xs text-[#6E685F] dark:text-[#9A9389] tabular-nums">
                  7-day consistency avg: {avgHabitRate}%
                </p>
              </div>
            </div>
          </div>

          {habits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] px-4 py-10 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
              Add daily habits above to unlock your 7-day habit dot matrix.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="pb-2.5 pr-2 text-[11px] font-semibold text-[#6E685F] dark:text-[#9A9389]">
                      Habit
                    </th>
                    {safeMetrics.map((m) => (
                      <th
                        key={m.dateKey}
                        className="pb-2.5 text-center text-[11px] font-mono font-medium text-[#6E685F] dark:text-[#9A9389] w-8"
                      >
                        {m.dayLabel === "Today" ? "Now" : m.dayLabel.slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D8]/60 dark:divide-[#322E29]/60">
                  {habits.map((habit) => (
                    <tr key={habit.id}>
                      <td className="py-2 pr-2 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] max-w-[140px] truncate">
                        {habit.label}
                      </td>
                      {safeMetrics.map((m, dayIdx) => {
                        const isToday = dayIdx === safeMetrics.length - 1;
                        const done = isToday
                          ? habit.completed
                          : Boolean(m.habitMap?.[habit.id]);
                        return (
                          <td key={`${habit.id}-${m.dateKey}`} className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => onToggleMatrixDot(m.dateKey, habit.id)}
                              title={`${habit.label} (${m.dayLabel}): ${done ? "Done" : "Missed"}`}
                              aria-label={`${habit.label} on ${m.dayLabel}: ${done ? "Completed" : "Not completed"}`}
                              className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                                done
                                  ? isToday
                                    ? "bg-[#10B981] ring-2 ring-[#FACC15]/70"
                                    : "bg-[#10B981]"
                                  : "bg-[#FAF7F2] dark:bg-[#161513] border border-[#D8D0C4] dark:border-[#3E3932]"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] text-[#6E685F] dark:text-[#9A9389]">
          Click any dot to update historical or today&apos;s habit records.
        </p>
      </div>
    </section>
  );
};
