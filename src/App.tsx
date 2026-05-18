import { Routes, Route, Link } from "react-router-dom";
import { useAuth } from "./components/AuthProvider";
import { Button } from "./components/ui/button";
import StudentLog from "./pages/StudentLog";
import RosterLog from "./pages/RosterLog";
import AdminConsole from "./pages/AdminConsole";
import Dashboard from "./pages/Dashboard";
import { BarChart3, LayoutDashboard, ClipboardList, ShieldAlert } from "lucide-react";

export default function App() {
  const { user, loading, signIn, signOut } = useAuth();

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
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <BarChart3 className="h-12 w-12 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950">GBT Behavior Tracker</h1>
            <p className="text-zinc-500">Track student behaviors seamlessly across the school day.</p>
          </div>
          <Button onClick={signIn} size="lg" className="w-full">
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="bg-black border-b border-zinc-800 sticky top-0 z-10 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="font-semibold text-lg text-white hover:text-orange-400 transition-colors flex items-center space-x-2">
              <BarChart3 className="h-6 w-6 text-orange-500" />
              <span className="hidden sm:inline-block">GBT Behavior Tracker</span>
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
              <Link to="/admin" className="text-zinc-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-orange-400" />
                <span className="hidden md:inline">Admin Console</span>
                <span className="md:hidden">Admin</span>
              </Link>
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
          <Route path="/admin" element={<AdminConsole />} />
          <Route path="/student/:id" element={<StudentLog />} />
        </Routes>
      </main>
    </div>
  );
}
