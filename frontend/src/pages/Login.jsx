import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { LineChart } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = mode === "login"
      ? await login(email, password)
      : await register(name || "Trader", email, password);
    setSubmitting(false);
    if (!res.ok) toast.error(res.error);
    else toast.success(mode === "login" ? "Welcome back." : "Account created.");
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text grid-bg flex items-center justify-center px-6">
      <div className="w-full max-w-5xl grid md:grid-cols-2 border border-terminal-border">
        <div className="hidden md:flex flex-col justify-between p-10 bg-terminal-panel border-r border-terminal-border">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8 text-terminal-cyan" />
            <div className="leading-none">
              <div className="brand-wordmark text-terminal-text text-xl">TRADEMATE</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-terminal-dim mt-1">
                Your edge, journaled.
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <h1 className="text-4xl font-black tracking-tight leading-[1.05]">
              Your <span className="text-terminal-cyan italic font-semibold">edge</span>,<br />
              journaled.
            </h1>
            <p className="text-terminal-mute max-w-md">
              A serious trading journal for every market — stocks, forex, crypto, futures &amp; options.
              Log trades, review psychology, and let AI mentor your process.
            </p>
            <div className="grid grid-cols-3 gap-px bg-terminal-border">
              {[
                { k: "MARKETS", v: "5" },
                { k: "AI COACH", v: "ON" },
                { k: "COST", v: "$0" },
              ].map((s) => (
                <div key={s.k} className="bg-terminal-panel p-4">
                  <div className="text-[10px] text-terminal-dim uppercase tracking-widest">{s.k}</div>
                  <div className="font-mono-num text-2xl text-terminal-cyan mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim flex items-center gap-2">
            <LineChart className="w-3 h-3" /> Realtime P&amp;L · Equity · Insights
          </div>
        </div>

        <div className="p-10 bg-terminal-bg">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-2">
            {mode === "login" ? "// AUTHENTICATE" : "// NEW ACCOUNT"}
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-tight mb-8">
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>

          <form onSubmit={submit} className="space-y-5" data-testid="auth-form">
            {mode === "register" && (
              <div>
                <Label className="text-xs uppercase tracking-widest text-terminal-mute">Name</Label>
                <Input
                  data-testid="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jesse Livermore"
                  className="bg-black border-terminal-border rounded-none mt-1 font-mono-num focus-visible:ring-terminal-cyan"
                />
              </div>
            )}
            <div>
              <Label className="text-xs uppercase tracking-widest text-terminal-mute">Email</Label>
              <Input
                data-testid="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@tape.io"
                className="bg-black border-terminal-border rounded-none mt-1 font-mono-num focus-visible:ring-terminal-cyan"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-terminal-mute">Password</Label>
              <Input
                data-testid="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-black border-terminal-border rounded-none mt-1 font-mono-num focus-visible:ring-terminal-cyan"
              />
            </div>
            <Button
              data-testid="auth-submit"
              type="submit"
              disabled={submitting}
              className="w-full rounded-none bg-amber-950/60 text-terminal-cyan border border-amber-500/60 hover:bg-amber-900/60 hover:text-amber-300 uppercase tracking-widest font-semibold"
            >
              {submitting ? "..." : mode === "login" ? "Access terminal" : "Provision account"}
            </Button>
          </form>

          <div className="mt-8 text-sm text-terminal-mute">
            {mode === "login" ? (
              <>New here?{" "}
                <button
                  data-testid="switch-to-register"
                  className="text-terminal-cyan hover:underline underline-offset-4"
                  onClick={() => setMode("register")}
                >
                  Create an account →
                </button>
              </>
            ) : (
              <>Already registered?{" "}
                <button
                  data-testid="switch-to-login"
                  className="text-terminal-cyan hover:underline underline-offset-4"
                  onClick={() => setMode("login")}
                >
                  Sign in →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
