import React, { useState } from "react";
import { PageHeader } from "@/components/Terminal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flag, ClipboardCheck, Target, TrendingUp, TrendingDown, AlertOctagon, Zap } from "lucide-react";

function fmtMoney(n) {
  if (isNaN(n)) return "0";
  const abs = Math.abs(n);
  const parts = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.round(abs * 100) / 100);
  return `${n < 0 ? "-" : ""}₹${parts}`;
}

const BADGES = {
  GREEN: {
    key: "GREEN",
    label: "Green Flag",
    emoji: "🟢",
    color: "text-terminal-green",
    border: "border-terminal-green",
    bg: "bg-emerald-950/40",
    ring: "ring-emerald-500/40",
    tagline: "PERFECT DISCIPLINE",
  },
  WHITE: {
    key: "WHITE",
    label: "White Flag",
    emoji: "⚪",
    color: "text-terminal-text",
    border: "border-terminal-mute",
    bg: "bg-zinc-800/40",
    ring: "ring-zinc-400/30",
    tagline: "NEUTRAL WEEK · MINOR SLIPS",
  },
  RED: {
    key: "RED",
    label: "Red Flag",
    emoji: "🔴",
    color: "text-terminal-red",
    border: "border-terminal-red",
    bg: "bg-red-950/40",
    ring: "ring-red-500/40",
    tagline: "DISCIPLINE BREACH · IMMEDIATE FIX REQUIRED",
  },
};

function resolveBadge(violations) {
  if (violations === 0) return BADGES.GREEN;
  if (violations > 2) return BADGES.RED;
  return BADGES.WHITE; // 1 or 2
}

function buildImpactAndChallenge({ trades, violations, pnl, badge }) {
  const violationRate = trades > 0 ? (violations / trades) * 100 : 0;
  const pnlPerTrade = trades > 0 ? pnl / trades : 0;
  const isProfit = pnl > 0;
  const isLoss = pnl < 0;

  let impact = "";
  let challenge = "";

  if (badge.key === "GREEN") {
    impact = isProfit
      ? `Flawless week. Zero rule violations across ${trades} trades produced a net gain of ${fmtMoney(pnl)} — this is exactly how process compounds into edge. Your P&L is the direct output of the discipline you exercised.`
      : isLoss
      ? `Zero rule violations across ${trades} trades. Even though the week closed at ${fmtMoney(pnl)}, this is a market outcome, not a process failure. Losing while disciplined is the cheapest tuition in trading — protect the streak.`
      : `Perfect discipline across ${trades} trades with a break-even outcome. Nothing to fix — variance did its work while you controlled your side of the equation.`;
    challenge = `Next-week challenge → **Maintain zero violations for another 5 sessions in a row.** Add one additional check: pre-commit your two allowed trades in writing at market open. If a third setup appears, you must screenshot it, log it as "watch-only", and move on. Stringing two Green Flag weeks = you can consider a modest size-up on your A+ setup only.`;
  } else if (badge.key === "WHITE") {
    impact = `${violations} rule violation${violations === 1 ? "" : "s"} across ${trades} trades (${violationRate.toFixed(0)}% violation rate). You closed at ${fmtMoney(pnl)}. Even ${violations === 1 ? "a single slip" : "two slips"} in a week is enough to leak edge — good weeks look green, but the process was borderline. If a variance-heavy week hits, undisciplined trades are the ones that turn a small loss into a large one.`;
    challenge = `Next-week challenge → **Cut violations to zero for a Green Flag.** Write your top-2 recurring rule breaks on a sticky note next to your monitor. Before every entry, physically read them aloud. Cap yourself at 2 trades/day, no exceptions. Earn Green Flag next week and you upgrade your journal tag from "🟡 Learning" to "🟢 Consistent".`;
  } else {
    impact = `${violations} rule violations across ${trades} trades (${violationRate.toFixed(0)}% violation rate) closed the week at ${fmtMoney(pnl)}. ${
      isProfit
        ? "The P&L is misleading — you profited despite the process, not because of it. This is the most dangerous kind of week: the market rewarded bad behavior, which will reinforce it. Do not confuse luck with edge."
        : isLoss
        ? "The losses are the direct cost of broken discipline. Revenge trades and rule breaks compound; the drawdown is a receipt for the violations, not the market."
        : "Break-even hides the leak. High violation rate with flat P&L means variance is currently absorbing your process failures — that will not last."
    }`;
    challenge = `Next-week challenge → **Hard reset. Trade at 50% of your normal size for 5 sessions.** Log every trade with a written pre-entry checklist (setup, stop, target, R:R, "am I chasing?"). If any trade violates the checklist, you close the terminal for that day. Target: bring violations under 2 for a White Flag first, then aim for zero next.`;
  }

  return { impact, challenge, violationRate, pnlPerTrade };
}

export default function WeeklyAudit() {
  const [trades, setTrades] = useState("");
  const [violations, setViolations] = useState("");
  const [pnl, setPnl] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const run = () => {
    setError("");
    const t = parseInt(trades, 10);
    const v = parseInt(violations, 10);
    const p = parseFloat(pnl);

    if (isNaN(t) || t < 0) return setError("Enter a valid number of trades taken this week.");
    if (isNaN(v) || v < 0) return setError("Enter a valid number of rule violations.");
    if (isNaN(p)) return setError("Enter your net weekly P&L (positive, negative or 0).");
    if (v > t) return setError("Violations cannot exceed total trades taken.");

    const badge = resolveBadge(v);
    const details = buildImpactAndChallenge({ trades: t, violations: v, pnl: p, badge });
    setResult({ trades: t, violations: v, pnl: p, badge, ...details });
  };

  const reset = () => {
    setTrades(""); setViolations(""); setPnl(""); setError(""); setResult(null);
  };

  return (
    <div>
      <PageHeader
        title="Weekly Challenge Audit"
        subtitle="Discipline scorecard · deterministic · no AI required."
        right={
          result && (
            <button data-testid="wa-new" onClick={reset}
                    className="border border-terminal-border px-3 py-2 text-xs uppercase tracking-widest text-terminal-mute hover:text-terminal-cyan hover:border-terminal-cyan">
              New audit
            </button>
          )
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-px bg-terminal-border">
        {/* Inputs */}
        <div className="xl:col-span-2 bg-terminal-panel p-6 space-y-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-mute border-b border-terminal-border pb-3">
            <ClipboardCheck className="w-4 h-4 text-terminal-cyan" />
            // Weekly Inputs
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-terminal-mute">Total Trades Taken This Week</Label>
            <Input data-testid="wa-trades" type="number" min={0} value={trades}
                   onChange={(e) => setTrades(e.target.value)} placeholder="12"
                   className="bg-black border-terminal-border rounded-none font-mono-num text-lg mt-1 focus-visible:ring-terminal-cyan" />
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim mt-1">
              Count every executed trade (winners + losers).
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-terminal-mute">Number of Rule Violations / Revenge Trades</Label>
            <Input data-testid="wa-violations" type="number" min={0} value={violations}
                   onChange={(e) => setViolations(e.target.value)} placeholder="0"
                   className="bg-black border-terminal-border rounded-none font-mono-num text-lg mt-1 focus-visible:ring-terminal-cyan" />
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim mt-1">
              Broken stop-loss · revenge entries · over-trading · position-size violations.
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-terminal-mute">Net Weekly P&amp;L</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-cyan font-mono-num pointer-events-none">₹</span>
              <Input data-testid="wa-pnl" type="number" step="any" value={pnl}
                     onChange={(e) => setPnl(e.target.value)} placeholder="7500"
                     className="bg-black border-terminal-border rounded-none font-mono-num text-lg pl-7 focus-visible:ring-terminal-cyan" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim mt-1">
              Enter negative for a losing week (e.g. -3200).
            </div>
          </div>

          {error && (
            <div data-testid="wa-error" className="border border-terminal-red bg-red-950/40 px-3 py-2 text-xs text-terminal-red uppercase tracking-widest flex items-center gap-2">
              <AlertOctagon className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          <button
            data-testid="wa-submit"
            onClick={run}
            className="neon-btn group relative w-full py-4 uppercase tracking-[0.25em] text-sm font-semibold text-terminal-cyan bg-black border border-terminal-cyan overflow-hidden"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              Audit Weekly Trading Discipline
            </span>
          </button>
        </div>

        {/* Output */}
        <div className="xl:col-span-3 bg-terminal-panel">
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center min-h-[500px]">
              <div className="border border-terminal-border p-8 max-w-md">
                <Flag className="w-8 h-8 text-terminal-cyan mx-auto mb-4" />
                <div className="text-xs uppercase tracking-widest text-terminal-mute mb-2">// Awaiting inputs</div>
                <p className="text-sm text-terminal-mute leading-relaxed">
                  Log your week's <span className="text-terminal-cyan">trades</span>,
                  <span className="text-terminal-red"> violations</span> and{" "}
                  <span className="text-terminal-amber">net P&amp;L</span> to receive your Discipline Audit Report.
                </p>
                <div className="mt-6 space-y-2 text-left">
                  <BadgePreview b={BADGES.GREEN} desc="0 violations" />
                  <BadgePreview b={BADGES.WHITE} desc="1 or 2 violations" />
                  <BadgePreview b={BADGES.RED} desc="More than 2 violations" />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5" data-testid="wa-result">
              <div className="border-b border-terminal-border pb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-terminal-mute">// Discipline Audit Report</div>
                  <div className="font-mono-num text-terminal-cyan text-sm mt-1">
                    Week of {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-right">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Trades</div>
                    <div className="font-mono-num text-lg">{result.trades}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Violations</div>
                    <div className={`font-mono-num text-lg ${result.violations === 0 ? "text-terminal-green" : result.violations > 2 ? "text-terminal-red" : "text-terminal-text"}`}>
                      {result.violations}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Net P&amp;L</div>
                    <div className={`font-mono-num text-lg ${result.pnl > 0 ? "pnl-pos" : result.pnl < 0 ? "pnl-neg" : "pnl-flat"}`}>
                      {fmtMoney(result.pnl)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Badge Sticker */}
              <div
                data-testid={`wa-badge-${result.badge.key.toLowerCase()}`}
                className={`border-2 ${result.badge.border} ${result.badge.bg} p-6 ring-4 ${result.badge.ring} ring-offset-2 ring-offset-terminal-panel flex items-center gap-6`}
              >
                <div className="text-6xl leading-none">{result.badge.emoji}</div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-terminal-mute">Awarded Badge</div>
                  <div className={`text-3xl font-black uppercase tracking-tight mt-1 ${result.badge.color}`}>
                    {result.badge.label}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-terminal-mute mt-1">
                    {result.badge.tagline}
                  </div>
                </div>
                <div className="text-right hidden md:block">
                  <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Violation Rate</div>
                  <div className="font-mono-num text-2xl">{result.violationRate.toFixed(0)}%</div>
                </div>
              </div>

              {/* Impact */}
              <div className="border border-terminal-border bg-terminal-bg p-5">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-terminal-mute">
                  {result.pnl >= 0
                    ? <TrendingUp className="w-3 h-3 text-terminal-green" />
                    : <TrendingDown className="w-3 h-3 text-terminal-red" />}
                  Discipline → P&amp;L Impact
                </div>
                <p className="text-sm text-terminal-text mt-2 leading-relaxed">{result.impact}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-terminal-border mt-4">
                  <div className="bg-terminal-panel p-3">
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">P&amp;L per trade</div>
                    <div className={`font-mono-num text-base mt-1 ${result.pnlPerTrade > 0 ? "pnl-pos" : result.pnlPerTrade < 0 ? "pnl-neg" : "pnl-flat"}`}>
                      {fmtMoney(result.pnlPerTrade)}
                    </div>
                  </div>
                  <div className="bg-terminal-panel p-3">
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Clean trades</div>
                    <div className="font-mono-num text-base mt-1 text-terminal-cyan">
                      {result.trades - result.violations}
                    </div>
                  </div>
                  <div className="bg-terminal-panel p-3 col-span-2 md:col-span-1">
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Process grade</div>
                    <div className={`font-mono-num text-base mt-1 ${result.badge.color}`}>
                      {result.badge.key === "GREEN" ? "A+" : result.badge.key === "WHITE" ? "B" : "D"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next-week challenge */}
              <div className="border border-terminal-amber bg-amber-950/20 p-5" data-testid="wa-challenge">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-amber font-semibold">
                  <Target className="w-4 h-4" /> Next-Week Challenge
                </div>
                <p className="text-sm text-terminal-text mt-2 leading-relaxed"
                   dangerouslySetInnerHTML={{ __html: result.challenge.replace(/\*\*(.+?)\*\*/g, '<span class="text-terminal-amber font-semibold">$1</span>') }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BadgePreview({ b, desc }) {
  return (
    <div className={`flex items-center gap-3 border ${b.border} ${b.bg} px-3 py-2`}>
      <span className="text-lg">{b.emoji}</span>
      <div className="flex-1">
        <div className={`text-xs uppercase tracking-widest font-semibold ${b.color}`}>{b.label}</div>
        <div className="text-[10px] text-terminal-mute font-mono-num">{desc}</div>
      </div>
    </div>
  );
}
