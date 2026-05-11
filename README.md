# 🎯 AIAS Counsellor Dashboard

Web dashboard for Masters Union counsellors to view their daily prioritized leads from Google Sheets — no login required, just direct URL access.

---

## ✨ Features

- 🔗 **Direct URL access** — no login, just bookmark your link
- 📊 **4 separate tabs** — Fresh Leads, Followup Leads, New App Starts, App Followups
- 🎯 **300 leads per day** distributed in your exact ratio (29.5% / 24.3% / 18.3% / 27.9%)
- 📈 **Sorted by Lead Score** (highest first), then by Priority
- ✅ **Already-spoken-today auto-hidden** — uses `Counsellor Last Activity Date` so leads disappear from your queue the moment you call them, even before you update the stage in CRM (v3)
- 🔁 **Automatic carry-forward** — leads not contacted today reappear tomorrow, no manual tracking needed
- 📧 **Copy all emails** with one click — perfect for CRM bulk search
- 🔄 **Auto-refresh** at 10:30 AM daily
- ⚡ **Admin force refresh** — instantly updates all counsellor dashboards
- 💻 **Desktop-optimized** UI

---

## 🔗 URLs

| Role | URL Path | Description |
|------|----------|-------------|
| **Jasmeet Kaur** | `/jasmeet` | Her dashboard |
| **Komal Pandey** | `/komal` | Her dashboard |
| **Prerna Kaushik** | `/prerna` | Her dashboard |
| **Admin** | `/admin` | View any counsellor + Force Refresh All |
| **Home** | `/` | Quick links page |

---

## 📊 How Lead Allocation Works

For each counsellor, **300 leads** are pulled in this ratio:

| Section | % | Count | Source Sheet | Filter |
|---------|---|-------|--------------|--------|
| Fresh Leads | 29.5% | 89 | `Lead Dump` | Registered ≤ yesterday + Untouched + lead + **Last Activity ≠ today** |
| Followup Leads | 24.3% | 73 | `Followup Sheet - LEAD` | Counseled (3+ days old) OR NCE (≤ yesterday) |
| New App Starts | 18.3% | 55 | `New - App start` | Untouched + Form started ≤ yesterday + **Last Activity ≠ today** |
| App Followups | 27.9% | 83 | `Followup sheet - App start` | Counseled (3+ days old) OR NCE (≤ yesterday) |

**Shortfall handling:** If any category has fewer leads than the ratio, the shortfall is filled from the highest-scoring leads in other categories.

All sections are sorted by **Lead Score (highest first)**, then by **Priority (1, 2, 3, 4, 5)**.

### 🎯 Why the "Last Activity ≠ today" check (v3)

When a counsellor calls a lead, the CRM stamps `Counsellor Last Activity Date` immediately, but the `Stage` column may not flip from `Untouched` to `Counseled`/`NCE` until the counsellor manually updates it. Without this check, a lead the counsellor *just called* would keep reappearing in the Fresh queue.

Sections 2 and 4 don't need this check explicitly — their existing date filters (`≥ 3 days ago`, `≤ yesterday`) already exclude today by definition.

### 🔁 Automatic carry-forward

A lead the counsellor doesn't reach today rolls over to tomorrow automatically. There's no separate state machine: tomorrow, the same filter still passes (Last Activity is still empty or older than today), so the lead reappears. If the counsellor *did* call today, the lead correctly graduates into the Followup section the next day once the stage updates.

---

## 🛠️ Setup

See **`QUICK_START.md`** for the step-by-step 25-minute deployment guide.

For the admin force refresh feature, see **`APPS_SCRIPT.md`**.

---

## 🏗️ Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **Data Source:** Google Sheets API (read-only via API key)
- **Refresh Trigger:** Google Apps Script (write access)
- **Hosting:** Vercel (free tier)

---

## 📁 Project Structure

```
counsellor-dashboard/
├── public/
├── src/
│   ├── components/
│   │   ├── HomePage.jsx       # Landing page with links
│   │   ├── Dashboard.jsx      # Main dashboard with 4 tabs
│   │   └── LeadTable.jsx      # Lead table with search
│   ├── utils/
│   │   ├── sheetsApi.js       # Google Sheets API client
│   │   ├── leadProcessor.js   # Filtering, sorting, allocation
│   │   └── refreshSignal.js   # Polling for admin refresh
│   ├── App.jsx                # Routing
│   ├── main.jsx               # Entry point
│   └── index.css              # Tailwind styles
├── .env.example
├── package.json
├── vercel.json
├── QUICK_START.md             # 25-min setup guide
├── APPS_SCRIPT.md             # Admin refresh setup
└── README.md
```

---

## 🔄 Refresh Mechanism

**Two refresh triggers:**

1. **Daily Auto-Refresh (10:30 AM):**
   - Each dashboard auto-fetches new data after 10:30 AM
   - Data cached in browser until next 10:30 AM

2. **Admin Force Refresh:**
   - Admin clicks **"⚡ Force Refresh All"**
   - Triggers Google Apps Script
   - Apps Script updates timestamp in `Config!B2`
   - All counsellor dashboards poll this cell every 60 seconds
   - When timestamp changes → they auto-refetch all data

**Manual refresh:**
- Each user can click **"🔄 Refresh"** anytime to fetch fresh data

---

## 🎨 UI Walkthrough

### **Home Page** (`/`)
Clean landing page with 4 button links — one for each counsellor + admin.

### **Counsellor Dashboard** (`/jasmeet`, `/komal`, `/prerna`)
1. Header with counsellor name + last refresh time + Refresh button
2. **4 clickable tabs** showing lead count per category
3. Tab content: scrollable lead table with all columns
4. Search bar to filter leads
5. **"📧 Copy All Emails"** button (copies emails from active tab)

### **Admin Dashboard** (`/admin`)
Same as counsellor dashboard, plus:
- **Counsellor switcher** dropdown (Jasmeet / Komal / Prerna)
- **"⚡ Force Refresh All"** button (yellow/amber)
- Indicator showing this is the admin view

---

## 📞 Lead Table Columns

| # | Column | Source |
|---|--------|--------|
| 1 | Category | Calculated |
| 2 | Score | Total Lead Score |
| 3 | Priority | Followup Priority (only for Followup categories) |
| 4 | Name | Lead Dump A / App Start M |
| 5 | Email | Lead Dump B / App Start N |
| 6 | Mobile | Lead Dump C / App Start O |
| 7 | Source | Lead Dump G / App Start S |
| 8 | Registered On | Lead Dump BA / App Start Q |
| 9 | Medium | Lead Dump H / App Start T |
| 10 | Last Activity | Lead Dump BK / App Start BG |
| 11 | Campaign | Lead Dump I / App Start U |
| 12 | Stage | Lead Dump BD / App Start AU |
| 13 | Sub Stage | Lead Dump BE / App Start AV |
| 14 | Notes | Lead Dump BP / App Start BM |
| 15 | Counsellor | Lead Dump BC / App Start AR |

---

## 🐛 Troubleshooting

**"Failed to fetch"?**
- API key incorrect or restricted
- Google Sheet not public
- Google Sheets API not enabled in Cloud Console

**No leads showing?**
- Counsellor name in URL must match Lead Dump column BC exactly
- Date format issues — verify dates are recognized
- Try manual refresh

**Force Refresh All not working?**
- Apps Script URL not set in env
- Apps Script not deployed as "Anyone" access
- Config tab missing in Google Sheet

**Counsellors not seeing admin's refresh?**
- They're not opening the dashboard (polls only when page is open)
- Wait up to 60 seconds for next poll
- Check Config!B2 was actually updated

---

## 🔒 Security Considerations

**Current setup:**
- URLs are not protected (anyone with link can view)
- Google Sheet is read-only public
- Apps Script web app is "Anyone" access

**To add security (optional):**
1. Use a secret token in URLs: `/jasmeet?token=xyz123`
2. Update Apps Script to require token
3. Use Vercel password protection (paid feature)
4. Implement OAuth (more complex)

---

## 📞 Support

Built for **Masters Union — PG AIAS Programme**

For deployment issues, refer to:
- `QUICK_START.md` — Setup guide
- `APPS_SCRIPT.md` — Apps Script setup
- Google Sheets API docs: https://developers.google.com/sheets/api
- Vercel docs: https://vercel.com/docs
