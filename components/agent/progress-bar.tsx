"use client";

const PHASES = [
  { key: "greeting", label: "Introduction" },
  { key: "discovery", label: "Discovery" },
  { key: "audit", label: "Audit" },
  { key: "qualification", label: "Qualification" },
  { key: "booking", label: "Booking" }
] as const;

type Phase = (typeof PHASES)[number]["key"];

type Props = {
  current: Phase;
};

export function AgentProgressBar({ current }: Props) {
  const currentIndex = PHASES.findIndex((p) => p.key === current);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {PHASES.map((phase, i) => {
          const isDone = i < currentIndex;
          const isActive = i === currentIndex;
          return (
            <div key={phase.key} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                  isDone
                    ? "bg-indigo-500"
                    : isActive
                    ? "bg-indigo-300"
                    : "bg-neutral-200"
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isDone || isActive ? "text-indigo-600" : "text-neutral-400"
                }`}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
