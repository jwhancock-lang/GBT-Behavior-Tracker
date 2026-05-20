import React, { useState } from "react";
import { User, Users, Trash2, Shield, Eye, Plus } from "lucide-react";
import { Student } from "../types";
import { useAuth } from "./AuthProvider";
import { usePermissions } from "../hooks/usePermissions";
import { useSystemAdmins } from "../hooks/useDatabase";
import { SYSTEM_ADMINS } from "../lib/constants";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { cn } from "../lib/utils";

interface CollaboratorManagerProps {
  student: Student;
  onUpdate: (updates: Partial<Student>) => Promise<void>;
  onClose?: () => void;
}

export function CollaboratorManager({ student, onUpdate, onClose }: CollaboratorManagerProps) {
  const { user } = useAuth();
  const userEmail = (user?.email || user?.providerData?.[0]?.email || "").toLowerCase();
  const { admins: dynamicAdmins } = useSystemAdmins();
  const perms = usePermissions(student);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<'edit' | 'view'>('view');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const staffEmails = student.teacherEmails || [];
  const userRoles = student.userRoles || {};

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !perms.canManageAccess) return;

    setIsSubmitting(true);
    try {
      const updatedEmails = Array.from(new Set([...staffEmails, email]));
      const updatedRoles = { ...userRoles, [email]: newRole };
      
      await onUpdate({
        teacherEmails: updatedEmails,
        userRoles: updatedRoles
      });
      setNewEmail("");
      setNewRole("view");
    } catch (err) {
      console.error("Failed to add collaborator:", err);
      alert("Failed to add collaborator.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (emailToRemove: string) => {
    if (!perms.canManageAccess) return;
    
    // Safety check - can't remove self
    if (emailToRemove === userEmail) {
      alert("You cannot remove your own access.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedEmails = staffEmails.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
      const updatedRoles = { ...userRoles };
      const actualKey = Object.keys(updatedRoles).find(k => k.toLowerCase() === emailToRemove.toLowerCase()) || emailToRemove;
      delete updatedRoles[actualKey];

      await onUpdate({
        teacherEmails: updatedEmails,
        userRoles: updatedRoles
      });
    } catch (err) {
      console.error("Failed to remove collaborator:", err);
      alert("Failed to remove collaborator.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allEmails = Array.from(new Set([
    ...staffEmails,
    ...Object.keys(userRoles),
    ...SYSTEM_ADMINS,
    ...dynamicAdmins
  ].map(e => e.toLowerCase().trim()))).filter(e => e && e.length > 0);

  return (
    <div className="space-y-6 pt-2">
      {perms.canManageAccess && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="h-4 w-4 text-orange-600" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Add New Collaborator</h4>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="collab-email" className="text-[10px] uppercase font-bold text-slate-500 ml-1">Email Address</Label>
              <Input 
                id="collab-email"
                placeholder="teacher@school.edu"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="h-10 text-sm bg-white"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Assigned Role</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newRole === 'view' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "flex-1 h-10 text-[10px] font-black uppercase tracking-widest",
                    newRole === 'view' ? "bg-slate-900" : "bg-white"
                  )}
                  onClick={() => setNewRole('view')}
                >
                  Contributor
                </Button>
                <Button
                  type="button"
                  variant={newRole === 'edit' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "flex-1 h-10 text-[10px] font-black uppercase tracking-widest",
                    newRole === 'edit' ? "bg-orange-600 hover:bg-orange-700" : "bg-white"
                  )}
                  onClick={() => setNewRole('edit')}
                >
                  Case Manager
                </Button>
              </div>
            </div>

            <Button 
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs"
              disabled={!newEmail.trim() || isSubmitting}
              onClick={handleAdd}
            >
              Add collaborator
            </Button>
            
            <p className="text-[10px] text-slate-500 font-medium px-1 text-center italic">
              {newRole === 'view' 
                ? 'Contributors can record daily logs and behavioral notes.' 
                : 'Case Managers can modify student settings and record logs.'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Current Access ({allEmails.length})</h4>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {allEmails.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No collaborators added</p>
            </div>
          ) : (
            allEmails.map(email => {
              const isAdmin = SYSTEM_ADMINS.some(e => e.toLowerCase() === email) || dynamicAdmins.some(e => e.toLowerCase() === email);
              const isSelf = email === userEmail;
              const role = userRoles[email] || userRoles[Object.keys(userRoles).find(k => k.toLowerCase() === email) || ""];
              
              return (
                <div key={email} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:border-slate-200 transition-colors">
                  <div className="min-w-0 pr-2">
                    <p className={cn("text-xs font-black truncate uppercase leading-none mb-1", isSelf ? "text-orange-700" : "text-slate-900")}>
                      {email} {isSelf && "(You)"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {isAdmin ? (
                        <span className="flex items-center text-[9px] font-black text-slate-500 uppercase tracking-tighter bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          <Shield className="h-2.5 w-2.5 mr-1" /> System Admin
                        </span>
                      ) : role === 'edit' ? (
                        <span className="flex items-center text-[9px] font-black text-orange-600 uppercase tracking-tighter bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                          <Shield className="h-2.5 w-2.5 mr-1" /> Case Manager
                        </span>
                      ) : (
                        <span className="flex items-center text-[9px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          <Eye className="h-2.5 w-2.5 mr-1" /> Contributor
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {!isSelf && !isAdmin && perms.canManageAccess && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => handleRemove(email)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(isSelf || isAdmin) && (
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] px-2">
                        {isAdmin ? "Protected" : "Owner"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
