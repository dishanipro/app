import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, fmtNum, pnlClass } from "@/components/Terminal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ImageIcon } from "lucide-react";
import TradeForm from "@/components/TradeForm";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MARKETS = ["All", "Stocks", "Forex", "Crypto", "Futures", "Options"];

export default function Trades() {
  const [rows, setRows] = useState([]);
  const [market, setMarket] = useState("All");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    const params = {};
    if (market !== "All") params.market_type = market;
    const { data } = await api.get("/trades", { params });
    setRows(data);
  };
  useEffect(() => { load(); }, [market]);

  const filtered = rows.filter((r) => !q || r.symbol.toLowerCase().includes(q.toLowerCase()));

  const del = async () => {
    try {
      await api.delete(`/trades/${confirmDel.id}`);
      toast.success("Trade deleted.");
      setConfirmDel(null);
      load();
    } catch (e) { toast.error("Failed to delete"); }
  };

  return (
    <div>
      <PageHeader
        title="Trade Blotter"
        subtitle={`${filtered.length} of ${rows.length} trades`}
        right={
          <Button data-testid="add-trade" onClick={() => { setEditing(null); setOpenForm(true); }}
                  className="rounded-none bg-cyan-950 text-terminal-cyan border border-cyan-800 hover:bg-cyan-900 uppercase tracking-widest">
            <Plus className="w-4 h-4 mr-2" /> New Trade
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center">
          <Input data-testid="search-trades" placeholder="Filter by symbol..." value={q} onChange={(e) => setQ(e.target.value)}
                 className="max-w-xs bg-black rounded-none border-terminal-border font-mono-num" />
          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger data-testid="filter-market" className="w-40 bg-black rounded-none border-terminal-border font-mono-num">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-terminal-panel rounded-none border-terminal-border">
              {MARKETS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="border border-terminal-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-terminal-panel">
              <tr className="text-[10px] uppercase tracking-widest text-terminal-dim border-b border-terminal-border">
                <th className="text-left py-2 px-3">Exit Date</th>
                <th className="text-left px-3">Symbol</th>
                <th className="text-left px-3">Market</th>
                <th className="text-left px-3">Dir</th>
                <th className="text-right px-3">Qty</th>
                <th className="text-right px-3">Entry</th>
                <th className="text-right px-3">Exit</th>
                <th className="text-right px-3">Fees</th>
                <th className="text-right px-3">P&L</th>
                <th className="text-left px-3">R:R</th>
                <th className="text-left px-3">Strategy</th>
                <th className="text-center px-3">Chart</th>
                <th className="text-right px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} data-testid={`trade-row-${t.id}`}
                    className="border-b border-terminal-border/60 hover:bg-terminal-panelHover font-mono-num">
                  <td className="py-2 px-3 text-terminal-mute">{t.exit_time?.slice(0, 10)}</td>
                  <td className="px-3">{t.symbol}</td>
                  <td className="px-3 text-terminal-mute">{t.market_type}</td>
                  <td className={`px-3 ${t.direction === "Long" ? "text-terminal-green" : "text-terminal-red"}`}>{t.direction}</td>
                  <td className="text-right px-3">{fmtNum(t.quantity, 4)}</td>
                  <td className="text-right px-3">{fmtNum(t.entry_price, 4)}</td>
                  <td className="text-right px-3">{fmtNum(t.exit_price, 4)}</td>
                  <td className="text-right px-3 text-terminal-mute">{fmtNum(t.fees)}</td>
                  <td className={`text-right px-3 ${pnlClass(t.pnl)}`}>{fmtNum(t.pnl)}</td>
                  <td className="px-3 text-terminal-cyan">{t.rr_ratio || "—"}</td>
                  <td className="px-3 text-terminal-mute font-sans">{t.strategy || "—"}</td>
                  <td className="text-center px-3">
                    {t.screenshot ? (
                      <button data-testid={`view-chart-${t.id}`} onClick={() => setPreview(t)}
                              className="text-terminal-cyan hover:text-cyan-300">
                        <ImageIcon className="w-4 h-4 inline" />
                      </button>
                    ) : <span className="text-terminal-dim">—</span>}
                  </td>
                  <td className="text-right px-3">
                    <button data-testid={`edit-${t.id}`} onClick={() => { setEditing(t); setOpenForm(true); }}
                            className="text-terminal-mute hover:text-terminal-cyan mr-3">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button data-testid={`delete-${t.id}`} onClick={() => setConfirmDel(t)}
                            className="text-terminal-mute hover:text-terminal-red">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="py-16 text-center text-terminal-dim">No trades match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TradeForm open={openForm} onOpenChange={setOpenForm} existing={editing} onSaved={load} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent className="bg-terminal-panel rounded-none border-terminal-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest">Delete trade?</AlertDialogTitle>
            <AlertDialogDescription className="text-terminal-mute">
              This permanently removes {confirmDel?.symbol} from your blotter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete" onClick={del}
              className="rounded-none bg-terminal-red text-black hover:bg-red-400">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="bg-terminal-panel rounded-none border-terminal-border max-w-4xl">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-sm text-terminal-mute">
              // {preview?.symbol} · {preview?.exit_time?.slice(0, 10)}
            </DialogTitle>
          </DialogHeader>
          {preview?.screenshot && <img src={preview.screenshot} alt="chart" className="max-w-full max-h-[70vh] border border-terminal-border" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
