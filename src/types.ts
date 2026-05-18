export type Student = {
  id?: string;
  name: string;
  gradeLevel?: string;
  homeroomTeacher?: string;
  groups?: string[]; // Legacy: Shared groups (deprecated)
  behaviors: string[];
  schedule: string[];
  periodImages?: Record<string, string>; // Maps period name to base64 image or URL
  teacherEmails: string[];
  ownerId: string; // Restricts modification rights to creator
  userRoles?: Record<string, 'edit' | 'view'>;
  authorizedUsers: string[]; // Preparedness for sharing
  status?: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type AttendanceStatus = "present" | "absent" | "school_closed";
export type PeriodStatus = "present" | "missed";

export type PeriodScore = {
  status: PeriodStatus;
  scores: Record<string, number>; // Maps behavior string to score (e.g., 0, 1, 2)
  notes?: string;
};

export type DailyLog = {
  id?: string;
  date: string; // YYYY-MM-DD
  attendance: AttendanceStatus;
  periodData: string; // JSON representation of Record<string, PeriodScore>
                        // Keys are schedule period names
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  email: string;
  createdAt: string;
};

export type PersonalGroup = {
  id?: string;
  name: string;
  ownerId: string;
  studentIds: string[];
  createdAt: string;
  updatedAt: string;
};
