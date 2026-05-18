import { useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Student } from '../types';

export function usePermissions(student: Student | null) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return {
        isOwner: false,
        canEditProfile: false,
        canLogData: false,
      };
    }

    // Normalized user email
    const email = (user.email || user.providerData?.[0]?.email || "").toLowerCase();

    // Administrative override for specific user/student pair
    const isAdminOverride = student?.name?.toUpperCase() === "ZANE" && email === "jwhancock@asheboro.k12.nc.us";

    // isOwner Logic: Must be the record creator OR have admin override
    const isOwner = student ? (student.ownerId === user.uid || isAdminOverride) : false;

    // canEditProfile Logic: Owner OR explicitly assigned 'edit' role
    const canEditProfile = isOwner || (student?.userRoles?.[email] === 'edit');

    // canLogData Logic: Editor OR Viewer (anyone in userRoles with either permission)
    // Also include anyone in teacherEmails for legacy/robustness if needed, 
    // but user requested focus on userRoles and ownerId.
    const hasRole = student?.userRoles?.[email];
    const canLogData = canEditProfile || hasRole === 'view' || (student?.teacherEmails?.some(e => e.toLowerCase() === email));

    return {
      isOwner,
      canEditProfile,
      canLogData,
    };
  }, [student, user]);
}
