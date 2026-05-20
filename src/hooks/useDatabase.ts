import { useState, useEffect, useMemo } from "react";
import { collection, doc, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, orderBy, writeBatch, getDoc, or } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../components/AuthProvider";
import { SYSTEM_ADMINS } from "../lib/constants";
import { Student, DailyLog, PersonalGroup } from "../types";

export function useSystemAdmins() {
  const { user, loading: authLoading } = useAuth();
  const [admins, setAdmins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAdmins([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "system_admins"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emails = snapshot.docs.map(doc => doc.id);
      setAdmins(emails);
      setLoading(false);
    }, (err) => {
      console.error("Failed to fetch system admins:", err);
      // Usually fails if user is not signed in or not authorized
      setAdmins([]);
      setLoading(false);
    });
    return unsubscribe;
  }, [user, authLoading]);

  const addAdmin = async (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;
    try {
      await setDoc(doc(db, "system_admins", cleanEmail), {
        addedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `system_admins/${cleanEmail}`);
    }
  };

  const removeAdmin = async (email: string) => {
    try {
      await deleteDoc(doc(db, "system_admins", email));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `system_admins/${email}`);
    }
  };

  return { admins, loading, addAdmin, removeAdmin };
}

export function useStudents() {
  const { user } = useAuth();
  const { admins } = useSystemAdmins();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (!user.email && !user.providerData[0]?.email)) {
      setStudents([]);
      setLoading(false);
      return;
    }
    
    const email = (user.email || user.providerData[0]?.email || "").toLowerCase();
    
    // We need to know if they are an admin to decide which query to run.
    // Since this hook runs early, we check the hardcoded list first, 
    // then the dynamic list if available.
    const isSystemAdmin = SYSTEM_ADMINS.includes(email) || admins.includes(email);

    // Admins see everything, teachers see assigned
    const q = isSystemAdmin 
      ? query(collection(db, `students`))
      : query(
          collection(db, `students`),
          where("teacherEmails", "array-contains", email)
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      
      // Sort in memory to avoid composite index requirements
      data.sort((a, b) => a.name.localeCompare(b.name));
      
      setStudents(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, `students`);
    });

    return () => unsubscribe();
  }, [user, admins]);

  const addStudent = async (studentData: Omit<Student, "id" | "createdAt" | "updatedAt" | "ownerId" | "authorizedUsers" | "userRoles">) => {
    if (!user) return null;
    const ref = doc(collection(db, `students`));
    const now = new Date().toISOString();
    const email = user.email || user.providerData[0]?.email || "";
    try {
        await setDoc(ref, {
        ...studentData,
        ownerId: user.uid,
        authorizedUsers: [user.uid],
        userRoles: { [email]: 'edit' },
        createdAt: now,
        updatedAt: now
        });
        return ref.id;
    } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `students/${ref.id}`);
        return null;
    }
  };

  const updateStudent = async (id: string, data: Partial<Omit<Student, "id" | "createdAt" | "updatedAt" | "ownerId" | "authorizedUsers">>) => {
    if (!user) return;
    try {
        await updateDoc(doc(db, `students`, id), {
        ...data,
        updatedAt: new Date().toISOString()
        });
    } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `students/${id}`);
    }
  };

  const deleteStudent = async (id: string) => {
    if (!user) return;
    try {
        await deleteDoc(doc(db, `students`, id));
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `students/${id}`);
    }
  };

  return { students, loading, addStudent, updateStudent, deleteStudent };
}

export interface DailyNote {
  text: string;
  date: string;
  updatedAt: string;
}

export function useDailyNote(studentId: string | undefined, dateStr: string) {
  const { user } = useAuth();
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !studentId || !dateStr) {
      setNote("");
      setLoading(false);
      return;
    }

    const ref = doc(db, `students/${studentId}/dailyNotes`, dateStr);
    const unsubscribe = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        setNote(docSnap.data().text || "");
      } else {
        setNote("");
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `students/${studentId}/dailyNotes/${dateStr}`);
    });

    return () => unsubscribe();
  }, [user, studentId, dateStr]);

  const saveNote = async (text: string) => {
    if (!user || !studentId || !dateStr) return;
    const ref = doc(db, `students/${studentId}/dailyNotes`, dateStr);
    const now = new Date().toISOString();

    try {
      const docSnap = await setDoc(ref, {
        text,
        date: dateStr,
        updatedAt: now
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `students/${studentId}/dailyNotes/${dateStr}`);
    }
  };

  return { note, loading, saveNote };
}

export function useAllDailyNotes(studentId: string | undefined) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !studentId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `students/${studentId}/dailyNotes`),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...(doc.data() as DailyNote),
      }));
      setNotes(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, `students/${studentId}/dailyNotes`);
    });

    return () => unsubscribe();
  }, [user, studentId]);

  return { notes, loading };
}

export function useDailyLogs(studentId: string | undefined) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !studentId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `students/${studentId}/logs`),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DailyLog[];
      setLogs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `students/${studentId}/logs`);
    });

    return () => unsubscribe();
  }, [user, studentId]);

  const saveLog = async (logData: Omit<DailyLog, "createdAt" | "updatedAt">) => {
    if (!user || !studentId) return;
    const logId = logData.id || logData.date;
    const ref = doc(db, `students/${studentId}/logs`, logId);
    
    const existingLog = logs.find(l => l.id === logId);
    const now = new Date().toISOString();

    try {
        if (!existingLog) {
            await setDoc(ref, {
              date: logData.date,
              attendance: logData.attendance,
              periodData: logData.periodData,
              createdAt: now,
              updatedAt: now
            });
        } else {
            await updateDoc(ref, {
              attendance: logData.attendance,
              periodData: logData.periodData,
              updatedAt: now
            });
        }
    } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `students/${studentId}/logs/${logId}`);
    }
  };

  return { logs, loading, saveLog };
}

export function useDailyLogsBulk() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const saveLogsBatch = async (
    dateStr: string,
    updates: { studentId: string; period: string; scores: Record<string, number> }[]
  ) => {
    if (!user) return;
    setLoading(true);
    const now = new Date().toISOString();
    
    try {
      const batch = writeBatch(db);
      
      for (const update of updates) {
        const studentRef = doc(db, `students/${update.studentId}`);
        const logRef = doc(db, `students/${update.studentId}/logs`, dateStr);
        
        // Fetch existing log to merge period data (this is slightly sub-optimal, but Firestore batches allow sequential queries)
        // Note: For large class sizes, this might get slow if doing many reads, 
        // but 20-30 reads is fine.
        const logSnap = await getDoc(logRef);
        let periodData = "{}";
        let attendance = "present";
        
        if (logSnap.exists()) {
          periodData = logSnap.data().periodData || "{}";
          attendance = logSnap.data().attendance || "present";
          // We don't overwrite createdAt.
        }
        
        let parsedData: any = {};
        try { parsedData = JSON.parse(periodData); } catch(e) {}
        
        if (!parsedData[update.period]) parsedData[update.period] = { status: "present", scores: {} };
        parsedData[update.period].scores = update.scores;
        
        if (logSnap.exists()) {
          batch.update(logRef, {
            periodData: JSON.stringify(parsedData), // the single string json payload as required by the schema constraints
            updatedAt: now
          });
        } else {
          batch.set(logRef, {
            date: dateStr,
            attendance,
            periodData: JSON.stringify(parsedData),
            createdAt: now,
            updatedAt: now
          });
        }
      }
      
      await batch.commit();
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, `students_batch_update`);
    } finally {
      setLoading(false);
    }
  };

  return { saveLogsBatch, loading };
}

export function usePersonalGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<PersonalGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "personalGroups"),
      where("ownerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PersonalGroup[];
      setGroups(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "personalGroups");
    });

    return () => unsubscribe();
  }, [user]);

  const updateStudentGroups = async (studentId: string, groupNames: string[]) => {
    if (!user) return;
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    // 1. Find all existing groups for this user
    // (We use the 'groups' state we already have from the snapshot)
    
    // 2. Identify which groups to ADD and which to REMOVE
    for (const g of groups) {
      const shouldHave = groupNames.includes(g.name);
      const hasId = g.studentIds.includes(studentId);

      if (shouldHave && !hasId) {
        // Add to this group
        batch.update(doc(db, "personalGroups", g.id!), {
          studentIds: [...g.studentIds, studentId],
          updatedAt: now
        });
      } else if (!shouldHave && hasId) {
        // Remove from this group
        batch.update(doc(db, "personalGroups", g.id!), {
          studentIds: g.studentIds.filter(id => id !== studentId),
          updatedAt: now
        });
      }
    }

    // 3. Handle NEW groups that don't exist yet
    const existingNames = groups.map(g => g.name);
    for (const name of groupNames) {
      if (!existingNames.includes(name)) {
        const newRef = doc(collection(db, "personalGroups"));
        batch.set(newRef, {
          name,
          ownerId: user.uid,
          studentIds: [studentId],
          createdAt: now,
          updatedAt: now
        });
      }
    }

    await batch.commit();
  };

  const deleteGroup = async (groupId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "personalGroups", groupId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `personalGroups/${groupId}`);
    }
  };

  return { groups, loading, updateStudentGroups, deleteGroup };
}

export interface StudentStats {
  studentId: string;
  name: string;
  gradeLevel?: string;
  homeroomTeacher?: string;
  percentage: number;
  strugglingGoals: { goal: string; average: number }[];
  totalPossible: number;
  totalEarned: number;
  logs: DailyLog[];
  createdAt: string;
}

export function useAdminStats(daysRange: number = 7) {
  const { students, loading: studentsLoading } = useStudents();
  const [studentLogsMap, setStudentLogsMap] = useState<Record<string, DailyLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    if (studentsLoading || students.length === 0) {
      if (!studentsLoading) setLoadingLogs(false);
      return;
    }

    setLoadingLogs(true);
    // We fetch at least 90 days to support the compliance timeline and historical tracking
    const fetchRange = Math.max(daysRange, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - fetchRange);
    const startDateStr = startDate.toISOString().split('T')[0];

    const unsubscribes: (() => void)[] = [];

    students.forEach(student => {
      const q = query(
        collection(db, `students/${student.id}/logs`),
        where("date", ">=", startDateStr),
        orderBy("date", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DailyLog[];
        
        setStudentLogsMap(prev => ({
          ...prev,
          [student.id!]: data
        }));
      });
      unsubscribes.push(unsubscribe);
    });

    // Mark as finished loading once we have at least started all listeners
    // (Actual data will flow in via snapshots)
    setLoadingLogs(false);

    return () => unsubscribes.forEach(unsub => unsub());
  }, [students, studentsLoading, daysRange]);

  const stats: StudentStats[] = useMemo(() => {
    return students.map(student => {
      const allLogs = studentLogsMap[student.id!] || [];
      
      // Filter logs for percentage calculation based on requested daysRange
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - daysRange);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      
      const filteredLogs = allLogs.filter(l => l.date >= cutoffStr);

      const behaviorScores: Record<string, { total: number; count: number }> = {};
      
      // Initialize behavior scores tracking
      student.behaviors.forEach(b => {
        behaviorScores[b] = { total: 0, count: 0 };
      });

      let grandTotalPossible = 0;
      let grandTotalEarned = 0;

      filteredLogs.forEach(log => {
        if (log.attendance !== "present") return;
        
        let periodDataParsed: Record<string, any> = {};
        try {
          periodDataParsed = JSON.parse(log.periodData);
        } catch (e) {}

        Object.values(periodDataParsed).forEach((p: any) => {
          if (p.status !== "present") return;
          
          Object.entries(p.scores || {}).forEach(([behavior, score]) => {
            if (typeof score === 'number' && behaviorScores[behavior]) {
              behaviorScores[behavior].total += score;
              behaviorScores[behavior].count += 1; // Max score is 1, not 2
              
              grandTotalEarned += score;
              grandTotalPossible += 1;
            }
          });
        });
      });

      const percentage = grandTotalPossible > 0 ? (grandTotalEarned / grandTotalPossible) * 100 : 0;
      
      const goalAverages = Object.entries(behaviorScores)
        .filter(([_, stats]) => stats.count > 0)
        .map(([goal, stats]) => ({
          goal,
          average: (stats.total / stats.count) * 100
        }))
        .sort((a, b) => a.average - b.average);

      return {
        studentId: student.id!,
        name: student.name,
        gradeLevel: student.gradeLevel,
        homeroomTeacher: student.homeroomTeacher,
        percentage,
        strugglingGoals: goalAverages.slice(0, 2),
        totalPossible: grandTotalPossible,
        totalEarned: grandTotalEarned,
        logs: allLogs,
        createdAt: student.createdAt
      };
    });
  }, [students, studentLogsMap, daysRange]);

  return { stats, loading: studentsLoading || loadingLogs };
}
