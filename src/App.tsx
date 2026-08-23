import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./components/AuthProvider";
import { usePermissions } from "./hooks/usePermissions";
import { Button } from "./components/ui/button";
import StudentLog from "./pages/StudentLog";
import RosterLog from "./pages/RosterLog";
import AdminConsole from "./pages/AdminConsole";
import Dashboard from "./pages/Dashboard";
import { BarChart3, LayoutDashboard, ClipboardList, ShieldAlert, Settings } from "lucide-react";
import { cn } from "./lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "./components/ui/dialog";
// @ts-ignore
import tigerLogo from "./assets/images/tiger_mascot_final_v2_1779214043375.png";
// @ts-ignore
import tigerIcon from "./assets/images/tiger_icon_1779212841108.png";

export default function App() {
  const { 
    user, 
    loading, 
    signIn, 
    signOut, 
    error, 
    impersonatedRole, 
    setImpersonatedRole,
    perspectiveEngineEnabled,
    setPerspectiveEngineEnabled
  } = useAuth();
  const perms = usePermissions(null); // Get global permissions
  const location = useLocation();

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
              <picture className="h-40 w-40 flex items-center justify-center object-contain">
                <source srcSet={tigerLogo} media="(min-width: 768px)" />
                <img src={tigerIcon} alt="Tiger Logo" className="h-40 w-40 object-contain mx-auto animate-fade-in" referrerPolicy="no-referrer" />
              </picture>
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
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 overflow-x-hidden">
      {/* Admin Simulation Controller Bar */}
      {perms.isActualAdmin && perspectiveEngineEnabled && (
        <div className="bg-orange-600 text-white py-2 px-4 text-xs font-medium flex flex-col md:flex-row items-center justify-between gap-3 border-b border-orange-700 print:hidden shadow-md relative z-20 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </span>
            <span className="text-white text-[11px] leading-tight">
              <strong>Perspective Engine:</strong> Switch views to test exact permissions & layouts.
            </span>
          </div>
          <div className="flex items-center bg-orange-700/60 p-0.5 rounded-lg border border-orange-500/20">
            <button
              onClick={() => setImpersonatedRole(null)}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-black tracking-tight text-[10px] uppercase select-none cursor-pointer duration-200",
                impersonatedRole === null || impersonatedRole === "admin"
                  ? "bg-white text-orange-950 shadow-sm"
                  : "text-orange-100 hover:text-white hover:bg-orange-600/30"
              )}
            >
              👑 Administrator
            </button>
            <button
              type="button"
              onClick={() => setImpersonatedRole("manager")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-black tracking-tight text-[10px] uppercase select-none cursor-pointer duration-200",
                impersonatedRole === "manager"
                  ? "bg-white text-orange-950 shadow-sm"
                  : "text-orange-100 hover:text-white hover:bg-orange-600/30"
              )}
            >
              💼 Case Manager
            </button>
            <button
              type="button"
              onClick={() => setImpersonatedRole("staff")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-black tracking-tight text-[10px] uppercase select-none cursor-pointer duration-200",
                impersonatedRole === "staff"
                  ? "bg-white text-orange-950 shadow-sm"
                  : "text-orange-100 hover:text-white hover:bg-orange-600/30"
              )}
            >
              ✏️ Staff / Contributor
            </button>
          </div>
        </div>
      )}

      <header className="bg-black border-b border-zinc-800 sticky top-0 z-10 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 h-12 md:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="font-bold text-sm md:text-lg text-white hover:text-orange-400 transition-colors flex items-center space-x-2 sm:space-x-3 text-nowrap group">
              <picture className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center object-contain">
                <source srcSet={tigerLogo} media="(min-width: 768px)" />
                <img src={tigerIcon} alt="Tiger Logo" className="h-8 w-8 md:h-10 md:w-10 object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
              </picture>
              <span className="hidden sm:inline-block tracking-tight uppercase">GBT Tracker</span>
            </Link>
            <div className="hidden md:flex items-center space-x-1 sm:space-x-2">
              <Link to="/" className={cn(
                "text-zinc-300 hover:text-white p-2.5 sm:px-3 sm:py-2 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 rounded-md touch-action-manipulation select-none",
                location.pathname === "/" ? "bg-zinc-800 text-white" : "hover:bg-zinc-900"
              )}>
                <LayoutDashboard className="h-4 w-4 text-orange-500" />
                <span className="hidden sm:inline-block">Dashboard</span>
              </Link>
              <Link to="/roster" className={cn(
                "text-zinc-300 hover:text-white p-2.5 sm:px-3 sm:py-2 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 rounded-md touch-action-manipulation select-none",
                location.pathname === "/roster" ? "bg-zinc-800 text-white" : "hover:bg-zinc-900"
              )}>
                <ClipboardList className="h-4 w-4 text-amber-500" />
                <span className="hidden sm:inline-block">Roster Log</span>
              </Link>
              {perms.isSystemAdmin && (
                <Link to="/admin" className={cn(
                  "text-zinc-300 hover:text-white p-2.5 sm:px-3 sm:py-2 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 rounded-md touch-action-manipulation select-none",
                  location.pathname === "/admin" ? "bg-zinc-800 text-white" : "hover:bg-zinc-900"
                )}>
                  <ShieldAlert className="h-4 w-4 text-orange-400" />
                  <span className="hidden sm:inline-block">Admin Console</span>
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4 animate-fade-in">
            <span className="text-sm text-zinc-400 hidden lg:inline-block">{user.email || user.providerData?.[0]?.email || "User"}</span>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
                  <span className="sr-only">Settings</span>
                  <Settings className="w-4 h-4 md:w-5 md:h-5 text-zinc-400 group-hover:text-white" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-orange-600" />
                    Settings & Diagnostics
                  </DialogTitle>
                  <DialogDescription>
                    Custom preferences and administrator simulation options.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 text-sm">
                  {/* PWA Info */}
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1.5">
                    <h4 className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">Mobile App Mode</h4>
                    <p className="text-xs text-slate-600 leading-normal">
                      For a native, distraction-free home screen application experience, open your mobile browser menu (Safari <strong>"Share"</strong> or Chrome <strong>"options menu"</strong>) and select <strong>"Add to Home Screen"</strong>. GBT Tracker will install as a high-frequency native web bookmark.
                    </p>
                  </div>

                  {/* Perspective Toggle for Admins */}
                  {perms.isActualAdmin && (
                    <div className="flex items-start justify-between gap-4 p-3 border border-orange-100 rounded-lg bg-orange-50/40">
                      <div className="space-y-1">
                        <label htmlFor="perspective-toggle" className="font-black text-[11px] uppercase tracking-wider text-orange-950 block">Perspective Switcher</label>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          Enable the floating Role Emulation Bar at the top of the app to preview GBT-Tracker exactly as a Case Manager or Contributor behaves.
                        </p>
                      </div>
                      <button
                        id="perspective-toggle"
                        type="button"
                        onClick={() => setPerspectiveEngineEnabled(!perspectiveEngineEnabled)}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          perspectiveEngineEnabled ? "bg-orange-600" : "bg-zinc-200"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            perspectiveEngineEnabled ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  )}
                </div>
                <DialogFooter className="sm:justify-start">
                  <Button variant="outline" className="w-full text-xs font-bold" onClick={(e) => {
                    const btn = e.currentTarget.closest('[role="dialog"]')?.querySelector('[aria-label="Close"]') as HTMLElement;
                    btn?.click();
                  }}>
                    Close Settings
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={signOut} className="border-zinc-700 bg-transparent text-zinc-300 border hover:text-white hover:bg-zinc-800 text-xs py-1 h-8 md:h-10">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 pb-24 md:pb-20 print:p-0 print:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/roster" element={<RosterLog />} />
          <Route path="/admin" element={perms.isSystemAdmin ? <AdminConsole /> : <Navigate to="/" />} />
          <Route path="/student/:id" element={<StudentLog />} />
        </Routes>
      </main>

      {/* Floating high-performance bottom-docked navigation bar for mobile web users */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-250 h-16 flex items-center justify-around px-2 md:hidden print:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <Link 
          to="/" 
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full font-black text-[10px] uppercase tracking-wider transition-all",
            location.pathname === "/" ? "text-orange-600 scale-105" : "text-zinc-400 hover:text-zinc-700"
          )}
        >
          <LayoutDashboard className="h-5 w-5 mb-1" />
          <span>Dashboard</span>
        </Link>
        <Link 
          to="/roster" 
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full font-black text-[10px] uppercase tracking-wider transition-all",
            location.pathname === "/roster" ? "text-orange-600 scale-105" : "text-zinc-400 hover:text-zinc-700"
          )}
        >
          <ClipboardList className="h-5 w-5 mb-1" />
          <span>Roster</span>
        </Link>
        {perms.isSystemAdmin && (
          <Link 
            to="/admin" 
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full font-black text-[10px] uppercase tracking-wider transition-all",
              location.pathname === "/admin" ? "text-orange-600 scale-105" : "text-zinc-400 hover:text-zinc-700"
            )}
          >
            <ShieldAlert className="h-5 w-5 mb-1 text-orange-500" />
            <span>Admin</span>
          </Link>
        )}
      </footer>
    </div>
  );
}
