# PRD — TAPE.JOURNAL (Trading Journal + TradeMind AI Mentor)

## Original problem statement
"Build me a app for trading journal for every market."

## User choices (Feb 2026)
- Markets: All (Stocks, Forex, Crypto, Futures, Options)
- Auth: JWT email/password
- AI: Claude Sonnet 4.5 via Emergent Universal Key
- Features: manual trade entry + chart screenshot uploads + analytics dashboard + calendar view + daily journal
- Design: Bloomberg-terminal dark professional (JetBrains Mono for numerics, IBM Plex Sans for headings)

## User personas
1. Multi-market retail trader — needs one journal across equities/futures/options/crypto/FX.
2. Discretionary swing/day trader — wants pattern review and psychological coaching.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) + Motor + Mongo, JWT cookie + Bearer fallback.
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + Recharts + Sonner.
- AI: `emergentintegrations.LlmChat` with `anthropic/claude-sonnet-4-5-20250929`.
- DB: `trading_journal_db` (users, trades, journal, ai_insights, mentor_messages, mentor_state).

## Implemented (Feb 10, 2026)
- **Auth** — register/login/logout/me with bcrypt + JWT (cookie + bearer fallback).
- **Trades CRUD** — auto P&L calc (long/short + fees), tags, strategy, notes, base64 chart screenshot.
- **Analytics** — total P&L, win rate, profit factor, avg win/loss, best/worst, by_market, by_strategy, equity curve.
- **Calendar** — month grid with per-day P&L tinted cells.
- **Journal** — one entry per date (upsert), mood, history list.
- **AI Insights** — Claude Sonnet 4.5 structured performance review.
- **TradeMind AI Mentor** — 5-mode chatbot (position sizing, paper trading, voice review, screen review, weekly badges), tri-language (English/Bangla/Hindi), virtual balance state, safety guardrails (no tips/advice), Markdown-rendered chat.
- **Design system** — Bloomberg terminal dark: `#0A0A0A` base, cyan/amber/orange accents, sharp edges, JetBrains Mono for numerics.

## Test credentials
See `/app/memory/test_credentials.md`. Demo user: `demo@tape.io` / `demo123`.

## Backlog (P1/P2)
- P1: Streaming SSE for TradeMind chat (token-by-token).
- P1: CSV import for existing broker trade histories.
- P1: Auto-linking of trades to daily journal entries.
- P2: Automatic paper-trade ledger updates from mentor state.
- P2: Broker API integrations (Interactive Brokers, Zerodha, Binance) for live sync.
- P2: Multi-account / portfolio tracking.
- P2: R-multiple analysis + max drawdown chart.
