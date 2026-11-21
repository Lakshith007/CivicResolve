# CivicResolve — AI-Powered Civic Issue Reporting & Management Platform

Built for **PromptWars 2026**, **CivicResolve** transforms how citizens report local infrastructure problems and how municipal authorities triage, route, and resolve them. Powered by **Google Gemini AI** with a deterministic smart-civic fallback engine, CivicResolve classifies complaints automatically, evaluates public-safety urgency, recommends the exact municipal department, detects nearby duplicates, and tracks every ticket transparently from **Reported → In Progress → Resolved**.

---

## Key Features

- **Citizen Issue Reporting Portal**
  - Submit complaints with title, description, street/landmark, municipal ward, GPS coordinates (auto-detect or manual), optional category override, and photo attachment.
  - **1-Click Demo Presets** to test realistic emergency and routine civic scenarios immediately.
  - **Live Gemini AI Triage Preview** before submission showing detected category, priority badge, public urgency score (`0–100`), recommended department, target SLA, impact assessment, and suggested crew action.
  - **Duplicate Guard**: Automatically detects active nearby complaints in the same category and lets citizens boost existing tickets (`+1`) instead of filing duplicates.
- **Public Transparency & Tracking Dashboard**
  - Live KPI strip (Total Complaints, In Progress, Resolved, Average AI Urgency).
  - **Interactive City Ward Hotspot Map**: Visual coordinate map plotting color-coded pins by priority; click any pin to inspect ticket details.
  - Search by Ticket ID (`CR-2026-...`), keyword, location, or department, plus Status/Category/Priority filters.
  - Expandable **Resolution Timeline Stepper** (`Reported` → `In Progress` → `Resolved`) with timestamps and official authority notes.
  - Community upvoting (`"I'm affected too"`).
- **Admin Command Center**
  - **Priority Triage Queue** sorted automatically by AI urgency score (`Critical` first).
  - **Department Workload & SLA Analytics** across municipal divisions.
  - Inline quick actions (`Dispatch Crew`, `Mark Resolved`) and full triage modal to override department/priority and publish official resolution notes.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling & Icons**: Tailwind CSS, `lucide-react`
- **AI Integration**: Google Gemini REST API (`gemini-2.0-flash` / `gemini-1.5-flash`) with multimodal image support + deterministic heuristic fallback (`src/lib/aiClassifier.ts`)
- **Data Persistence**: File-backed JSON store (`data/issues.json`) with automatic in-memory fallback and 6 seeded civic records
- **Testing**: Vitest (`src/__tests__/civic.test.ts`)

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and add your Google Gemini API key:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> Note: If `GEMINI_API_KEY` is omitted or offline, CivicResolve automatically engages its built-in smart civic triage classifier (`smart-civic-fallback`) so core functionality always works.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Tests & Production Build

```bash
npm test
npm run build
npm start
```

---

## Project Structure

```text
civic-resolve/
├── .env.example
├── package.json
├── vitest.config.ts
└── src/
    ├── __tests__/
    │   └── civic.test.ts           # Unit & integration tests
    ├── app/
    │   ├── api/
    │   │   ├── analyze/route.ts    # POST: Gemini AI triage & duplicate check
    │   │   └── issues/
    │   │       ├── route.ts        # GET/POST: list & create civic tickets
    │   │       └── [id]/route.ts   # GET/PATCH: fetch, upvote, or update status
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx                # Unified Citizen, Tracking & Admin UI
    ├── components/
    │   ├── AdminDashboard.tsx
    │   ├── CivicBadges.tsx
    │   ├── ReportIssueForm.tsx
    │   └── TrackingDashboard.tsx
    ├── lib/
    │   ├── aiClassifier.ts         # Gemini API + deterministic heuristic + duplicate detector
    │   ├── issueStore.ts           # JSON/in-memory store with 6 seeded civic issues
    │   └── validation.ts           # Input sanitization & strict payload validation
    └── types/
        └── civic.ts                # Shared strict TypeScript types & municipal constants
```

---

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/analyze` | Analyzes title, description, location, and optional base64 image with Gemini AI and returns classification + potential active duplicates. |
| `GET` | `/api/issues` | Returns filtered civic issues (`status`, `category`, `priority`, `department`, `search`) and live dashboard stats. |
| `POST` | `/api/issues` | Validates & sanitizes submission, runs AI triage if not already attached, persists ticket, and returns `201`. |
| `GET` | `/api/issues/[id]` | Retrieves a single ticket by ID (e.g. `CR-2026-1001`). |
| `PATCH` | `/api/issues/[id]` | Upvotes a ticket (`{ "action": "upvote" }`) or updates status, department, priority, and resolution notes. |
