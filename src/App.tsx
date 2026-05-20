import { Routes, Route, Link, Navigate } from "react-router-dom";
import { useAuth } from "./components/AuthProvider";
import { usePermissions } from "./hooks/usePermissions";
import { Button } from "./components/ui/button";
import StudentLog from "./pages/StudentLog";
import RosterLog from "./pages/RosterLog";
import AdminConsole from "./pages/AdminConsole";
import Dashboard from "./pages/Dashboard";
import { BarChart3, LayoutDashboard, ClipboardList, ShieldAlert } from "lucide-react";
// @ts-ignore
import tigerLogo from "./assets/images/tiger_mascot_final_v2_1779214043375.png";

export default function App() {
  const { user, loading, signIn, signOut, error } = useAuth();
  const perms = usePermissions(null); // Get global permissions

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-500 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2 flex flex-col items-center">
            <div className="mb-8">
              <img src={tigerLogo} alt="Tiger Logo" className="h-40 w-40 object-contain" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 uppercase">GBT Behavior Tracker</h1>
          </div>
          <div className="space-y-4">
            <Button onClick={signIn} size="lg" className="w-full">
              Sign in with Google
            </Button>

            {error && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-left text-sm text-zinc-800 animate-fade-in">
                <p className="font-bold flex items-center gap-2 text-orange-800">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  Sign-In Issue Detected
                </p>
                <p className="mt-1 text-zinc-700 leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="bg-black border-b border-zinc-800 sticky top-0 z-10 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="font-bold text-lg text-white hover:text-orange-400 transition-colors flex items-center space-x-3 text-nowrap group">
              <img src={tigerLogo} alt="Tiger Logo" className="h-10 w-10 object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
              <span className="hidden sm:inline-block tracking-tight uppercase">GBT Behavior Tracker</span>
            </Link>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Link to="/" className="text-zinc-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden md:inline">Dashboard</span>
              </Link>
              <Link to="/roster" className="text-zinc-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden md:inline">Roster Log</span>
              </Link>
              {perms.isSystemAdmin && (
                <Link to="/admin" className="text-zinc-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-orange-400" />
                  <span className="hidden md:inline">Admin Console</span>
                  <span className="md:hidden">Admin</span>
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-zinc-400 hidden sm:inline-block">{user.email || user.providerData?.[0]?.email || "User"}</span>
            <Button variant="outline" size="sm" onClick={signOut} className="border-zinc-700 bg-transparent text-zinc-300 border hover:text-white hover:bg-zinc-800">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 pb-20 print:p-0 print:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/roster" element={<RosterLog />} />
          <Route path="/admin" element={perms.isSystemAdmin ? <AdminConsole /> : <Navigate to="/" />} />
          <Route path="/student/:id" element={<StudentLog />} />
        </Routes>
      </main>
    </div>
  );
}
