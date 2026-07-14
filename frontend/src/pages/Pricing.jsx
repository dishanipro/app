import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PageHeader } from "@/components/Terminal";
import { Check, Sparkles, Shield, Bot, ClipboardCheck, Flag, Zap, Star, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MONTHLY_FEATURES = [
  { icon: Bot, text: "Access to AI Chat Mentor" },
  { icon: Shield, text: "Complete Position Calculator" },
  { icon: ClipboardCheck, text: "Standard Weekly Audits" },
  { icon: Flag, text: "Active Challenges" },
];
const YEARLY_FEATURES = [
  { icon: Check, text: "Everything in Monthly, plus:" },
  { icon: Sparkles, text: "Premium Dashboard Insights" },
  { icon: Bot, text: "Audio / Screen Recording Journal features" },
  { icon: Flag, text: "All Multi-Day Challenges" },
  { icon: Star, text: "Priority Support" },
];

export default function Pricing() {
  const [me, setMe] = useState(null);
  const [checkoutSub, setCheckoutSub] = useState(null); // pending checkout to complete
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/subscriptions/me");
      setMe(data);
    } catch (e) { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const startCheckout = async (plan) => {
    setProcessing(true);
    try {
      const refCode = localStorage.getItem("tj_ref") || "";
      const { data } = await api.post("/subscriptions/checkout", { plan, ref_code: refCode });
      setCheckoutSub(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setProcessing(false);
    }
  };

  const completeDemo = async () => {
    if (!checkoutSub) return;
    setProcessing(true);
    try {
      await api.post("/subscriptions/complete", { subscription_id: checkoutSub.id });
      toast.success(`${checkoutSub.plan_name} activated.`);
      setCheckoutSub(null);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Premium Subscription"
        subtitle="Unlock the full trading edge. Cancel anytime."
        right={
          me?.status === "active" && (
            <div className="border border-terminal-green bg-emerald-950/40 px-3 py-1.5 text-[10px] uppercase tracking-widest text-terminal-green font-semibold">
              {me.plan_name} · until {me.expires_at}
            </div>
          )
        }
      />

      <div className="p-6 relative">
        {/* Ambient neon glow behind cards */}
        <div className="absolute inset-0 pointer-events-none opacity-30" aria-hidden>
          <div className="absolute top-10 left-1/4 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full" />
          <div className="absolute top-24 right-1/4 w-96 h-96 bg-emerald-500/20 blur-[120px] rounded-full" />
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Monthly card */}
          <div
            data-testid="plan-monthly"
            className="glass-card border border-indigo-500/40 p-8 flex flex-col"
            style={{
              background: "linear-gradient(155deg, rgba(99,102,241,0.12), rgba(30,27,75,0.35) 60%, rgba(10,10,10,0.55))",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              boxShadow: "0 0 0 1px rgba(99,102,241,0.35), 0 20px 60px -20px rgba(99,102,241,0.35)",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-indigo-300 mb-1">// Monthly</div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-white">Monthly Pro Pack</h3>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-mono-num text-5xl text-white">₹99</span>
              <span className="text-terminal-mute text-sm">/ month</span>
            </div>
            <ul className="mt-8 space-y-3 flex-1">
              {MONTHLY_FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-terminal-text">
                  <f.icon className="w-4 h-4 text-indigo-300 mt-0.5 flex-shrink-0" />
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
            <button
              data-testid="subscribe-monthly"
              onClick={() => startCheckout("monthly")}
              disabled={processing || me?.status === "active"}
              className="mt-8 w-full py-4 uppercase tracking-[0.25em] text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 border border-indigo-400/50 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: "0 0 24px rgba(99,102,241,0.5)" }}
            >
              Subscribe Monthly
            </button>
          </div>

          {/* Yearly card */}
          <div
            data-testid="plan-yearly"
            className="glass-card relative border border-emerald-500/40 p-8 flex flex-col"
            style={{
              background: "linear-gradient(155deg, rgba(16,185,129,0.12), rgba(6,78,59,0.35) 60%, rgba(10,10,10,0.55))",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              boxShadow: "0 0 0 1px rgba(16,185,129,0.4), 0 20px 60px -20px rgba(16,185,129,0.45)",
            }}
          >
            <div className="absolute -top-3 right-6 bg-emerald-500 text-black text-[10px] uppercase tracking-[0.2em] font-bold px-3 py-1">
              Save 15% · Best Value
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-300 mb-1">// Yearly Elite</div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-white">Yearly Elite Pack</h3>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-mono-num text-5xl text-white">₹999</span>
              <span className="text-terminal-mute text-sm">/ year</span>
              <span className="ml-2 text-xs text-emerald-300 line-through">₹1,188</span>
            </div>
            <ul className="mt-8 space-y-3 flex-1">
              {YEARLY_FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-terminal-text">
                  <f.icon className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
            <button
              data-testid="subscribe-yearly"
              onClick={() => startCheckout("yearly")}
              disabled={processing || me?.status === "active"}
              className="mt-8 w-full py-4 uppercase tracking-[0.25em] text-sm font-semibold text-emerald-100 bg-black border-2 border-emerald-400 hover:bg-emerald-950 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                boxShadow: "0 0 0 1px rgba(16,185,129,0.7), 0 0 28px rgba(16,185,129,0.65), inset 0 0 18px rgba(16,185,129,0.15)",
                textShadow: "0 0 8px rgba(16,185,129,0.9)",
              }}
            >
              <span className="inline-flex items-center gap-2"><Zap className="w-4 h-4" /> Subscribe Yearly</span>
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-8 text-xs text-terminal-mute text-center">
          Payments processed via Razorpay / Stripe (integration pending). All prices in INR. Cancel anytime from your account.
        </div>
      </div>

      {/* Placeholder checkout modal */}
      <Dialog open={!!checkoutSub} onOpenChange={(o) => !o && setCheckoutSub(null)}>
        <DialogContent className="bg-terminal-panel border border-terminal-border rounded-none max-w-md p-0">
          <DialogHeader className="p-5 border-b border-terminal-border">
            <DialogTitle className="uppercase tracking-widest text-sm text-terminal-mute">// Complete Purchase</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="border border-terminal-border p-4">
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim">You are about to activate</div>
              <div className="text-lg font-bold mt-1">{checkoutSub?.plan_name}</div>
              <div className="font-mono-num text-2xl text-terminal-cyan mt-2">₹{checkoutSub?.amount}</div>
              {checkoutSub?.referrer_id && (
                <div className="text-[10px] uppercase tracking-widest text-terminal-amber mt-2">
                  Referral applied · commission credited to referrer
                </div>
              )}
            </div>
            <div className="border border-terminal-amber bg-amber-950/20 p-3 text-xs text-terminal-amber">
              <strong>Placeholder gateway:</strong> Razorpay / Stripe integration is not yet configured.
              Click below to simulate a successful payment and activate your subscription.
            </div>
            <div className="flex gap-3">
              <button data-testid="checkout-cancel" onClick={() => setCheckoutSub(null)}
                      className="flex-1 border border-terminal-border py-3 text-xs uppercase tracking-widest text-terminal-mute hover:text-terminal-text">
                Cancel
              </button>
              <button data-testid="checkout-complete" onClick={completeDemo} disabled={processing}
                      className="flex-1 border border-emerald-500 bg-emerald-950/40 text-emerald-300 py-3 text-xs uppercase tracking-widest hover:bg-emerald-900/50"
                      style={{ boxShadow: "0 0 18px rgba(16,185,129,0.5)" }}>
                {processing ? "Processing..." : "Complete Demo Purchase"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
