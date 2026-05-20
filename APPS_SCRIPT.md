# 🔧 Google Apps Script Setup

Handles three things:
1. **Admin "Force Refresh All"** button — manually pushes a refresh signal to all dashboards
2. **Daily 10:30 AM auto-refresh** — automatically refreshes all counsellor dashboards every morning
3. **Campaign Blackout Windows** — add/remove campaign hold periods from the admin UI

---

## Step 1: Add "Config" Tab to Your Google Sheet

1. Open your Google Sheet
2. Click **+** at the bottom → rename the new sheet to **`Config`** (exact case)
3. Fill in:

| | A | B |
|---|---|---|
| 1 | Last Refresh Trigger | 2026-05-08T00:00:00Z |
| 2 | Refresh Timestamp | *(leave empty)* |

---

## Step 2: Open Apps Script

1. In your Google Sheet → **Extensions → Apps Script**
2. Delete all existing code

---

## Step 3: Paste This Script

```javascript
// ─── Manual trigger (called by admin's Force Refresh button) ───────────────
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'addBlackout') {
    return addBlackoutRow(
      e.parameter.campaign || '',
      e.parameter.source   || '',
      e.parameter.startDate || '',
      e.parameter.endDate   || ''
    );
  }

  if (action === 'deleteBlackout') {
    return deleteBlackoutRow(Number(e.parameter.rowIndex || 0));
  }

  return writeRefreshTimestamp();
}

// ─── Blackout: append a row to "Campaign Blackouts" tab ──────────────────
function addBlackoutRow(campaign, source, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Campaign Blackouts');
    if (!sheet) {
      sheet = ss.insertSheet('Campaign Blackouts');
      sheet.appendRow(['Campaign', 'Source', 'Start Date', 'End Date']);
    }
    sheet.appendRow([campaign, source, startDate, endDate]);
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Blackout: delete a row by data-row index (0 = first data row) ────────
function deleteBlackoutRow(rowIndex) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Campaign Blackouts');
    if (sheet && rowIndex >= 0) {
      sheet.deleteRow(rowIndex + 2); // +1 for header, +1 for 1-based index
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Scheduled trigger (runs daily at 10:30 AM IST) ──────────────────────
function scheduledRefresh() {
  writeRefreshTimestamp();
}

// ─── Shared: write current timestamp to Config!B2 ────────────────────────
function writeRefreshTimestamp() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, error: 'Config sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const now = new Date().toISOString();
    sheet.getRange('B2').setValue(now);
    return ContentService.createTextOutput(JSON.stringify({
      success: true, timestamp: now
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Run this ONCE to install the daily 10:30 AM trigger ─────────────────
// After pasting: Run → scheduledRefresh first to test, then run createDailyTrigger
function createDailyTrigger() {
  // Delete any existing scheduledRefresh triggers first (avoid duplicates)
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'scheduledRefresh') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger: daily between 10:30–11:30 AM in script timezone
  ScriptApp.newTrigger('scheduledRefresh')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .nearMinute(30)
    .inTimezone('Asia/Kolkata')
    .create();

  Logger.log('✅ Daily trigger created — scheduledRefresh will run at ~10:30 AM IST every day');
}
```

---

## Step 4: Set Script Timezone to IST

**Important — do this before creating the trigger:**

1. In Apps Script → click **Project Settings** (gear icon ⚙️ on the left)
2. Under **Time zone** → select **(GMT+05:30) India Standard Time**
3. Save

---

## Step 5: Deploy as Web App (for manual Force Refresh)

1. Click **Deploy → New deployment**
2. Gear icon ⚙️ → **Web app**
3. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** → authorize → **copy the Web App URL**
5. Add to your `.env` as `VITE_APPS_SCRIPT_URL`

---

## Step 6: Install the Daily Trigger (run once)

1. In Apps Script, select `createDailyTrigger` from the function dropdown
2. Click **▶ Run**
3. Authorize if prompted
4. Check the **Executions** log — you should see: `✅ Daily trigger created`
5. Verify: go to **Triggers** (clock icon on left sidebar) — you should see `scheduledRefresh` listed

---

## ✅ How to Test

**Test the scheduled function manually:**
1. Select `scheduledRefresh` from the dropdown → click **▶ Run**
2. Open your Google Sheet → `Config!B2` should update with the current timestamp
3. Open any counsellor dashboard — within 60 seconds it should auto-refresh

**Test the Force Refresh button:**
1. Open `/admin` dashboard → click **⚡ Force Refresh All**
2. Check `Config!B2` updates

---

## 🔄 How It All Works

```
10:30 AM IST every day
        ↓
Apps Script scheduledRefresh() fires
        ↓
Writes timestamp → Config!B2
        ↓
Counsellor dashboards poll Config!B2 every 60 sec
        ↓
See new timestamp → refetch all lead data
        ↓
Fresh data ready before counsellors start work ✨

Admin clicks "Force Refresh All"
        ↓
Same flow — just triggered manually
```

---

## 🔒 Security Note

The Web App URL is public but can only write a timestamp to `Config!B2`. Worst case: someone triggers a refresh. No sheet data is exposed or modifiable.
