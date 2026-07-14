import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Table as TableIcon,
  CalendarDays,
  Notebook,
  Sparkles,
  Bot,
  LogOut,
  TerminalSquare,
} from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, id: "nav-dashboard" },
  { to: "/trades", label: "Trades", icon: TableIcon, id: "nav-trades" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, id: "nav-calendar" },
  { to: "/journal", label: "Journal", icon: Notebook, id: "nav-journal" },
  { to: "/insights", label: "AI Insights", icon: Sparkles, id: "nav-insights" },
  { to: "/mentor", label: "AI Mentor", icon: Bot, id: "nav-mentor" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text flex">
      <aside className="w-60 border-r border-terminal-border bg-terminal-panel flex-shrink-0 flex flex-col">
        <div className="px-5 py-5 border-b border-terminal-border flex items-center gap-2">
          <TerminalSquare className="w-5 h-5 text-terminal-cyan" />
          <span className="font-mono-num text-terminal-cyan tracking-tighter">TAPE.JOURNAL</span>
        </div>
        <nav className="flex-1 py-4">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exact}
              data-testid={n.id}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors duration-75 ${
                  isActive
                    ? "border-terminal-cyan bg-terminal-panelHover text-terminal-cyan"
                    : "border-transparent text-terminal-mute hover:text-terminal-text hover:bg-terminal-panelHover"
                }`
              }
            >
              <n.icon className="w-4 h-4" strokeWidth={1.5} />
              <span className="uppercase tracking-widest text-xs">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-terminal-border p-4 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Signed in</div>
            <div className="font-mono-num text-sm truncate" data-testid="current-user-email">
              {user?.email}
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={async () => { await logout(); navigate("/login"); }}
            className="w-full flex items-center gap-2 border border-terminal-border px-3 py-2 text-xs uppercase tracking-widest text-terminal-mute hover:text-terminal-red hover:border-terminal-red transition-colors duration-75"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
