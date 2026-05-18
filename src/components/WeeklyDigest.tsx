import React, { useMemo, useState } from 'react';
import { Student, DailyLog, PeriodScore } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { subDays, format, parseISO, isAfter, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { Smile, Meh, Frown, Lightbulb, AlertTriangle, CheckSquare } from 'lucide-react';
import { Button } from './ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface WeeklyDigestProps {
  student: Student;
  logs: DailyLog[];
  monthlyData?: { name: string; score: number }[];
  periodAverages?: { name: string; score: number }[];
  behaviorAverages?: { name: string; score: number }[];
  insights?: { behavior: string, period: string, pScore: number, oScore: number }[];
}

export function WeeklyDigest({ student, logs, monthlyData = [], periodAverages = [], behaviorAverages = [], insights = [] }: WeeklyDigestProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekDays, tableData, weeklyPct } = useMemo(() => {
    const today = new Date();
    // Offset by weeks
    const targetDate = subDays(today, -weekOffset * 7);
    
    // Get Mon-Fri of the target week
    const start = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
    const weekInterval = eachDayOfInterval({
      start: start,
      end: subDays(start, -4) // Mon to Fri
    });

    const dataByPeriod: Record<string, Record<string, { pct: number | null, notes: string }>> = {};
    let wEarned = 0;
    let wPossible = 0;
    
    student.schedule.forEach(p => {
      dataByPeriod[p] = {};
      weekInterval.forEach(d => {
        dataByPeriod[p][format(d, 'yyyy-MM-dd')] = { pct: null, notes: "" };
      });
    });

    logs.forEach(log => {
      if (log.attendance === "absent" || log.attendance === "school_closed") return;
      const logDate = parseISO(log.date);
      const dateKey = format(logDate, 'yyyy-MM-dd');
      
      // Only process if it falls in our weekDays
      if (!weekInterval.some(d => format(d, 'yyyy-MM-dd') === dateKey)) return;

      try {
        const data: Record<string, PeriodScore> = JSON.parse(log.periodData);
        student.schedule.forEach(period => {
          const pData = data[period];
          if (pData && pData.status === "present" && pData.scores) {
            let possible = 0;
            let earned = 0;
            student.behaviors.forEach(b => {
              if (pData.scores[b] !== undefined) {
                possible += 1;
                earned += pData.scores[b];
                wPossible += 1;
                wEarned += pData.scores[b];
              }
            });
            if (possible > 0) {
              dataByPeriod[period][dateKey] = {
                pct: earned / possible,
                notes: pData.notes || ""
              };
            } else if (pData.notes) {
               dataByPeriod[period][dateKey] = {
                pct: null,
                notes: pData.notes
              };
            }
          } else if (pData && pData.status === "missed") {
             dataByPeriod[period][dateKey] = {
                pct: null,
                notes: "Missed"
             };
          }
        });
      } catch (e) {}
    });

    const weeklyPct = wPossible > 0 ? (wEarned / wPossible) * 100 : null;
    return { weekDays: weekInterval, tableData: dataByPeriod, weeklyPct };
  }, [student, logs, weekOffset]);

  const [printError, setPrintError] = useState(false);

  const handlePrint = () => {
    try {
      if (window.self !== window.top) {
        setPrintError(true);
        setTimeout(() => setPrintError(false), 5000);
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  return (
    <Card className="border-slate-200 shadow-none bg-white rounded-xl overflow-hidden print:shadow-none print:border-none print:w-full">
      <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <CheckSquare className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Week of {format(weekDays[0], "MMMM d, yyyy")}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(prev => prev - 1)} className="h-8 text-[10px] font-black uppercase tracking-widest">
            Prev
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0} className="h-8 text-[10px] font-black uppercase tracking-widest px-4">
            Current
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(prev => prev + 1)} className="h-8 text-[10px] font-black uppercase tracking-widest">
            Next
          </Button>
        </div>
      </div>
      
      <CardContent className="p-0">
        {/* Achievement Banner */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-end gap-6 print:mb-4">
           {weeklyPct !== null && (
             <div className="flex items-center gap-4 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg">
               <div className="p-2 bg-white/10 rounded-lg">
                 {weeklyPct >= 80 ? <Smile className="h-5 w-5 text-emerald-400" /> : 
                  weeklyPct >= 50 ? <Meh className="h-5 w-5 text-yellow-400" /> : 
                  <Frown className="h-5 w-5 text-red-400" />}
               </div>
               <div className="flex flex-col">
                 <span className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400 leading-none mb-1">Weekly Success</span>
                 <span className="text-xl font-black leading-none">{Math.round(weeklyPct)}%</span>
               </div>
             </div>
           )}
        </div>
        
        {/* The Grid Table */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-2.5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-r border-slate-100 bg-slate-50/50 sticky left-0 z-10">Period</th>
                {weekDays.map(d => (
                  <th key={d.toISOString()} className="py-2.5 px-4 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">{format(d, 'EEE')}</span>
                    <span className="block text-[11px] font-black text-slate-900 leading-none mt-1">{format(d, 'MMM d')}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {student.schedule.map(period => (
                <tr key={period} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-2.5 px-6 text-[10px] font-black uppercase text-slate-600 bg-white group-hover:bg-slate-50 sticky left-0 z-10 border-r border-slate-100">
                    {period}
                  </td>
                  {weekDays.map(d => {
                    const dateKey = format(d, 'yyyy-MM-dd');
                    const cellData = tableData[period]?.[dateKey];
                    
                    return (
                      <td key={dateKey} className="py-2 px-2 align-middle text-center border-r border-slate-50 last:border-r-0">
                        {cellData ? (
                          <div className="flex flex-col items-center gap-1 animate-in slide-in-from-top-1 duration-300">
                            {cellData.pct !== null && (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white rounded border border-slate-200 shadow-sm">
                                <div 
                                  className="w-1 h-1 rounded-full" 
                                  style={{ backgroundColor: `hsl(${cellData.pct * 140}, 80%, 45%)` }}
                                />
                                <span className="text-[9px] font-black text-slate-900 leading-none">
                                  {Math.round(cellData.pct * 100)}%
                                </span>
                              </div>
                            )}
                            {cellData.notes && (
                              <p className="text-[8px] font-bold text-slate-400 leading-tight truncate max-w-[80px] hover:max-w-none hover:bg-white hover:z-20 hover:relative hover:shadow-lg hover:p-1 hover:rounded transition-all">
                                {cellData.notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-slate-200">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
