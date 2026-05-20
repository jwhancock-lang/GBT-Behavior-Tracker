import React, { useState, useMemo, useEffect } from "react";
import { useAdminStats, StudentStats, useSystemAdmins } from "../hooks/useDatabase";
import { usePermissions } from "../hooks/usePermissions";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, ArrowUpDown, TrendingDown, Clock, User, GraduationCap, School, AlertTriangle, CheckCircle2, History, Shield, ShieldPlus, Trash2, Mail, Plus, Archive, Settings2, Users, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { format, subDays, eachDayOfInterval, isWeekend, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { SYSTEM_ADMINS as HARDCODED_ADMINS } from "../lib/constants";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Student } from "../types";
import { useStudents, usePersonalGroups, useDailyLogs, useDailyNote, useAllDailyNotes, useSystemAdmins as useDatabaseSystemAdmins } from "../hooks/useDatabase";
import { useAuth } from "../components/AuthProvider";

const DEFAULT_SCHEDULE = [
  "Arrival",
  "Reading",
  "Math",
  "Specials",
  "Lunch",
  "Recess",
  "Dismissal"
];

const DEFAULT_BEHAVIORS = [
  "Follows directions",
  "Keep hands and feet to self",
  "Stays on task"
];

export default function AdminConsole() {
  const { user: authUser } = useAuth();
  const { isSystemAdmin, loading: permsLoading } = usePermissions(null);
  const [activeTab, setActiveTab] = useState<"overview" | "compliance" | "roster" | "system">("overview");
  const [daysRange, setDaysRange] = useState<7 | 30>(7);
  const { stats, loading } = useAdminStats(daysRange);
  const { students, addStudent, updateStudent, deleteStudent } = useStudents();
  const { updateStudentGroups } = usePersonalGroups();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "percentage" | "gradeLevel" | "missingCount">("percentage");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [showArchived, setShowArchived] = useState(false);

  // Student Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newName, setNewName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [homeroomTeacher, setHomeroomTeacher] = useState("");
  const [behaviors, setBehaviors] = useState(DEFAULT_BEHAVIORS.join("\n"));
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE.join("\n"));
  const [status, setStatus] = useState<"active" | "archived">("active");

  // System Admin management
  const { admins, addAdmin, removeAdmin } = useSystemAdmins();
  const [newAdminEmail, setNewAdminEmail] = useState("");

  useEffect(() => {
    if (activeTab === "compliance") {
      setSortField("missingCount");
      setSortOrder("desc");
    } else {
      setSortField("percentage");
      setSortOrder("asc");
    }
  }, [activeTab]);

  // Get last 30 weekdays for the visual timeline
  const recentCheckDates = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, 40); // 40 days to get ~30 weekdays
    return eachDayOfInterval({ start, end })
      .filter(date => !isWeekend(date))
      .slice(-30) // Take exactly 30
      .reverse(); // Newest first
  }, []);

  const complianceStats = useMemo(() => {
    return stats.map(s => {
      const logsMap = new Map(s.logs.map(l => [l.date, l]));
      const today = startOfDay(new Date());
      let studentCreated = startOfDay(parseISO(s.createdAt || new Date().toISOString()));
      if (isNaN(studentCreated.getTime()) || isAfter(studentCreated, today)) {
        studentCreated = today;
      }
      
      // Calculate missing count since creation (excluding weekends)
      let missingTotalSinceCreation = 0;
      const allDatesSinceCreation = eachDayOfInterval({ start: studentCreated, end: today })
        .filter(date => !isWeekend(date));
      
      allDatesSinceCreation.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const log = logsMap.get(dateStr);
        
        let isMissing = false;
        if (!log) {
          isMissing = true;
        } else if (log.attendance === "present") {
          // Check if it's empty (no scores AND no explicit missed statuses)
          try {
            const data = JSON.parse(log.periodData);
            let hasAnyData = false;
            Object.values(data).forEach((p: any) => {
              if (p.scores && Object.keys(p.scores).length > 0) hasAnyData = true;
              if (p.notes && p.notes.length > 0) hasAnyData = true;
              if (p.status === "missed") hasAnyData = true; // Teacher explicitly explained the missing data
            });
            if (!hasAnyData) isMissing = true;
          } catch {
            isMissing = true;
          }
        }
        
        if (isMissing) missingTotalSinceCreation++;
      });

      return {
        ...s,
        missingCount: missingTotalSinceCreation,
        logsMap
      };
    });
  }, [stats]);

  const filteredAndSortedStats = useMemo(() => {
    let source = activeTab === "compliance" ? complianceStats : stats.map(s => ({ ...s, missingCount: 0 }));
    
    // Filter out compliant students in compliance tab
    if (activeTab === "compliance") {
      source = (source as any).filter((s: any) => s.missingCount > 0);
    }

    let result = [...source];

    // Filter by search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(st => 
        st.name.toLowerCase().includes(s) || 
        st.gradeLevel?.toLowerCase().includes(s) || 
        st.homeroomTeacher?.toLowerCase().includes(s)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortField === "percentage") {
        return sortOrder === "asc" ? a.percentage - b.percentage : b.percentage - a.percentage;
      }
      if (sortField === "missingCount") {
        return sortOrder === "asc" ? (a as any).missingCount - (b as any).missingCount : (b as any).missingCount - (a as any).missingCount;
      }

      let valA: any = (a as any)[sortField] || "";
      let valB: any = (b as any)[sortField] || "";
      const comparison = String(valA).localeCompare(String(valB));
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [stats, complianceStats, search, sortField, sortOrder, activeTab]);

  const summary = useMemo(() => {
    const counts = { red: 0, orange: 0, yellow: 0, green: 0, missingTotal: 0 };
    stats.forEach(s => {
      if (s.percentage < 70) counts.red++;
      else if (s.percentage < 80) counts.orange++;
      else if (s.percentage < 90) counts.yellow++;
      else counts.green++;
    });
    
    // Total missing slots in last 14 days
    counts.missingTotal = complianceStats.reduce((acc, curr) => acc + curr.missingCount, 0);

    return counts;
  }, [stats, complianceStats]);

  const filteredRoster = useMemo(() => {
    return students.filter(s => {
      const sStatus = s.status || "active";
      if (showArchived && sStatus !== "archived") return false;
      if (!showArchived && sStatus === "archived") return false;
      
      if (search.trim()) {
        const term = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(term) ||
          (s.gradeLevel || "").toLowerCase().includes(term) ||
          (s.homeroomTeacher || "").toLowerCase().includes(term)
        );
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, search, showArchived]);

  if (permsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-zinc-500 animate-pulse font-medium">Aggregating behavior data...</div>
      </div>
    );
  }

  if (!isSystemAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <div>
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-sm text-zinc-500">Only system administrators can access this console.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }


  const openAddForm = () => {
    setEditingStudent(null);
    setNewName("");
    setGradeLevel("");
    setHomeroomTeacher("");
    setBehaviors(DEFAULT_BEHAVIORS.join("\n"));
    setSchedule(DEFAULT_SCHEDULE.join("\n"));
    setStatus("active");
    setIsFormOpen(true);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !authUser) return;

    try {
      if (editingStudent && editingStudent.id) {
        await updateStudent(editingStudent.id, {
          name: newName.trim(),
          gradeLevel: gradeLevel.trim(),
          homeroomTeacher: homeroomTeacher.trim(),
          status: status,
          behaviors: behaviors.split("\n").map(b => b.trim()).filter(Boolean),
          schedule: schedule.split("\n").map(s => s.trim()).filter(Boolean),
        });
      } else {
        await addStudent({
          name: newName.trim(),
          gradeLevel: gradeLevel.trim(),
          homeroomTeacher: homeroomTeacher.trim(),
          behaviors: behaviors.split("\n").map(b => b.trim()).filter(Boolean),
          schedule: schedule.split("\n").map(s => s.trim()).filter(Boolean),
          teacherEmails: [authUser.email || ""],
          status: "active"
        });
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error("Failed to save student:", err);
      alert("Error saving student record.");
    }
  };

  const handleSort = (field: "name" | "percentage" | "gradeLevel" | "missingCount") => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getBadgeColor = (percentage: number) => {
    if (percentage < 70) return "bg-red-500 text-white";
    if (percentage < 80) return "bg-orange-500 text-white";
    if (percentage < 90) return "bg-amber-400 text-black";
    return "bg-emerald-500 text-white";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 flex items-center gap-2">
            Admin Console
          </h1>
          <p className="text-zinc-500 text-sm">Bird's-eye view of student performance and compliance.</p>
        </div>
        
        <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200 min-w-0 max-w-full overflow-x-auto no-scrollbar whitespace-nowrap">
          <Button 
            variant={activeTab === "overview" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setActiveTab("overview")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest h-8 px-2.5 sm:px-4"
            title="Performance Overview"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Overview</span>
          </Button>
          <Button 
            variant={activeTab === "compliance" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setActiveTab("compliance")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest h-8 px-2.5 sm:px-4"
            title="Data Compliance"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Compliance</span>
            {summary.missingTotal > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[9px] rounded-full shrink-0">{summary.missingTotal}</span>}
          </Button>
          <Button 
            variant={activeTab === "roster" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setActiveTab("roster")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest h-8 px-2.5 sm:px-4"
            title="Roster Management"
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Roster</span>
          </Button>
          <Button 
            variant={activeTab === "system" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setActiveTab("system")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest h-8 px-2.5 sm:px-4"
            title="System Access"
          >
            <Shield className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">System</span>
          </Button>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Behavior Trends</h2>
            <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
              <Button 
                variant={daysRange === 7 ? "white" : "ghost"} 
                size="sm" 
                onClick={() => setDaysRange(7)}
                className={cn("text-[9px] font-black uppercase tracking-widest h-7", daysRange === 7 && "bg-white shadow-sm")}
              >
                Week
              </Button>
              <Button 
                variant={daysRange === 30 ? "white" : "ghost"} 
                size="sm" 
                onClick={() => setDaysRange(30)}
                className={cn("text-[9px] font-black uppercase tracking-widest h-7", daysRange === 30 && "bg-white shadow-sm")}
              >
                Month
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Urgent (Red)" count={summary.red} color="bg-red-50" borderColor="border-red-200" textColor="text-red-700" />
            <SummaryCard label="Struggling (Orange)" count={summary.orange} color="bg-orange-50" borderColor="border-orange-200" textColor="text-orange-700" />
            <SummaryCard label="Monitor (Yellow)" count={summary.yellow} color="bg-amber-50" borderColor="border-amber-200" textColor="text-amber-700" />
            <SummaryCard label="Exceeding (Green)" count={summary.green} color="bg-emerald-50" borderColor="border-emerald-200" textColor="text-emerald-700" />
          </div>
        </>
      )}

      {activeTab === "compliance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border-b-2 border-red-200 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Action Required</p>
              </div>
              <p className="text-3xl font-black text-zinc-900">{summary.missingTotal}</p>
              <p className="text-[10px] font-bold text-red-600 mt-1">Total missing entries across all students</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 px-4 py-3 bg-zinc-50 rounded-lg border border-zinc-200">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Timeline Legend:</span>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-600 uppercase">Complete (Data or explained)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-amber-400" />
              <span className="text-[10px] font-bold text-zinc-600 uppercase">Incomplete (Empty Entry)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-red-500" />
              <span className="text-[10px] font-bold text-zinc-600 uppercase">Missing (No Entry)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-zinc-200" />
              <span className="text-[10px] font-bold text-zinc-600 uppercase">Before enrollment</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "roster" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Find student..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 border-zinc-200 focus:ring-orange-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="h-11 px-4 text-[10px] font-black uppercase tracking-widest"
              >
                <Archive className="h-4 w-4 mr-2" />
                {showArchived ? "Viewing Archived" : "View Archive"}
              </Button>
              
              <Button 
                onClick={openAddForm}
                className="h-11 px-6 font-black uppercase text-[10px] bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Student Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Grade / Teacher</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredRoster.map(s => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-zinc-900">{s.name}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {s.gradeLevel || "No Grade"} • {s.homeroomTeacher || "No Teacher"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                          (s.status || "active") === "archived" ? "bg-zinc-100 text-zinc-400" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {s.status || "active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                         <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingStudent(s);
                            setNewName(s.name);
                            setGradeLevel(s.gradeLevel || "");
                            setHomeroomTeacher(s.homeroomTeacher || "");
                            setBehaviors(s.behaviors.join("\n"));
                            setSchedule(s.schedule.join("\n"));
                            setStatus(s.status || "active");
                            setIsFormOpen(true);
                          }}
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-900"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            if (window.confirm(`Delete ${s.name}? This cannot be undone.`)) {
                              deleteStudent(s.id!);
                            }
                          }}
                          className="h-8 w-8 text-zinc-300 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredRoster.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic text-sm">
                        No students found in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "system" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100">
              <div className="flex items-center gap-3 mb-1">
                <Shield className="h-5 w-5 text-orange-600" />
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Platform Administrators</h3>
              </div>
              <p className="text-xs text-zinc-500">System Administrators have full reading and writing access to all students, settings, and logs across the entire platform.</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Add New Administrator</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input 
                      placeholder="Email address (e.g. principal@school.edu)" 
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="pl-10 h-11 border-zinc-200"
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      if (newAdminEmail.trim()) {
                        addAdmin(newAdminEmail);
                        setNewAdminEmail("");
                      }
                    }}
                    disabled={!newAdminEmail.trim()}
                    className="h-11 px-6 font-black uppercase text-[10px] bg-zinc-900 text-white hover:bg-black"
                  >
                    <ShieldPlus className="h-4 w-4 mr-2" />
                    Grant Access
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Current Administrators</label>
                <div className="border border-zinc-100 rounded-xl divide-y divide-zinc-50">
                  {/* Hardcoded Admins (Cannot be removed via UI for safety) */}
                  {HARDCODED_ADMINS.map(email => (
                    <div key={email} className="flex items-center justify-between p-4 bg-zinc-50/50">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center">
                          <User className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-zinc-900 uppercase tracking-tight">{email}</p>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Master Root Admin</span>
                        </div>
                      </div>
                      <div className="px-2 py-0.5 bg-zinc-100 text-zinc-400 text-[8px] font-black uppercase rounded tracking-widest">
                        Permanent
                      </div>
                    </div>
                  ))}

                  {/* Dynamic Admins */}
                  {admins.filter(e => !HARDCODED_ADMINS.includes(e)).map(email => (
                    <div key={email} className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-zinc-900 uppercase tracking-tight">{email}</p>
                          <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">System Administrator</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Revoke administrator access for ${email}?`)) {
                            removeAdmin(email);
                          }
                        }}
                        className="h-9 w-9 text-red-300 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {admins.filter(e => !HARDCODED_ADMINS.includes(e)).length === 0 && (
                    <div className="p-8 text-center text-zinc-400 italic text-xs">
                      No additional platform administrators have been added.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl">
             <div className="flex gap-3">
               <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
               <div>
                  <p className="text-xs font-black text-amber-900 uppercase tracking-tight">Security Notice</p>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Granting System Administrator access gives a user full control over all data in the system. 
                    Only grant this role to trusted staff members who require bird's-eye management of the platform.
                  </p>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Filters & Main Data Table for Overview & Compliance */}
      {(activeTab === "overview" || activeTab === "compliance") && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search name, grade, or teacher..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 border-zinc-200 text-sm focus:ring-orange-500"
              />
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <User className="h-3.5 w-3.5" />
                <span>{filteredAndSortedStats.length} Results</span>
              </div>
            </div>
          </div>

          {/* Main Data Table */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-200">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 sticky left-0 bg-zinc-50 z-10 border-b border-zinc-200">
                      <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-zinc-900 transition-colors">
                        Student <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-200">
                      <button onClick={() => handleSort("gradeLevel")} className="flex items-center gap-1 hover:text-zinc-900 transition-colors">
                        Grade <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    {activeTab === "overview" ? (
                      <>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center border-b border-zinc-200">
                          <button onClick={() => handleSort("percentage")} className="flex items-center gap-1 hover:text-zinc-900 transition-colors mx-auto">
                            Score <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-200">
                          Struggling Goals (Focus Areas)
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center border-b border-zinc-200">
                          <button onClick={() => handleSort("missingCount")} className="flex items-center gap-1 hover:text-zinc-900 transition-colors mx-auto">
                            Missing <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-200">
                           Timeline (Last 30 Days)
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 border-b border-zinc-200"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filteredAndSortedStats.map((item) => {
                      const today = startOfDay(new Date());
                      let studentCreated = startOfDay(parseISO(item.createdAt || new Date().toISOString()));
                      if (isNaN(studentCreated.getTime()) || isAfter(studentCreated, today)) {
                        studentCreated = today;
                      }

                      return (
                        <motion.tr 
                          key={item.studentId}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors"
                        >
                          <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-zinc-50 z-10">
                            <Link to={`/student/${item.studentId}`} className="font-bold text-zinc-900 hover:text-orange-600 transition-colors whitespace-nowrap block">
                              {item.name}
                              <span className="text-[10px] font-medium text-zinc-400 block tracking-tight uppercase">{item.homeroomTeacher || "No Teacher"}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-zinc-500">
                            {item.gradeLevel || "—"}
                          </td>

                          {activeTab === "overview" ? (
                            <>
                              <td className="px-4 py-3 text-center">
                                <div className={cn(
                                  "inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-black min-w-[3.5rem]",
                                  getBadgeColor(item.percentage)
                                )}>
                                  {Math.round(item.percentage)}%
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {item.strugglingGoals.length > 0 ? (
                                    item.strugglingGoals.map(sg => (
                                      <div key={sg.goal} className="flex items-center gap-1.5 bg-zinc-100/80 px-2 py-1 rounded text-[10px] font-bold text-zinc-600">
                                        <TrendingDown className="h-3 w-3 text-red-500" />
                                        <span className="uppercase tracking-tight truncate max-w-[120px]">{sg.goal}</span>
                                        <span className="text-red-600 tabular-nums">{Math.round(sg.average)}%</span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-zinc-300 font-medium italic">All goals tracking well</span>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-center">
                                 {(item as any).missingCount > 0 ? (
                                   <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                                     {(item as any).missingCount} Missing
                                   </span>
                                 ) : (
                                   <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs font-bold flex items-center gap-1 justify-center">
                                     <CheckCircle2 className="h-3 w-3" /> Complete
                                   </span>
                                 )}
                              </td>
                              <td className="px-4 py-3">
                                 <div className="flex gap-[2px]">
                                   {recentCheckDates.map((date, idx) => {
                                     const dateStr = format(date, 'yyyy-MM-dd');
                                     const isBeforeCreation = isBefore(date, studentCreated);
                                     const log = (item as any).logsMap.get(dateStr);
                                     
                                     let status: 'missing' | 'present' | 'incomplete' | 'before' = 'missing';
                                     if (isBeforeCreation) {
                                       status = 'before';
                                     } else if (log) {
                                        if (log.attendance !== "present") {
                                          status = 'present';
                                        } else {
                                          try {
                                            const data = JSON.parse(log.periodData);
                                            let hasAnyData = false;
                                            Object.values(data).forEach((p: any) => {
                                              if (p.scores && Object.keys(p.scores).length > 0) hasAnyData = true;
                                              if (p.notes && p.notes.length > 0) hasAnyData = true;
                                              if (p.status === "missed") hasAnyData = true;
                                            });
                                            status = hasAnyData ? 'present' : 'incomplete';
                                          } catch {
                                            status = 'incomplete';
                                          }
                                        }
                                     }

                                     return (
                                       <Link 
                                         key={idx}
                                         to={`/student/${item.studentId}?date=${dateStr}`}
                                         title={`${format(date, 'MMM d, yyyy')}: ${
                                           status === 'present' ? 'Data Complete' : 
                                           status === 'incomplete' ? 'Entry Exists (Blank)' : 
                                           status === 'before' ? 'Before Enrollment' : 'No Data Entered'
                                         }`}
                                         className={cn(
                                           "h-4 w-2 sm:w-3 rounded-[1px] border border-transparent transition-transform hover:scale-125 hover:z-20",
                                           status === 'present' && "bg-emerald-500 shadow-[0_0_2px_rgba(16,185,129,0.5)]",
                                           status === 'incomplete' && "bg-amber-400 shadow-[0_0_2px_rgba(251,191,36,0.5)]",
                                           status === 'missing' && "bg-red-500 shadow-[0_0_2px_rgba(239,68,68,0.3)]",
                                           status === 'before' && "bg-zinc-200"
                                         )}
                                       />
                                     );
                                   })}
                                 </div>
                              </td>
                            </>
                          )}
                          
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-zinc-400 hover:text-zinc-900">
                              <Link to={`/student/${item.studentId}`}>
                                <History className="h-4 w-4" />
                              </Link>
                            </Button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {filteredAndSortedStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-zinc-400 italic">
                        No students matching active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Student Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Edit Student Profile" : "Add New Student"}</DialogTitle>
            <DialogDescription>
              Configure the core identity and behavioral targets for this student.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStudentSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gradeLevel">Grade Level</Label>
                <Input
                  id="gradeLevel"
                  value={gradeLevel}
                  onChange={e => setGradeLevel(e.target.value)}
                  placeholder="e.g. 1st Grade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homeroomTeacher">Homeroom</Label>
                <Input
                  id="homeroomTeacher"
                  value={homeroomTeacher}
                  onChange={e => setHomeroomTeacher(e.target.value)}
                  placeholder="e.g. Smith"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Student Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Alex M."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Availability Status</Label>
              <select
                id="status"
                value={status}
                onChange={e => setStatus(e.target.value as "active" | "archived")}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm"
              >
                <option value="active">Active (Visible to Teachers)</option>
                <option value="archived">Archived (Hidden from Dashboard)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="behaviors">Target Behaviors (one per line)</Label>
              <textarea
                id="behaviors"
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm"
                value={behaviors}
                onChange={e => setBehaviors(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule / Periods (one per line)</Label>
              <textarea
                id="schedule"
                className="flex min-h-[120px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm"
                value={schedule}
                onChange={e => setSchedule(e.target.value)}
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white">
                {editingStudent ? "Save Student" : "Create Student"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function SummaryCard({ label, count, color, borderColor, textColor }: { 
  label: string; 
  count: number; 
  color: string; 
  borderColor: string; 
  textColor: string;
}) {
  return (
    <div className={cn(
      "p-4 rounded-xl border-b-2 shadow-sm",
      color,
      borderColor
    )}>
      <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", textColor)}>
        {label}
      </p>
      <p className="text-3xl font-black tabular-nums text-zinc-900">
        {count}
      </p>
    </div>
  );
}
