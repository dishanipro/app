import React from "react";

export function StatTile({ label, value, sub, color = "text-terminal-text", testId }) {
  return (
    <div className="bg-terminal-panel p-4 border border-terminal-border" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-widest text-terminal-dim">{label}</div>
      <div className={`font-mono-num text-2xl md:text-3xl mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-terminal-mute mt-1 font-mono-num">{sub}</div>}
    </div>
  );
}

export function PanelHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
      <div className="text-xs uppercase tracking-widest text-terminal-mute">// {title}</div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between border-b border-terminal-border px-6 py-5">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-terminal-dim">TAPE.JOURNAL</div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight mt-1">{title}</h1>
        {subtitle && <div className="text-sm text-terminal-mute mt-1">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function fmtNum(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pnlClass(n) {
  if (n > 0) return "pnl-pos";
  if (n < 0) return "pnl-neg";
  return "pnl-flat";
}
