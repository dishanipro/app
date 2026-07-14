import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/Terminal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Journal() {
  const [date, setDate] = useState(todayISO());
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadDay = async (d) => {
    const { data } = await api.get(`/journal/${d}`);
    setContent(data.content || "");
    setMood(data.mood || "");
  };
  const loadHistory = async () => {
    const { data } = await api.get("/journal");
    setHistory(data);
  };
  useEffect(() => { loadDay(date); }, [date]);
  useEffect(() => { loadHistory(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/journal", { date, content, mood });
      toast.success("Journal saved.");
      loadHistory();
    } catch (e) { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Daily Journal" subtitle="Reflections, market observations & lessons." />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-px bg-terminal-border">
        <div className="lg:col-span-3 bg-terminal-panel p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-1">Date</div>
              <Input data-testid="journal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                     className="bg-black rounded-none border-terminal-border font-mono-num" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-1">Mood / State</div>
              <Input data-testid="journal-mood" value={mood} onChange={(e) => setMood(e.target.value)}
                     placeholder="Focused · Tilted · Neutral"
                     className="bg-black rounded-none border-terminal-border font-mono-num" />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-terminal-dim mb-1">Reflection</div>
            <Textarea data-testid="journal-content" rows={16} value={content} onChange={(e) => setContent(e.target.value)}
                      placeholder="What went well today? What mistakes did you make? Any patterns? Tomorrow's game plan..."
                      className="bg-black rounded-none border-terminal-border" />
          </div>
          <Button data-testid="journal-save" onClick={save} disabled={saving}
                  className="rounded-none bg-amber-950/60 text-terminal-cyan border border-amber-500/60 hover:bg-amber-900/60 uppercase tracking-widest">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save entry"}
          </Button>
        </div>

        <div className="bg-terminal-panel">
          <div className="px-4 py-3 border-b border-terminal-border text-xs uppercase tracking-widest text-terminal-mute">// History</div>
          <div className="max-h-[70vh] overflow-y-auto">
            {history.length === 0 && <div className="p-4 text-terminal-dim text-sm">No entries yet.</div>}
            {history.map((h) => (
              <button data-testid={`journal-hist-${h.date}`} key={h.date} onClick={() => setDate(h.date)}
                      className={`w-full text-left px-4 py-3 border-b border-terminal-border hover:bg-terminal-panelHover ${date === h.date ? "bg-terminal-panelHover border-l-2 border-l-terminal-cyan" : ""}`}>
                <div className="font-mono-num text-sm text-terminal-cyan">{h.date}</div>
                <div className="text-xs text-terminal-mute mt-1 line-clamp-2">{h.content?.slice(0, 90) || "(empty)"}</div>
                {h.mood && <div className="text-[10px] uppercase tracking-widest text-terminal-dim mt-1">{h.mood}</div>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
