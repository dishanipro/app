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
    rating: Optional[int] = 0  # 0-5

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
    rating: Optional[int] = None

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
# App startup
# -----------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.trades.create_index([("user_id", 1), ("exit_time", -1)])
    await db.journal.create_index([("user_id", 1), ("date", 1)], unique=True)
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
