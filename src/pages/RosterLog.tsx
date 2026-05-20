import React, { useState, useMemo } from "react";
import { format, isWeekend, parseISO, isToday, subDays, addDays } from "date-fns";
import { useStudents, useDailyLogsBulk, useSystemAdmins } from "../hooks/useDatabase";
import { useAuth } from "../components/AuthProvider";
import { usePermissions } from "../hooks/usePermissions";
import { SYSTEM_ADMINS as SYSTEM_ADMIN_EMAILS } from "../lib/constants";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { CalendarIcon, Smile, Frown, MinusCircle, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { Student } from "../types";
import { cn } from "../lib/utils";

function StudentRow({ 
  student, 
  isSelected, 
  onToggle 
}: { 
  student: Student; 
  isSelected: boolean; 
  onToggle: (id: string) => void;
  key?: React.Key;
}) {
  const { canLogData } = usePermissions(student);
  
  return (
    <div 
      className={cn(
        "p-1.5 px-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group",
        !canLogData && "opacity-50 cursor-not-allowed grayscale"
      )}
      onClick={() => canLogData && onToggle(student.id!)}
    >
      <div className="flex items-center justify-center w-4 h-4">
        {canLogData ? (
          <input 
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(student.id!);
            }}
          />
        ) : (
          <Lock className="h-3 w-3 text-slate-400" />
        )}
      </div>
      <span className={cn(
        "text-sm font-medium",
        isSelected ? "text-slate-900" : "text-slate-600"
      )}>
        {student.name}
      </span>
      {!canLogData && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          View Only
        </span>
      )}
    </div>
  );
}

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

export default function RosterLog() {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useStudents();
  const { admins: dynamicAdmins } = useSystemAdmins();
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const today = new Date();
    return isWeekend(today) ? getPrevWeekday(today) : today;
  });
  
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  const dateStr = format(currentDate, "yyyy-MM-dd");

  const allGroups = useMemo(() => {
    const groupSet = new Set<string>();
    students.forEach(s => {
      if (s.status === "archived") return;
      s.groups?.forEach(g => groupSet.add(g));
    });
    return Array.from(groupSet).sort();
  }, [students]);

  const allPeriods = useMemo(() => {
    const periodSet = new Set<string>();
    students.forEach(s => {
      if (s.status === "archived") return;
      if (selectedGroup !== "All" && !s.groups?.includes(selectedGroup)) return;
      s.schedule.forEach(p => periodSet.add(p));
    });
    return Array.from(periodSet);
  }, [students, selectedGroup]);

  // Ensure period stays valid when group changes
  React.useEffect(() => {
    if (selectedPeriod && !allPeriods.includes(selectedPeriod)) {
      setSelectedPeriod("");
    }
  }, [allPeriods, selectedPeriod]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (s.status === "archived") return false;
      if (selectedGroup !== "All" && !s.groups?.includes(selectedGroup)) return false;
      if (selectedPeriod && !s.schedule.includes(selectedPeriod)) return false;
      return true;
    });
  }, [students, selectedGroup, selectedPeriod]);

  // Normalized user email for bulk check
  const userEmail = useMemo(() => (user?.email || user?.providerData?.[0]?.email || "").toLowerCase(), [user]);

  const canLogCount = useMemo(() => {
    let count = 0;
    filteredStudents.forEach(s => {
      // Manual check simulation since we can't call hooks in a loop easily, 
      // but we should match usePermissions logic
      const isSystemAdmin = SYSTEM_ADMIN_EMAILS.includes(userEmail) || dynamicAdmins.includes(userEmail);
      const isCaseManager = s.userRoles?.[userEmail] === 'edit';
      const isContributor = s.userRoles?.[userEmail] === 'view' || (s.teacherEmails?.some(e => e.toLowerCase() === userEmail));
      
      const canLog = isSystemAdmin || isCaseManager || isContributor;
      if (canLog) count++;
    });
    return count;
  }, [filteredStudents, userEmail, dynamicAdmins]);

  // Default all to selected when filtered students change
  React.useEffect(() => {
    const loggableIds = filteredStudents
      .filter(s => {
        const isSystemAdmin = SYSTEM_ADMIN_EMAILS.includes(userEmail) || dynamicAdmins.includes(userEmail);
        const isCaseManager = s.userRoles?.[userEmail] === 'edit';
        const isContributor = s.userRoles?.[userEmail] === 'view' || (s.teacherEmails?.some(e => e.toLowerCase() === userEmail));
        return isSystemAdmin || isCaseManager || isContributor;
      })
      .map(s => s.id!);
    setSelectedStudentIds(new Set(loggableIds));
  }, [filteredStudents, userEmail, dynamicAdmins]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudentIds(newSet);
  };
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const loggableIds = filteredStudents
        .filter(s => {
          const isSystemAdmin = SYSTEM_ADMIN_EMAILS.includes(userEmail);
          const isCaseManager = s.userRoles?.[userEmail] === 'edit';
          const isContributor = s.userRoles?.[userEmail] === 'view' || (s.teacherEmails?.some(e => e.toLowerCase() === userEmail));
          return isSystemAdmin || isCaseManager || isContributor;
        })
        .map(s => s.id!);
      setSelectedStudentIds(new Set(loggableIds));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const { saveLogsBatch, loading: batchLoading } = useDailyLogsBulk();

  const handleBulkAction = async (val: number) => {
    if (selectedStudentIds.size === 0 || !selectedPeriod) return;
    
    // Construct updates for all selected students
    const updates = Array.from(selectedStudentIds).map(id => {
      const student = students.find(s => s.id === id);
      if (!student) return null;
      
      const newScores: Record<string, number> = {};
      student.behaviors.forEach(b => {
        newScores[b] = val;
      });

      return {
        studentId: id,
        period: selectedPeriod,
        scores: newScores
      };
    }).filter(Boolean);

    if (updates.length > 0) {
      // Use any to bypass TS for the filter(Boolean) strictness
      await saveLogsBatch(dateStr, updates as any);
      alert(`Successfully saved batch update for ${updates.length} students.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Roster Log</h2>
          <p className="text-slate-500 text-sm">Bulk tracking for small groups and specialists.</p>
        </div>
        
        <div className="flex items-center bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setCurrentDate(getPrevWeekday(currentDate))}
          >
            <ChevronLeft className="h-5 w-5 text-slate-500" />
          </Button>
          <div className="flex items-center space-x-2 font-medium text-slate-700 px-2 min-w-[140px] justify-center">
            <CalendarIcon className="h-4 w-4 text-slate-400" />
            <span>{isToday(currentDate) ? "Today, " : ""}{format(currentDate, "MMM d, yyyy")}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            disabled={isToday(currentDate) || getNextWeekday(currentDate) > new Date()}
            onClick={() => setCurrentDate(getNextWeekday(currentDate))}
          >
            <ChevronRight className="h-5 w-5 text-slate-500" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 space-y-2">
              <Label>Filter by Group</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 bg-white"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="All">All Active Students</option>
                {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Select Period</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 bg-white"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="">-- Choose a Period --</option>
                {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          
          {selectedPeriod && filteredStudents.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 mt-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <div>
                    <h3 className="font-bold text-sm max-w-sm">
                      {selectedStudentIds.size} of {canLogCount} active students selected
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-tight">Apply score to all goals for {selectedPeriod}.</p>
                  </div>
                  
                  <div className="flex bg-slate-200/50 p-1 rounded-lg gap-1.5 w-full md:w-auto">
                     <button
                       disabled={selectedStudentIds.size === 0 || batchLoading}
                       onClick={() => handleBulkAction(1)}
                       className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 h-8 rounded-md text-[10px] font-black uppercase bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 tracking-widest"
                     >
                       <Smile className="h-4 w-4" />
                       Yes
                     </button>
                     <button
                       disabled={selectedStudentIds.size === 0 || batchLoading}
                       onClick={() => handleBulkAction(0)}
                       className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 h-8 rounded-md text-[10px] font-black uppercase bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors disabled:opacity-50 tracking-widest"
                     >
                       <Frown className="h-4 w-4" />
                       No
                     </button>
                     <button
                       disabled={selectedStudentIds.size === 0 || batchLoading}
                       onClick={() => handleBulkAction(-1)}
                       className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 h-8 rounded-md text-[10px] font-black uppercase bg-slate-500 text-white shadow-sm hover:bg-slate-600 transition-colors disabled:opacity-50 tracking-widest"
                     >
                       <MinusCircle className="h-4 w-4" />
                       N/A
                     </button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="p-1 px-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                    <input 
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-600"
                      checked={selectedStudentIds.size === canLogCount && canLogCount > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      id="selectAll"
                    />
                    <Label htmlFor="selectAll" className="font-black text-[10px] uppercase tracking-widest cursor-pointer mb-0 text-slate-500">Student Roster ({filteredStudents.length})</Label>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {filteredStudents.map(student => (
                      <StudentRow 
                        key={student.id}
                        student={student}
                        isSelected={selectedStudentIds.has(student.id!)}
                        onToggle={toggleSelection}
                      />
                    ))}
                  </div>
                </div>
              </div>
          )}
          
          {!selectedPeriod && (
             <div className="py-12 text-center text-slate-500 border-2 border-dashed rounded-xl border-slate-200 mt-4 bg-slate-50">
               Please select a period to enable bulk action.
             </div>
          )}
          
        </CardContent>
      </Card>
    </div>
  );
}
