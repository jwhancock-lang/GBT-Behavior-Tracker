import React, { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import { useStudents, usePersonalGroups } from "../hooks/useDatabase";
import { useAuth } from "../components/AuthProvider";
import { usePermissions } from "../hooks/usePermissions";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Plus, User, Trash2, Edit, CheckSquare, Square, Archive, Search, Edit3 } from "lucide-react";
import { Student } from "../types";
import { cn } from "../lib/utils";

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

function StudentCard({ 
  student, 
  isSelected, 
  groupsMap, 
  onToggle, 
  onEdit, 
  onDelete 
}: { 
  student: Student; 
  isSelected: boolean; 
  groupsMap: Record<string, string[]>;
  onToggle: (id: string, e: React.MouseEvent) => void;
  onEdit: (student: Student, e: React.MouseEvent) => void;
  onDelete: (id: string) => Promise<void> | void;
  key?: React.Key;
}) {
  const { user } = useAuth();
  const { isOwner, canEditProfile } = usePermissions(student);
  
  return (
    <div
      className={cn(
        "group relative bg-white border rounded-xl p-3 transition-all flex items-center gap-4 hover:shadow-sm",
        isSelected 
          ? "border-orange-500 bg-orange-50/20 ring-1 ring-orange-100" 
          : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div 
        className="shrink-0 cursor-pointer text-slate-300 hover:text-orange-600 transition-colors z-10"
        onClick={(e) => student.id && onToggle(student.id, e)}
      >
        {isSelected ? (
          <CheckSquare className="h-5 w-5 text-orange-600" />
        ) : (
          <Square className="h-5 w-5 opacity-40 group-hover:opacity-100" />
        )}
      </div>

      <Link to={`/student/${student.id}`} className="absolute inset-0 z-0" />
      
      <div className="flex-1 min-w-0 pr-16 relative z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-bold text-slate-900 truncate uppercase mt-0.5">{student.name}</h3>
        </div>
        <div className="flex flex-col gap-0.5">
          {(student.gradeLevel || student.homeroomTeacher) && (
            <div className="flex flex-wrap items-center gap-1 mt-0.5 mb-1.5">
              {student.gradeLevel && (
                <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 text-[9px] font-black uppercase rounded border border-orange-100">
                  G: {student.gradeLevel}
                </span>
              )}
              {student.homeroomTeacher && (
                <span className="px-1.5 py-0.5 bg-slate-50 text-slate-600 text-[9px] font-black uppercase rounded border border-slate-200">
                  HR: {student.homeroomTeacher}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center text-[10px] text-slate-400 uppercase tracking-wide font-black">
            <span className="truncate">{student.behaviors.length} Behaviors</span>
          </div>
          {groupsMap[student.id!] && groupsMap[student.id!].length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {groupsMap[student.id!].map(g => (
                <span key={g} className="bg-slate-100 text-slate-600 text-[9px] px-2 py-0.5 rounded font-bold border border-slate-200/50 uppercase">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-20">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          title={canEditProfile ? "Edit Student" : "View Student"}
          onClick={(e) => onEdit(student, e)}
        >
          {canEditProfile ? <Edit className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5 opacity-50" />}
        </Button>
        {isOwner && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete Student"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (window.confirm(`Delete ${student.name}?`)) {
                onDelete(student.id!);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const userEmail = useMemo(() => (user?.email || user?.providerData?.[0]?.email || "").toLowerCase(), [user]);
  const { students, loading, addStudent, updateStudent, deleteStudent } = useStudents();
  const { groups: personalGroups, loading: groupsLoading, updateStudentGroups } = usePersonalGroups();
  
  // Single student form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newName, setNewName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [homeroomTeacher, setHomeroomTeacher] = useState("");
  const [behaviors, setBehaviors] = useState(DEFAULT_BEHAVIORS.join("\n"));
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE.join("\n"));
  const [groups, setGroups] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");

  // Selection & Batch Edit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchGroups, setBatchGroups] = useState("");
  const [batchEmails, setBatchEmails] = useState("");
  const [batchStatus, setBatchStatus] = useState<"no_change" | "active" | "archived">("no_change");
  
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{name: string, gradeLevel: string, homeroomTeacher: string, groups: string[], schedule: string[], behaviors: string[]}[] | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const studentsToAdd = data.map(row => {
           let name = "";
           let gradeLevel = "";
           let homeroomTeacher = "";
           let groups: string[] = [];
           let schedule: string[] = [];
           let behaviors: string[] = [];
           
           Object.entries(row).forEach(([colName, value]) => {
              const lowerCol = colName.toLowerCase().trim();
              const val = value.trim();
              if (!val) return;
              
              if (lowerCol === "name" || lowerCol === "student" || lowerCol === "student name" || lowerCol === "studentname" || lowerCol === "first name") {
                 name = name ? `${name} ${val}` : val; // e.g. append Last Name if split
              } else if (lowerCol === "last name") {
                 name = name ? `${name} ${val}` : val;
              } else if (lowerCol === "grade" || lowerCol === "grade level" || lowerCol === "gradelevel") {
                 gradeLevel = val;
              } else if (lowerCol === "homeroom" || lowerCol === "homeroom teacher" || lowerCol === "homeroomteacher" || lowerCol === "teacher") {
                 homeroomTeacher = val;
              } else if (lowerCol.includes("group") || lowerCol.includes("class")) {
                 val.split(/[,\n]/).forEach(v => {
                    if (v.trim()) groups.push(v.trim());
                 });
              } else if (lowerCol.includes("schedule") || lowerCol.includes("period")) {
                 val.split(/[,\n]/).forEach(v => {
                    if (v.trim()) schedule.push(v.trim());
                 });
              } else if (lowerCol.includes("behavior") || lowerCol.includes("target")) {
                 val.split(/[,\n]/).forEach(v => {
                    if (v.trim()) behaviors.push(v.trim());
                 });
              }
           });
           
           if (schedule.length === 0) schedule = DEFAULT_SCHEDULE;
           if (behaviors.length === 0) behaviors = DEFAULT_BEHAVIORS;
           
           return { name, gradeLevel, homeroomTeacher, groups, schedule, behaviors };
        }).filter(s => s.name);
        
        setImportPreview(studentsToAdd);
        setIsImportOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const studentGroupsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    personalGroups.forEach(g => {
      g.studentIds.forEach(sid => {
        if (!map[sid]) map[sid] = [];
        map[sid].push(g.name);
      });
    });
    return map;
  }, [personalGroups]);

  const handleImportSubmit = async () => {
    if (!importPreview || !user) return;
    
    for (const studentProps of importPreview) {
       const id = await addStudent({
         ...studentProps,
         groups: [], // We don't use shared groups anymore
         teacherEmails: [user.email || ""],
         status: "active"
       });
       if (id && studentProps.groups.length > 0) {
         await updateStudentGroups(id, studentProps.groups);
       }
    }
    
    setImportPreview(null);
    setIsImportOpen(false);
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openAddForm = () => {
    setEditingStudent(null);
    setNewName("");
    setGradeLevel("");
    setHomeroomTeacher("");
    setBehaviors(DEFAULT_BEHAVIORS.join("\n"));
    setSchedule(DEFAULT_SCHEDULE.join("\n"));
    setGroups("");
    setStatus("active");
    setIsFormOpen(true);
  };

  const openEditForm = (student: Student, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingStudent(student);
    setNewName(student.name);
    setGradeLevel(student.gradeLevel || "");
    setHomeroomTeacher(student.homeroomTeacher || "");
    setBehaviors(student.behaviors.join("\n"));
    setSchedule(student.schedule.join("\n"));
    const pGroups = studentGroupsMap[student.id!] || [];
    setGroups(pGroups.join(", "));
    setStatus(student.status || "active");
    setIsFormOpen(true);
  };

  const currentPerms = usePermissions(editingStudent);
  const canEditFull = editingStudent ? currentPerms.canEditProfile : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;

    const parsedGroups = groups.split(",").map(g => g.trim()).filter(Boolean);

    try {
      if (editingStudent && editingStudent.id) {
        if (canEditFull) {
          await updateStudent(editingStudent.id, {
            name: newName.trim(),
            gradeLevel: gradeLevel.trim(),
            homeroomTeacher: homeroomTeacher.trim(),
            behaviors: behaviors.split("\n").map(b => b.trim()).filter(Boolean),
            schedule: schedule.split("\n").map(s => s.trim()).filter(Boolean),
            status
          });
        }
        await updateStudentGroups(editingStudent.id, parsedGroups);
      } else {
        const id = await addStudent({
          name: newName.trim(),
          gradeLevel: gradeLevel.trim(),
          homeroomTeacher: homeroomTeacher.trim(),
          behaviors: behaviors.split("\n").map(b => b.trim()).filter(Boolean),
          schedule: schedule.split("\n").map(s => s.trim()).filter(Boolean),
          teacherEmails: [user.email || user.providerData[0]?.email || ""],
          status: "active"
        });
        if (id) {
          await updateStudentGroups(id, parsedGroups);
        }
      }
      setEditingStudent(null);
      setNewName("");
      setGradeLevel("");
      setHomeroomTeacher("");
      setIsFormOpen(false);
    } catch (err) {
      console.error("Form submission failed:", err);
      alert("Failed to save student. Please check your connection and permissions.");
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newGroups = batchGroups.split(",").map(g => g.trim()).filter(Boolean);
    const newEmails = batchEmails.split(",").map(em => em.trim().toLowerCase()).filter(Boolean);

    const ids = Array.from(selectedIds);
    let updatedCount = 0;
    let skippedCount = 0;

    for (const id of ids) {
      if (typeof id !== 'string') continue;
      const student = students.find(s => s.id === id);
      if (!student) continue;

      // Check if user has permission to edit THIS specific student
      const isAdminOverride = student.name?.toUpperCase() === "ZANE" && userEmail === "jwhancock@asheboro.k12.nc.us";
      const isOwner = student.ownerId === user?.uid || isAdminOverride;
      const hasRole = student.userRoles?.[userEmail];
      const canEditProfile = isOwner || hasRole === 'edit';

      if (!canEditProfile) {
        skippedCount++;
        continue;
      }

      const updates: Partial<Student> = {};
      if (newEmails.length > 0) {
        const existing = student.teacherEmails || [];
        updates.teacherEmails = Array.from(new Set([...existing, ...newEmails]));
      }
      if (batchStatus !== "no_change") {
        updates.status = batchStatus;
      }
      
      if (Object.keys(updates).length > 0) {
        await updateStudent(id, updates);
      }

      if (newGroups.length > 0) {
        const existing = studentGroupsMap[id] || [];
        const merged = Array.from(new Set([...existing, ...newGroups]));
        await updateStudentGroups(id, merged);
      }
      updatedCount++;
    }

    if (skippedCount > 0) {
      alert(`Updated ${updatedCount} students. ${skippedCount} students were skipped due to insufficient permissions.`);
    }

    setIsBatchOpen(false);
    setSelectedIds(new Set());
    setBatchGroups("");
    setBatchEmails("");
    setBatchStatus("no_change");
  };

  const allGroups = useMemo(() => {
    return personalGroups.map(g => g.name).sort();
  }, [personalGroups]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const sStatus = s.status || "active";
      if (showArchived && sStatus !== "archived") return false;
      if (!showArchived && sStatus === "archived") return false;
      if (selectedGroup !== "All") {
        const pGroups = studentGroupsMap[s.id!] || [];
        if (!pGroups.includes(selectedGroup)) return false;
      }
      return true;
    });
  }, [students, selectedGroup, showArchived, studentGroupsMap]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase">GBT Behavior Tracker</h2>
          <p className="text-slate-500 text-xs uppercase tracking-widest font-black opacity-60">Manage & Track Student Groups</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setShowArchived(!showArchived);
              setSelectedGroup("All");
              setSelectedIds(new Set());
            }}
            className="h-9 px-4 text-xs font-semibold"
          >
            <Archive className="h-4 w-4 mr-2 text-slate-400" />
            {showArchived ? "Showing Archived" : "Archive"}
          </Button>
          
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 px-4 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white" onClick={openAddForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                {canEditFull ? (
                  <>
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
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="e.g. Alex M."
                        autoFocus
                      />
                    </div>
                    {editingStudent && (
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                          id="status"
                          value={status}
                          onChange={e => setStatus(e.target.value as "active" | "archived")}
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="active">Active</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mb-4">
                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">View Only Access</p>
                    <p className="text-xs text-blue-600 font-medium">You are collaborating on this record. Only personal groups can be modified.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="groups">Groups / Categories (comma-separated)</Label>
                  <Input
                    id="groups"
                    value={groups}
                    onChange={e => setGroups(e.target.value)}
                    placeholder="e.g. 1st Grade, Monday Music"
                  />
                </div>
                {canEditFull && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="behaviors">Target Behaviors (one per line)</Label>
                      <textarea
                        id="behaviors"
                        className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                        value={behaviors}
                        onChange={e => setBehaviors(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule">Schedule / Periods (one per line)</Label>
                      <textarea
                        id="schedule"
                        className="flex min-h-[120px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                        value={schedule}
                        onChange={e => setSchedule(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={!canEditFull || !newName.trim()}>
                    {editingStudent ? "Save Changes" : "Add Student"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Import Preview Dialog */}
          <Dialog open={isImportOpen} onOpenChange={(open) => {
            if (!open) {
               setIsImportOpen(false);
               setImportPreview(null);
            }
          }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import Students</DialogTitle>
                <CardDescription>
                  {importPreview?.length || 0} students found in CSV. Please verify before importing.
                </CardDescription>
              </DialogHeader>
              
              {importPreview && importPreview.length > 0 ? (
                <div className="space-y-4 pt-4">
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                          <th className="px-4 py-3 font-semibold text-slate-700">Groups</th>
                          <th className="px-4 py-3 font-semibold text-slate-700">Schedule (count)</th>
                          <th className="px-4 py-3 font-semibold text-slate-700">Behaviors (count)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {importPreview.map((s, idx) => (
                           <tr key={idx} className="hover:bg-slate-50">
                             <td className="px-4 py-2 font-medium">{s.name}</td>
                             <td className="px-4 py-2 text-slate-600">{s.groups.join(", ") || "-"}</td>
                             <td className="px-4 py-2 text-slate-600 truncate max-w-[150px]" title={s.schedule.join(", ")}>
                               {s.schedule.length} periods
                             </td>
                             <td className="px-4 py-2 text-slate-600 truncate max-w-[150px]" title={s.behaviors.join(", ")}>
                               {s.behaviors.length} behaviors
                             </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-md text-sm text-blue-800">
                    <strong>Note:</strong> We mapped columns matching "name", "group", "schedule", "period", "behavior", or "target". 
                    If details are missing, please update the headers in your CSV and try again.
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                   No valid student names found in CSV.
                </div>
              )}
              
              <DialogFooter className="pt-4">
                 <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
                 <Button onClick={handleImportSubmit} disabled={!importPreview || importPreview.length === 0}>
                   Import {importPreview?.length || 0} Students
                 </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between shadow-sm">
          <div className="text-sm font-medium text-orange-900 mb-3 sm:mb-0">
            {selectedIds.size} student{selectedIds.size > 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Button variant="ghost" size="sm" onClick={clearSelection} className="w-full sm:w-auto">
              Cancel
            </Button>
            
            <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto text-white py-4 px-6 font-semibold shadow-md">
                  <Edit3 className="h-4 w-4 mr-2" />
                  Bulk Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Batch Edit Students</DialogTitle>
                  <CardDescription>
                    These changes will be ADDED to {selectedIds.size} selected student{selectedIds.size > 1 ? 's' : ''}. Unchanged fields will remain as they are.
                  </CardDescription>
                </DialogHeader>
                <form onSubmit={handleBatchSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="batchEmails">Add Teachers (comma-separated emails)</Label>
                    <Input
                      id="batchEmails"
                      value={batchEmails}
                      onChange={e => setBatchEmails(e.target.value)}
                      placeholder="e.g. msmith@school.edu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batchGroups">Add to Groups (comma-separated)</Label>
                    <Input
                      id="batchGroups"
                      value={batchGroups}
                      onChange={e => setBatchGroups(e.target.value)}
                      placeholder="e.g. Read180, Art Club"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batchStatus">Change Status</Label>
                    <select
                      id="batchStatus"
                      value={batchStatus}
                      onChange={e => setBatchStatus(e.target.value as "no_change" | "active" | "archived")}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    >
                      <option value="no_change">No Change</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="pt-4 flex justify-end">
                    <Button type="submit">
                      Apply Changes
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

          <div className="flex flex-wrap items-center gap-1.5 py-1">
            <div className="flex items-center mr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filteredStudents.map(s => s.id!)));
                  }
                }}
                className="h-8 px-2 text-slate-600 hover:bg-slate-100/50"
              >
                {selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                  <CheckSquare className="h-5 w-5 mr-2 text-orange-600" />
                ) : (
                  <Square className="h-5 w-5 mr-2 text-slate-300" />
                )}
                <span className="text-xs font-bold">Select All</span>
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-1">
              <Button 
                variant={selectedGroup === "All" ? "default" : "secondary"} 
                size="sm" 
                onClick={() => setSelectedGroup("All")}
                className={cn(
                  "rounded-full h-8 text-[11px] px-4 font-bold transition-all",
                  selectedGroup === "All" ? "bg-orange-600 hover:bg-orange-700 shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                All Students
              </Button>
              {allGroups.map(g => (
                <Button 
                  key={g} 
                  variant={selectedGroup === g ? "default" : "secondary"} 
                  size="sm" 
                  onClick={() => setSelectedGroup(g)}
                  className={cn(
                    "rounded-full h-8 text-[11px] px-4 font-bold transition-all",
                    selectedGroup === g ? "bg-orange-600 hover:bg-orange-700 shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500 text-sm">Loading students...</div>
      ) : students.length === 0 ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <User className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="font-medium text-base text-slate-900 mb-1">No students yet</h3>
            <p className="text-slate-500 text-xs mb-3 max-w-sm">
              Add your first student to start tracking.
            </p>
            <Button size="sm" onClick={() => setIsFormOpen(true)} variant="outline">
              Add Student
            </Button>
          </CardContent>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <div className="py-8 text-center text-slate-500 border-2 border-dashed rounded-xl border-slate-200 text-sm">
          {showArchived ? "No archived students." : `None in "${selectedGroup}".`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-8">
          {filteredStudents.map((student) => (
            <StudentCard 
              key={student.id}
              student={student}
              isSelected={student.id ? selectedIds.has(student.id) : false}
              groupsMap={studentGroupsMap}
              onToggle={toggleSelection}
              onEdit={openEditForm}
              onDelete={deleteStudent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
