import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, StatTile, PanelHeader, fmtNum, pnlClass } from "@/components/Terminal";
import { LineChart as RLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import TradeForm from "@/components/TradeForm";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [trades, setTrades] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const [{ data: summary }, { data: recent }] = await Promise.all([
      api.get("/analytics/summary"),
      api.get("/trades?limit=8"),
    ]);
    setS(summary);
    setTrades(recent);
  };

  useEffect(() => { load(); }, []);

  if (!s) {
    return (
      <div className="p-8 text-terminal-mute font-mono-num">LOADING METRICS...</div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Dashboard"
        subtitle={`${s.total_trades} trades logged · session ${new Date().toLocaleDateString()}`}
        right={
          <Button data-testid="new-trade-btn" onClick={() => setOpenForm(true)}
                  className="rounded-none bg-amber-950/60 text-terminal-cyan border border-amber-500/60 hover:bg-amber-900/60 uppercase tracking-widest">
            <Plus className="w-4 h-4 mr-2" /> New Trade
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-px bg-terminal-border">
          <StatTile testId="stat-total-pnl" label="Total P&L" value={fmtNum(s.total_pnl)} color={pnlClass(s.total_pnl)} sub={`Best ${fmtNum(s.best_trade)} · Worst ${fmtNum(s.worst_trade)}`} />
          <StatTile testId="stat-win-rate" label="Win Rate" value={`${fmtNum(s.win_rate, 1)}%`} sub={`${s.wins}W / ${s.losses}L`} color="text-terminal-cyan" />
          <StatTile testId="stat-profit-factor" label="Profit Factor" value={fmtNum(s.profit_factor)} color="text-terminal-amber" />
          <StatTile testId="stat-avg-win" label="Avg Win" value={fmtNum(s.avg_win)} color="text-terminal-green" />
          <StatTile testId="stat-avg-loss" label="Avg Loss" value={fmtNum(s.avg_loss)} color="text-terminal-red" />
          <StatTile testId="stat-total-trades" label="Trades" value={s.total_trades} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-px bg-terminal-border">
          <div className="xl:col-span-2 bg-terminal-panel">
            <PanelHeader title="Equity Curve" />
            <div className="h-72 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <RLineChart data={s.equity_curve}>
                  <CartesianGrid stroke="#27272A" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="date" stroke="#52525B" fontSize={10} />
                  <YAxis stroke="#52525B" fontSize={10} />
                  <Tooltip contentStyle={{ background: "#0A0A0A", border: "1px solid #27272A", borderRadius: 0 }} />
                  <Line type="monotone" dataKey="equity" stroke="#06B6D4" strokeWidth={2} dot={false} />
                </RLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-terminal-panel">
            <PanelHeader title="PnL by Market" />
            <div className="h-72 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.by_market}>
                  <CartesianGrid stroke="#27272A" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="market" stroke="#52525B" fontSize={10} />
                  <YAxis stroke="#52525B" fontSize={10} />
                  <Tooltip contentStyle={{ background: "#0A0A0A", border: "1px solid #27272A", borderRadius: 0 }} />
                  <Bar dataKey="pnl">
                    {s.by_market.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-px bg-terminal-border">
          <div className="xl:col-span-2 bg-terminal-panel">
            <PanelHeader
              title="Recent Trades"
              action={
                <button onClick={() => navigate("/trades")}
                        className="text-xs uppercase tracking-widest text-terminal-cyan hover:underline">
                  View all →
                </button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-terminal-dim border-b border-terminal-border">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left px-3">Symbol</th>
                    <th className="text-left px-3">Mkt</th>
                    <th className="text-left px-3">Dir</th>
                    <th className="text-right px-3">Qty</th>
                    <th className="text-right px-3">Entry</th>
                    <th className="text-right px-3">Exit</th>
                    <th className="text-right px-3">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-b border-terminal-border/60 hover:bg-terminal-panelHover font-mono-num">
                      <td className="py-2 px-3 text-terminal-mute">{t.exit_time?.slice(0, 10)}</td>
                      <td className="px-3">{t.symbol}</td>
                      <td className="px-3 text-terminal-mute">{t.market_type}</td>
                      <td className={`px-3 ${t.direction === "Long" ? "text-terminal-green" : "text-terminal-red"}`}>{t.direction}</td>
                      <td className="text-right px-3">{fmtNum(t.quantity, 4)}</td>
                      <td className="text-right px-3">{fmtNum(t.entry_price, 4)}</td>
                      <td className="text-right px-3">{fmtNum(t.exit_price, 4)}</td>
                      <td className={`text-right px-3 ${pnlClass(t.pnl)}`}>{fmtNum(t.pnl)}</td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                    <tr><td colSpan={8} className="py-10 text-center text-terminal-dim">No trades yet. Log your first one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-terminal-panel">
            <PanelHeader title="Strategy Leaderboard" />
            <div className="p-3 space-y-2">
              {s.by_strategy.length === 0 && <div className="text-terminal-dim text-sm p-4">No data.</div>}
              {s.by_strategy.slice(0, 8).map((row) => (
                <div key={row.strategy} className="flex items-center justify-between border border-terminal-border px-3 py-2">
                  <div>
                    <div className="text-sm">{row.strategy}</div>
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim font-mono-num">
                      {row.trades} trades · {row.win_rate}% win
                    </div>
                  </div>
                  <div className={`font-mono-num ${pnlClass(row.pnl)}`}>{fmtNum(row.pnl)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TradeForm open={openForm} onOpenChange={setOpenForm} onSaved={load} />
    </div>
  );
}
