import React from "react";
import { Student, DailyLog, PeriodScore } from "../types";
import { PeriodImage } from "./PeriodImage";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "../lib/utils";

interface KidModeProps {
  student: Student;
  periodData: Record<string, PeriodScore>;
  onImageSelected: (period: string, base64: string) => void;
  onScoreChange: (period: string, behavior: string, score: number) => void;
}

export function KidMode({ student, periodData, onImageSelected, onScoreChange }: KidModeProps) {
  
  // Calculate the current active period based on first incomplete one
  const currentPeriodIndex = student.schedule.findIndex(p => {
    const data = periodData[p];
    if (!data || data.status === "missed") return false;
    return student.behaviors.some(b => data.scores[b] === undefined);
  });
  
  // If all complete, it will be -1
  const activeIdx = currentPeriodIndex === -1 ? student.schedule.length : currentPeriodIndex;

  const colors = [
    "bg-sky-100 border-sky-300",
    "bg-purple-100 border-purple-300",
    "bg-pink-100 border-pink-300",
    "bg-emerald-100 border-emerald-300",
    "bg-amber-100 border-amber-300",
    "bg-indigo-100 border-indigo-300",
    "bg-rose-100 border-rose-300",
    "bg-teal-100 border-teal-300"
  ];

  return (
    <div className="space-y-2 max-w-2xl mx-auto pb-8">
      <div className="text-center mb-2">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
          {student.name}'s Schedule
        </h2>
        <p className="text-zinc-600 mt-1 font-medium">You are doing great!</p>
      </div>

      <div className="relative border-l-4 border-orange-300 ml-4 sm:ml-8 space-y-3 pb-2">
        {student.schedule.map((period, idx) => {
          const isPast = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const pData = periodData[period] || { status: "present", scores: {} };
          const cardColor = colors[idx % colors.length];
          
          return (
            <div key={period} className={cn("relative pl-6 sm:pl-8 transition-all duration-300", 
              isPast ? "opacity-95" : "",
              isCurrent ? "scale-[1.02] origin-left" : ""
            )}>
              {/* Timeline dot */}
              <div className={cn(
                "absolute -left-[14px] top-6 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm",
                isPast ? "bg-green-500" : isCurrent ? "bg-orange-500 animate-pulse border-orange-200" : "bg-zinc-300"
              )}>
                {isPast && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>

              <div className={cn(
                "rounded-2xl p-2 sm:p-3 shadow-sm border-2",
                cardColor,
                isCurrent ? "shadow-md ring-2 ring-orange-400 ring-offset-2" : ""
              )}>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 bg-white/50 p-1 rounded-xl">
                    <PeriodImage 
                      period={period} 
                      image={student.periodImages?.[period]} 
                      size="lg" 
                      editable={true} 
                      onImageSelected={(b64) => onImageSelected(period, b64)} 
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 drop-shadow-sm">{period}</h3>
                    {isCurrent && (
                      <div className="text-orange-700 font-bold mt-0.5 text-sm uppercase tracking-wider bg-orange-200/50 inline-block px-2 py-0.5 rounded border border-orange-300/50">Happening right now!</div>
                    )}
                  </div>
                </div>

                {(isCurrent || isPast) && pData.status !== "missed" && (
                  <div className="mt-2 pt-2 border-t border-black/10">
                    <div className="space-y-2">
                      {student.behaviors.map(behavior => (
                        <div key={behavior} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/60 rounded-xl p-2 px-3 gap-2 border border-white/40 shadow-sm">
                          <span className="font-bold text-slate-800 text-lg leading-tight">{behavior}</span>
                          <div className="flex scale-110 origin-left sm:origin-right space-x-1.5">
                            {[-1, 0, 1].map((score) => {
                              const isSelected = pData.scores[behavior] === score;
                              let Emoji = score === 1 ? "😄" : score === 0 ? "😢" : "➖";
                              let colorClass = score === 1 ? "bg-green-100 border-green-400 text-green-700 shadow-sm" : 
                                               score === 0 ? "bg-red-100 border-red-400 text-red-700 shadow-sm" :
                                               "bg-slate-200 border-slate-400 text-slate-700 shadow-sm";
                              
                              if (!isSelected && pData.scores[behavior] !== undefined) {
                                colorClass = "bg-white/30 border-black/5 opacity-40 grayscale";
                              }

                              return (
                                <button
                                  key={score}
                                  onClick={() => onScoreChange(period, behavior, score)}
                                  className={cn(
                                    "h-11 w-11 md:h-9 md:w-9 touch-action-manipulation select-none flex items-center justify-center text-xl md:text-lg rounded-full border-2 transition-transform hover:scale-110",
                                    colorClass,
                                    isSelected && "ring-2 ring-offset-1 ring-black/20 scale-110 z-10"
                                  )}
                                  title={`Score: ${score}`}
                                >
                                  {Emoji}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
