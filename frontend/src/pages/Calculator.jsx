import React, { useState, useMemo } from "react";
import { PageHeader } from "@/components/Terminal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, ShieldAlert, Target, TrendingUp, AlertOctagon, Zap } from "lucide-react";

const MARKETS = [
  { value: "Indian Market/Nifty", currency: "₹", locale: "en-IN" },
  { value: "Crypto", currency: "$", locale: "en-US" },
  { value: "Forex", currency: "$", locale: "en-US" },
  { value: "US Market", currency: "$", locale: "en-US" },
];

const SEGMENTS = ["Options Buying", "Options Selling", "Futures", "Equity Cash"];

const SEGMENT_RULES = {
  "Options Buying": {
    capPct: 10,
    note: "Premium decay (Theta) erodes value daily. Never exceed 10% of capital in open long options.",
    perPosPct: 5,
  },
  "Options Selling": {
    capPct: 35,
    note: "Margin-intensive & tail-risk exposed. Keep total short-option deployment under 35%.",
    perPosPct: 12,
  },
  "Futures": {
    capPct: 25,
    note: "Leveraged instrument. Max margin blocked at any time should stay under 25% of capital.",
    perPosPct: 10,
  },
  "Equity Cash": {
    capPct: 80,
    note: "Delivery / cash-and-carry. You may deploy up to 80% but keep 20% dry powder for opportunities.",
    perPosPct: 15,
  },
};

function fmtMoney(n, currency, locale) {
  if (isNaN(n)) return "—";
  const parts = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.round(n * 100) / 100);
  return `${currency}${parts}`;
}

export default function CalculatorPage() {
  const [capital, setCapital] = useState("");
  const [market, setMarket] = useState("");
  const [segment, setSegment] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const marketInfo = useMemo(() => MARKETS.find((m) => m.value === market), [market]);
  const currency = marketInfo?.currency || "₹";
  const locale = marketInfo?.locale || "en-IN";

  const calculate = () => {
    setError("");
    const cap = parseFloat(capital);
    if (!cap || cap <= 0) return setError("Enter a valid Total Capital Amount.");
    if (!market) return setError("Please select a Market Type.");
    if (!segment) return setError("Please select a Trading Segment.");

    const rule = SEGMENT_RULES[segment];
    const risk1 = cap * 0.01;
    const risk2 = cap * 0.02;
    const deployCap = cap * (rule.capPct / 100);
    const perPos = cap * (rule.perPosPct / 100);
    const reward1 = risk1 * 2;
    const reward2 = risk2 * 2;

    setResult({
      capital: cap,
      market,
      segment,
      risk1, risk2,
      deployCap,
      perPos,
      reward1, reward2,
      rule,
    });
  };

  return (
    <div>
      <PageHeader
        title="Risk & Position Sizing Calculator"
        subtitle="Deterministic capital allocator · no AI, no chat, no delay."
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-px bg-terminal-border">
        {/* Inputs */}
        <div className="xl:col-span-2 bg-terminal-panel p-6 space-y-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-mute border-b border-terminal-border pb-3">
            <Calculator className="w-4 h-4 text-terminal-cyan" />
            // Inputs
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-terminal-mute">Total Capital Amount</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-cyan font-mono-num pointer-events-none">
                {currency}
              </span>
              <Input
                data-testid="calc-capital"
                type="number"
                min={0}
                step="any"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="50000"
                className="bg-black border-terminal-border rounded-none font-mono-num text-lg pl-8 focus-visible:ring-terminal-cyan"
              />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim mt-1">
              Enter the entire trading capital you can risk.
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-terminal-mute">Market Type</Label>
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger data-testid="calc-market" className="bg-black border-terminal-border rounded-none font-mono-num mt-1 focus:ring-terminal-cyan">
                <SelectValue placeholder="Select market..." />
              </SelectTrigger>
              <SelectContent className="bg-terminal-panel rounded-none border-terminal-border">
                {MARKETS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-terminal-mute">Trading Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger data-testid="calc-segment" className="bg-black border-terminal-border rounded-none font-mono-num mt-1 focus:ring-terminal-cyan">
                <SelectValue placeholder="Select segment..." />
              </SelectTrigger>
              <SelectContent className="bg-terminal-panel rounded-none border-terminal-border">
                {SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div data-testid="calc-error" className="border border-terminal-red bg-red-950/40 px-3 py-2 text-xs text-terminal-red uppercase tracking-widest flex items-center gap-2">
              <AlertOctagon className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          <button
            data-testid="calc-submit"
            onClick={calculate}
            className="neon-btn group relative w-full py-4 uppercase tracking-[0.25em] text-sm font-semibold text-terminal-cyan bg-black border border-terminal-cyan overflow-hidden"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              Calculate Risk Allocation
            </span>
          </button>
        </div>

        {/* Output */}
        <div className="xl:col-span-3 bg-terminal-panel">
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center min-h-[500px]">
              <div className="border border-terminal-border p-8 max-w-md">
                <Calculator className="w-8 h-8 text-terminal-cyan mx-auto mb-4" />
                <div className="text-xs uppercase tracking-widest text-terminal-mute mb-2">// Awaiting inputs</div>
                <p className="text-sm text-terminal-mute">
                  Enter your capital, pick a market &amp; segment, then hit <span className="text-terminal-cyan">Calculate</span> to
                  generate your risk allocation report.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4" data-testid="calc-result">
              <div className="flex items-center justify-between border-b border-terminal-border pb-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-terminal-mute">// Risk Allocation Report</div>
                  <div className="font-mono-num text-terminal-cyan text-lg mt-1">
                    {fmtMoney(result.capital, currency, locale)}
                    <span className="text-terminal-mute text-sm ml-3">· {result.market} · {result.segment}</span>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-terminal-dim font-mono-num">
                  {new Date().toLocaleString(locale)}
                </div>
              </div>

              {/* Risk per trade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-terminal-border">
                <div className="bg-terminal-bg p-4 border border-terminal-border">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-terminal-mute">
                    <ShieldAlert className="w-3 h-3 text-terminal-cyan" /> Risk Per Trade · 1%
                  </div>
                  <div className="font-mono-num text-2xl mt-2 text-terminal-cyan" data-testid="calc-risk-1">
                    {fmtMoney(result.risk1, currency, locale)}
                  </div>
                  <div className="text-[11px] text-terminal-mute mt-1">Conservative · recommended for beginners</div>
                </div>
                <div className="bg-terminal-bg p-4 border border-terminal-border">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-terminal-mute">
                    <ShieldAlert className="w-3 h-3 text-terminal-amber" /> Risk Per Trade · 2%
                  </div>
                  <div className="font-mono-num text-2xl mt-2 text-terminal-amber" data-testid="calc-risk-2">
                    {fmtMoney(result.risk2, currency, locale)}
                  </div>
                  <div className="text-[11px] text-terminal-mute mt-1">Aggressive ceiling · experienced traders only</div>
                </div>
              </div>

              {/* Deployment cap */}
              <div className="border border-terminal-border bg-terminal-bg p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-terminal-mute">
                  <TrendingUp className="w-3 h-3 text-terminal-orange" />
                  Capital Deployment Cap · {result.rule.capPct}% max
                </div>
                <div className="font-mono-num text-3xl mt-2 text-terminal-orange" data-testid="calc-deploy-cap">
                  {fmtMoney(result.deployCap, currency, locale)}
                </div>
                <div className="text-xs text-terminal-mute mt-2 leading-relaxed">{result.rule.note}</div>
                <div className="grid grid-cols-2 gap-px bg-terminal-border mt-3">
                  <div className="bg-terminal-panel p-3">
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Per position ({result.rule.perPosPct}%)</div>
                    <div className="font-mono-num text-lg text-terminal-text mt-1">{fmtMoney(result.perPos, currency, locale)}</div>
                  </div>
                  <div className="bg-terminal-panel p-3">
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Dry powder reserve</div>
                    <div className="font-mono-num text-lg text-terminal-text mt-1">
                      {fmtMoney(result.capital - result.deployCap, currency, locale)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 1:2 R:R */}
              <div className="border border-terminal-border bg-terminal-bg p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-terminal-mute">
                  <Target className="w-3 h-3 text-terminal-green" /> 1:2 Risk-to-Reward Setup
                </div>
                <div className="grid grid-cols-2 gap-px bg-terminal-border mt-3">
                  <div className="bg-terminal-panel p-3">
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Risk 1% → Target</div>
                    <div className="font-mono-num text-xl text-terminal-green mt-1" data-testid="calc-reward-1">
                      {fmtMoney(result.reward1, currency, locale)}
                    </div>
                    <div className="text-[10px] text-terminal-dim mt-1 font-mono-num">
                      SL {fmtMoney(result.risk1, currency, locale)} · TP {fmtMoney(result.reward1, currency, locale)}
                    </div>
                  </div>
                  <div className="bg-terminal-panel p-3">
                    <div className="text-[10px] uppercase tracking-widest text-terminal-dim">Risk 2% → Target</div>
                    <div className="font-mono-num text-xl text-terminal-green mt-1" data-testid="calc-reward-2">
                      {fmtMoney(result.reward2, currency, locale)}
                    </div>
                    <div className="text-[10px] text-terminal-dim mt-1 font-mono-num">
                      SL {fmtMoney(result.risk2, currency, locale)} · TP {fmtMoney(result.reward2, currency, locale)}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-terminal-mute mt-3">
                  Only take trades where the projected upside is at least 2× your stop-loss distance.
                </div>
              </div>

              {/* Hard rule card */}
              <div className="border-2 border-terminal-red bg-red-950/30 p-5" data-testid="calc-hard-rule">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-red font-semibold">
                  <AlertOctagon className="w-4 h-4" /> Hard Rule · Non-Negotiable
                </div>
                <div className="mt-2 text-lg text-terminal-text">
                  Maximum <span className="font-mono-num text-terminal-red text-2xl">2 trades</span> per day.
                </div>
                <div className="text-sm text-terminal-mute mt-2 leading-relaxed">
                  If both trades hit stop-loss, close the terminal for the day. No revenge trades.
                  No "just one more setup". Preservation of capital &gt; every single opportunity.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
