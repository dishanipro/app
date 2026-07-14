import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";

const BOTPRESS_URL =
  "https://cdn.botpress.cloud/webchat/v3.6/shareable.html?configUrl=https://files.bpcontent.cloud/2026/07/14/11/20260714113448-090TN9XE.json";

export default function BotpressChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Chat panel */}
      <div
        data-testid="botpress-panel"
        className={`fixed z-[60] right-6 bottom-32 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-10rem)] border border-terminal-cyan bg-terminal-panel shadow-[0_0_30px_rgba(251,174,60,0.35)] transition-all duration-150 ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
        style={{ colorScheme: "dark" }}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-black">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-cyan">
            <MessageCircle className="w-3.5 h-3.5" />
            TradeMind · Live Chat
          </div>
          <button
            data-testid="botpress-close"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="text-terminal-mute hover:text-terminal-red transition-colors duration-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {open && (
          <iframe
            title="TradeMind Chatbot"
            src={BOTPRESS_URL}
            className="w-full"
            style={{ height: "calc(100% - 33px)", border: 0, background: "#0A0A0A" }}
            allow="microphone *; clipboard-read; clipboard-write"
          />
        )}
      </div>

      {/* Floating trigger bubble */}
      <button
        data-testid="botpress-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed z-[60] right-6 bottom-16 w-14 h-14 flex items-center justify-center bg-black border border-terminal-cyan text-terminal-cyan hover:bg-amber-950/60 transition-all duration-100"
        style={{
          boxShadow: open
            ? "0 0 0 1px rgba(251,174,60,0.9), 0 0 22px rgba(251,174,60,0.7)"
            : "0 0 0 1px rgba(251,174,60,0.5), 0 0 14px rgba(251,174,60,0.45)",
        }}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
