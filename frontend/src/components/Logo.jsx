import React from "react";

/**
 * TradeMate logo — an "M"-shaped ascending chart line with a filled peak dot
 * at the top-right, symbolizing a rising trade journey. Uses currentColor.
 */
export default function Logo({ className = "w-6 h-6", strokeWidth = 3.2 }) {
  return (
    <svg
      viewBox="0 0 40 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="TradeMate logo"
      role="img"
    >
      <path
        d="M3 27 L3 8 L14 21 L20 13 L26 21 L37 8 L37 27"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="37" cy="8" r="3.4" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ size = "text-base", showTagline = true, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo className="w-6 h-6 text-terminal-cyan" />
      <div className="leading-none">
        <div className={`brand-wordmark text-terminal-text ${size}`}>TRADEMATE</div>
        {showTagline && (
          <div className="text-[9px] uppercase tracking-[0.22em] text-terminal-dim mt-0.5">
            Your edge, journaled.
          </div>
        )}
      </div>
    </div>
  );
}
