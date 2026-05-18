import { useState, useMemo } from "react";
import { useAdminStats, StudentStats } from "../hooks/useDatabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, ArrowUpDown, TrendingDown, Clock, User, GraduationCap, School } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

export default function AdminConsole() {
  const [daysRange, setDaysRange] = useState<7 | 30>(7);
  const { stats, loading } = useAdminStats(daysRange);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "percentage" | "gradeLevel">("percentage");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredAndSortedStats = useMemo(() => {
    let result = [...stats];

    // Filter by search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(st => 
        st.name.toLowerCase().includes(s) || 
        st.gradeLevel?.toLowerCase().includes(s) || 
        st.homeroomTeacher?.toLowerCase().includes(s)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField] || "";
      let valB: any = b[sortField] || "";

      if (sortField === "percentage") {
        return sortOrder === "asc" ? a.percentage - b.percentage : b.percentage - a.percentage;
      }

      const comparison = String(valA).localeCompare(String(valB));
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [stats, search, sortField, sortOrder]);

  const summary = useMemo(() => {
    const counts = { red: 0, orange: 0, yellow: 0, green: 0 };
    stats.forEach(s => {
      if (s.percentage < 70) counts.red++;
      else if (s.percentage < 80) counts.orange++;
      else if (s.percentage < 90) counts.yellow++;
      else counts.green++;
    });
    return counts;
  }, [stats]);

  const handleSort = (field: "name" | "percentage" | "gradeLevel") => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getBadgeColor = (percentage: number) => {
    if (percentage < 70) return "bg-red-500 text-white";
    if (percentage < 80) return "bg-orange-500 text-white";
    if (percentage < 90) return "bg-amber-400 text-black";
    return "bg-emerald-500 text-white";
  };

  const getScoreColor = (percentage: number) => {
    if (percentage < 70) return "text-red-600";
    if (percentage < 80) return "text-orange-600";
    if (percentage < 90) return "text-amber-600";
    return "text-emerald-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-zinc-500 animate-pulse font-medium">Aggregating behavior data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 flex items-center gap-2">
            Admin Console
          </h1>
          <p className="text-zinc-500 text-sm">Bird's-eye view of student performance and trends.</p>
        </div>
        
        <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
          <Button 
            variant={daysRange === 7 ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setDaysRange(7)}
            className="text-xs h-8"
          >
            Last 7 Days
          </Button>
          <Button 
            variant={daysRange === 30 ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setDaysRange(30)}
            className="text-xs h-8"
          >
            Last 30 Days
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard 
          label="Urgent (Red)" 
          count={summary.red} 
          color="bg-red-50" 
          borderColor="border-red-200" 
          textColor="text-red-700" 
          iconColor="text-red-500"
        />
        <SummaryCard 
          label="Struggling (Orange)" 
          count={summary.orange} 
          color="bg-orange-50" 
          borderColor="border-orange-200" 
          textColor="text-orange-700"
          iconColor="text-orange-500"
        />
        <SummaryCard 
          label="Monitor (Yellow)" 
          count={summary.yellow} 
          color="bg-amber-50" 
          borderColor="border-amber-200" 
          textColor="text-amber-700"
          iconColor="text-amber-500"
        />
        <SummaryCard 
          label="Exceeding (Green)" 
          count={summary.green} 
          color="bg-emerald-50" 
          borderColor="border-emerald-200" 
          textColor="text-emerald-700"
          iconColor="text-emerald-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search name, grade, or teacher..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          <span>Showing {filteredAndSortedStats.length} Students</span>
        </div>
      </div>

      {/* High-Density Table */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-zinc-900 transition-colors">
                    Student <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden md:table-cell">
                  <button onClick={() => handleSort("gradeLevel")} className="flex items-center gap-1 hover:text-zinc-900 transition-colors">
                    Grade <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden lg:table-cell text-center">
                  Homeroom
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                  <button onClick={() => handleSort("percentage")} className="flex items-center gap-1 hover:text-zinc-900 transition-colors mx-auto">
                    Score <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Struggling Goals (Focus Areas)
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filteredAndSortedStats.map((item) => (
                  <motion.tr 
                    key={item.studentId}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link to={`/student/${item.studentId}`} className="font-bold text-zinc-900 hover:text-orange-600 transition-colors whitespace-nowrap block">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs font-medium text-zinc-500">
                      {item.gradeLevel || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-[10px] font-medium text-zinc-400 text-center uppercase tracking-tight">
                      {item.homeroomTeacher || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-black min-w-[3.5rem]",
                        getBadgeColor(item.percentage)
                      )}>
                        {Math.round(item.percentage)}%
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {item.strugglingGoals.length > 0 ? (
                          item.strugglingGoals.map(sg => (
                            <div key={sg.goal} className="flex items-center gap-1.5 bg-zinc-100/80 px-2 py-1 rounded text-[10px] font-bold text-zinc-600">
                              <TrendingDown className="h-3 w-3 text-red-500" />
                              <span className="uppercase tracking-tight truncate max-w-[120px]">{sg.goal}</span>
                              <span className="text-red-600 tabular-nums">{Math.round(sg.average)}%</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-medium italic">No struggling areas detected</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-zinc-400 hover:text-zinc-900">
                        <Link to={`/student/${item.studentId}`}>View Details</Link>
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filteredAndSortedStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-400 italic">
                    No students found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, count, color, borderColor, textColor, iconColor }: { 
  label: string; 
  count: number; 
  color: string; 
  borderColor: string; 
  textColor: string;
  iconColor: string;
}) {
  return (
    <div className={cn(
      "p-4 rounded-xl border-b-2 shadow-sm",
      color,
      borderColor
    )}>
      <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", textColor)}>
        {label}
      </p>
      <p className="text-3xl font-black tabular-nums text-zinc-900">
        {count}
      </p>
    </div>
  );
}
