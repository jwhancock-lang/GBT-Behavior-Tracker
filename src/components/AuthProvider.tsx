import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  impersonatedRole: "admin" | "manager" | "staff" | null;
  setImpersonatedRole: (role: "admin" | "manager" | "staff" | null) => void;
  perspectiveEngineEnabled: boolean;
  setPerspectiveEngineEnabled: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
  impersonatedRole: null,
  setImpersonatedRole: () => {},
  perspectiveEngineEnabled: false,
  setPerspectiveEngineEnabled: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonatedRole, setImpersonatedRoleState] = useState<"admin" | "manager" | "staff" | null>(() => {
    const val = localStorage.getItem("gbt_impersonated_role");
    if (val === "manager" || val === "staff") return val;
    return null;
  });
  const [perspectiveEngineEnabled, setPerspectiveEngineEnabledState] = useState<boolean>(() => {
    return localStorage.getItem("gbt_perspective_engine_enabled") === "true";
  });

  const setImpersonatedRole = (role: "admin" | "manager" | "staff" | null) => {
    setImpersonatedRoleState(role);
    if (role && role !== "admin") {
      localStorage.setItem("gbt_impersonated_role", role);
    } else {
      localStorage.removeItem("gbt_impersonated_role");
    }
  };

  const setPerspectiveEngineEnabled = (val: boolean) => {
    setPerspectiveEngineEnabledState(val);
    if (val) {
      localStorage.setItem("gbt_perspective_engine_enabled", "true");
    } else {
      localStorage.removeItem("gbt_perspective_engine_enabled");
      setImpersonatedRoleState(null);
      localStorage.removeItem("gbt_impersonated_role");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Ensure user profile exists
        try {
          const userRef = doc(db, "users", u.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              email: u.email || "",
              createdAt: new Date().toISOString()
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      const { signInWithGoogle } = await import("../lib/firebase");
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign-in error:", err);
      if (err && err.code === "auth/unauthorized-domain") {
        setError(
          "unauthorized-domain: This domain is not currently on your Firebase project's 'Authorized domains' list. Please add your Vercel URL to your Firebase Console under Authentication > Settings > Authorized domains."
        );
      } else if (err && err.code === "auth/popup-closed-by-user") {
        setError("The sign-in popup was closed before completing. Please try again.");
      } else if (err && err.code === "auth/popup-blocked") {
        setError("The login popup was blocked by your browser. Please enable popups for this site and try again.");
      } else {
        setError(err?.message || String(err));
      }
    }
  };

  const signOut = async () => {
    await auth.signOut();
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error, 
      signIn, 
      signOut, 
      clearError, 
      impersonatedRole, 
      setImpersonatedRole,
      perspectiveEngineEnabled,
      setPerspectiveEngineEnabled
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
