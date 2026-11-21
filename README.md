# CivicResolve — AI-Powered Municipal Issue Reporting & Operations Platform

Built for **PromptWars 2026**, **CivicResolve** connects citizens, dispatched municipal field crews, and city administrators in one end-to-end civic resolution workflow tailored for **Coimbatore**. Powered by **Google Gemini AI**, **Google Cloud Firebase**, and **Google Maps Platform**, CivicResolve triages complaints automatically, routes work orders to municipal divisions, verifies field completion with **SHA-256 photo plagiarism detection**, and records every decision in an **immutable audit trail**.

* **Live Deployment:** https://civic-resolve-three.vercel.app
* **GitHub Repository:** https://github.com/Lakshith007/civic-resolve

---

## Three-Portal Role Architecture

### 1. Citizen Portal (`/`) — Zero Login Required
* **Role-Selection Landing:** Clean separation between Citizen Reporting/Tracking, Field Crew Operations, and Government Official Command Center.
* **Smart Location & Map Picker:** Citizens do not need to guess administrative ward numbers — choose **Detect My GPS** (high-accuracy geolocation + OpenStreetMap Nominatim street reverse-geocoding) or **Pick on Map** (interactive draggable Google Maps pin with live address lookup).
* **1-Click Coimbatore Demo Scenarios:** Pre-filled emergency and routine civic presets across Peelamedu, Coimbatore Medical College GH, Gandhipuram, and Ukkadam Market.
* **Client-Side Photo Compression:** Automatically resizes & compresses smartphone photos (`<= 10 MB` input → `<= 380 KB` JPEG) so real camera images upload quickly and fit cleanly within Firestore limits.
* **Live Gemini AI Triage Preview & Duplicate Guard:** Shows AI category, priority (`Critical`/`High`/`Medium`/`Low`), urgency score (`1–100`), department routing, target SLA, and active nearby duplicate tickets before submission.
* **Public Tracking Dashboard (`Map & Track`):** Live KPIs (*Active Open Issues*, *In Progress*, *Resolved*, *Avg AI Urgency*), interactive Coimbatore **Google Map** + **Coordinate Spatial Grid** (automatically hiding resolved tickets from active pins), community upvoting, and a 3-stage resolution timeline stepper.

### 2. Field Crew / Worker Portal (`/worker`) — Department-Scoped `WORKER` RBAC
* **Protected Access Gate:** Unauthenticated visitors see a dedicated Crew Sign-In Gate; authorized crews receive an HMAC-SHA256 signed `HttpOnly` session cookie scoped to their municipal division (`WORKER` accounts are blocked from `/admin` and cannot approve their own work).
* **Dispatched Work Queue & Proof Upload:** Teams inspect active `In Progress` jobs and submit a completed repair photo + work notes via `POST /api/worker/submit-proof`.
* **Cryptographic Photo Plagiarism Detection (`SHA-256`):** Blocks crews from re-uploading the citizen's original *"Before"* photo or reusing any completion photo previously submitted on another complaint, logging blocked attempts as `WORKER_PLAGIARISM_BLOCKED`.
* **Supervisor Rework Loop:** Displays any supervisor rejection feedback prominently so crews can re-remediate and upload updated proof.

### 3. Municipal Operations Command Center (`/admin`) — 2-Step Verification (`ADMIN` RBAC)
* **Municipal 2-Step Verification (2FA):** Credential verification triggers a single-use, HMAC-signed 6-digit OTP challenge (5-minute validity window, 5-attempt lockout, with an in-modal simulated official dispatch preview for instant demo evaluation).
* **Six Dedicated Operations Tabs:** *Overview*, *Complaint Management*, *Department Management*, *Geographic Insights*, *Resolution Reports*, and *Audit Logs*.
* **Live Municipal KPIs:** Real-time *Active Complaints* (with total logged), *Awaiting Dispatch*, *In Progress*, *Resolved*, *Critical Active*, and *Avg Resolution Time*.
* **Strict Crew-Proof Verification Gate:** Administrators **cannot** mark tickets `Resolved` directly — tickets transition to `Resolved` only after reviewing side-by-side **Before vs. After** photos in the Verification Panel and clicking **Verify Photo & Mark Completed** (or **Reject & Request Rework** with mandatory feedback).
* **Citywide Hotspot Map:** Filterable by Department, Ward, Priority, Timeframe (`24h`/`7d`/`30d`), and optional **Show Resolved** toggle, featuring Haversine proximity clustering (`<= 1.5 km`) and repeated ward-category alerts.
* **Immutable Audit Trail:** Append-only logging of `ADMIN_2FA_LOGIN`, `ADMIN_LOGOUT`, `ADMIN_TRIAGE_UPDATE`, `ADMIN_TRIAGE_AND_PRIORITY_OVERRIDE`, `WORKER_LOGIN`, `WORKER_PROOF_SUBMITTED`, `WORKER_PLAGIARISM_BLOCKED`, `ADMIN_VERIFY_AND_RESOLVE`, and `ADMIN_REJECT_FIELD_WORK`.

---

## Demo Accounts (Pre-Configured)

| Role | Identifier / Email | Password / Passcode | Scope |
| --- | --- | --- | --- |
| **Administrator (2FA)** | `admin@civicresolve.gov` | `CivicAdmin@2026!Secure` | Full Command Center (`/admin`) + 6-digit OTP auto-fill |
| **Field Lead** | `CREW-LEAD` | `Crew@Lead!2026` | All Municipal Divisions (`/worker`) |
| **Electrical Crew** | `CREW-E4` | `Crew@E4!2026` | Electrical & Streetlighting Division only (`/worker`) |
| **Hydraulic Crew** | `CREW-H2` | `Crew@H2!2026` | Water Works & Hydraulic Engineering only (`/worker`) |

---

## Tech Stack

* **Framework:** Next.js 14 (App Router, TypeScript), React 18
* **Styling & Icons:** Tailwind CSS, `lucide-react`
* **AI Engine:** Google Gemini REST API (`gemini-flash-lite-latest` primary, `gemini-3-flash-preview` fallback) with multimodal inline image inspection + deterministic `smart-civic-fallback` engine (`src/lib/aiClassifier.ts`)
* **Database & Cloud:** Google Cloud Firebase (`civic-sence-4ef70`) — two-way Cloud Firestore synchronization for `civic_issues` and `civic_audit_logs` (`src/lib/firebase.ts`) + browser Analytics + local JSON/memory fallback
* **Maps & Geocoding:** Google Maps Platform (Maps JavaScript API) + OpenStreetMap Nominatim reverse-geocoding
* **Testing:** Vitest (`18/18` passing tests across unit, RBAC/2FA/plagiarism security, and full E2E workflow)

---

## Getting Started Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and supply your keys:
```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API key (falls back to `smart-civic-fallback` if omitted) |
| `SESSION_SECRET` | 32+ char hex HMAC secret for signing session & 2FA tokens |
| `ADMIN_BOOTSTRAP_EMAIL` / `PASSWORD` / `NAME` | Server-bootstrapped municipal administrator account |
| `NEXT_PUBLIC_FIREBASE_*` | Google Firebase web SDK credentials (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`, `MEASUREMENT_ID`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps Platform Maps JavaScript API key |

### 3. Run Development Server, Tests & Build
```bash
npm run dev      # http://localhost:3000
npm test         # Runs all 18 Vitest unit, RBAC/security & E2E tests
npm run build    # Production Next.js build
npm start        # Serve production build
```

---

## Project Structure

```text
civic-resolve/
├── .env.example
├── firebase.json & firestore.rules
├── package.json
├── vitest.config.ts
└── src/
    ├── __tests__/
    │   ├── civic.test.ts                   # AI fallback classifier, validation & Coimbatore store tests
    │   ├── security.rbac.test.ts           # RBAC, 2FA OTP, Worker auth & SHA-256 plagiarism tests
    │   └── workflow.e2e.test.ts            # Full Citizen -> AI -> Crew Proof -> Admin Approve E2E test
    ├── app/
    │   ├── api/
    │   │   ├── admin/analytics/route.ts    # GET: Admin KPIs & audit logs
    │   │   ├── admin/complaints/route.ts   # GET: Full unstripped complaint queue
    │   │   ├── analyze/route.ts            # POST: Gemini AI triage & Firestore-hydrated duplicate check
    │   │   ├── auth/
    │   │   │   ├── login/route.ts          # POST: Admin 2-Step Verification (credentials + 2FA OTP)
    │   │   │   ├── logout/route.ts         # POST: Session revocation + audit entry
    │   │   │   ├── me/route.ts             # GET/PATCH: Session introspection
    │   │   │   ├── register/route.ts       # POST: Locked citizen registration endpoint
    │   │   │   └── worker-login/route.ts   # POST: Crew Unit ID + passcode authentication
    │   │   ├── issues/route.ts             # GET/POST: Public listing (PII-stripped) & creation
    │   │   ├── issues/[id]/route.ts        # GET/PATCH: Detail view, upvoting, Admin triage & photo approval
    │   │   └── worker/submit-proof/route.ts# POST: Worker completion proof + SHA-256 plagiarism block
    │   ├── admin/page.tsx & dashboard/     # Server-guarded Admin Command Center
    │   ├── worker/page.tsx                 # Server-guarded Field Crew Portal
    │   ├── icon.svg, layout.tsx & page.tsx # App icon, metadata & 3-role landing + Citizen Portal
    ├── components/
    │   ├── AdminAccessGate.tsx             # Admin unauthenticated screen with 2FA modal trigger
    │   ├── AdminAuthModal.tsx              # 2-Step Admin credential + 6-digit OTP modal
    │   ├── AdminCommandClient.tsx          # Admin header, notifications, profile menu & 6-tab router
    │   ├── AdminDashboard.tsx              # KPIs, Critical Alerts, Before/After Review, Workloads, Queue & Audit
    │   ├── AdminHotspotMap.tsx             # Filtered hotspot map with Haversine clustering & Show Resolved toggle
    │   ├── CivicBadges.tsx                 # Priority/Status/Engine badges & Resolution Timeline stepper
    │   ├── CivicGoogleMap.tsx              # Coimbatore Google Maps renderer (auto-hides resolved pins)
    │   ├── LocationPickerMap.tsx           # Interactive click/drag map pin selector
    │   ├── ReportIssueForm.tsx             # Citizen form, GPS + reverse-geocoding, Pick on Map & AI Preview
    │   ├── TrackingDashboard.tsx           # Citizen tracking board, Coimbatore Spatial Grid & hotspot map
    │   ├── WorkerAccessGate.tsx            # Field Crew Unit ID sign-in screen
    │   └── WorkerPortalClient.tsx          # Division-scoped dispatched jobs & completion proof uploader
    ├── lib/
    │   ├── aiClassifier.ts                 # Gemini multimodal client + fallback + duplicate detector
    │   ├── auditStore.ts                   # Immutable audit log + Firestore sync
    │   ├── authGuards.ts                   # requireAuth, requireCitizen, requireWorker, requireAdmin, CSRF & RL
    │   ├── authStore.ts                    # scrypt hashing, HMAC sessions, 2FA tokens & Crew accounts
    │   ├── firebase.ts                     # Firebase initialization & two-way Firestore sync
    │   ├── imageCompress.ts                # Client canvas photo resizing & JPEG compression
    │   ├── issueStore.ts                   # Coimbatore seed store, proof/approval & SHA-256 duplicate photo check
    │   └── validation.ts                   # Sanitization & PNG/JPEG/WebP magic-byte enforcement
    └── types/
        └── civic.ts                        # Shared TypeScript contracts & Coimbatore wards/departments
```
