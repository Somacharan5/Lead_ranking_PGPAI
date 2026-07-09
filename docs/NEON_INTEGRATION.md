# Neon DB — Integration & Data Guide (AIAS Dashboard)

**Purpose of this doc:** everything another project (your lead-gen automation) needs to
write Lead Dump, App Start Dump and Callyzer calls **directly into Neon Postgres**, so
Neon becomes the system of record and Google Sheets can be retired.

**Audience:** whoever builds the "push to Neon every 2 hours" automation, and anyone
who later makes the dashboard read from the DB instead of Sheets.

---

## 0. TL;DR

- Neon is a serverless **Postgres** DB. Any Postgres client (Node, Python, Go, …) can talk to it with a connection string.
- There are **three data sources → five tables** you care about:
  | Source | Static table (identity, write-once) | History table (daily state, upserted) |
  |---|---|---|
  | **Lead Dump** | `lead_static` (PK `email`) | `lead_history` (unique `snapshot_date,email`) |
  | **App Start Dump** | `app_start_static` (PK `application_number`) | `app_start_history` (unique `snapshot_date,application_number`) |
  | **Callyzer calls** | — | `call_history` (PK `uniqueid`) |
- **The "last dump of the day = that day's snapshot" behavior is automatic.** History rows are keyed by `(snapshot_date, <id>)` and you **upsert (INSERT … ON CONFLICT DO UPDATE)**. Every 2-hour run on the same calendar day overwrites the same row, so the final run before midnight IST leaves the day's snapshot. No extra logic needed.
- Do **not** write to `sheet_cache`, `ai_cache`, `paidapp_classification` — those are managed by the app.

---

## 1. Connecting from another project

### 1.1 Connection string
Get it from the **Neon dashboard → Project → Connection Details → Pooled connection**. It looks like:

```
postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
```

- Use the **pooled** host (`...-pooler...`) for app/automation traffic (handles many short connections).
- `sslmode=require` is mandatory.
- The dashboard already stores it as `DATABASE_URL` in `.env` (never commit the real one — it's gitignored). Reuse the same DB from the new project, or create a dedicated Neon role for it.

### 1.2 Drivers / examples

**Node (serverless HTTP driver — best for Vercel/Lambda):**
```js
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
const rows = await sql`SELECT count(*) FROM lead_history`
```

**Node (classic pool — best for a long-running worker):**
```js
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const { rows } = await pool.query('SELECT count(*) FROM lead_history')
```

**Python (psycopg2/psycopg3):**
```python
import os, psycopg2
conn = psycopg2.connect(os.environ["DATABASE_URL"])   # sslmode=require already in the URL
with conn, conn.cursor() as cur:
    cur.execute("SELECT count(*) FROM lead_history")
    print(cur.fetchone())
```

Any tool that speaks Postgres works: `psql`, DBeaver, TablePlus, Prisma, SQLAlchemy, etc.

---

## 2. Mental model — static vs history, and the snapshot semantics

Each entity (a lead, an application) is split into two tables:

- **Static** = the parts that don't change (identity + first-touch attribution): name, email, phone, source/medium/campaign, registration date, program, city. **Write once** — `INSERT … ON CONFLICT DO NOTHING`. Keyed by a natural id (`email` for leads, `application_number` for apps).
- **History** = the parts that change over time (stage, sub-stage, counsellor, scores, priority, activity dates, notes). **One row per entity per day.** Keyed by `(snapshot_date, <id>)`, written with `INSERT … ON CONFLICT DO UPDATE`.

### 2.1 What `snapshot_date` means
`snapshot_date` is a **`date`** column = the **IST calendar day** the row represents. Compute it as:

```js
// IST is UTC+5:30. "Today in IST" as YYYY-MM-DD:
const istDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
```
```python
from datetime import datetime, timezone, timedelta
ist_date = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")
```

### 2.2 Why "every 2 hours, last run = the snapshot" just works
Because the history unique key is `(snapshot_date, <id>)` and you upsert with **DO UPDATE**:

- 10:00 run → inserts today's row for each lead with the 10:00 state.
- 12:00 run → the row for `(today, email)` already exists → **updates** it to the 12:00 state.
- … 22:00, 23:50 → keep updating the *same* row.
- At midnight IST the date rolls over → the next run writes a **new** `(tomorrow, email)` row, and today's row is frozen exactly as the last run left it = **that day's snapshot.**

You never delete or special-case anything. Just upsert every run.

> ⚠️ **Send a FULL dump each run.** Upsert only *adds/updates* rows that are present. If a lead disappears from your dump mid-day, its earlier row for today is **not** removed (it keeps the last state it had). That's usually fine for leads, but if you need "removed today" semantics you must handle deletes explicitly.

### 2.3 `static` is write-once, `history` is idempotent
- Re-running the same day is safe: `static` conflicts DO NOTHING, `history` conflicts DO UPDATE to the newest values.
- Backfilling a past day is possible: just set `snapshot_date` to that day. (The dashboard's daily cron currently does this from Sheets; once your automation writes directly, you can disable that cron — see §7.)

---

## 3. Table reference (live schema)

Row counts are indicative (as of writing). All text columns are Postgres `text`.

### 3.1 `lead_static` — lead identity (PK `email`)
`email` (PK), `mobile`, `name`, `source`, `medium`, `campaign`, `primary_source`, `primary_medium`, `primary_campaign`, `city`, `country_code`, `lead_type`, `lead_origin`, `program`, `registered_on`, `extra_data` (jsonb).
Index: `email`.

### 3.2 `lead_history` — lead daily state (unique `snapshot_date,email`)
`id` (bigserial PK), `snapshot_date` (date), `email`, `lead_score`, `user_type`, `mobile_verified`, `email_verified`, `payment_status`, `updated_at`, `counsellor`, `lead_stage`, `lead_sub_stage`, `app_form_start_date`, `payment_initiated_date`, `payment_last_initiated_date`, `counsellor_first_activity`, `counsellor_last_activity`, `app_fee_paid_on`, `last_stage_updated`, `app_last_activity_date`, `notes`, `tags`, `source_score`, `recency_score`, `stage_score`, `organic_bonus`, `ig_bonus`, **`total_lead_score`** (sort key), **`priority`** (Priority 5 = excluded).
Indexes: unique `(snapshot_date,email)`, `email`, `(snapshot_date,counsellor)`, `lead_stage`.

### 3.3 `app_start_static` — application identity (PK `application_number`)
`application_number` (PK), `email`, `mobile`, `name`, `source`, `medium`, `campaign`, `primary_source`, `primary_medium`, `primary_campaign`, `city`, `state`, `program`, `registered_on`, `extra_data` (jsonb).
Index: `email`.

### 3.4 `app_start_history` — application daily state (unique `snapshot_date,application_number`)
`id` (bigserial PK), `snapshot_date` (date), `application_number`, `application_status`, `payment_status`, `payment_method`, `payment_initiated`, `coupon_code`, `form_completion_date`, `app_form_initiated`, `app_form_submitted`, `last_interacted_section`, `updated_date`, `lead_score`, `counsellor`, `counsellor_email`, `lead_stage`, `application_stage`, `application_sub_stage`, `previous_lead_stage`, `reassigned_by`, `reassigned_on`, `is_email_verified`, `is_mobile_verified`, `last_active_at`, `app_form_start_date`, `payment_initiated_date`, `payment_last_initiated_date`, `counsellor_first_activity`, `counsellor_last_activity`, `app_fee_paid_on`, `last_stage_updated`, `app_last_activity_date`, `total_forms_initiated`, `notes`, `video_link`, `application_tags`, `tags`, `mu_baat_link`, `mu_baat_result`, `mu_baat_report`, **`total_score_formula`** (sort key; sheet header "Lead Score"), **`priority_app_start`** (Priority 5 = excluded).
Indexes: unique `(snapshot_date,application_number)`, `application_number`, `(snapshot_date,counsellor)`, `application_stage`, `payment_status`.

### 3.5 `call_history` — Callyzer calls (PK `uniqueid`)
`uniqueid` (PK), `call_date` (date), `sr_no`, `emp_code`, `emp_tags`, `employee_name`, `employee_number`, `to_name`, `country_code`, `to_number`, `call_type`, `call_method`, `call_mode`, `duration`, `call_time`, `notes`, `audio_url`, `call_transcript`, `stage`, `app_form_completed_pct`, `payment_initiated`, `app_form_initiated`, `source`, `lead_app_start_stage`, `call_duration_mins` (double), `captured_at` (default now()).
Index: `call_date`.

### 3.6 App-managed tables — **do not write from automation**
- `sheet_cache` — 120-min cache of sheet payloads + cached prev-stage maps (`prevstage:<date>`).
- `ai_cache` — cached Claude insights.
- `paidapp_classification` — admin classifications of paid apps.

---

## 4. Where to dump each source (exact column mapping)

The columns below are what the **dashboard's business logic reads**. You're writing directly
from your source system, so populate these DB columns from your own fields — the "Sheet col"
column is just the current reference for what each value is. `idx` = 0-based position in the
current sheet layout (Lead Dump `A:CK`, App Start `A:EY`, Calls `A:Y`).

### 4.1 Lead Dump → `lead_static` + `lead_history`

**→ `lead_static`** (write-once)
| DB column | Sheet col (idx) | Meaning |
|---|---|---|
| `email` (PK) | B (1) | Email — the join/identity key |
| `mobile` | C (2) | Phone |
| `name` | A (0) | Name |
| `source` | D (3) | Source |
| `medium` | E (4) | Medium |
| `campaign` | F (5) | Campaign |
| `primary_source` | G (6) | **Primary Source** — used for junk-source & pmax rules |
| `primary_medium` | H (7) | **Primary Medium** — used as the blackout-campaign key |
| `primary_campaign` | I (8) | Primary Campaign |
| `city` | AC (28) | City |
| `country_code` | Y (24) | Country code |
| `lead_type` | V (21) | Lead type |
| `lead_origin` | W (22) | Lead origin |
| `program` | BF (57) | Program |
| `registered_on` | BA (52) | Registered On (date/serial) |
| `extra_data` (jsonb) | J–U, X, Z, AA, AD… | secondary/tertiary source-medium-campaign, UTM fields, alternate email/mobile, school, source_url |

**→ `lead_history`** (upsert daily)
| DB column | Sheet col (idx) | Meaning |
|---|---|---|
| `snapshot_date` | — | IST date (see §2.1) |
| `email` | B (1) | join key |
| `user_type` | AG (32) | `lead` / `applicant` — app keeps only `lead` |
| `payment_status` | AJ (35) | `Completed` = excluded |
| `counsellor` | BC (54) | Assigned counsellor (routing key) |
| `lead_stage` | BD (55) | Untouched / Counseled / No Contact Established / Not interested / … |
| `lead_sub_stage` | BE (56) | Hot / Warm / Cold / Call later / DNP / … |
| `counsellor_last_activity` | BK (62) | Last activity date |
| `notes` | BP (67) | Counsellor notes |
| `total_lead_score` | **CJ (87)** | **Sort key** |
| `priority` | **CK (88)** | `Priority 5` = excluded |
| `lead_score`, `source_score`, `recency_score`, `stage_score`, `organic_bonus`, `ig_bonus` | AF, CE, CF, CG, CH, CI | score components (audit/debug) |
| `updated_at`, `mobile_verified`, `email_verified`, activity/payment dates, `tags` | BB, AH, AI, BG–BO, BQ | supporting fields |

### 4.2 App Start Dump → `app_start_static` + `app_start_history`

**→ `app_start_static`** (write-once)
| DB column | Sheet col (idx) | Meaning |
|---|---|---|
| `application_number` (PK) | A (0) | Identity key |
| `email` | N (13) | Email |
| `mobile` | O (14) | Phone |
| `name` | M (12) | Name |
| `source` / `medium` / `campaign` | S/T/U (18/19/20) | attribution |
| `primary_source` / `primary_medium` / `primary_campaign` | V/W/X (21/22/23) | `primary_medium` = blackout key |
| `city` / `state` | BZ/BY (77/76) | location |
| `program` | AP (41) | Program |
| `registered_on` | Q (16) | Registered On |
| `extra_data` (jsonb) | P, Y, Z, AE, AF, AG, AQ | country_code, secondary_*, source_url, lead_origin, lead_type, organization |

**→ `app_start_history`** (upsert daily)
| DB column | Sheet col (idx) | Meaning |
|---|---|---|
| `snapshot_date` | — | IST date |
| `application_number` | A (0) | join key |
| `application_status` | B (1) | **form-completion %** (0/30/…/100) — pmax gate |
| `payment_status` | C (2) | `Completed`/`completed` = excluded |
| `counsellor` | AR (43) | routing key |
| `lead_stage` | AT (45) | e.g. Counseled / Paid |
| `application_stage` | AU (46) | Untouched / Counseled / No Contact Established |
| `application_sub_stage` | AV (47) | Hot / Warm / Cold / Call later / DNP … |
| `counsellor_last_activity` | BG (58) | Last activity |
| `notes` | BM (64) | Notes |
| `total_score_formula` | **EX (153)** | **Sort key** (sheet header "Lead Score") |
| `priority_app_start` | **EY (154)** | `Priority 5` = excluded |
| everything else (payment/verify/reassign/mu-baat/…) | see §3.4 | supporting fields |

### 4.3 Callyzer calls → `call_history`
Dedup on **`uniqueid`** (`INSERT … ON CONFLICT (uniqueid) DO NOTHING` — calls are immutable).

| DB column | idx | | DB column | idx |
|---|---|---|---|---|
| `sr_no` | 0 | | `notes` | 14 |
| `emp_code` | 1 | | `uniqueid` (PK) | 15 |
| `emp_tags` | 2 | | `audio_url` | 16 |
| `employee_name` | 3 | | `call_transcript` | 17 |
| `employee_number` | 4 | | `stage` | 18 |
| `to_name` | 5 | | `app_form_completed_pct` | 19 |
| `country_code` | 6 | | `payment_initiated` | 20 |
| `to_number` | 7 | | `app_form_initiated` | 21 |
| `call_type` | 8 | | `source` | 22 |
| `call_method` | 9 | | `lead_app_start_stage` | 23 |
| `call_mode` | 10 | | `call_duration_mins` (float) | 24 |
| `duration` | 11 | | | |
| `call_date` (date) | 12 | | | |
| `call_time` | 13 | | | |

`call_date` should be a real `date` (`YYYY-MM-DD`). If your source gives an Excel serial, convert: `new Date((serial - 25569) * 86400000)`.

---

## 5. Upsert recipes

### 5.1 SQL shapes
```sql
-- lead identity (write once)
INSERT INTO lead_static (email, mobile, name, primary_source, primary_medium, registered_on /*, … */)
VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (email) DO NOTHING;

-- lead daily state (last run of the day wins)
INSERT INTO lead_history (snapshot_date, email, user_type, payment_status, counsellor,
                          lead_stage, lead_sub_stage, counsellor_last_activity, notes,
                          total_lead_score, priority /*, … */)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
ON CONFLICT (snapshot_date, email)
DO UPDATE SET user_type=EXCLUDED.user_type, payment_status=EXCLUDED.payment_status,
              counsellor=EXCLUDED.counsellor, lead_stage=EXCLUDED.lead_stage,
              lead_sub_stage=EXCLUDED.lead_sub_stage,
              counsellor_last_activity=EXCLUDED.counsellor_last_activity,
              notes=EXCLUDED.notes, total_lead_score=EXCLUDED.total_lead_score,
              priority=EXCLUDED.priority /*, … every non-key column … */;

-- app start: same pattern, ON CONFLICT (snapshot_date, application_number)
-- calls: ON CONFLICT (uniqueid) DO NOTHING
```

### 5.2 Batch inserts (do NOT run one INSERT per row)
Build multi-row `VALUES` in chunks of ~500 rows. Node example (mirrors the app's helper):
```js
async function upsert(table, rows, conflictCols, { doNothing = false } = {}) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const conflict = conflictCols.join(', ')
  const setList = cols.filter(c => !conflictCols.includes(c))
                      .map(c => `"${c}"=EXCLUDED."${c}"`).join(', ')
  const onConflict = doNothing
    ? `ON CONFLICT (${conflict}) DO NOTHING`
    : `ON CONFLICT (${conflict}) DO UPDATE SET ${setList}`
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const params = []
    const values = chunk.map(r => `(${cols.map(c => {
      let v = r[c]; if (v && typeof v === 'object') v = JSON.stringify(v)  // jsonb
      params.push(v === undefined ? null : v); return `$${params.length}`
    }).join(',')})`).join(',')
    await sql(`INSERT INTO ${table} (${cols.map(c=>`"${c}"`).join(',')}) VALUES ${values} ${onConflict}`, params)
  }
}
```
Python: use `psycopg2.extras.execute_values` with the same `ON CONFLICT` clause.

---

## 6. The every-2-hours automation blueprint

```
For each run (e.g. cron */2 hours):
  ist_date = today's date in IST                     # §2.1
  leads    = pull FULL current lead dump             # your source of truth
  apps     = pull FULL current app-start dump
  calls    = pull Callyzer calls (rolling window ok)

  upsert lead_static        (leads,  conflict=email,                       DO NOTHING)
  upsert lead_history       (leads + snapshot_date=ist_date, conflict=(snapshot_date,email),               DO UPDATE)
  upsert app_start_static   (apps,   conflict=application_number,          DO NOTHING)
  upsert app_start_history  (apps  + snapshot_date=ist_date, conflict=(snapshot_date,application_number),  DO UPDATE)
  upsert call_history       (calls,  conflict=uniqueid,                    DO NOTHING)
```

- **Full dump each run** (see §2.2 warning).
- Dedup within a run before sending (keep the last occurrence per key) to avoid "cannot affect row a second time" upsert errors.
- Idempotent & safe to retry.

---

## 7. Making the DB the primary source (retire Sheets)

Today the dashboard still **reads leads/apps from Google Sheets** (via `/api/sheets`, cached),
and only *calls* + *previous-stage* already come from the DB. To fully cut Sheets:

1. **Keep writing the DB via your automation** (this doc). Once trustworthy, **disable the Sheets→DB cron** (`api/snapshot.js` in `vercel.json`), or reduce it to calls-only.
2. **Add a DB read endpoint** (e.g. `/api/leads?counsellor=`) that reconstructs "today's dump" from the latest snapshot:
   ```sql
   SELECT s.*, h.*
   FROM lead_history h JOIN lead_static s USING (email)
   WHERE h.snapshot_date = (SELECT MAX(snapshot_date) FROM lead_history);
   ```
   (same for app starts). Map DB columns → the objects `leadProcessor.js` expects.
3. **Point `leadProcessor.js` at the DB** instead of `getCol(row, 'A:CK')`. The business logic itself doesn't change — only where the fields come from.

### 7.1 Columns the dashboard logic depends on (make sure these are populated)
Leads: `primary_source` (junk/pmax), `primary_medium` (blackout), `user_type`, `payment_status`,
`registered_on`, `counsellor`, `lead_stage`, `lead_sub_stage`, `counsellor_last_activity`,
`total_lead_score`, `priority`, `notes`.
Apps: `application_status` (form %), `payment_status`, `source`, `primary_medium`, `registered_on`,
`counsellor`, `lead_stage`, `application_stage`, `application_sub_stage`, `counsellor_last_activity`,
`total_score_formula`, `priority_app_start`, `notes`.

### 7.2 ⚠️ Known gap: **graduation year** is not stored yet
The Fresh-Leads filter drops leads with **graduation year ≥ 2027** (Lead Dump col **CB**, "Graduation year").
That column is **not** in `lead_static`/`lead_history` today. If you want that filter to work when
reading from the DB, add a column (e.g. `ALTER TABLE lead_static ADD COLUMN graduation_year text;`)
and populate it. Everything else the logic needs is already stored.

### 7.3 Business rules (for context — full logic in `src/utils/leadProcessor.js`)
- **Fresh leads**: `user_type='lead'`, `lead_stage='Untouched'`, `payment_status≠Completed`, registered ≤ yesterday, **graduation year < 2027**, not a junk source, pmax excluded, last activity ≠ today.
- **Followup leads**: Counseled + sub-stage ∈ {Hot,Warm,Cold} + ≥3 days since activity; or No Contact Established + sub-stage ∈ {Call later, Disconnected, DNP, Not Reachable} + activity empty/≤ yesterday. `Priority 5` excluded.
- **App starts / App followups**: analogous, using `application_stage`/`application_sub_stage`, `application_status` form-% for the pmax exception, `total_score_formula`/`priority_app_start`.
- **Global exclusions**: junk partner sources (Collegedunia, CollegeHai, College_Kampus, CollegeOutreach, CareerGuide, CareerMantra); `pmax` unless app form-completion ≥ 20%.
- **Prev-stage feature** (already DB-backed): `/api/prev-stage?date=X` joins `*_static` → `*_history[X−1]` by last-10-digit phone (App-Start precedence) to show a called lead's stage the day before.

---

## 8. Quick checklist for the new project
- [ ] Get the pooled `DATABASE_URL` from Neon (SSL required).
- [ ] Compute `snapshot_date` in **IST** each run.
- [ ] Upsert **full** dumps: static (DO NOTHING) + history (DO UPDATE on `(snapshot_date, id)`).
- [ ] Batch inserts (~500 rows); dedup per key within a run.
- [ ] Populate the business-critical columns in §7.1 (+ graduation year §7.2 if needed).
- [ ] Calls: dedup on `uniqueid`, `call_date` as a real date.
- [ ] Never write `sheet_cache` / `ai_cache` / `paidapp_classification`.
- [ ] When confident, disable the Sheets→DB cron and switch the app's read path (§7).
