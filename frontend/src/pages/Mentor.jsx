import React, { useEffect, useRef, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PageHeader } from "@/components/Terminal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, RefreshCw, Bot, User, Calculator, LineChart, Mic, Monitor, Trophy, ShieldAlert } from "lucide-react";

const LANGS = ["English", "Bangla", "Hindi"];

const QUICK_PROMPTS = [
  { icon: Calculator, label: "Position Sizing", text: "My total capital is ₹1,00,000. Market: Stocks. Segment: Options Buying. Guide me on position sizing." },
  { icon: LineChart, label: "Paper Trade", text: "I want to start paper trading. Give me my virtual balance and open a practice position." },
  { icon: Mic, label: "Voice Journal", text: "I recorded a voice journal. I want to paste what I said and get psychological feedback." },
  { icon: Monitor, label: "Screen Review", text: "I want to review a screen recording of my trade. Help me analyze my execution discipline." },
  { icon: Trophy, label: "Weekly Badge", text: "Please review my trading week and award me a badge." },
];

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const l = line;
    const trimmed = l.trim();
    if (trimmed.startsWith("### ")) {
      return <h3 key={i} className="text-terminal-amber uppercase tracking-widest text-xs mt-4 mb-2 font-semibold">{trimmed.slice(4)}</h3>;
    }
    if (trimmed.startsWith("## ")) {
      return <h3 key={i} className="text-terminal-cyan uppercase tracking-widest text-sm mt-4 mb-2 font-semibold border-b border-terminal-border pb-1">{trimmed.slice(3)}</h3>;
    }
    if (trimmed.startsWith("# ")) {
      return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{trimmed.slice(2)}</h2>;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <div key={i} className="pl-4 relative text-sm mb-1 leading-relaxed">
          <span className="absolute left-0 text-terminal-cyan">›</span>
          <span dangerouslySetInnerHTML={{ __html: bold(trimmed.slice(2)) }} />
        </div>
      );
    }
    if (!trimmed) return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: bold(trimmed) }} />;
  });
}
function bold(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<span class="text-terminal-amber font-semibold">$1</span>');
}

export default function Mentor() {
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState({ virtual_balance: 100000, currency: "INR" });
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("English");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/mentor/history");
      setMessages(data.messages || []);
      setState(data.state || { virtual_balance: 100000, currency: "INR" });
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic user bubble
    const optimistic = { id: `tmp-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    try {
      const { data } = await api.post("/mentor/message", { message: text, language: lang });
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.user_message,
        data.assistant_message,
      ]);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Clear TradeMind conversation & reset paper-trading balance?")) return;
    await api.post("/mentor/reset");
    setMessages([]);
    setState({ virtual_balance: 100000, currency: "INR" });
    toast.success("Session reset.");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="TradeMind AI"
        subtitle="Your risk manager, paper-trading ledger & psychological mentor. Powered by Claude Sonnet 4.5."
        right={
          <div className="flex items-center gap-2">
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger data-testid="mentor-lang" className="w-32 bg-black rounded-none border-terminal-border font-mono-num text-xs uppercase tracking-widest">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-terminal-panel rounded-none border-terminal-border">
                {LANGS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button data-testid="mentor-reset" onClick={reset} variant="ghost"
                    className="rounded-none border border-terminal-border hover:border-terminal-red hover:text-terminal-red text-xs uppercase tracking-widest">
              <RefreshCw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </div>
        }
      />

      <div className="border-b border-terminal-border bg-terminal-panel px-6 py-3 flex items-center justify-between text-xs uppercase tracking-widest">
        <div className="flex items-center gap-2 text-terminal-mute">
          <ShieldAlert className="w-3 h-3 text-terminal-amber" />
          <span>No financial advice. Risk &amp; psychology only.</span>
        </div>
        <div className="font-mono-num text-terminal-cyan" data-testid="virtual-balance">
          Virtual Balance: {state.currency === "USD" ? "$" : "₹"}{Number(state.virtual_balance || 0).toLocaleString()}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 grid-bg" ref={listRef}>
        {loading && <div className="text-terminal-mute font-mono-num">LOADING SESSION...</div>}
        {!loading && messages.length === 0 && (
          <div className="max-w-3xl mx-auto">
            <div className="border border-terminal-border bg-terminal-panel p-6">
              <div className="flex items-center gap-3 mb-3">
                <Bot className="w-5 h-5 text-terminal-cyan" />
                <div className="uppercase tracking-widest text-xs text-terminal-mute">TradeMind AI · Session Start</div>
              </div>
              <h3 className="text-xl font-bold mb-2">Welcome, trader.</h3>
              <p className="text-sm text-terminal-mute mb-4">
                I run 5 modes: <span className="text-terminal-cyan">Position Sizing</span>,{" "}
                <span className="text-terminal-cyan">Paper Trading</span>,{" "}
                <span className="text-terminal-cyan">Voice Journal Review</span>,{" "}
                <span className="text-terminal-cyan">Screen Review</span>, and{" "}
                <span className="text-terminal-cyan">Weekly Badges</span>. Pick a starter below or just type.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-terminal-border">
                {QUICK_PROMPTS.map((q, i) => (
                  <button key={i} data-testid={`quick-${i}`} onClick={() => send(q.text)}
                          className="bg-terminal-bg hover:bg-terminal-panelHover text-left p-3 flex items-start gap-3 transition-colors duration-75">
                    <q.icon className="w-4 h-4 text-terminal-cyan mt-0.5" />
                    <div>
                      <div className="text-sm">{q.label}</div>
                      <div className="text-[11px] text-terminal-dim mt-0.5 line-clamp-2">{q.text}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                 data-testid={`msg-${m.role}`}>
              <div className={`max-w-[85%] border ${m.role === "user" ? "border-amber-500/60 bg-amber-950/50" : "border-terminal-border bg-terminal-panel"} px-4 py-3`}>
                <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-widest text-terminal-dim">
                  {m.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-terminal-cyan" />}
                  <span>{m.role === "user" ? "You" : "TradeMind AI"}</span>
                  <span className="font-mono-num">· {new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                {m.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div>{renderMarkdown(m.content)}</div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="border border-terminal-border bg-terminal-panel px-4 py-3">
                <div className="flex items-center gap-2 text-terminal-cyan text-xs uppercase tracking-widest">
                  <Bot className="w-3 h-3 animate-pulse" /> TradeMind is thinking...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-terminal-border bg-terminal-panel p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <Textarea
            data-testid="mentor-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Ask about position sizing, start a paper trade, share a voice journal, request a weekly badge..."
            className="bg-black rounded-none border-terminal-border font-sans resize-none"
          />
          <Button data-testid="mentor-send" onClick={() => send()} disabled={sending || !input.trim()}
                  className="rounded-none bg-amber-950/60 text-terminal-cyan border border-amber-500/60 hover:bg-amber-900/60 uppercase tracking-widest h-16">
            <Send className="w-4 h-4 mr-2" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}
