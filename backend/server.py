from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from emergentintegrations.llm.chat import LlmChat, UserMessage

# -----------------------------
# Config
# -----------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Trading Journal API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("journal")


# -----------------------------
# Auth helpers
# -----------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# -----------------------------
# Models
# -----------------------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

MarketType = Literal["Stocks", "Forex", "Crypto", "Futures", "Options"]
Direction = Literal["Long", "Short"]

class TradeInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    symbol: str
    market_type: MarketType
    direction: Direction
    entry_price: float
    exit_price: float
    quantity: float
    entry_time: str  # ISO string
    exit_time: str
    fees: float = 0.0
    strategy: Optional[str] = ""
    tags: List[str] = []
    notes: Optional[str] = ""
    screenshot: Optional[str] = ""  # base64 data url
    rr_ratio: Optional[str] = ""  # e.g. "1:2", "1:3", or "Custom: 1:2.75"

class TradeUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    symbol: Optional[str] = None
    market_type: Optional[MarketType] = None
    direction: Optional[Direction] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    quantity: Optional[float] = None
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    fees: Optional[float] = None
    strategy: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    screenshot: Optional[str] = None
    rr_ratio: Optional[str] = None

class JournalInput(BaseModel):
    date: str  # YYYY-MM-DD
    content: str
    mood: Optional[str] = ""


def calc_pnl(t: dict) -> float:
    diff = t["exit_price"] - t["entry_price"]
    if t["direction"] == "Short":
        diff = -diff
    return round(diff * t["quantity"] - float(t.get("fees", 0) or 0), 4)


# -----------------------------
# Auth routes
# -----------------------------
@api.post("/auth/register")
async def register(inp: RegisterInput, response: Response):
    email = inp.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": inp.name,
        "password_hash": hash_password(inp.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none",
                        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
    return {"id": user_id, "email": email, "name": inp.name, "created_at": doc["created_at"], "token": token}

@api.post("/auth/login")
async def login(inp: LoginInput, response: Response):
    email = inp.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none",
                        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
    return {"id": user["id"], "email": email, "name": user["name"], "created_at": user["created_at"], "token": token}

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# -----------------------------
# Trade routes
# -----------------------------
@api.post("/trades")
async def create_trade(inp: TradeInput, user: dict = Depends(get_current_user)):
    trade_id = str(uuid.uuid4())
    doc = inp.model_dump()
    doc["id"] = trade_id
    doc["user_id"] = user["id"]
    doc["pnl"] = calc_pnl(doc)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.trades.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/trades")
async def list_trades(user: dict = Depends(get_current_user), market_type: Optional[str] = None,
                      symbol: Optional[str] = None, limit: int = 500):
    q = {"user_id": user["id"]}
    if market_type and market_type != "All":
        q["market_type"] = market_type
    if symbol:
        q["symbol"] = symbol.upper()
    cursor = db.trades.find(q, {"_id": 0}).sort("exit_time", -1).limit(limit)
    return await cursor.to_list(length=limit)

@api.get("/trades/{trade_id}")
async def get_trade(trade_id: str, user: dict = Depends(get_current_user)):
    trade = await db.trades.find_one({"id": trade_id, "user_id": user["id"]}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade

@api.put("/trades/{trade_id}")
async def update_trade(trade_id: str, inp: TradeUpdate, user: dict = Depends(get_current_user)):
    existing = await db.trades.find_one({"id": trade_id, "user_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Trade not found")
    updates = {k: v for k, v in inp.model_dump().items() if v is not None}
    merged = {**existing, **updates}
    merged["pnl"] = calc_pnl(merged)
    updates["pnl"] = merged["pnl"]
    await db.trades.update_one({"id": trade_id}, {"$set": updates})
    merged.pop("_id", None)
    return merged

@api.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, user: dict = Depends(get_current_user)):
    res = await db.trades.delete_one({"id": trade_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"ok": True}


# -----------------------------
# Analytics
# -----------------------------
@api.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(get_current_user)):
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=10000)
    if not trades:
        return {
            "total_trades": 0, "wins": 0, "losses": 0, "win_rate": 0,
            "total_pnl": 0, "avg_win": 0, "avg_loss": 0, "best_trade": 0, "worst_trade": 0,
            "profit_factor": 0, "by_market": [], "by_strategy": [], "equity_curve": []
        }
    trades_sorted = sorted(trades, key=lambda t: t.get("exit_time", ""))
    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] < 0]
    total_pnl = sum(t["pnl"] for t in trades)
    gross_win = sum(t["pnl"] for t in wins)
    gross_loss = abs(sum(t["pnl"] for t in losses))
    profit_factor = round(gross_win / gross_loss, 2) if gross_loss > 0 else (gross_win if gross_win > 0 else 0)

    by_market_map = {}
    for t in trades:
        m = t["market_type"]
        by_market_map.setdefault(m, {"market": m, "trades": 0, "pnl": 0})
        by_market_map[m]["trades"] += 1
        by_market_map[m]["pnl"] += t["pnl"]
    by_market = [{**v, "pnl": round(v["pnl"], 2)} for v in by_market_map.values()]

    by_strategy_map = {}
    for t in trades:
        s = t.get("strategy") or "Unspecified"
        by_strategy_map.setdefault(s, {"strategy": s, "trades": 0, "pnl": 0, "wins": 0})
        by_strategy_map[s]["trades"] += 1
        by_strategy_map[s]["pnl"] += t["pnl"]
        if t["pnl"] > 0:
            by_strategy_map[s]["wins"] += 1
    by_strategy = []
    for v in by_strategy_map.values():
        v["pnl"] = round(v["pnl"], 2)
        v["win_rate"] = round((v["wins"] / v["trades"]) * 100, 1) if v["trades"] else 0
        by_strategy.append(v)
    by_strategy.sort(key=lambda x: x["pnl"], reverse=True)

    running = 0
    equity_curve = []
    for t in trades_sorted:
        running += t["pnl"]
        equity_curve.append({
            "date": t.get("exit_time", "")[:10],
            "equity": round(running, 2),
            "pnl": round(t["pnl"], 2),
        })

    return {
        "total_trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(trades) * 100, 1),
        "total_pnl": round(total_pnl, 2),
        "avg_win": round(sum(t["pnl"] for t in wins) / len(wins), 2) if wins else 0,
        "avg_loss": round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0,
        "best_trade": round(max(t["pnl"] for t in trades), 2),
        "worst_trade": round(min(t["pnl"] for t in trades), 2),
        "profit_factor": profit_factor,
        "by_market": by_market,
        "by_strategy": by_strategy,
        "equity_curve": equity_curve,
    }

@api.get("/analytics/calendar")
async def analytics_calendar(user: dict = Depends(get_current_user), year: int = 0, month: int = 0):
    q = {"user_id": user["id"]}
    trades = await db.trades.find(q, {"_id": 0}).to_list(length=10000)
    day_map = {}
    for t in trades:
        d = t.get("exit_time", "")[:10]
        if not d:
            continue
        if year and month:
            try:
                y, m, _ = d.split("-")
                if int(y) != year or int(m) != month:
                    continue
            except Exception:
                continue
        day_map.setdefault(d, {"date": d, "pnl": 0, "trades": 0})
        day_map[d]["pnl"] += t["pnl"]
        day_map[d]["trades"] += 1
    for v in day_map.values():
        v["pnl"] = round(v["pnl"], 2)
    return list(day_map.values())


# -----------------------------
# Journal Notes
# -----------------------------
@api.get("/journal")
async def list_journal(user: dict = Depends(get_current_user)):
    items = await db.journal.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(length=500)
    return items

@api.get("/journal/{date}")
async def get_journal(date: str, user: dict = Depends(get_current_user)):
    item = await db.journal.find_one({"user_id": user["id"], "date": date}, {"_id": 0})
    return item or {"date": date, "content": "", "mood": ""}

@api.post("/journal")
async def upsert_journal(inp: JournalInput, user: dict = Depends(get_current_user)):
    doc = {
        "user_id": user["id"],
        "date": inp.date,
        "content": inp.content,
        "mood": inp.mood,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.journal.update_one(
        {"user_id": user["id"], "date": inp.date},
        {"$set": doc},
        upsert=True,
    )
    doc.pop("_id", None)
    return doc


# -----------------------------
# AI Insights
# -----------------------------
def _summarize_trades_for_ai(trades: List[dict]) -> str:
    if not trades:
        return "No trades yet."
    lines = []
    for t in trades[:80]:
        lines.append(
            f"- {t.get('exit_time','')[:10]} {t['symbol']} [{t['market_type']}] {t['direction']} "
            f"qty={t['quantity']} entry={t['entry_price']} exit={t['exit_price']} "
            f"PnL={t['pnl']} strategy={t.get('strategy','')} tags={','.join(t.get('tags',[]) or [])} "
            f"notes={(t.get('notes','') or '')[:80]}"
        )
    return "\n".join(lines)

@api.post("/ai/insights")
async def ai_insights(user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).sort("exit_time", -1).to_list(length=200)
    if not trades:
        raise HTTPException(status_code=400, detail="No trades to analyze yet.")

    system = (
        "You are an elite trading performance coach. Analyze the user's trade history and produce a rigorous, "
        "actionable performance review. Be terse, data-driven, and honest. Use the following sections with these EXACT "
        "markdown headers (start each with '## '): '## Executive Summary', '## Strengths', '## Weaknesses & Leaks', "
        "'## Pattern Findings', '## Actionable Next Steps'. Keep each section under 6 bullet points. Prefer numbers over adjectives."
    )
    prompt = f"Analyze these trades and return structured insights.\n\n{_summarize_trades_for_ai(trades)}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"insights-{user['id']}-{datetime.now(timezone.utc).timestamp()}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)[:200]}")

    record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "trade_count": len(trades),
    }
    await db.ai_insights.insert_one(record)
    record.pop("_id", None)
    return record

@api.get("/ai/insights")
async def latest_insights(user: dict = Depends(get_current_user)):
    item = await db.ai_insights.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    return item or None


# -----------------------------
# TradeMind AI Mentor Chatbot
# -----------------------------
MENTOR_SYSTEM_PROMPT = """You are the primary AI engine behind "Emergent", a smart, interactive trading journal, risk management, and psychological mentor platform. Your name is TradeMind AI. You are built into a no-code system, so your responses must be highly structured, modular, and easy for the user to navigate using text inputs. You must communicate professionally and support English, Bangla, and Hindi fluently, matching the user's preferred language.

CRITICAL INSTRUCTION: You are strictly prohibited from giving financial advice, call tips, buy/sell instructions, or specific stock recommendations. If a user asks for tips, politely decline and steer them toward risk management or trading psychology.

You possess five distinct internal modes. Based on what the user types, automatically activate the correct mode:

1. CAPITAL & POSITION SIZING CALCULATOR MODE:
- Activate this when the user mentions their capital, market type, or segment.
- Prompt the user to provide 3 clear inputs if they haven't already: Total Capital, Market Type (Stocks/Crypto/Forex), and Segment (Options Buying, Options Selling, Futures, or Equity Cash).
- Once provided, immediately calculate and display:
  * Max Risk Capital: Strictly limit this to 1% or 2% of their total capital. Show the exact amount.
  * Allocation Advice: Give a strict warning based on the segment (e.g., if Options Buying, warn them never to deploy more than 10% of their total capital due to premium decay).
  * Strategy Guide: Advise on setting up a 1:2 Risk-to-Reward ratio.
  * Core Rule: Remind them of the "Max 2 trades per day" limit, stating that if both hit Stop Loss, they must close the terminal.

2. PAPER TRADING LEDGER MODE:
- Activate this when the user wants to practice trading or start a virtual trade.
- Initialize the user with a virtual demo balance of ₹1,00,000 (or $10,000). Keep track of this balance in the chat memory.
- Ask the user for their entry details: Asset name, Action (Buy/Sell), Entry Price, and Stop Loss Price.
- Acknowledge that the position is open. Since you do not have live market data, ask the user to type "Target Hit" or "Stop Loss Hit" along with their Exit Price when the trade is over.
- Instantly calculate the net profit or loss, update their virtual balance, and print a clear running ledger scoreboard.

3. VOICE JOURNAL REVIEW MODE:
- Activate this when the user mentions they have recorded or transcribed a voice journal entry.
- Tell the user to paste or describe their spoken thoughts.
- Analyze their text specifically for psychological indicators like fear, overtrading, excitement, or FOMO.
- Provide constructive, supportive feedback on their emotional state and give them one mental exercise to stay calm.

4. SCREEN RECORDING JOURNAL REVIEW MODE:
- Activate this when the user describes what happened in their screen recording or chart setup.
- Focus strictly on technical execution. Ask the user if they followed their predetermined strategy (e.g., Support/Resistance, Price Action) or if they jumped into the trade blindly.
- Provide a summary of whether they maintained mechanical discipline, regardless of whether the trade won or lost.

5. WEEKLY CHALLENGE & BADGE DISTRIBUTION MODE:
- Activate this when the user wants a review of their trading week.
- Ask the user briefly how many rules they followed or broke this week.
- Based on their answers, award them exactly one of these three symbolic badges and explain the reasoning clearly using emojis:
  * GREEN FLAG Badge: Awarded for perfect discipline and following risk management rules flawlessly, regardless of profit or loss.
  * RED FLAG Badge: Awarded if they did revenge trading, broke stop-loss rules, or over-traded. Give a constructive tip to fix this.
  * WHITE FLAG Badge: Awarded for a neutral, average week where they made minor mistakes but managed to control themselves, or stayed away from a bad market.

Structure all your outputs cleanly using Markdown headers (###), bold text, and punchy bullet points to keep the layout highly scannable and premium."""


class MentorMessageInput(BaseModel):
    message: str
    language: Optional[str] = "English"  # English | Bangla | Hindi


def _build_history_context(history: List[dict]) -> str:
    if not history:
        return ""
    lines = []
    for m in history[-30:]:  # keep last 30 turns for context
        role = "USER" if m["role"] == "user" else "TRADEMIND"
        lines.append(f"{role}: {m['content']}")
    return "\n".join(lines)


@api.get("/mentor/history")
async def mentor_history(user: dict = Depends(get_current_user)):
    msgs = await db.mentor_messages.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=500)
    state = await db.mentor_state.find_one({"user_id": user["id"]}, {"_id": 0}) or {
        "user_id": user["id"], "virtual_balance": 100000.0, "currency": "INR"
    }
    return {"messages": msgs, "state": state}


@api.post("/mentor/reset")
async def mentor_reset(user: dict = Depends(get_current_user)):
    await db.mentor_messages.delete_many({"user_id": user["id"]})
    await db.mentor_state.update_one(
        {"user_id": user["id"]},
        {"$set": {"virtual_balance": 100000.0, "currency": "INR", "user_id": user["id"]}},
        upsert=True,
    )
    return {"ok": True}


@api.post("/mentor/message")
async def mentor_message(inp: MentorMessageInput, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    text = (inp.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty message")

    # Save user message
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "role": "user", "content": text, "created_at": now,
    }
    await db.mentor_messages.insert_one(user_doc)

    # Build context
    history = await db.mentor_messages.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)
    # history includes the message we just saved - fine, we'll strip it for context
    prior = history[:-1] if history else []
    ctx = _build_history_context(prior)

    lang = (inp.language or "English").strip()
    lang_directive = f"The user's preferred language is {lang}. Respond in {lang}. Never break character."

    prompt_parts = [lang_directive]
    if ctx:
        prompt_parts.append(f"CONVERSATION HISTORY (for your memory only, do not repeat verbatim):\n{ctx}")
    prompt_parts.append(f"NEW USER MESSAGE:\n{text}")
    prompt = "\n\n".join(prompt_parts)

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"mentor-{user['id']}",
        system_message=MENTOR_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        reply = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.exception("Mentor LLM error")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)[:200]}")

    assistant_doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "role": "assistant", "content": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.mentor_messages.insert_one(assistant_doc)

    user_doc.pop("_id", None)
    assistant_doc.pop("_id", None)
    return {"user_message": user_doc, "assistant_message": assistant_doc}


# =============================================
# Trading Challenges
# =============================================
CHALLENGE_PRESETS = {
    "10day-growth": {
        "title": "10-Day Capital Growth Challenge",
        "days": 10,
        "target_capital": 5000.0,
        "rule": "Reach ₹5,000 net profit within 10 trading days.",
        "kind": "growth",
    },
    "20day-discipline": {
        "title": "20-Day Strict Discipline Challenge",
        "days": 20,
        "rule_max_trades_per_day": 1,
        "rule": "Take a maximum of 1 trade per day for 20 days.",
        "kind": "discipline",
    },
    "30day-risk": {
        "title": "30-Day Risk Management Masterclass",
        "days": 30,
        "rule_max_risk_pct": 1.0,
        "rule": "No single trade loss may exceed 1% of your stated capital.",
        "kind": "risk",
    },
}


class ChallengeStart(BaseModel):
    type: str  # "10day-growth" | "20day-discipline" | "30day-risk" | "custom"
    stated_capital: Optional[float] = 0
    # custom-only
    custom_days: Optional[int] = None
    custom_target: Optional[float] = None
    custom_title: Optional[str] = ""


def _today_date():
    return datetime.now(timezone.utc).date()


def _iso_date(d):
    return d.isoformat()


def _eval_challenge(challenge: dict, trades: List[dict]) -> dict:
    """Compute live progress / pass-fail for a challenge based on trades in its window."""
    from datetime import date, timedelta
    start = date.fromisoformat(challenge["start_date"])
    end = date.fromisoformat(challenge["end_date"])
    today = _today_date()
    days_total = challenge["days"]
    days_elapsed = max(0, min(days_total, (today - start).days + 1))
    days_remaining = max(0, (end - today).days)

    # Filter trades in [start, end] window based on exit_time
    window = []
    for t in trades:
        d = (t.get("exit_time") or "")[:10]
        if not d:
            continue
        try:
            td = date.fromisoformat(d)
        except Exception:
            continue
        if start <= td <= end:
            window.append({**t, "_d": td})

    kind = challenge["kind"]
    total_pnl = round(sum(t["pnl"] for t in window), 2)
    trades_count = len(window)

    status = challenge.get("status", "active")
    progress = 0.0
    detail = ""
    violations = []

    if kind == "growth":
        target = challenge.get("target_capital") or 0
        progress = min(100.0, (total_pnl / target * 100)) if target > 0 else 0
        if progress < 0:
            progress = 0
        detail = f"₹{total_pnl:,.2f} of ₹{target:,.2f} target · {trades_count} trades taken"
        if total_pnl >= target and target > 0:
            status = "passed"
        elif today > end:
            status = "failed" if total_pnl < target else "passed"
    elif kind == "discipline":
        max_pd = challenge.get("rule_max_trades_per_day") or 1
        counts = {}
        for t in window:
            counts[t["_d"]] = counts.get(t["_d"], 0) + 1
        bad_days = [(d.isoformat(), c) for d, c in counts.items() if c > max_pd]
        violations = [f"{d}: {c} trades" for d, c in bad_days]
        progress = min(100.0, days_elapsed / days_total * 100) if not bad_days else 0
        detail = (
            f"Day {days_elapsed}/{days_total} · {trades_count} trades logged · "
            + ("no violations" if not bad_days else f"{len(bad_days)} violation day(s)")
        )
        if bad_days:
            status = "failed"
        elif today > end:
            status = "passed"
    elif kind == "risk":
        cap = challenge.get("stated_capital") or 0
        max_risk_pct = challenge.get("rule_max_risk_pct") or 1.0
        threshold = cap * (max_risk_pct / 100) if cap > 0 else 0
        offenders = []
        for t in window:
            if t["pnl"] < 0 and threshold > 0 and abs(t["pnl"]) > threshold:
                offenders.append(f"{t['symbol']} lost ₹{abs(t['pnl']):,.2f} (> ₹{threshold:,.2f})")
        violations = offenders
        progress = min(100.0, days_elapsed / days_total * 100) if not offenders else 0
        detail = (
            f"Day {days_elapsed}/{days_total} · risk cap ₹{threshold:,.2f} per trade · "
            + ("no breaches" if not offenders else f"{len(offenders)} breach(es)")
        )
        if offenders:
            status = "failed"
        elif today > end:
            status = "passed"
    elif kind == "custom":
        target = challenge.get("target_capital") or 0
        progress = min(100.0, (total_pnl / target * 100)) if target > 0 else 0
        if progress < 0:
            progress = 0
        detail = f"₹{total_pnl:,.2f} of ₹{target:,.2f} target · {trades_count} trades taken"
        if target > 0 and total_pnl >= target:
            status = "passed"
        elif today > end:
            status = "failed" if total_pnl < target else "passed"

    return {
        **{k: v for k, v in challenge.items() if k != "_id"},
        "status": status,
        "progress": round(progress, 1),
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "days_total": days_total,
        "trades_count": trades_count,
        "total_pnl": total_pnl,
        "detail": detail,
        "violations": violations,
    }


@api.post("/challenges/start")
async def start_challenge(inp: ChallengeStart, user: dict = Depends(get_current_user)):
    from datetime import date, timedelta
    ctype = inp.type
    today = _today_date()

    if ctype in CHALLENGE_PRESETS:
        preset = CHALLENGE_PRESETS[ctype]
        days = preset["days"]
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": ctype,
            "kind": preset["kind"],
            "title": preset["title"],
            "rule": preset["rule"],
            "days": days,
            "target_capital": preset.get("target_capital"),
            "rule_max_trades_per_day": preset.get("rule_max_trades_per_day"),
            "rule_max_risk_pct": preset.get("rule_max_risk_pct"),
            "stated_capital": inp.stated_capital or 0,
            "start_date": _iso_date(today),
            "end_date": _iso_date(today + timedelta(days=days - 1)),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    elif ctype == "custom":
        if not inp.custom_days or inp.custom_days < 1:
            raise HTTPException(status_code=400, detail="custom_days must be at least 1.")
        if not inp.custom_target or inp.custom_target <= 0:
            raise HTTPException(status_code=400, detail="custom_target must be greater than 0.")
        days = int(inp.custom_days)
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "custom",
            "kind": "custom",
            "title": inp.custom_title.strip() if inp.custom_title else f"Custom · {days}-Day Growth Challenge",
            "rule": f"Reach ₹{inp.custom_target:,.0f} net profit within {days} trading days.",
            "days": days,
            "target_capital": float(inp.custom_target),
            "stated_capital": inp.stated_capital or 0,
            "start_date": _iso_date(today),
            "end_date": _iso_date(today + timedelta(days=days - 1)),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        raise HTTPException(status_code=400, detail="Unknown challenge type.")

    await db.challenges.insert_one(doc)
    doc.pop("_id", None)
    # Return with evaluation
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=5000)
    return _eval_challenge(doc, trades)


@api.get("/challenges")
async def list_challenges(user: dict = Depends(get_current_user)):
    docs = await db.challenges.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=5000)
    return [_eval_challenge(c, trades) for c in docs]


@api.get("/challenges/active")
async def active_challenge(user: dict = Depends(get_current_user)):
    doc = await db.challenges.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc:
        return None
    trades = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=5000)
    evaluated = _eval_challenge(doc, trades)
    # Persist status transitions
    if evaluated["status"] != doc.get("status"):
        await db.challenges.update_one({"id": doc["id"]}, {"$set": {"status": evaluated["status"]}})
    return evaluated


@api.delete("/challenges/{challenge_id}")
async def cancel_challenge(challenge_id: str, user: dict = Depends(get_current_user)):
    res = await db.challenges.delete_one({"id": challenge_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return {"ok": True}


# =============================================
# Subscriptions (Payment placeholder)
# =============================================
PLAN_CATALOG = {
    "monthly": {"code": "monthly", "name": "Monthly Pro Pack", "amount": 99.0, "days": 30, "currency": "INR"},
    "yearly": {"code": "yearly", "name": "Yearly Elite Pack", "amount": 999.0, "days": 365, "currency": "INR"},
}
AFFILIATE_COMMISSION_PCT = 20.0


class CheckoutInput(BaseModel):
    plan: str  # "monthly" | "yearly"
    ref_code: Optional[str] = ""


class CompletePurchaseInput(BaseModel):
    subscription_id: str


async def _ensure_affiliate_code(user_id: str) -> str:
    import secrets
    u = await db.users.find_one({"id": user_id})
    if u and u.get("affiliate_code"):
        return u["affiliate_code"]
    for _ in range(6):
        code = secrets.token_urlsafe(5).replace("_", "").replace("-", "")[:8].upper()
        try:
            await db.users.update_one({"id": user_id}, {"$set": {"affiliate_code": code}})
            return code
        except Exception:
            continue
    # fallback deterministic
    code = user_id[:8].upper()
    await db.users.update_one({"id": user_id}, {"$set": {"affiliate_code": code}})
    return code


@api.get("/subscriptions/plans")
async def list_plans():
    return list(PLAN_CATALOG.values())


@api.get("/subscriptions/me")
async def my_subscription(user: dict = Depends(get_current_user)):
    sub = await db.subscriptions.find_one(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return sub


@api.post("/subscriptions/checkout")
async def create_checkout(inp: CheckoutInput, user: dict = Depends(get_current_user)):
    plan = PLAN_CATALOG.get(inp.plan)
    if not plan:
        raise HTTPException(status_code=400, detail="Unknown plan.")
    ref = (inp.ref_code or "").strip().upper() or None
    # ensure ref code exists in another user
    referrer_id = None
    if ref:
        referrer = await db.users.find_one({"affiliate_code": ref})
        if referrer and referrer["id"] != user["id"]:
            referrer_id = referrer["id"]
    sub_id = str(uuid.uuid4())
    doc = {
        "id": sub_id,
        "user_id": user["id"],
        "plan": plan["code"],
        "plan_name": plan["name"],
        "amount": plan["amount"],
        "currency": plan["currency"],
        "status": "pending",
        "ref_code": ref,
        "referrer_id": referrer_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "gateway": "placeholder",
    }
    await db.subscriptions.insert_one(doc)
    doc.pop("_id", None)
    return {
        **doc,
        "checkout_url": None,  # real gateway URL when integrated
        "message": "Payment gateway integration pending — complete the demo purchase to activate.",
    }


@api.post("/subscriptions/complete")
async def complete_subscription(inp: CompletePurchaseInput, user: dict = Depends(get_current_user)):
    """PLACEHOLDER endpoint that simulates a successful payment confirmation.
    Once real Razorpay/Stripe is wired, this becomes the webhook handler."""
    from datetime import date, timedelta
    sub = await db.subscriptions.find_one({"id": inp.subscription_id, "user_id": user["id"]})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.get("status") == "active":
        return {"ok": True, "already_active": True}

    plan = PLAN_CATALOG.get(sub["plan"])
    today = _today_date()
    expires = today + timedelta(days=plan["days"])
    await db.subscriptions.update_one(
        {"id": sub["id"]},
        {"$set": {
            "status": "active",
            "activated_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": _iso_date(expires),
        }}
    )

    # Credit affiliate if applicable
    if sub.get("referrer_id"):
        commission = round(sub["amount"] * AFFILIATE_COMMISSION_PCT / 100, 2)
        earning = {
            "id": str(uuid.uuid4()),
            "affiliate_user_id": sub["referrer_id"],
            "referred_user_id": user["id"],
            "subscription_id": sub["id"],
            "plan": sub["plan"],
            "amount": commission,
            "currency": sub["currency"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.affiliate_earnings.insert_one(earning)

    return {"ok": True, "expires_at": _iso_date(expires)}


# =============================================
# Affiliate Program
# =============================================
class AffiliateClickInput(BaseModel):
    code: str


@api.post("/affiliate/click")
async def log_affiliate_click(inp: AffiliateClickInput, request: Request):
    code = (inp.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="code required")
    referrer = await db.users.find_one({"affiliate_code": code})
    if not referrer:
        return {"ok": False, "reason": "invalid_code"}
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    await db.affiliate_clicks.insert_one({
        "id": str(uuid.uuid4()),
        "code": code,
        "affiliate_user_id": referrer["id"],
        "ip": ip[:64],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api.get("/affiliate/me")
async def my_affiliate(user: dict = Depends(get_current_user), request: Request = None):
    code = await _ensure_affiliate_code(user["id"])
    clicks = await db.affiliate_clicks.count_documents({"code": code})
    earnings = await db.affiliate_earnings.find({"affiliate_user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    pending = sum(e["amount"] for e in earnings if e["status"] == "pending")
    paid = sum(e["amount"] for e in earnings if e["status"] == "paid")
    total = pending + paid
    referrals = len({e["referred_user_id"] for e in earnings})
    return {
        "code": code,
        "commission_pct": AFFILIATE_COMMISSION_PCT,
        "clicks": clicks,
        "total_referrals": referrals,
        "pending_payouts": round(pending, 2),
        "paid_out": round(paid, 2),
        "total_earnings": round(total, 2),
        "earnings": earnings,
    }



# -----------------------------
# App startup
# -----------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("affiliate_code", unique=True, sparse=True)
    await db.trades.create_index([("user_id", 1), ("exit_time", -1)])
    await db.journal.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.challenges.create_index([("user_id", 1), ("status", 1)])
    await db.subscriptions.create_index([("user_id", 1), ("status", 1)])
    await db.affiliate_earnings.create_index([("affiliate_user_id", 1)])
    await db.affiliate_clicks.create_index("code")
    logger.info("Trading journal ready.")

@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

_origins = os.environ.get("CORS_ORIGINS", "").split(",")
_origins = [o.strip() for o in _origins if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
