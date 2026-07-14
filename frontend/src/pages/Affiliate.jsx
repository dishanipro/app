import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, fmtNum } from "@/components/Terminal";
import { Copy, Users, Wallet, TrendingUp, Share2, Info } from "lucide-react";
import { toast } from "sonner";

export default function Affiliate() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/affiliate/me").then(({ data }) => setData(data));
  }, []);

  const referralUrl = data ? `${window.location.origin}/?ref=${data.code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success("Referral link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Copy failed — long-press to copy.");
    }
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({
        title: "TRADEMATE",
        text: "The trading journal I use — every market, AI mentor built in. Try it:",
        url: referralUrl,
      });
    } catch (e) { /* user dismissed */ }
  };

  if (!data) return <div className="p-8 text-terminal-mute font-mono-num">LOADING AFFILIATE DASHBOARD...</div>;

  return (
    <div>
      <PageHeader
        title="Affiliate Program"
        subtitle={`Earn ${data.commission_pct}% commission on every subscription referred through your link.`}
      />

      <div className="p-6 space-y-6">
        {/* Link card */}
        <div className="border border-terminal-border bg-terminal-panel p-5">
          <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-2">// Your Unique Referral Link</div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center bg-black border border-terminal-border">
              <span className="px-3 text-terminal-cyan font-mono-num text-xs uppercase tracking-widest">CODE</span>
              <span className="border-l border-terminal-border px-3 py-2 font-mono-num text-terminal-cyan text-sm" data-testid="aff-code">
                {data.code}
              </span>
              <input
                data-testid="aff-link"
                readOnly
                value={referralUrl}
                className="flex-1 bg-transparent border-l border-terminal-border px-3 py-2 font-mono-num text-sm text-terminal-text focus:outline-none min-w-0"
              />
            </div>
            <button
              data-testid="aff-copy"
              onClick={copy}
              className="border border-terminal-cyan bg-amber-950/60 text-terminal-cyan px-4 py-2 uppercase tracking-widest text-xs hover:bg-amber-900/60 flex items-center gap-2 justify-center"
              style={{ boxShadow: "0 0 16px rgba(251,174,60,0.4)" }}
            >
              <Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              data-testid="aff-share"
              onClick={share}
              className="border border-terminal-border px-4 py-2 uppercase tracking-widest text-xs text-terminal-mute hover:text-terminal-cyan hover:border-terminal-cyan flex items-center gap-2 justify-center"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-terminal-border">
          <ScoreCard
            testId="aff-total-referrals"
            icon={Users}
            label="Total Referrals"
            value={data.total_referrals}
            sub={`${data.clicks} link clicks tracked`}
            color="text-terminal-cyan"
          />
          <ScoreCard
            testId="aff-pending-payouts"
            icon={Wallet}
            label="Pending Payouts"
            value={`₹${fmtNum(data.pending_payouts)}`}
            sub="Will unlock after 30-day refund window"
            color="text-terminal-amber"
          />
          <ScoreCard
            testId="aff-total-earnings"
            icon={TrendingUp}
            label="Total Earnings"
            value={`₹${fmtNum(data.total_earnings)}`}
            sub={`Paid so far ₹${fmtNum(data.paid_out)}`}
            color="text-terminal-green"
          />
        </div>

        {/* Program rules */}
        <div className="border border-terminal-amber bg-amber-950/20 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-terminal-amber font-semibold">
            <Info className="w-4 h-4" /> Program Rules
          </div>
          <p className="text-sm text-terminal-text mt-2 leading-relaxed">
            <span className="text-terminal-amber font-semibold">Earn {data.commission_pct}% commission</span> every time
            someone purchases a monthly or yearly subscription using your unique link.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-terminal-mute">
            <li>· Referral link clicks are tracked automatically.</li>
            <li>· Commission is credited when the referred user completes their subscription payment.</li>
            <li>· Pending payouts are unlocked after the 30-day refund window closes.</li>
            <li>· Self-referrals are automatically blocked.</li>
          </ul>
        </div>

        {/* Recent earnings */}
        <div className="border border-terminal-border bg-terminal-panel">
          <div className="px-4 py-3 border-b border-terminal-border text-xs uppercase tracking-widest text-terminal-mute">
            // Recent Earnings
          </div>
          {data.earnings.length === 0 ? (
            <div className="p-6 text-sm text-terminal-dim">
              No earnings yet. Share your link — every subscription you drive pays you {data.commission_pct}%.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-terminal-dim border-b border-terminal-border">
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left px-3">Plan</th>
                  <th className="text-left px-3">Status</th>
                  <th className="text-right px-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.earnings.map((e) => (
                  <tr key={e.id} className="border-b border-terminal-border/60 font-mono-num">
                    <td className="py-2 px-3 text-terminal-mute">{e.created_at?.slice(0, 10)}</td>
                    <td className="px-3">{e.plan}</td>
                    <td className={`px-3 uppercase text-[10px] tracking-widest ${e.status === "paid" ? "text-terminal-green" : "text-terminal-amber"}`}>
                      {e.status}
                    </td>
                    <td className="text-right px-3 text-terminal-green">₹{fmtNum(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ icon: Icon, label, value, sub, color, testId }) {
  return (
    <div className="bg-terminal-panel p-5" data-testid={testId}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-terminal-dim">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`font-mono-num text-3xl mt-2 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-terminal-mute mt-1">{sub}</div>}
    </div>
  );
}
