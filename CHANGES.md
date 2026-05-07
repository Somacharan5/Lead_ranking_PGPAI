# 📝 v3 Changes Summary

All changes from v2 to v3 of the AIAS Counsellor Dashboard.

The core idea of v3: **use `Counsellor Last Activity Date` as the anchor for "already spoken today"** so leads disappear from the queue the moment a counsellor calls them — without waiting for the CRM Stage column to be manually updated.

---

## 🎯 The Problem v3 Solves

In v2, Section 1 (Fresh Leads) and Section 3 (New App Starts) only filtered by `Stage = "Untouched"`. But in real CRM use:

1. Counsellor calls the lead → CRM auto-stamps `Counsellor Last Activity Date` with the call time
2. Counsellor moves on to the next call
3. **Stage column doesn't change to "Counseled" until the counsellor manually updates it later**

During step 2 → 3, the lead would keep showing up in the Fresh queue all day even though it had already been contacted. Counsellors saw repeats and lost trust in the prioritization.

---

## 🔧 Filter Logic Changes

| Section | Old Filter | New Filter |
|---|---|---|
| **1. Fresh Leads** | Untouched + Registered ≤ yesterday | + **Last Activity ≠ today** |
| **2. Followup Leads (Counseled)** | Last Activity ≥ 3 days ago | ✅ Same — already excludes today |
| **2. Followup Leads (NCE)** | Last Activity ≤ yesterday | ✅ Same — already excludes today |
| **3. New App Starts** | Untouched + Form Started ≤ yesterday | + **Last Activity ≠ today** |
| **4. App Followup (Counseled)** | Last Activity ≥ 3 days ago | ✅ Same — already excludes today |
| **4. App Followup (NCE)** | Last Activity ≤ yesterday | ✅ Same — already excludes today |

**Why Sections 2 and 4 don't need explicit changes:** "≥ 3 days ago" and "≤ yesterday" mathematically reject any timestamp from today. The fix only matters where `Stage = "Untouched"` is the gate, because that gate doesn't look at Last Activity at all.

---

## 🔄 Carry-Forward Behaviour (Free!)

The user's question — *"if not contacted today, can it carry forward to tomorrow's list?"* — is answered automatically by this filter:

- **Today:** Lead X has `Last Activity = empty` → passes filter → appears in Fresh
- **End of today:** Counsellor doesn't call X → `Last Activity` stays empty
- **Tomorrow:** Same row, same filter — `Last Activity ≠ today` is still true → X reappears

No separate carry-forward state, no overnight job, no data writes. The filter is idempotent across days.

If the counsellor *did* call X today, `Last Activity` becomes today's timestamp. Tomorrow that timestamp is "yesterday" — so X correctly graduates into Section 2 (Followup) when the CRM also updates Stage.

---

## 🎨 UI Changes

**New "spoken today" indicator** above the tabs:

```
✅ 7 leads already contacted today — hidden from your queue   🆕 3  🔄 2  📝 1  📞 1
```

This shows up only when there's at least one filtered-out lead. It builds counsellor trust — they can see at a glance that the dashboard *intentionally* removed leads they already worked, rather than wondering why the count dropped.

The breakdown by section (🆕 / 🔄 / 📝 / 📞) appears on screens ≥ md and is hidden on mobile to save space.

---

## 📐 Code Changes

### `src/utils/leadProcessor.js`
- New helper `isToday(dateStr)` — returns true if the date is today in local timezone.
- New helper `spokeToday(dateStr)` — wraps `isToday`, treats empty/missing as "never contacted" (do not exclude).
- `getFreshLeads()` — splits matched rows into `spokenToday` (excluded) and `actionable` (included); returns both `leads` and `spokenTodayCount`.
- `getFollowupLeads()` — adds defensive `spokeToday` guard (current date filters already exclude today, but the guard makes the intent explicit and counts edge cases for transparency).
- `getNewAppStart()` — same change as `getFreshLeads`.
- `getAppFollowup()` — same defensive guard as `getFollowupLeads`.
- `getLeadsForCounsellor()` — aggregates all four `spokenTodayCount` values into a `spokenToday` object and merges it into the return payload.

### `src/components/Dashboard.jsx`
- Adds the green "spoken today" indicator banner above the tab navigation.
- Banner only renders when `data.spokenToday.total > 0`.
- Per-section breakdown shown on desktop, hidden on mobile.

---

## 🗂️ Files Changed

| File | What |
|---|---|
| `src/utils/leadProcessor.js` | Filter logic + `spokenToday` counts |
| `src/components/Dashboard.jsx` | "Spoken today" banner |
| `CHANGES.md` | This file |
| `README.md` | Updated filter table + carry-forward note |

---

## 🚀 Migration from v2

Drop-in replacement. **No Google Sheet schema changes, no env-var changes, no Apps Script changes.**

1. Replace `src/utils/leadProcessor.js` and `src/components/Dashboard.jsx` with the v3 versions.
2. Push to GitHub → Vercel auto-deploys.
3. Done. Counsellors will see the new banner and stop seeing already-called leads in their queue.

---

## ⚠️ Edge Cases Worth Knowing

**"What counts as activity?"** — Whatever your CRM stamps into `Counsellor Last Activity Date`. If it gets stamped on every UI interaction (not just calls), the filter could over-exclude. Verify with your CRM admin what triggers that column.

**Timezone** — All "today" checks use the browser's local timezone. For India-based counsellors viewing the dashboard from India, this is IST. If a counsellor logs in from a different timezone, "today" is their local today. This is almost always the right behaviour — but worth flagging.

**Last Activity = future date** — If the CRM ever produces a future timestamp (data entry error), the filter treats it as "not today" and the lead is included. That's the safer default.

**Empty Last Activity** — Treated as "never contacted." Lead is included. This is correct — fresh leads usually have no prior activity.
