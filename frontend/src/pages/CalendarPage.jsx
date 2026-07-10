import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, fmtNum, pnlClass } from "@/components/Terminal";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK = ["S","M","T","W","T","F","S"];

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get(`/analytics/calendar?year=${year}&month=${month}`).then(({ data }) => setData(data));
  }, [year, month]);

  const map = useMemo(() => Object.fromEntries(data.map((d) => [d.date, d])), [data]);

  const totalPnL = data.reduce((s, d) => s + d.pnl, 0);
  const totalTrades = data.reduce((s, d) => s + d.trades, 0);
  const winDays = data.filter((d) => d.pnl > 0).length;
  const lossDays = data.filter((d) => d.pnl < 0).length;

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const nav = (dir) => {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  return (
    <div>
      <PageHeader
        title="Trade Calendar"
        subtitle={`${MONTHS[month - 1]} ${year} · ${totalTrades} trades · ${winDays}W / ${lossDays}L days`}
        right={
          <div className="flex items-center gap-2">
            <button data-testid="cal-prev" onClick={() => nav(-1)} className="border border-terminal-border w-8 h-8 flex items-center justify-center hover:border-terminal-cyan hover:text-terminal-cyan">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-mono-num text-sm w-28 text-center">{MONTHS[month - 1]} {year}</div>
            <button data-testid="cal-next" onClick={() => nav(1)} className="border border-terminal-border w-8 h-8 flex items-center justify-center hover:border-terminal-cyan hover:text-terminal-cyan">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-px bg-terminal-border">
          <div className="bg-terminal-panel p-4">
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Net P&L</div>
            <div className={`font-mono-num text-2xl mt-1 ${pnlClass(totalPnL)}`} data-testid="cal-net-pnl">{fmtNum(totalPnL)}</div>
          </div>
          <div className="bg-terminal-panel p-4">
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Winning Days</div>
            <div className="font-mono-num text-2xl mt-1 text-terminal-green">{winDays}</div>
          </div>
          <div className="bg-terminal-panel p-4">
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Losing Days</div>
            <div className="font-mono-num text-2xl mt-1 text-terminal-red">{lossDays}</div>
          </div>
          <div className="bg-terminal-panel p-4">
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Trades</div>
            <div className="font-mono-num text-2xl mt-1">{totalTrades}</div>
          </div>
        </div>

        <div className="border border-terminal-border">
          <div className="grid grid-cols-7 border-b border-terminal-border bg-terminal-panel">
            {WEEK.map((d, i) => (
              <div key={i} className="p-2 text-[10px] uppercase tracking-widest text-terminal-dim border-r border-terminal-border last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-24 border-r border-b border-terminal-border bg-terminal-bg" />;
              const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const cell = map[iso];
              const bg = cell ? (cell.pnl >= 0 ? "bg-emerald-950/40" : "bg-red-950/40") : "bg-terminal-panel";
              return (
                <div key={i} className={`h-24 p-2 border-r border-b border-terminal-border ${bg} hover:bg-terminal-panelHover transition-colors duration-75`} data-testid={`cal-day-${iso}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-terminal-mute font-mono-num">{d}</span>
                    {cell && <span className="text-[9px] text-terminal-dim uppercase tracking-widest">{cell.trades}T</span>}
                  </div>
                  {cell && (
                    <div className={`mt-4 font-mono-num text-sm ${pnlClass(cell.pnl)}`}>{fmtNum(cell.pnl)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
