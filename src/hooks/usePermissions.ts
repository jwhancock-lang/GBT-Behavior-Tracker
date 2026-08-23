import { useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Student } from '../types';
import { SYSTEM_ADMINS } from '../lib/constants';
import { useSystemAdmins } from './useDatabase';

export function usePermissions(student: Student | null) {
  const { user, impersonatedRole } = useAuth();
  const { admins: dynamicAdmins, loading: adminsLoading } = useSystemAdmins();

  return useMemo(() => {
    if (!user) {
      return {
        isSystemAdmin: false,
        roleLabel: "Guest",
        fullRoleTitle: "No Access",
        canCreateStudent: false,
        canEditCore: false,
        canEditSettings: false,
        canLogData: false,
        canManageAccess: false,
        loading: false,
      };
    }
    
    // Normalized user email
    const email = (user.email || user.providerData?.[0]?.email || "").toLowerCase();

    // 1. System Administrator Check (Hardcoded fallback + Dynamic Firestore list)
    const isHardcodedAdmin = SYSTEM_ADMINS.some(e => e.toLowerCase() === email);
    const isDynamicAdmin = dynamicAdmins.some(e => e.toLowerCase() === email);
    const isActualAdmin = isHardcodedAdmin || isDynamicAdmin;

    if (adminsLoading && !isHardcodedAdmin) {
      return {
        isSystemAdmin: false,
        roleLabel: "Staff",
        fullRoleTitle: "Loading...",
        canCreateStudent: false,
        canEditCore: false,
        canEditSettings: false,
        canLogData: false,
        canManageAccess: false,
        loading: true,
      };
    }

    // Determine simulated/active role
    const activeRole = isActualAdmin ? impersonatedRole : null;
    const isSystemAdmin = isActualAdmin && activeRole === null;

    // 2. Role assigned to this specific student
    // We check both userRoles map and the legacy teacherEmails for robustness
    const assignedRole = student?.userRoles?.[email];
    
    // Determine tiered level based on student data
    let isCaseManager = false;
    let isContributor = false;

    if (isActualAdmin && activeRole === "manager") {
      isCaseManager = true;
    } else if (isActualAdmin && activeRole === "staff") {
      isContributor = true;
    } else {
      isCaseManager = assignedRole === 'edit';
      isContributor = assignedRole === 'view' || (student?.teacherEmails?.some(e => e.toLowerCase() === email));
    }

    // Role Labeling (System Admin takes precedence)
    const roleLabel = isSystemAdmin ? "Admin" : isCaseManager ? "Manager" : "Staff";
    const fullRoleTitle = isSystemAdmin ? "System Administrator" : isCaseManager ? "Case Manager" : isContributor ? "Contributor" : "No Access";

    // canCreateStudent: Only system admins
    const canCreateStudent = isSystemAdmin;

    // canManageAccess: Only system admins
    const canManageAccess = isSystemAdmin;

    // canEditCore (Name, Grade, Homeroom, Status): Only system admins
    const canEditCore = isSystemAdmin;

    // canEditSettings (Behaviors, Schedule): System admin OR case managers
    const canEditSettings = isSystemAdmin || isCaseManager;

    // canLogData: All roles
    const canLogData = isSystemAdmin || isCaseManager || isContributor;

    return {
      isSystemAdmin,
      isActualAdmin,
      roleLabel,
      fullRoleTitle,
      canCreateStudent,
      canManageAccess,
      canEditCore,
      canEditSettings,
      canLogData,
    };
  }, [student, user, dynamicAdmins, adminsLoading, impersonatedRole]);
}
