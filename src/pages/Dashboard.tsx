import React, { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useStudents, usePersonalGroups, useSystemAdmins } from "../hooks/useDatabase";
import { useAuth } from "../components/AuthProvider";
import { usePermissions } from "../hooks/usePermissions";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Plus, User, Trash2, Edit, CheckSquare, Square, Search, Edit3, Users, Shield, Eye } from "lucide-react";
import { Student } from "../types";
import { cn } from "../lib/utils";
import { SYSTEM_ADMINS } from "../lib/constants";
import { CollaboratorManager } from "../components/CollaboratorManager";

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
  onManageAccess,
  onDelete,
  onGroupClick
}: { 
  student: Student; 
  isSelected: boolean; 
  groupsMap: Record<string, string[]>;
  onToggle: (id: string, e: React.MouseEvent) => void;
  onEdit: (student: Student, e: React.MouseEvent) => void;
  onManageAccess: (student: Student, e: React.MouseEvent) => void;
  onDelete: (id: string) => Promise<void> | void;
  onGroupClick: (groupName: string) => void;
  key?: React.Key;
}) {
  const { user } = useAuth();
  const { isSystemAdmin, canManageAccess, canEditSettings, roleLabel } = usePermissions(student);
  
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
      
      <div className="flex-1 min-w-0 pr-32 relative z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-bold text-slate-900 truncate uppercase mt-0.5">{student.name}</h3>
          {roleLabel && roleLabel !== "Staff" && (
            <span className={cn(
              "px-1 py-0.5 text-[8px] font-black uppercase rounded tracking-tighter leading-none border",
              roleLabel === "Admin" ? "bg-slate-900 text-white border-slate-900" : "bg-orange-100 text-orange-700 border-orange-200"
            )}>
              {roleLabel}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {(student.gradeLevel || student.homeroomTeacher) && (
            <div className="flex flex-wrap items-center gap-1 mt-0.5 mb-1.5 pointer-events-auto">
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
            <div className="flex flex-wrap gap-1.5 mt-1.5 pointer-events-auto">
              {groupsMap[student.id!].map(g => (
                <button 
                  key={g} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onGroupClick(g);
                  }}
                  className="bg-slate-100 text-slate-600 text-[9px] px-2 py-0.5 rounded font-bold border border-slate-200/50 uppercase hover:bg-orange-100 hover:text-orange-700 hover:border-orange-200 transition-colors"
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-20">
        {canManageAccess && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            title="Collaborate"
            onClick={(e) => onManageAccess(student, e)}
          >
            <Users className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          title={canEditSettings ? "Edit Student" : "View Student"}
          onClick={(e) => onEdit(student, e)}
        >
          {canEditSettings ? <Edit className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5 opacity-50" />}
        </Button>
        {isSystemAdmin && (
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
  const { admins: dynamicAdmins } = useSystemAdmins();
  
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
  
  // Access Management
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessStudent, setAccessStudent] = useState<Student | null>(null);

  // Selection & Batch Edit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchGroups, setBatchGroups] = useState("");
  const [batchEmails, setBatchEmails] = useState("");
  const [batchRole, setBatchRole] = useState<'edit' | 'view'>('view');
  const [batchStatus, setBatchStatus] = useState<"no_change" | "active" | "archived">("no_change");
  
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "grade" | "homeroom">("name");
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterHomeroom, setFilterHomeroom] = useState("All");

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
    // CSV Import removed per user request
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

  const openManageAccess = (student: Student, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAccessStudent(student);
    setIsAccessModalOpen(true);
  };

  const globalPerms = usePermissions(null);
  const currentPerms = usePermissions(editingStudent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;

    const parsedGroups = groups.split(",").map(g => g.trim()).filter(Boolean);

    try {
      if (editingStudent && editingStudent.id) {
        const updates: Partial<Student> = {};
        
        if (currentPerms.canEditCore) {
          updates.name = newName.trim();
          updates.gradeLevel = gradeLevel.trim();
          updates.homeroomTeacher = homeroomTeacher.trim();
          updates.status = status;
        }
        
        if (currentPerms.canEditSettings) {
          updates.behaviors = behaviors.split("\n").map(b => b.trim()).filter(Boolean);
          updates.schedule = schedule.split("\n").map(s => s.trim()).filter(Boolean);
        }

        if (Object.keys(updates).length > 0) {
          await updateStudent(editingStudent.id, updates);
        }
        await updateStudentGroups(editingStudent.id, parsedGroups);
      } else if (globalPerms.canCreateStudent) {
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

      const perms = {
        isSystemAdmin: SYSTEM_ADMINS.includes(userEmail) || dynamicAdmins.includes(userEmail),
        isCaseManager: student.userRoles?.[userEmail] === 'edit' || student.ownerId === user?.uid,
        isContributor: student.userRoles?.[userEmail] === 'view' || student.teacherEmails?.some(e => e.toLowerCase() === userEmail)
      };

      const canEditGroups = perms.isSystemAdmin || perms.isCaseManager || perms.isContributor;
      const canEditProfile = perms.isSystemAdmin; // Only admins can batch edit staff/status now per request

      if (!canEditGroups && !perms.isSystemAdmin) {
        skippedCount++;
        continue;
      }

      const updates: Partial<Student> = {};
      
      // Only admins can batch add teachers or change status
      if (perms.isSystemAdmin) {
        if (newEmails.length > 0) {
          const existing = student.teacherEmails || [];
          updates.teacherEmails = Array.from(new Set([...existing, ...newEmails]));
          
          // Apply roles to userRoles as well
          const currentRoles = { ...(student.userRoles || {}) };
          newEmails.forEach(email => {
            currentRoles[email] = batchRole;
          });
          updates.userRoles = currentRoles;
        }
        if (batchStatus !== "no_change") {
          updates.status = batchStatus;
        }
        
        if (Object.keys(updates).length > 0) {
          await updateStudent(id, updates);
        }
      }

      // Everyone with access can batch add groups
      if (newGroups.length > 0 && canEditGroups) {
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
    setBatchRole("view");
    setBatchStatus("no_change");
  };

  const allGroups = useMemo(() => {
    return personalGroups.map(g => g.name).sort();
  }, [personalGroups]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach(s => { if (s.gradeLevel) grades.add(s.gradeLevel); });
    return Array.from(grades).sort();
  }, [students]);

  const uniqueHomerooms = useMemo(() => {
    const hrs = new Set<string>();
    students.forEach(s => { if (s.homeroomTeacher) hrs.add(s.homeroomTeacher); });
    return Array.from(hrs).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    let result = students.filter(s => {
      const sStatus = s.status || "active";
      if (sStatus === "archived") return false;
      
      // Group filter
      if (selectedGroup !== "All") {
        const pGroups = studentGroupsMap[s.id!] || [];
        if (!pGroups.includes(selectedGroup)) return false;
      }

      // Grade filter
      if (filterGrade !== "All" && s.gradeLevel !== filterGrade) return false;

      // Homeroom filter
      if (filterHomeroom !== "All" && s.homeroomTeacher !== filterHomeroom) return false;

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          s.name.toLowerCase().includes(term) ||
          (s.gradeLevel || "").toLowerCase().includes(term) ||
          (s.homeroomTeacher || "").toLowerCase().includes(term)
        );
      }
      
      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === "grade") {
        const ga = a.gradeLevel || "";
        const gb = b.gradeLevel || "";
        if (ga !== gb) return ga.localeCompare(gb);
      } else if (sortBy === "homeroom") {
        const ha = a.homeroomTeacher || "";
        const hb = b.homeroomTeacher || "";
        if (ha !== hb) return ha.localeCompare(hb);
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [students, selectedGroup, studentGroupsMap, searchTerm, sortBy, filterGrade, filterHomeroom]);

  return (
    <div className="space-y-4">

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
                <DialogDescription>
                    These changes will be ADDED to {selectedIds.size} selected student{selectedIds.size > 1 ? 's' : ''}. Unchanged fields will remain as they are.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBatchSubmit} className="space-y-4 pt-4">
                  {globalPerms.isSystemAdmin && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-orange-600" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Add Collaborators</h4>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="batchEmails" className="text-[10px] uppercase font-bold text-slate-500 ml-1">Email Addresses (comma-separated)</Label>
                          <Input
                            id="batchEmails"
                            value={batchEmails}
                            onChange={e => setBatchEmails(e.target.value)}
                            placeholder="msmith@school.edu, jdoe@school.edu"
                            className="h-10 text-sm bg-white"
                          />
                        </div>
                        
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Assigned Role</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={batchRole === 'view' ? 'default' : 'outline'}
                              size="sm"
                              className={cn(
                                "flex-1 h-10 text-[10px] font-black uppercase tracking-widest",
                                batchRole === 'view' ? "bg-slate-900" : "bg-white"
                              )}
                              onClick={() => setBatchRole('view')}
                            >
                              Contributor
                            </Button>
                            <Button
                              type="button"
                              variant={batchRole === 'edit' ? 'default' : 'outline'}
                              size="sm"
                              className={cn(
                                "flex-1 h-10 text-[10px] font-black uppercase tracking-widest",
                                batchRole === 'edit' ? "bg-orange-600 hover:bg-orange-700" : "bg-white"
                              )}
                              onClick={() => setBatchRole('edit')}
                            >
                              Case Manager
                            </Button>
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium px-1 text-center italic">
                          {batchRole === 'view' 
                            ? 'Contributors can record daily logs and behavioral notes.' 
                            : 'Case Managers can modify student settings and record logs.'}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="batchGroups">Add to Groups (comma-separated)</Label>
                    <Input
                      id="batchGroups"
                      value={batchGroups}
                      onChange={e => setBatchGroups(e.target.value)}
                      placeholder="e.g. Read180, Art Club"
                    />
                  </div>
                  {globalPerms.isSystemAdmin && (
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
                  )}
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

      {/* Filters & Sorting */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by name, grade, or teacher..." 
              className="pl-9 bg-slate-50/50 border-slate-200 focus:bg-white transition-colors h-10 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-10 px-3 rounded-md border border-slate-200 text-xs font-bold uppercase tracking-wider bg-slate-50/50 focus:bg-white outline-none cursor-pointer"
              title="Sort By"
            >
              <option value="name">Sort: Name</option>
              <option value="grade">Sort: Grade</option>
              <option value="homeroom">Sort: Homeroom</option>
            </select>
            
            <select
              value={filterGrade}
              onChange={e => setFilterGrade(e.target.value)}
              className="h-10 px-3 rounded-md border border-slate-200 text-xs font-bold uppercase tracking-wider bg-slate-50/50 focus:bg-white outline-none cursor-pointer"
              title="Filter by Grade"
            >
              <option value="All">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <select
              value={filterHomeroom}
              onChange={e => setFilterHomeroom(e.target.value)}
              className="h-10 px-3 rounded-md border border-slate-200 text-xs font-bold uppercase tracking-wider bg-slate-50/50 focus:bg-white outline-none cursor-pointer"
              title="Filter by Homeroom"
            >
              <option value="All">All Homerooms</option>
              {uniqueHomerooms.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-50">
          <div className="flex flex-wrap items-center gap-1.5">
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
                className="h-8 px-2 text-slate-600 hover:bg-slate-100/50 group"
              >
                {selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                  <CheckSquare className="h-4 w-4 mr-2 text-orange-600" />
                ) : (
                  <Square className="h-4 w-4 mr-2 text-slate-300 group-hover:text-orange-400" />
                )}
                <span className="text-[10px] font-black uppercase tracking-wider">Select All</span>
              </Button>
            </div>
            
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Groups:</span>
              <Button 
                variant={selectedGroup === "All" ? "default" : "secondary"} 
                size="sm" 
                onClick={() => setSelectedGroup("All")}
                className={cn(
                  "rounded-full h-7 text-[10px] px-3 font-bold transition-all",
                  selectedGroup === "All" ? "bg-orange-600 hover:bg-orange-700 shadow-sm" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                All
              </Button>
              {allGroups.map(g => (
                <Button 
                  key={g} 
                  variant={selectedGroup === g ? "default" : "secondary"} 
                  size="sm" 
                  onClick={() => setSelectedGroup(g)}
                  className={cn(
                    "rounded-full h-7 text-[10px] px-3 font-bold transition-all",
                    selectedGroup === g ? "bg-orange-600 hover:bg-orange-700 shadow-sm" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>
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
              Wait for an administrator to add students.
            </p>
          </CardContent>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <div className="py-8 text-center text-slate-500 border-2 border-dashed rounded-xl border-slate-200 text-sm">
          {`None in "${selectedGroup }".`}
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
              onManageAccess={openManageAccess}
              onDelete={deleteStudent}
              onGroupClick={setSelectedGroup}
            />
          ))}
        </div>
      )}

      {/* Persistence / Off-canvas Dialogs */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {currentPerms.canEditCore && (
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
            )}
            
            {!currentPerms.canEditCore && editingStudent && (
              <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-lg mb-4">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Student Profile</p>
                <p className="text-sm font-bold text-zinc-900">{editingStudent.name}</p>
                <p className="text-xs text-zinc-500">{editingStudent.gradeLevel} • {editingStudent.homeroomTeacher}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="groups">Groups (comma-separated)</Label>
              <Input
                id="groups"
                value={groups}
                onChange={e => setGroups(e.target.value)}
                placeholder="e.g. 1st Grade, Monday Music"
              />
            </div>

            {currentPerms.canEditSettings && (
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
              <Button type="submit" disabled={!currentPerms.canLogData || (!newName.trim() && !editingStudent)}>
                {editingStudent ? "Save Changes" : "Add Student"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-600" />
              Collaborate: {accessStudent?.name}
            </DialogTitle>
            <DialogDescription>
              Manage who can view and log behavior data for this student.
            </DialogDescription>
          </DialogHeader>

          {accessStudent && (
            <CollaboratorManager 
              student={accessStudent}
              onUpdate={async (updates) => {
                if (accessStudent.id) {
                  await updateStudent(accessStudent.id, updates);
                }
              }}
              onClose={() => setIsAccessModalOpen(false)}
            />
          )}

          <DialogFooter className="pt-4">
            <Button variant="outline" className="w-full h-10 font-black uppercase tracking-widest text-[10px]" onClick={() => setIsAccessModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
