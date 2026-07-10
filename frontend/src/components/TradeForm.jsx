import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Upload, X } from "lucide-react";

const MARKETS = ["Stocks", "Forex", "Crypto", "Futures", "Options"];

const empty = {
  symbol: "",
  market_type: "Stocks",
  direction: "Long",
  entry_price: "",
  exit_price: "",
  quantity: "",
  entry_time: "",
  exit_time: "",
  fees: 0,
  strategy: "",
  tags: "",
  notes: "",
  screenshot: "",
  rating: 0,
};

function toLocalInput(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export default function TradeForm({ open, onOpenChange, existing, onSaved }) {
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setF({
        ...empty,
        ...existing,
        tags: (existing.tags || []).join(", "),
        entry_time: toLocalInput(existing.entry_time),
        exit_time: toLocalInput(existing.exit_time),
      });
    } else {
      const now = new Date();
      const iso = toLocalInput(now.toISOString());
      setF({ ...empty, entry_time: iso, exit_time: iso });
    }
  }, [existing, open]);

  const update = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const previewPnL = (() => {
    const ep = parseFloat(f.entry_price), xp = parseFloat(f.exit_price), q = parseFloat(f.quantity);
    if (isNaN(ep) || isNaN(xp) || isNaN(q)) return null;
    let diff = xp - ep;
    if (f.direction === "Short") diff = -diff;
    return diff * q - (parseFloat(f.fees) || 0);
  })();

  const uploadImg = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800_000) {
      toast.error("Image too large (max 800KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("screenshot", reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...f,
        symbol: f.symbol.trim().toUpperCase(),
        entry_price: parseFloat(f.entry_price),
        exit_price: parseFloat(f.exit_price),
        quantity: parseFloat(f.quantity),
        fees: parseFloat(f.fees) || 0,
        rating: Number(f.rating) || 0,
        tags: String(f.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
        entry_time: new Date(f.entry_time).toISOString(),
        exit_time: new Date(f.exit_time).toISOString(),
      };
      if (existing?.id) {
        await api.put(`/trades/${existing.id}`, payload);
        toast.success("Trade updated.");
      } else {
        await api.post("/trades", payload);
        toast.success("Trade logged.");
      }
      onOpenChange(false);
      onSaved && onSaved();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-panel border border-terminal-border rounded-none max-w-3xl p-0">
        <DialogHeader className="p-5 border-b border-terminal-border">
          <DialogTitle className="uppercase tracking-widest text-sm text-terminal-mute">
            // {existing ? "Edit Trade" : "New Trade Entry"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Symbol</Label>
              <Input data-testid="tf-symbol" required value={f.symbol}
                     onChange={(e) => update("symbol", e.target.value.toUpperCase())}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1"
                     placeholder="AAPL / BTCUSDT / EURUSD" />
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Market</Label>
              <Select value={f.market_type} onValueChange={(v) => update("market_type", v)}>
                <SelectTrigger data-testid="tf-market" className="bg-black rounded-none border-terminal-border font-mono-num mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-terminal-panel rounded-none border-terminal-border">
                  {MARKETS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Direction</Label>
              <Select value={f.direction} onValueChange={(v) => update("direction", v)}>
                <SelectTrigger data-testid="tf-direction" className="bg-black rounded-none border-terminal-border font-mono-num mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-terminal-panel rounded-none border-terminal-border">
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Quantity</Label>
              <Input data-testid="tf-qty" required type="number" step="any" value={f.quantity}
                     onChange={(e) => update("quantity", e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Entry Price</Label>
              <Input data-testid="tf-entry-price" required type="number" step="any" value={f.entry_price}
                     onChange={(e) => update("entry_price", e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Exit Price</Label>
              <Input data-testid="tf-exit-price" required type="number" step="any" value={f.exit_price}
                     onChange={(e) => update("exit_price", e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Fees</Label>
              <Input data-testid="tf-fees" type="number" step="any" value={f.fees}
                     onChange={(e) => update("fees", e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Rating (0-5)</Label>
              <Input data-testid="tf-rating" type="number" min={0} max={5} value={f.rating}
                     onChange={(e) => update("rating", e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Entry Time</Label>
              <Input data-testid="tf-entry-time" required type="datetime-local" value={f.entry_time}
                     onChange={(e) => update("entry_time", e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div>
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Exit Time</Label>
              <Input data-testid="tf-exit-time" required type="datetime-local" value={f.exit_time}
                     onChange={(e) => update("exit_time", e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Strategy</Label>
              <Input data-testid="tf-strategy" value={f.strategy}
                     onChange={(e) => update("strategy", e.target.value)}
                     placeholder="Breakout / Mean-reversion / ORB"
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
            <div className="col-span-2 md:col-span-4">
              <Label className="text-xs text-terminal-mute uppercase tracking-widest">Tags (comma separated)</Label>
              <Input data-testid="tf-tags" value={f.tags}
                     onChange={(e) => update("tags", e.target.value)}
                     placeholder="A+, FOMO, revenge, plan-followed"
                     className="bg-black rounded-none border-terminal-border font-mono-num mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-terminal-mute uppercase tracking-widest">Notes</Label>
            <Textarea data-testid="tf-notes" rows={3} value={f.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Setup, thesis, execution grade, lessons..."
                      className="bg-black rounded-none border-terminal-border mt-1" />
          </div>

          <div>
            <Label className="text-xs text-terminal-mute uppercase tracking-widest">Chart Screenshot</Label>
            <div className="mt-1 flex items-start gap-4">
              <label className="cursor-pointer border border-terminal-border bg-black px-3 py-2 text-xs uppercase tracking-widest text-terminal-mute hover:text-terminal-cyan hover:border-terminal-cyan flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload
                <input data-testid="tf-screenshot" type="file" accept="image/*" onChange={uploadImg} className="hidden" />
              </label>
              {f.screenshot && (
                <div className="relative border border-terminal-border">
                  <img src={f.screenshot} alt="chart" className="max-h-32" />
                  <button type="button" onClick={() => update("screenshot", "")}
                          className="absolute -top-2 -right-2 bg-terminal-red text-black w-5 h-5 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-terminal-border pt-4">
            <div className="text-xs text-terminal-mute uppercase tracking-widest">
              Live P&amp;L:{" "}
              <span className={`font-mono-num text-base ml-2 ${previewPnL == null ? "" : previewPnL > 0 ? "pnl-pos" : previewPnL < 0 ? "pnl-neg" : ""}`}>
                {previewPnL == null ? "—" : previewPnL.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}
                      className="rounded-none text-terminal-mute uppercase tracking-widest">
                Cancel
              </Button>
              <Button data-testid="tf-submit" type="submit" disabled={saving}
                      className="rounded-none bg-cyan-950 text-terminal-cyan border border-cyan-800 hover:bg-cyan-900 uppercase tracking-widest">
                {saving ? "..." : existing ? "Update" : "Log Trade"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
