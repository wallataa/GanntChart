import type { DateRange } from "@/types";
import { daysInRange, isMonthStart, isToday, isWeekend, toISODate } from "@/lib/dates";

/**
 * Absolute-positioned background layer of day columns: per-column left border
 * (stronger on month boundaries), weekend / today tints, and a vertical accent
 * line marking today. Non-interactive (pointer-events-none) so clicks fall
 * through to the track. Shared by the main lanes, the weekly Life band, and
 * weekly task rows.
 */
export default function DayColumns({
  range,
  columnWidth,
}: {
  range: DateRange;
  columnWidth: number;
}) {
  const days = daysInRange(range);
  return (
    <div
      className="pointer-events-none absolute inset-0 grid"
      style={{ gridTemplateColumns: `repeat(${days.length}, ${columnWidth}px)` }}
    >
      {days.map((d) => (
        <div
          key={toISODate(d)}
          className={[
            "relative border-l",
            isMonthStart(d)
              ? "border-neutral-400 dark:border-neutral-500"
              : "border-neutral-200 dark:border-neutral-800",
            isWeekend(d) ? "bg-neutral-100 dark:bg-neutral-900" : "",
            isToday(d) ? "bg-blue-50/60 dark:bg-blue-500/10" : "",
          ].join(" ")}
        >
          {isToday(d) && <span className="absolute inset-y-0 -left-px w-[2px] bg-blue-500/70" />}
        </div>
      ))}
    </div>
  );
}
