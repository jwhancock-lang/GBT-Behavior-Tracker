import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { format, subDays, addDays, isToday, parseISO, parse, isWeekend, isValid } from "date-fns";
import { useStudents, useDailyLogs, useDailyNote, useAllDailyNotes, useSystemAdmins } from "../hooks/useDatabase";
import { useAuth } from "../components/AuthProvider";
import { usePermissions } from "../hooks/usePermissions";
import { PeriodScore, DailyLog, AttendanceStatus } from "../types";
import { CollaboratorManager } from "../components/CollaboratorManager";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar as CalendarIcon, TrendingUp, Share2, ChevronDown, ChevronUp, CheckCircle2, Lightbulb, AlertTriangle, Smile, Meh, Frown, BarChart2, CheckSquare, MinusCircle, MessageSquare, Trash2, Shield, Eye } from "lucide-react";
import { cn } from "../lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { StudentReport } from "../components/StudentReport";
import { PeriodImage } from "../components/PeriodImage";
import { KidMode } from "../components/KidMode";
import { Star } from "lucide-react";
import { SYSTEM_ADMINS } from "../lib/constants";
import { useIsMobile } from "../hooks/useMediaQuery";

const getPrevWeekday = (d: Date) => {
  let prev = subDays(d, 1);
  while (isWeekend(prev)) {
    prev = subDays(prev, 1);
  }
  return prev;
};

const getNextWeekday = (d: Date) => {
  let next = addDays(d, 1);
  while (isWeekend(next)) {
    next = addDays(next, 1);
  }
  return next;
};

export default function StudentLog() {
  const isMobile = useIsMobile();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { students, updateStudent, loading: studentsLoading } = useStudents();
  const { logs, loading: logsLoading, saveLog } = useDailyLogs(id);
  const { notes: allDailyNotes } = useAllDailyNotes(id);
  const { user } = useAuth();
  const { admins: dynamicAdmins } = useSystemAdmins();
  
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (isValid(parsed)) return parsed;
    }
    const today = new Date();
    return isWeekend(today) ? getPrevWeekday(today) : today;
  });

  // Sync date to URL
  useEffect(() => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    if (searchParams.get("date") !== dateStr) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set("date", dateStr);
        return next;
      }, { replace: true });
    }
  }, [currentDate, searchParams, setSearchParams]);

  const [isShareOpen, setIsShareOpen] = useState(false);
  
  const [attendance, setAttendance] = useState<AttendanceStatus>("present");
  const [periodData, setPeriodData] = useState<Record<string, PeriodScore>>({});
  const [trendFilter, setTrendFilter] = useState<"week" | "month" | "year">("week");
  const [view, setView] = useState<"log" | "report" | "kid">("log");

  const [showPeriodNote, setShowPeriodNote] = useState<Record<string, boolean>>({});
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
  const noteDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const dailyNoteDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [localDailyNote, setLocalDailyNote] = useState("");

  const student = useMemo(() => students.find(s => s.id === id), [students, id]);
  const { isSystemAdmin, canManageAccess, canEditSettings, canLogData, roleLabel } = usePermissions(student || null);
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const currentLog = useMemo(() => logs.find(l => l.date === dateStr), [logs, dateStr]);
  const { note: dailyNoteText, saveNote: saveDailyNote } = useDailyNote(id, dateStr);

  useEffect(() => {
    // Role synchronization or other side effects can go here
  }, [student?.id, user?.email]);

  useEffect(() => {
    setLocalDailyNote(dailyNoteText);
  }, [dailyNoteText]);

  const handleDailyNoteChange = (text: string) => {
    setLocalDailyNote(text);
    if (dailyNoteDebounceRef.current) {
      clearTimeout(dailyNoteDebounceRef.current);
    }
    dailyNoteDebounceRef.current = setTimeout(() => {
      saveDailyNote(text);
    }, 2000);
  };


  useEffect(() => {
    if (logsLoading) return;
    
    if (currentLog) {
      setAttendance(currentLog.attendance);
      try {
        setPeriodData(JSON.parse(currentLog.periodData));
      } catch (e) {
        console.error("Failed to parse period data", e);
        setPeriodData({});
      }
    } else if (student) {
      setAttendance("present");
      // init fresh day empty
      const fresh: Record<string, PeriodScore> = {};
      student.schedule.forEach(period => {
        fresh[period] = {
          status: "present",
          scores: {}
        };
      });
      setPeriodData(fresh);
      
      // Auto-save this fresh day so it counts in trend data without requiring changes,
      // but only if it's a weekday, to avoid generating spurious weekend data.
      const parsedDate = parseISO(dateStr);
      if (!isWeekend(parsedDate)) {
        saveLog({
          id: undefined,
          date: dateStr,
          attendance: "present",
          periodData: JSON.stringify(fresh)
        });
      }
    }
  }, [currentLog, student, dateStr, logsLoading]);

  const togglePeriodExpanded = (period: string, force?: boolean) => {
    setExpandedPeriods(prev => ({
      ...prev,
      [period]: force !== undefined ? force : !prev[period]
    }));
  };

  const handleImageSelected = async (period: string, base64: string) => {
    if (!student || !student.id) return;
    const periodImages = student.periodImages || {};
    await updateStudent(student.id, {
      periodImages: {
        ...periodImages,
        [period]: base64
      }
    });
  };

  // Expand periods by default on desktop, collapse by default on mobile
  // Optimized to only trigger on student change or date change
  useEffect(() => {
    if (student) {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      setExpandedPeriods(prev => {
        const initialExpanded: Record<string, boolean> = {};
        student.schedule.forEach(period => {
          initialExpanded[period] = isDesktop;
        });
        return initialExpanded;
      });
    }
  }, [student?.id, dateStr]);

  const handleExpandAll = () => {
    if (!student) return;
    setExpandedPeriods(prev => {
      const next = { ...prev };
      student.schedule.forEach(period => {
        next[period] = true;
      });
      return next;
    });
  };

  const handleCollapseAll = () => {
    if (!student) return;
    setExpandedPeriods(prev => {
      const next = { ...prev };
      student.schedule.forEach(period => {
        next[period] = false;
      });
      return next;
    });
  };

  const filteredLogs = useMemo(() => {
    const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    if (trendFilter === "week") {
      return sortedLogs.slice(-7);
    } else if (trendFilter === "month") {
      return sortedLogs.slice(-30);
    } else if (trendFilter === "year") {
      return sortedLogs.slice(-180); // Roughly a school year of logs
    }
    return sortedLogs;
  }, [logs, trendFilter]);

  // Calculate generic daily score mapping for trend line
  const calculateDailyScore = (log: DailyLog) => {
    if (log.attendance === "absent" || log.attendance === "school_closed" || log.attendance === "teacher_absent") return null;
    try {
      const data: Record<string, PeriodScore> = JSON.parse(log.periodData);
      let possible = 0;
      let earned = 0;
      student?.schedule.forEach(period => {
        const pData = data[period];
        if (pData && pData.status === "present") {
          student.behaviors.forEach(behavior => {
            const score = pData.scores[behavior];
            if (score !== undefined && score >= 0) {
               possible += 1;
               earned += score;
            }
          });
        }
      });
      return possible > 0 ? Math.round((earned / possible) * 100) : null;
    } catch {
      return null;
    }
  };

  const chartData = useMemo(() => {
    return filteredLogs.map(log => {
      const score = calculateDailyScore(log);
      const parsedDate = parse(log.date, 'yyyy-MM-dd', new Date());
      return {
        name: format(parsedDate, 'M/d'),
        score: score ?? undefined
      };
    }).filter(d => d.score !== undefined);
  }, [filteredLogs, student]);

  const insights = useMemo(() => {
    if (!student || filteredLogs.length === 0) return null;

    const periodScores: Record<string, { total: number, count: number }> = {};
    const behaviorScores: Record<string, { total: number, count: number }> = {};
    const combinationScores: Record<string, Record<string, { total: number, count: number }>> = {};

    student.schedule.forEach(p => {
      periodScores[p] = { total: 0, count: 0 };
      combinationScores[p] = {};
      student.behaviors.forEach(b => {
        combinationScores[p][b] = { total: 0, count: 0 };
      });
    });

    student.behaviors.forEach(b => {
      behaviorScores[b] = { total: 0, count: 0 };
    });

    filteredLogs.forEach(log => {
      if (log.attendance === "absent" || log.attendance === "school_closed" || log.attendance === "teacher_absent") return;
      try {
        const data: Record<string, PeriodScore> = JSON.parse(log.periodData);
        student.schedule.forEach(period => {
          const pData = data[period];
          if (pData && pData.status === "present" && pData.scores) {
            let periodTotal = 0;
            let periodCount = 0;

            student.behaviors.forEach(b => {
              const score = pData.scores[b];
              if (score !== undefined && score >= 0) {
                // Score is 0 or 1
                periodTotal += score;
                periodCount += 1;

                behaviorScores[b].total += score;
                behaviorScores[b].count += 1;

                combinationScores[period][b].total += score;
                combinationScores[period][b].count += 1;
              }
            });

            if (periodCount > 0) {
              periodScores[period].total += periodTotal / periodCount;
              periodScores[period].count += 1;
            }
          }
        });
      } catch (e) {
        // ignore parse error
      }
    });

    // Find toughest period
    let toughestPeriod = { name: "", avg: 1 };
    Object.entries(periodScores).forEach(([p, data]) => {
      if (data.count >= 3) { // Need at least 3 data points to be a trend
        const avg = data.total / data.count;
        if (avg < toughestPeriod.avg) {
          toughestPeriod = { name: p, avg };
        }
      }
    });

    // Find highest need behavior
    let highestNeedBehavior = { name: "", avg: 1 };
    Object.entries(behaviorScores).forEach(([b, data]) => {
      if (data.count >= 3) {
        const avg = data.total / data.count;
        if (avg < highestNeedBehavior.avg) {
          highestNeedBehavior = { name: b, avg };
        }
      }
    });

    // Find specific struggles (combos with much lower avg than the behavior's overall avg)
    const specificStruggles: { period: string, behavior: string, avg: number, behaviorAvg: number }[] = [];
    Object.entries(combinationScores).forEach(([p, bData]) => {
      Object.entries(bData).forEach(([b, data]) => {
        if (data.count >= 3 && behaviorScores[b].count >= 3) {
          const avg = data.total / data.count;
          const bAvg = behaviorScores[b].total / behaviorScores[b].count;
          // If the score in this period is noticeably lower than the behavior's average, or just generally low
          if (avg < bAvg - 0.25 || (avg <= 0.4 && bAvg >= 0.5)) {
            specificStruggles.push({ period: p, behavior: b, avg, behaviorAvg: bAvg });
          }
        }
      });
    });

    specificStruggles.sort((a, b) => a.avg - b.avg);

    return {
      toughestPeriod: toughestPeriod.name && toughestPeriod.avg <= 0.75 ? toughestPeriod : null,
      highestNeedBehavior: highestNeedBehavior.name && highestNeedBehavior.avg <= 0.75 ? highestNeedBehavior : null,
      specificStruggles: specificStruggles.filter(s => s.avg <= 0.75).slice(0, 3)
    };
  }, [student, filteredLogs]);

  const handleAttendanceChange = (status: AttendanceStatus) => {
    setAttendance(status);
    saveCurrentState(status, periodData);
  };

  const handlePeriodStatusToggle = (period: string) => {
    const fresh = { ...periodData };
    if (!fresh[period]) fresh[period] = { status: "present", scores: {} };
    fresh[period] = {
      ...fresh[period],
      status: fresh[period].status === "present" ? "missed" : "present"
    };
    setPeriodData(fresh);
    saveCurrentState(attendance, fresh);
  };

  const handleScoreChange = (period: string, behavior: string, score: number) => {
    const fresh = { ...periodData };
    if (!fresh[period]) fresh[period] = { status: "present", scores: {} };
    fresh[period] = {
      ...fresh[period],
      scores: {
        ...fresh[period].scores,
        [behavior]: score
      }
    };
    setPeriodData(fresh);
    saveCurrentState(attendance, fresh);
  };

  const handleScoreChangeBatch = (period: string, score: number) => {
    const fresh = { ...periodData };
    if (!fresh[period]) fresh[period] = { status: "present", scores: {} };
    
    const newScores = { ...fresh[period].scores };
    student.behaviors.forEach(b => {
      newScores[b] = score;
    });

    fresh[period] = {
      ...fresh[period],
      scores: newScores
    };
    setPeriodData(fresh);
    saveCurrentState(attendance, fresh);
    
    // Automatically expand the period if it was collapsed, so they can see it optionally, 
    // or just leave it collapsed for speed. The request was "without having to expand the box", 
    // so let's leave it as is or expand state unchanged.
  };

  const handleNotesChange = (period: string, notes: string) => {
    const fresh = { ...periodData };
    if (!fresh[period]) fresh[period] = { status: "present", scores: {} };
    fresh[period] = {
      ...fresh[period],
      notes
    };
    setPeriodData(fresh);
    
    if (noteDebounceRef.current) {
      clearTimeout(noteDebounceRef.current);
    }
    
    noteDebounceRef.current = setTimeout(() => {
      saveCurrentState(attendance, fresh);
    }, 2000);
  };

  const saveCurrentState = (newAtt: AttendanceStatus, newData: Record<string, PeriodScore>) => {
    saveLog({
      id: currentLog?.id,
      date: dateStr,
      attendance: newAtt,
      periodData: JSON.stringify(newData)
    });
  };

  // Calculations for averages
  let totalPossible = 0;
  let totalEarned = 0;

  if (student && attendance === "present") {
    student.schedule.forEach(period => {
      const pData = periodData[period];
      if (pData && pData.status === "present") {
        student.behaviors.forEach(behavior => {
          const score = pData.scores[behavior];
          if (score !== undefined && score >= 0) {
             totalPossible += 1; // max score is 1
             totalEarned += score;
          }
        });
      }
    });
  }

  const dailyPercentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;

  const renderAttendanceSelector = () => (
    <select
      className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all uppercase tracking-wide"
      value={attendance}
      onChange={(e) => handleAttendanceChange(e.target.value as AttendanceStatus)}
    >
      <option value="present">Present</option>
      <option value="absent">Absent</option>
      <option value="school_closed">School Closed</option>
      <option value="teacher_absent">Teacher Absent</option>
    </select>
  );

  if (studentsLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="text-slate-400 animate-pulse font-black text-[10px] uppercase tracking-widest">Loading student record...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center">
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Student record not found</p>
        <Button variant="outline" className="mt-6 font-bold uppercase text-xs tracking-widest h-9" asChild>
          <Link to="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase leading-none">{student.name}</h2>
              {roleLabel && roleLabel !== "Staff" && (
                <span className={cn(
                  "px-1.5 py-0.5 text-[9px] font-black uppercase rounded tracking-tighter leading-none border",
                  roleLabel === "Admin" ? "bg-slate-900 text-white border-slate-900" : "bg-orange-100 text-orange-700 border-orange-200 shadow-sm"
                )}>
                  {roleLabel}
                </span>
              )}
            </div>
            {(student.gradeLevel || student.homeroomTeacher) && (
              <div className="flex items-center gap-1.5 text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1">
                {student.gradeLevel && <span>Grade {student.gradeLevel}</span>}
                {student.gradeLevel && student.homeroomTeacher && <span>•</span>}
                {student.homeroomTeacher && <span>HR: {student.homeroomTeacher}</span>}
              </div>
            )}
            <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-1">Behavior Log & Performance</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canManageAccess && (
            <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-4 font-bold text-xs bg-white border-slate-200 shadow-sm">
                  <Share2 className="h-4 w-4 mr-2 text-slate-400" />
                  Collaborate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-orange-600" />
                    Collaborate: {student.name}
                  </DialogTitle>
                  <DialogDescription>
                    Manage who can view and log behavior data for this student.
                  </DialogDescription>
                </DialogHeader>

                <CollaboratorManager 
                  student={student}
                  onUpdate={async (updates) => {
                    if (student.id) {
                      await updateStudent(student.id, updates);
                    }
                  }}
                  onClose={() => setIsShareOpen(false)}
                />

                <DialogFooter className="pt-4">
                  <Button variant="outline" className="w-full h-10 font-black uppercase tracking-widest text-[10px]" onClick={() => setIsShareOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-100 mb-6 bg-slate-50/50 rounded-lg p-1 print:hidden">
        <button
          onClick={() => setView("log")}
          title="Tracking"
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 sm:px-6 rounded-md font-black text-xs uppercase tracking-wider sm:tracking-widest transition-all",
            view === "log" ? "bg-white text-orange-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
          )}
        >
          <CheckSquare className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Tracking</span>
        </button>
        <button
          onClick={() => setView("kid")}
          title="Student View"
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 sm:px-6 rounded-md font-black text-xs uppercase tracking-wider sm:tracking-widest transition-all",
            view === "kid" ? "bg-white text-orange-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
          )}
        >
          <Star className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Student View</span>
        </button>
        <button
          onClick={() => setView("report")}
          title="Analytics"
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 sm:px-6 rounded-md font-black text-xs uppercase tracking-wider sm:tracking-widest transition-all",
            view === "report" ? "bg-white text-orange-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
          )}
        >
          <BarChart2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Analytics</span>
        </button>
      </div>

      {view === "report" ? (
        <StudentReport student={student} logs={logs} allDailyNotes={allDailyNotes} />
      ) : (
        <>
          <div className="flex items-center justify-between bg-slate-900 text-white px-2 py-2 rounded-xl shadow-lg print:hidden mb-6">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-11 w-11 md:h-9 md:w-9 touch-action-manipulation select-none text-white hover:bg-white/10 hover:text-white rounded-lg"
              onClick={() => setCurrentDate(getPrevWeekday(currentDate))}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Viewing Date</span>
              <div className="flex items-center gap-2 font-black text-sm uppercase">
                {format(currentDate, "EEEE, MMM d")}
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-11 w-11 md:h-9 md:w-9 touch-action-manipulation select-none text-white hover:bg-white/10 hover:text-white rounded-lg"
              disabled={isToday(currentDate) || getNextWeekday(currentDate) > new Date()}
              onClick={() => setCurrentDate(getNextWeekday(currentDate))}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          {view === "kid" ? (
            <div className="mt-2">
              <KidMode 
                student={student} 
                periodData={periodData}
                onImageSelected={handleImageSelected}
                onScoreChange={handleScoreChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="w-full lg:w-1/3 space-y-4 flex flex-col lg:sticky lg:top-4">
                  <Card className="border-slate-200 shadow-none bg-white p-3">
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1.5">Attendance</h4>
                        {renderAttendanceSelector()}
                      </div>
                      <div className="pt-1">
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1.5">Comments</h4>
                        <textarea
                          className="w-full min-h-[100px] text-xs bg-slate-50 border border-slate-100 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-400 resize-none font-medium leading-relaxed"
                          placeholder="General behavioral notes for today..."
                          value={localDailyNote}
                          onChange={(e) => handleDailyNoteChange(e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>

                  <Card className="shadow-none border-slate-200 overflow-hidden hidden lg:block">
                    <div className="bg-slate-900 text-white p-4 text-center">
                      <div className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60 mb-1">Today's Performance</div>
                      <div className="text-4xl font-black">{dailyPercentage !== null ? `${dailyPercentage}%` : "--"}</div>
                    </div>
                    <div className="bg-white p-3 flex justify-between items-center text-[11px] font-black uppercase text-slate-500">
                      <span>Points Earned</span>
                      <span className="text-slate-900">{totalEarned} / {totalPossible}</span>
                    </div>
                  </Card>
            
                  {chartData.length > 0 && (
                    <Card className="shadow-none border-slate-200 hidden lg:block">
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Score History</h4>
                        <select 
                          className="text-[10px] font-bold bg-slate-50 border-none rounded px-2 py-1 text-slate-600 focus:outline-none"
                          value={trendFilter}
                          onChange={e => setTrendFilter(e.target.value as "week"| "month" | "year")}
                        >
                          <option value="week">WEEK</option>
                          <option value="month">MONTH</option>
                          <option value="year">YEAR</option>
                        </select>
                      </div>
                      <CardContent className="p-4">
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer height={250} width="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={!isMobile} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
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
                                name="Historical Score"
                                type="monotone" 
                                dataKey="score" 
                                stroke="#ea580c" 
                                strokeWidth={3}
                                dot={{ r: 4, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
                                activeDot={{ r: 6, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase">Daily Schedule</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={handleCollapseAll} className="h-7 text-[10px] font-black uppercase tracking-widest hover:text-orange-600">
                        Collapse
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleExpandAll} className="h-7 text-[10px] font-black uppercase tracking-widest hover:text-orange-600">
                        Expand
                      </Button>
                    </div>
                  </div>
                  
                  {attendance === "absent" || attendance === "school_closed" || attendance === "teacher_absent" ? (
                    <div className="py-24 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                         Day set as {attendance.split('_').join(' ')}
                       </p>
                    </div>
                  ) : (
                      <div className="md:border md:border-slate-200 md:rounded-xl md:bg-white md:shadow-sm overflow-hidden">
                        {student.schedule.map((period, pIdx) => {
                          const pData = periodData[period] || { status: "present", scores: {} };
                          const isMissed = pData.status === "missed";
                          const isExpanded = expandedPeriods[period];
                          const isNoteVisible = showPeriodNote[period] || (pData.notes && pData.notes.length > 0);
                          const isComplete = student.behaviors.length > 0 && student.behaviors.every(b => pData.scores[b] !== undefined);
                          
                          let periodPct: null | number = null;
                          if (isComplete && !isMissed) {
                            const periodScoreVal = student.behaviors.reduce((acc, b) => acc + (pData.scores[b] || 0), 0);
                            const periodMaxVal = student.behaviors.length; 
                            periodPct = periodMaxVal > 0 ? periodScoreVal / periodMaxVal : null;
                          }

                          return (
                            <div key={pIdx} className={cn(
                              "bg-white border md:border-0 md:border-b border-slate-100 last:border-b-0 transition-all",
                              "md:even:bg-slate-50/30",
                              isExpanded && !isMissed && "md:bg-orange-50/10",
                              isMissed && "opacity-60 grayscale bg-slate-50",
                              !isExpanded && "rounded-xl md:rounded-none"
                            )}>
                              <div 
                                className={cn(
                                  "flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5 cursor-pointer hover:bg-slate-50/80 transition-colors",
                                  isExpanded && !isMissed && "border-b border-slate-100 md:border-b-transparent"
                                )}
                                onClick={() => togglePeriodExpanded(period)}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="hidden md:block">
                                    <PeriodImage period={period} image={student.periodImages?.[period]} size="sm" />
                                  </div>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{period}</h4>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isMissed ? (
                                        <span className="text-[9px] font-black text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded uppercase leading-none">MISSED</span>
                                      ) : isComplete ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                  {periodPct !== null && (
                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-slate-900 text-white rounded-md shadow-sm">
                                      {periodPct >= 0.8 ? <Smile className="h-3 w-3" /> : 
                                       periodPct >= 0.5 ? <Meh className="h-3 w-3" /> : 
                                       <Frown className="h-3 w-3" />}
                                      <span className="text-[10px] font-black">{Math.round(periodPct * 100)}%</span>
                                    </div>
                                  )}
                                  
                                  {!isMissed && !isComplete && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 px-2 text-[9px] font-black uppercase text-emerald-600 hover:bg-emerald-50 rounded-md hidden md:flex"
                                      onClick={(e) => { e.stopPropagation(); handleScoreChangeBatch(period, 1); }}
                                    >
                                      Quick Yes
                                    </Button>
                                  )}

                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-11 w-11 md:h-9 md:w-9 touch-action-manipulation select-none text-slate-400 rounded-md hover:bg-slate-200/50"
                                      onClick={(e) => { e.stopPropagation(); handlePeriodStatusToggle(period); }}
                                    >
                                      <MinusCircle className={cn("h-5 w-5 md:h-4 md:w-4", isMissed && "text-orange-500")} />
                                    </Button>
                                    <div className="text-slate-300">
                                      {isExpanded ? <ChevronUp className="h-4 w-4 md:h-3.5 md:w-3.5" /> : <ChevronDown className="h-4 w-4 md:h-3.5 md:w-3.5" />}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {isExpanded && !isMissed && (
                                <div className="p-3 md:p-2 bg-slate-50/50 space-y-1">
                                  <div className="space-y-1 md:px-2">
                                    {student.behaviors.map((behavior, bIdx) => {
                                      const currentScore = pData.scores[behavior];
                                      return (
                                        <div key={bIdx} className="bg-white md:bg-transparent md:border-0 p-2 md:p-0 md:py-1 rounded-lg border border-slate-100 flex items-center justify-between gap-4">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-tight truncate">{behavior}</p>
                                          </div>
                                          <div className="flex gap-1.5 shrink-0">
                                            {[
                                              { val: 0, icon: Frown, color: "bg-red-500", label: "NO" },
                                              { val: 1, icon: Smile, color: "bg-emerald-500", label: "YES" }
                                            ].map(opt => (
                                              <button
                                                key={opt.val}
                                                onClick={() => handleScoreChange(period, behavior, opt.val)}
                                                className={cn(
                                                  "h-11 w-11 md:h-9 md:w-12 rounded-md flex flex-col items-center justify-center transition-all border touch-action-manipulation select-none",
                                                  currentScore === opt.val 
                                                    ? cn(opt.color, "text-white border-transparent shadow-sm") 
                                                    : "bg-slate-50 text-slate-300 border-slate-100 hover:border-slate-200 hover:bg-slate-100"
                                                )}
                                              >
                                                <opt.icon className="h-3.5 w-3.5 md:h-3.5 md:w-3.5" />
                                                <span className="text-[8px] font-black leading-none mt-0.5">{opt.label}</span>
                                              </button>
                                            ))}
                                            <button
                                              onClick={() => handleScoreChange(period, behavior, -1)}
                                              className={cn(
                                                "h-11 w-11 md:h-9 md:w-9 rounded-md flex items-center justify-center transition-all border touch-action-manipulation select-none",
                                                currentScore === -1 
                                                  ? "bg-slate-400 text-white border-transparent" 
                                                  : "bg-slate-50 text-slate-300 border-slate-100 hover:bg-slate-100"
                                              )}
                                            >
                                              <MinusCircle className="h-3.5 w-3.5 md:h-3.5 md:w-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  
                                  <div className="mt-1 border-t border-slate-100/50 pt-1 flex flex-col md:px-2">
                                    <div className="flex items-center justify-between">
                                      <button 
                                        onClick={() => setShowPeriodNote(prev => ({ ...prev, [period]: !prev[period] }))}
                                        className={cn(
                                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all",
                                          isNoteVisible ? "text-orange-600 bg-orange-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                        )}
                                      >
                                        <MessageSquare className="h-3 w-3" />
                                        <span>{isNoteVisible ? "Period Note" : "Add Note"}</span>
                                      </button>
                                    </div>
                                    
                                    {isNoteVisible && (
                                      <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <textarea
                                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500 min-h-[40px] md:min-h-[50px] font-medium"
                                          placeholder="Type notes for this period..."
                                          value={pData.notes || ""}
                                          autoFocus={showPeriodNote[period]}
                                          onChange={(e) => handleNotesChange(period, e.target.value)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                  )}

                  {/* Mobile-only performance and score history views placed below the daily schedule */}
                  <div className="block lg:hidden space-y-4 pt-4 border-t border-slate-100/50">
                    <Card className="shadow-none border-slate-200 overflow-hidden">
                      <div className="bg-slate-900 text-white p-4 text-center">
                        <div className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60 mb-1">Today's Performance</div>
                        <div className="text-4xl font-black">{dailyPercentage !== null ? `${dailyPercentage}%` : "--"}</div>
                      </div>
                      <div className="bg-white p-3 flex justify-between items-center text-[11px] font-black uppercase text-slate-500">
                        <span>Points Earned</span>
                        <span className="text-slate-900">{totalEarned} / {totalPossible}</span>
                      </div>
                    </Card>

                    {chartData.length > 0 && (
                      <Card className="shadow-none border-slate-200">
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Score History</h4>
                          <select 
                            className="text-[10px] font-bold bg-slate-50 border-none rounded px-2 py-1 text-slate-600 focus:outline-none"
                            value={trendFilter}
                            onChange={e => setTrendFilter(e.target.value as "week"| "month" | "year")}
                          >
                            <option value="week">WEEK</option>
                            <option value="month">MONTH</option>
                            <option value="year">YEAR</option>
                          </select>
                        </div>
                        <CardContent className="p-4">
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer height={250} width="100%">
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={!isMobile} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="name" 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
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
                                  name="Historical Score"
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke="#ea580c" 
                                  strokeWidth={3}
                                  dot={{ r: 4, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
                                  activeDot={{ r: 6, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
