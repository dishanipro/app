import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PageHeader, fmtNum, pnlClass } from "@/components/Terminal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Flame, CalendarClock, ShieldCheck, TrendingUp, X, AlertOctagon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const CHALLENGES = [
  { value: "10day-growth", label: "10-Day Capital Growth Challenge (Goal: Target ₹5,000)", icon: TrendingUp },
  { value: "20day-discipline", label: "20-Day Strict Discipline Challenge (Rule: Max 1 Trade Per Day)", icon: ShieldCheck },
  { value: "30day-risk", label: "30-Day Risk Management Masterclass (Rule: Strict 1% Max Risk)", icon: Flame },
  { value: "custom", label: "Custom Challenge (User sets days and capital target)", icon: Trophy },
];

const STATUS_STYLE = {
  active: { label: "IN PROGRESS", color: "text-terminal-cyan", bg: "bg-amber-950/50", border: "border-terminal-cyan" },
  passed: { label: "PASSED", color: "text-terminal-green", bg: "bg-emerald-950/40", border: "border-terminal-green" },
  failed: { label: "FAILED", color: "text-terminal-red", bg: "bg-red-950/40", border: "border-terminal-red" },
};

export default function Challenges() {
  const [type, setType] = useState("");
  const [customDays, setCustomDays] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [statedCapital, setStatedCapital] = useState("");
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: a }, { data: h }] = await Promise.all([
        api.get("/challenges/active"),
        api.get("/challenges"),
      ]);
      setActive(a);
      setHistory(h.filter((c) => c.status !== "active"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const start = async () => {
    if (!type) return toast.error("Select a challenge first.");
    if (type === "30day-risk" && (!statedCapital || parseFloat(statedCapital) <= 0)) {
      return toast.error("Enter your stated capital so we can enforce the 1% rule.");
    }
    if (type === "custom") {
      if (!customDays || parseInt(customDays, 10) < 1) return toast.error("Set custom days.");
      if (!customTarget || parseFloat(customTarget) <= 0) return toast.error("Set custom target.");
    }
    setStarting(true);
    try {
      const payload = { type, stated_capital: parseFloat(statedCapital) || 0 };
      if (type === "custom") {
        payload.custom_days = parseInt(customDays, 10);
        payload.custom_target = parseFloat(customTarget);
        payload.custom_title = customTitle.trim();
      }
      await api.post("/challenges/start", payload);
      toast.success("Challenge started. Trade with intent.");
      setType(""); setCustomDays(""); setCustomTarget(""); setCustomTitle(""); setStatedCapital("");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setStarting(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm("Cancel this active challenge?")) return;
    await api.delete(`/challenges/${id}`);
    toast.success("Challenge cancelled.");
    load();
  };

  return (
    <div>
      <PageHeader
        title="Trading Challenges"
        subtitle="Commit to time-based rules. Progress tracked live from your trades."
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-px bg-terminal-border">
        {/* Selector */}
        <div className="xl:col-span-2 bg-terminal-panel p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-mute border-b border-terminal-border pb-3">
            <Trophy className="w-4 h-4 text-terminal-cyan" />
            // Select a Challenge
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-terminal-mute">Select a Challenge</Label>
            <Select value={type} onValueChange={setType} disabled={!!active}>
              <SelectTrigger data-testid="ch-select" className="bg-black rounded-none border-terminal-border font-mono-num mt-1">
                <SelectValue placeholder="Choose your challenge..." />
              </SelectTrigger>
              <SelectContent className="bg-terminal-panel rounded-none border-terminal-border max-w-[600px]">
                {CHALLENGES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "30day-risk" && (
            <div>
              <Label className="text-xs uppercase tracking-widest text-terminal-mute">Stated Capital (₹)</Label>
              <Input data-testid="ch-stated-capital" type="number" min={0} value={statedCapital}
                     onChange={(e) => setStatedCapital(e.target.value)} placeholder="50000"
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim mt-1">Used to enforce the strict 1% max risk per trade.</div>
            </div>
          )}

          {type === "custom" && (
            <div className="space-y-4 border-l-2 border-terminal-cyan pl-4">
              <div>
                <Label className="text-xs uppercase tracking-widest text-terminal-mute">Challenge Title (optional)</Label>
                <Input data-testid="ch-custom-title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}
                       placeholder="e.g. 15-Day Crypto Grind"
                       className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-terminal-mute">Days</Label>
                  <Input data-testid="ch-custom-days" type="number" min={1} value={customDays}
                         onChange={(e) => setCustomDays(e.target.value)} placeholder="15"
                         className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-terminal-mute">Target (₹)</Label>
                  <Input data-testid="ch-custom-target" type="number" min={0} value={customTarget}
                         onChange={(e) => setCustomTarget(e.target.value)} placeholder="8000"
                         className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
                </div>
              </div>
            </div>
          )}

          {active && (
            <div className="border border-terminal-amber bg-amber-950/20 p-3 text-xs text-terminal-amber flex items-center gap-2">
              <AlertOctagon className="w-3.5 h-3.5" />
              You already have an active challenge. Complete or cancel it first.
            </div>
          )}

          <button
            data-testid="ch-start"
            onClick={start}
            disabled={starting || !!active || !type}
            className="neon-btn group relative w-full py-4 uppercase tracking-[0.25em] text-sm font-semibold text-terminal-cyan bg-black border border-terminal-cyan overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {starting ? "STARTING..." : "Start Challenge"}
            </span>
          </button>

          {/* History */}
          <div className="pt-4 border-t border-terminal-border">
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-2">// Past Challenges</div>
            {history.length === 0 && <div className="text-xs text-terminal-dim">No completed challenges yet.</div>}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((c) => {
                const s = STATUS_STYLE[c.status] || STATUS_STYLE.active;
                return (
                  <div key={c.id} className={`border ${s.border} ${s.bg} px-3 py-2 flex items-center justify-between`}>
                    <div>
                      <div className="text-sm">{c.title}</div>
                      <div className="text-[10px] font-mono-num text-terminal-dim">
                        {c.start_date} → {c.end_date} · P&L ₹{fmtNum(c.total_pnl)}
                      </div>
                    </div>
                    <div className={`text-[10px] uppercase tracking-widest font-semibold ${s.color}`}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress panel */}
        <div className="xl:col-span-3 bg-terminal-panel">
          {loading ? (
            <div className="p-8 text-terminal-mute font-mono-num">LOADING CHALLENGE STATUS...</div>
          ) : !active ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center min-h-[500px]">
              <Trophy className="w-10 h-10 text-terminal-cyan mb-4" />
              <div className="text-xs uppercase tracking-widest text-terminal-mute mb-2">// No active challenge</div>
              <p className="text-sm text-terminal-mute max-w-md">
                Pick a challenge on the left and hit <span className="text-terminal-cyan">Start Challenge</span>.
                Progress tracks automatically from every trade you log during the window.
              </p>
            </div>
          ) : (
            <ActiveTracker challenge={active} onCancel={() => cancel(active.id)} />
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveTracker({ challenge, onCancel }) {
  const s = STATUS_STYLE[challenge.status] || STATUS_STYLE.active;
  const pct = challenge.progress || 0;
  const daysPct = (challenge.days_elapsed / challenge.days_total) * 100;
  return (
    <div className="p-6 space-y-5" data-testid="active-challenge">
      <div className="flex items-start justify-between border-b border-terminal-border pb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-terminal-mute">// Active Challenge</div>
          <h3 className="text-xl font-bold mt-1">{challenge.title}</h3>
          <div className="text-xs text-terminal-mute mt-1">{challenge.rule}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 border ${s.border} ${s.bg} ${s.color} text-[10px] uppercase tracking-widest font-semibold`}>
            {s.label}
          </div>
          <button data-testid="ch-cancel" onClick={onCancel}
                  className="border border-terminal-border w-8 h-8 flex items-center justify-center text-terminal-mute hover:text-terminal-red hover:border-terminal-red">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-terminal-border">
        <div className="bg-terminal-bg p-4">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Days Elapsed</div>
          <div className="font-mono-num text-2xl mt-1 text-terminal-text">{challenge.days_elapsed}/{challenge.days_total}</div>
        </div>
        <div className="bg-terminal-bg p-4">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim flex items-center gap-1">
            <CalendarClock className="w-3 h-3" /> Days Remaining
          </div>
          <div className="font-mono-num text-2xl mt-1 text-terminal-cyan">{challenge.days_remaining}</div>
        </div>
        <div className="bg-terminal-bg p-4">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Trades in Window</div>
          <div className="font-mono-num text-2xl mt-1">{challenge.trades_count}</div>
        </div>
        <div className="bg-terminal-bg p-4">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim">P&L in Window</div>
          <div className={`font-mono-num text-2xl mt-1 ${pnlClass(challenge.total_pnl)}`}>₹{fmtNum(challenge.total_pnl)}</div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-4">
        <ProgressBar label="Goal Progress" pct={pct} color={challenge.status === "failed" ? "bg-terminal-red" : challenge.status === "passed" ? "bg-terminal-green" : "bg-terminal-cyan"} testId="ch-progress-goal" />
        <ProgressBar label="Time Progress" pct={daysPct} color="bg-terminal-amber" testId="ch-progress-time" />
      </div>

      {/* Detail */}
      <div className="border border-terminal-border bg-terminal-bg p-4">
        <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-1">// Status Detail</div>
        <div className="text-sm text-terminal-text">{challenge.detail}</div>
      </div>

      {challenge.violations && challenge.violations.length > 0 && (
        <div className="border border-terminal-red bg-red-950/30 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-red font-semibold">
            <AlertOctagon className="w-4 h-4" /> Rule Violations Detected
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {challenge.violations.map((v, i) => (
              <li key={i} className="text-terminal-red font-mono-num">· {v}</li>
            ))}
          </ul>
        </div>
      )}

      {challenge.status === "passed" && (
        <div className="border border-terminal-green bg-emerald-950/30 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-terminal-green" />
          <div>
            <div className="text-terminal-green uppercase tracking-widest text-sm font-semibold">Challenge Passed</div>
            <div className="text-xs text-terminal-mute mt-1">Discipline compounded. Ready for the next one.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ label, pct, color, testId }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-terminal-dim mb-1">
        <span>{label}</span>
        <span className="font-mono-num">{clamped.toFixed(1)}%</span>
      </div>
      <div className="h-3 bg-black border border-terminal-border relative overflow-hidden" data-testid={testId}>
        <div className={`absolute inset-y-0 left-0 ${color} transition-all duration-500`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
