import type { DateRange } from "@/types";
import { daysInRange, isToday, isWeekend, toISODate } from "@/lib/dates";

/**
 * Absolute-positioned background layer of day columns: per-column left border
 * plus weekend / today tints. Non-interactive (pointer-events-none) so clicks
 * fall through to the track. Shared by the main lanes, the weekly Life band,
 * and weekly task rows.
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
            "border-l border-neutral-200",
            isWeekend(d) ? "bg-neutral-100" : "",
            isToday(d) ? "bg-blue-50/60" : "",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
