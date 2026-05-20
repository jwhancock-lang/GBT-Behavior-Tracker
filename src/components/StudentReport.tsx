import React, { useMemo, useState } from 'react';
import { Student, DailyLog, PeriodScore } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { format, parse, getMonth, getYear, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, startOfWeek, subDays, isAfter } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { WeeklyDigest } from './WeeklyDigest';
import { Button } from './ui/button';
import { Lightbulb, AlertTriangle, CheckSquare, TrendingUp, BarChart2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useIsMobile } from '../hooks/useMediaQuery';

const getStyleForScore = (score: number, minInView: number = 0) => {
  // Color Scale: <70 Red, 70-85 Orange/Yellow, 85+ Green
  let hue = 0;
  if (score >= 85) {
    hue = 140; // Green
  } else if (score >= 70) {
    hue = 48; // Orange/Yellow
  } else {
    hue = 0; // Red
  }

  // Dynamic Height: Exaggerate differences if scores are high
  // Baseline is roughly 10% below the lowest score, capped at 60%
  const baseline = Math.max(0, Math.min(minInView - 10, 60));
  const range = 100 - baseline;
  const relativeScore = score - baseline;
  const heightPercent = Math.max(10, (relativeScore / range) * 90 + 10);

  return {
    backgroundColor: `hsl(${hue}, 75%, 45%)`,
    color: 'white',
    height: `${heightPercent}%`
  };
};

const HeatmapVisual = ({ title, data }: { title: string, data: { name: string, score: number }[] }) => {
  const minScore = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.min(...data.map(d => d.score));
  }, [data]);

  return (
    <Card className="print:border-slate-100 print:shadow-none">
      <CardHeader className="print:py-2">
        <CardTitle className="text-base font-black uppercase tracking-widest print:text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="print:pb-3">
        {data.length > 0 ? (
          <div className="flex w-full h-[140px] sm:h-[200px] print:h-[100px] items-end gap-1.5 sm:gap-3 overflow-x-auto print:overflow-visible print:gap-1 px-1">
            {data.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col justify-end pointer-events-none min-w-[45px] print:min-w-0 h-full group">
                <div 
                  style={getStyleForScore(item.score, minScore)}
                  className="w-full rounded-md flex items-center justify-center font-black text-[10px] sm:text-xs print:text-[8px] shadow-sm border-b-4 border-black/10"
                  title={`${item.name}: ${item.score}%`}
                >
                  <span className="drop-shadow-md text-white">{item.score}%</span>
                </div>
                <div className="text-[9px] sm:text-[10px] print:text-[7px] text-center mt-3 text-slate-500 font-black truncate px-0.5 leading-tight uppercase tracking-tighter">
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[100px] items-center justify-center text-sm text-slate-500">Not enough data.</div>
        )}
      </CardContent>
    </Card>
  );
};

interface StudentReportProps {
  student: Student;
  logs: DailyLog[];
  allDailyNotes?: { date: string, text: string }[];
}

export function StudentReport({ student, logs, allDailyNotes = [] }: StudentReportProps) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<"digest" | "trends" | "insights">("digest");
  const [trendRange, setTrendRange] = useState<"day" | "week" | "month">("month");

  // Aggregate data for robust reporting
  const { dailyData, weeklyData, monthlyData, periodAverages, dayOfWeekAverages, behaviorAverages, insights } = useMemo(() => {
    const weeklyAcc: Record<string, { totalPossible: number, totalEarned: number }> = {};
    const monthlyAcc: Record<string, { totalPossible: number, totalEarned: number }> = {};
    const periodAcc: Record<string, { totalPossible: number, totalEarned: number }> = {};
    const dayOfWeekAcc: Record<number, { totalPossible: number, totalEarned: number }> = {};
    const behaviorAcc: Record<string, { totalPossible: number, totalEarned: number }> = {};
    const behaviorByPeriod: Record<string, Record<string, { totalPossible: number, totalEarned: number }>> = {};

    [1, 2, 3, 4, 5].forEach(d => {
      dayOfWeekAcc[d] = { totalPossible: 0, totalEarned: 0 };
    });

    student.schedule.forEach(p => {
      periodAcc[p] = { totalPossible: 0, totalEarned: 0 };
    });
    student.behaviors.forEach(b => {
      behaviorAcc[b] = { totalPossible: 0, totalEarned: 0 };
      behaviorByPeriod[b] = {};
      student.schedule.forEach(p => {
        behaviorByPeriod[b][p] = { totalPossible: 0, totalEarned: 0 };
      });
    });

    logs.forEach(log => {
      if (log.attendance === "absent" || log.attendance === "school_closed" || log.attendance === "teacher_absent") return;
      try {
        const data: Record<string, PeriodScore> = JSON.parse(log.periodData);
        
        let dailyPossible = 0;
        let dailyEarned = 0;

        student.schedule.forEach(period => {
          const pData = data[period];
          if (pData && pData.status === "present" && pData.scores) {
            student.behaviors.forEach(behavior => {
              const score = pData.scores[behavior];
              if (score !== undefined && score >= 0) {
                dailyPossible += 1;
                dailyEarned += score;

                // Acc period
                if (periodAcc[period]) {
                  periodAcc[period].totalPossible += 1;
                  periodAcc[period].totalEarned += score;
                }

                // Acc behavior
                if (behaviorAcc[behavior]) {
                  behaviorAcc[behavior].totalPossible += 1;
                  behaviorAcc[behavior].totalEarned += score;
                }

                // Acc behavior by period
                if (behaviorByPeriod[behavior] && behaviorByPeriod[behavior][period]) {
                  behaviorByPeriod[behavior][period].totalPossible += 1;
                  behaviorByPeriod[behavior][period].totalEarned += score;
                }
              }
            });
          }
        });

        if (dailyPossible > 0) {
          const logDate = parseISO(log.date);
          
          const mKey = format(logDate, 'yyyy-MM');
          if (!monthlyAcc[mKey]) monthlyAcc[mKey] = { totalPossible: 0, totalEarned: 0 };
          monthlyAcc[mKey].totalPossible += dailyPossible;
          monthlyAcc[mKey].totalEarned += dailyEarned;
          
          const wStart = startOfWeek(logDate, { weekStartsOn: 1 });
          const wKey = format(wStart, 'yyyy-MM-dd');
          if (!weeklyAcc[wKey]) weeklyAcc[wKey] = { totalPossible: 0, totalEarned: 0 };
          weeklyAcc[wKey].totalPossible += dailyPossible;
          weeklyAcc[wKey].totalEarned += dailyEarned;

          let dayOfWeek = logDate.getDay();
          // Adjust for 0=Sunday, 1=Monday (1-5 are weekdays)
          if (dayOfWeek >= 1 && dayOfWeek <= 5 && dayOfWeekAcc[dayOfWeek]) {
             dayOfWeekAcc[dayOfWeek].totalPossible += dailyPossible;
             dayOfWeekAcc[dayOfWeek].totalEarned += dailyEarned;
          }
        }

      } catch (e) {
        // ignore JSON parse error
      }
    });

    const dailyDataRaw = logs
      .filter(log => log.attendance !== "absent" && log.attendance !== "school_closed" && log.attendance !== "teacher_absent")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(log => {
        try {
          const data: Record<string, PeriodScore> = JSON.parse(log.periodData);
          let possible = 0;
          let earned = 0;
          student.schedule.forEach(p => {
            const pData = data[p];
            if (pData && pData.status === "present" && pData.scores) {
              student.behaviors.forEach(b => {
                const score = pData.scores[b];
                if (score !== undefined && score >= 0) {
                  possible += 1;
                  earned += score;
                }
              });
            }
          });
          if (possible === 0) return null;
          return {
            name: format(parseISO(log.date), 'MMM d'),
            score: Math.round((earned / possible) * 100)
          };
        } catch (e) {
          return null;
        }
      })
      .filter((d): d is { name: string; score: number } => d !== null);

    const monthlyDataRaw = Object.entries(monthlyAcc).sort().map(([key, val]) => ({
      name: format(parse(key, 'yyyy-MM', new Date()), 'MMM yyyy'),
      score: val.totalPossible > 0 ? Math.round((val.totalEarned / val.totalPossible) * 100) : 0
    }));

    const weeklyDataRaw = Object.entries(weeklyAcc).sort().map(([key, val]) => ({
      name: `Week of ${format(parseISO(key), 'MMM d')}`,
      score: val.totalPossible > 0 ? Math.round((val.totalEarned / val.totalPossible) * 100) : 0
    }));

    const addTrendLine = (data: { name: string; score: number }[]) => {
      const n = data.length;
      if (n < 2) return data.map(d => ({ ...d, trend: d.score }));
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i].score;
        sumXY += i * data[i].score;
        sumXX += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      return data.map((d, i) => ({
        ...d,
        trend: slope * i + intercept
      }));
    };

    const dailyData = addTrendLine(dailyDataRaw);
    const weeklyData = addTrendLine(weeklyDataRaw);
    const monthlyData = addTrendLine(monthlyDataRaw);

    const periodAverages = Object.entries(periodAcc).map(([period, val]) => ({
      name: period,
      score: val.totalPossible > 0 ? Math.round((val.totalEarned / val.totalPossible) * 100) : 0
    })).filter(p => p.score > 0);

    const behaviorAveragesList = Object.entries(behaviorAcc).map(([behavior, val]) => ({
      name: behavior,
      score: val.totalPossible > 0 ? Math.round((val.totalEarned / val.totalPossible) * 100) : 0
    })).filter(b => b.score > 0);

    const dayNameMap: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
    const dayOfWeekAverages = Object.entries(dayOfWeekAcc).map(([dayIdx, val]) => ({
      name: dayNameMap[parseInt(dayIdx)],
      score: val.totalPossible > 0 ? Math.round((val.totalEarned / val.totalPossible) * 100) : 0,
      totalPossible: val.totalPossible
    })).filter(d => d.totalPossible > 0);

    // Generate Broader Behavioral Insights
    const generatedInsights: { type: 'trend' | 'bias' | 'consistency' | 'struggle', title: string, text: string, score?: number }[] = [];
    
    // 1. Growth Trend
    if (dailyDataRaw.length >= 6) {
      const mid = Math.floor(dailyDataRaw.length / 2);
      const firstHalf = dailyDataRaw.slice(0, mid);
      const secondHalf = dailyDataRaw.slice(mid);
      const firstAvg = firstHalf.reduce((acc, d) => acc + d.score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((acc, d) => acc + d.score, 0) / secondHalf.length;
      const diff = secondAvg - firstAvg;
      
      if (Math.abs(diff) >= 8) {
        generatedInsights.push({
          type: 'trend',
          title: diff > 0 ? "Positive Growth Pattern" : "Declining Momentum",
          text: `Performance has ${diff > 0 ? 'improved' : 'slipped'} by ${Math.abs(Math.round(diff))}% when comparing recent logs to the previous period.`,
          score: Math.round(secondAvg)
        });
      }
    }

    // 2. Day of Week Bias
    if (dayOfWeekAverages.length >= 3) {
      const sortedDays = [...dayOfWeekAverages].sort((a, b) => b.score - a.score);
      const bestDay = sortedDays[0];
      const worstDay = sortedDays[sortedDays.length - 1];
      const avgScore = dayOfWeekAverages.reduce((acc, d) => acc + d.score, 0) / dayOfWeekAverages.length;

      if (bestDay.score > avgScore + 10) {
        generatedInsights.push({
          type: 'bias',
          title: `${bestDay.name} is a Strong Point`,
          text: `Performance on ${bestDay.name}s is significantly higher than the weekly average, suggesting higher engagement or better support.`,
          score: bestDay.score
        });
      }
      if (worstDay.score < avgScore - 10) {
        generatedInsights.push({
          type: 'bias',
          title: `Mid-Week Struggle: ${worstDay.name}`,
          text: `Scores on ${worstDay.name}s tend to dip below the usual baseline. Consider if external factors are impacting focus on this day.`,
          score: worstDay.score
        });
      }
    }

    // 3. Time of Day Bias (Morning vs Afternoon)
    if (periodAverages.length >= 4) {
      const midPoint = Math.floor(student.schedule.length / 2);
      const morningPeriods = student.schedule.slice(0, midPoint);
      const afternoonPeriods = student.schedule.slice(midPoint);
      
      const morningAvg = morningPeriods.reduce((acc, p) => acc + (periodAcc[p]?.totalPossible > 0 ? (periodAcc[p].totalEarned / periodAcc[p].totalPossible) * 100 : 0), 0) / morningPeriods.filter(p => periodAcc[p]?.totalPossible > 0).length;
      const afternoonAvg = afternoonPeriods.reduce((acc, p) => acc + (periodAcc[p]?.totalPossible > 0 ? (periodAcc[p].totalEarned / periodAcc[p].totalPossible) * 100 : 0), 0) / afternoonPeriods.filter(p => periodAcc[p]?.totalPossible > 0).length;

      if (Math.abs(morningAvg - afternoonAvg) >= 12) {
        const isMorningBetter = morningAvg > afternoonAvg;
        generatedInsights.push({
          type: 'bias',
          title: isMorningBetter ? "Morning Momentum" : "Afternoon Peak",
          text: `There is a clear preference for ${isMorningBetter ? 'morning' : 'afternoon'} classes, where success rates are ${Math.round(Math.abs(morningAvg - afternoonAvg))}% higher.`,
          score: Math.round(isMorningBetter ? morningAvg : afternoonAvg)
        });
      }
    }

    // 4. Consistency vs Volatility
    if (dailyDataRaw.length >= 5) {
      const scores = dailyDataRaw.map(d => d.score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev < 8) {
        generatedInsights.push({
          type: 'consistency',
          title: "Highly Consistent",
          text: "Behavior scores show very low day-to-day variance, indicating a stable and predictable performance level.",
          score: Math.round(avg)
        });
      } else if (stdDev > 20) {
        generatedInsights.push({
          type: 'consistency',
          title: "High Volatility",
          text: "Performance is swinging significantly between days. This 'rollercoaster' profile often points to external environmental triggers.",
          score: Math.round(avg)
        });
      }
    }

    // 5. Success Streak
    if (dailyDataRaw.length >= 3) {
      let streak = 0;
      for (let i = dailyDataRaw.length - 1; i >= 0; i--) {
        if (dailyDataRaw[i].score >= 90) {
          streak++;
        } else {
          break;
        }
      }
      if (streak >= 3) {
        generatedInsights.push({
          type: 'trend',
          title: "High Performance Streak",
          text: `Currently on a ${streak}-day streak of achieving 90% or higher. This indicates a period of excellent stability and success.`,
          score: dailyDataRaw[dailyDataRaw.length - 1].score
        });
      }
    }

    // 6. Traditional Struggle Detection (The 'Narrow' ones)
    Object.entries(behaviorByPeriod).forEach(([behavior, periods]) => {
      const overallBehavior = behaviorAveragesList.find(b => b.name === behavior);
      if (overallBehavior && overallBehavior.score > 0) {
        Object.entries(periods).forEach(([period, val]) => {
          if (val.totalPossible >= 3) {
            const pScore = Math.round((val.totalEarned / val.totalPossible) * 100);
            if (pScore <= overallBehavior.score - 18) {
              generatedInsights.push({
                type: 'struggle',
                title: "Specific Context Trigger",
                text: `${behavior} is significantly more difficult during ${period} than other times, suggesting a possible environment conflict.`,
                score: pScore
              });
            }
          }
        });
      }
    });

    return { dailyData, weeklyData, monthlyData, periodAverages, dayOfWeekAverages, behaviorAverages: behaviorAveragesList, insights: generatedInsights };
  }, [student, logs]);

  const dateRangeStr = useMemo(() => {
    if (logs.length === 0) return "No logs available";
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].date;
    const last = sorted[sorted.length - 1].date;
    if (first === last) return format(parseISO(first), "MMMM d, yyyy");
    return `${format(parseISO(first), "MM/dd/yyyy")} - ${format(parseISO(last), "MM/dd/yyyy")}`;
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 print:hidden">
        <div className="flex flex-wrap bg-slate-100/80 p-1 rounded-lg border border-slate-200">
          {[
            { id: "digest", label: "Weekly Overview", icon: CheckSquare },
            { id: "trends", label: "Trends", icon: TrendingUp },
            { id: "insights", label: "Insights", icon: Lightbulb }
          ].map(t => (
            <button 
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                tab === t.id ? "bg-white text-orange-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {tab === "digest" && (
          <div className="animate-in fade-in duration-500">
            <WeeklyDigest 
              student={student} 
              logs={logs} 
            />
          </div>
        )}
      
        {tab === "trends" && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Trend Selector Bar */}
            <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-xl">
              <div className="flex items-center gap-2 pl-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Trend Analysis</h3>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {[
                  { id: "day", label: "Day" },
                  { id: "week", label: "Week" },
                  { id: "month", label: "Month" }
                ].map(r => (
                  <button 
                    key={r.id}
                    onClick={() => setTrendRange(r.id as any)}
                    className={cn(
                      "px-4 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all",
                      trendRange === r.id ? "bg-white text-orange-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Top Chart: Consolidated Trend */}
            <Card className="shadow-none border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
                  {trendRange === 'month' ? 'Monthly' : trendRange === 'week' ? 'Weekly' : 'Daily'} Performance Trend (Full Year)
                </h4>
                {trendRange === 'month' ? <BarChart2 className="h-3.5 w-3.5 text-slate-300" /> : <TrendingUp className="h-3.5 w-3.5 text-slate-300" />}
              </div>
              <CardContent className="h-[250px] px-2 py-4">
                {(trendRange === 'month' ? monthlyData : trendRange === 'week' ? weeklyData : dailyData).length > 0 ? (
                  <ResponsiveContainer height={250} width="100%">
                    <LineChart 
                      data={trendRange === 'month' ? monthlyData : trendRange === 'week' ? weeklyData : dailyData} 
                      margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={!isMobile} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                        interval={trendRange === 'day' ? Math.floor(dailyData.length / 10) : 0}
                      />
                      <YAxis hide={isMobile} domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(val) => `${val}%`} />
                      <Tooltip 
                        trigger={isMobile ? "click" : "hover"}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }}
                        formatter={(val: number) => [`${Math.round(val)}%`, 'Score']} 
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        align="center" 
                        height={36} 
                        iconSize={10} 
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} 
                      />
                      <Line 
                        name="Performance Score"
                        type="monotone" 
                        dataKey="score" 
                        stroke={trendRange === 'month' ? "#3b82f6" : trendRange === 'week' ? "#ea580c" : "#10b981"} 
                        strokeWidth={3} 
                        dot={trendRange !== 'day'} 
                        activeDot={{ r: 6 }} 
                        isAnimationActive={false} 
                      />
                      <Line name="Linear Trend" type="linear" dataKey="trend" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Data found</div>
                )}
              </CardContent>
            </Card>

            {/* Second Row: Behavior & Day of Week */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="shadow-none border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Behavior</h4>
                  <BarChart2 className="h-3.5 w-3.5 text-slate-300" />
                </div>
                <CardContent className="h-[250px] px-2 py-2">
                  {behaviorAverages.length > 0 ? (
                    <ResponsiveContainer height={250} width="100%">
                      <BarChart data={behaviorAverages} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis hide={isMobile} dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} width={90} />
                        <Tooltip trigger={isMobile ? "click" : "hover"} cursor={{ fill: '#f8fafc' }} formatter={(val: number) => [`${val}%`, 'Score']} />
                        <Legend 
                          verticalAlign="bottom" 
                          align="center" 
                          height={36} 
                          iconSize={10} 
                          wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} 
                        />
                        <Bar 
                          name="Target Success Rate"
                          dataKey="score" 
                          fill="#ea580c" 
                          radius={[0, 6, 6, 0]} 
                          barSize={12}
                          isAnimationActive={false}
                          label={{ position: 'right', formatter: (val: number) => `${val}%`, fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Data</div>
                  )}
                </CardContent>
              </Card>

              <HeatmapVisual title="Day of the Week" data={dayOfWeekAverages} />
            </div>

            {/* Third Row: Time of Day (Full Width) */}
            <div className="w-full">
              <HeatmapVisual title="Time of Day" data={periodAverages} />
            </div>
          </div>
        )}

        {tab === "insights" && (
          <div className="animate-in fade-in duration-500">
            <Card className="border-none bg-slate-900 shadow-xl overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-white/5">
                <div className="flex items-center gap-3 text-orange-400 mb-2">
                  <Lightbulb className="h-6 w-6" />
                  <h3 className="text-xl font-black uppercase tracking-tight text-white">Smart Behavioral Insights</h3>
                </div>
                <p className="text-slate-400 text-sm font-medium">Algorithmic analysis of behavior patterns across all logged periods.</p>
              </div>
              <CardContent className="p-6">
                {insights.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {insights.map((insight, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.08] transition-colors relative overflow-hidden group">
                        <div className={cn(
                          "absolute top-0 left-0 w-1 h-full",
                          insight.type === 'trend' ? "bg-emerald-500" :
                          insight.type === 'bias' ? "bg-blue-500" :
                          insight.type === 'consistency' ? "bg-purple-500" :
                          "bg-orange-500"
                        )} />
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            insight.type === 'trend' ? "bg-emerald-500/10" :
                            insight.type === 'bias' ? "bg-blue-500/10" :
                            insight.type === 'consistency' ? "bg-purple-500/10" :
                            "bg-orange-500/10"
                          )}>
                            {insight.type === 'trend' ? <TrendingUp className={cn("h-4 w-4", "text-emerald-500")} /> :
                             insight.type === 'bias' ? <BarChart2 className={cn("h-4 w-4", "text-blue-500")} /> :
                             insight.type === 'consistency' ? <CheckSquare className={cn("h-4 w-4", "text-purple-500")} /> :
                             <AlertTriangle className="h-4 w-4 text-orange-500" />}
                          </div>
                          <div>
                            <p className={cn(
                              "text-[10px] font-black uppercase tracking-[0.2em] mb-1",
                              insight.type === 'trend' ? "text-emerald-500" :
                              insight.type === 'bias' ? "text-blue-500" :
                              insight.type === 'consistency' ? "text-purple-500" :
                              "text-orange-500"
                            )}>
                              {insight.type}
                            </p>
                            <p className="text-sm font-bold text-slate-100 leading-tight">
                              {insight.title}
                            </p>
                            <p className="text-[11px] font-medium text-slate-400 mt-2 leading-relaxed">
                              {insight.text}
                            </p>
                            {insight.score !== undefined && (
                              <div className="mt-3 flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                  <div className={cn(
                                    "h-full",
                                    insight.type === 'trend' ? "bg-emerald-500" : "bg-orange-500"
                                  )} style={{ width: `${insight.score}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400">{insight.score}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No significant deviations detected at this time.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
