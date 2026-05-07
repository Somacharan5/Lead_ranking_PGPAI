# 🔧 Google Apps Script Setup (for Admin Force Refresh)

This script enables the **Admin's "Force Refresh All"** button to update all counsellor dashboards simultaneously.

---

## ⏱️ Setup Time: 5 minutes

---

## Step 1: Add "Config" Tab to Your Google Sheet

1. Open your Google Sheet
2. Click the **+** at the bottom to add a new sheet
3. Rename it to **`Config`** (exactly this, case-sensitive)
4. In **A1** write: `Last Refresh Trigger`
5. In **B1** write: any timestamp like `2026-05-07T00:00:00Z`
6. In **A2** write: `Refresh Timestamp`
7. Leave **B2** empty (it will be auto-updated)

Your Config sheet should look like:

| | A | B |
|---|---|---|
| 1 | Last Refresh Trigger | 2026-05-07T00:00:00Z |
| 2 | Refresh Timestamp | (empty) |

---

## Step 2: Open Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**
2. A new tab opens with the script editor
3. Delete any existing code

---

## Step 3: Paste This Script

```javascript
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Config sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const now = new Date().toISOString();
    sheet.getRange('B2').setValue(now);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      timestamp: now
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## Step 4: Save & Deploy as Web App

1. Click the **💾 Save** button (or Ctrl+S)
2. Name the project: **"AIAS Refresh Trigger"**
3. Click **Deploy → New deployment**
4. Click the gear icon ⚙️ next to "Select type" → choose **Web app**
5. Configure:
   - **Description:** AIAS Refresh Endpoint
   - **Execute as:** Me (your email)
   - **Who has access:** **Anyone**
6. Click **Deploy**
7. Authorize when prompted (click "Advanced" if you see a warning)
8. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/AKfy.../exec`)

---

## Step 5: Add URL to Your Project

### **Local Development:**

In your `.env` file, add:
```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfy.../exec
```

### **Vercel Production:**

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add: `VITE_APPS_SCRIPT_URL` = your Apps Script URL
3. Redeploy

---

## ✅ Test It

1. Open admin dashboard: `https://your-app.vercel.app/admin`
2. Click **"⚡ Force Refresh All"** button
3. Check your Google Sheet → Config!B2 should update with current timestamp
4. Open `/jasmeet` in another tab → within 60 seconds it should auto-refresh

---

## 🔄 How It Works

```
Admin clicks "Force Refresh All"
         ↓
App calls Apps Script URL
         ↓
Script writes timestamp to Config!B2
         ↓
Counsellor dashboards poll Config!B2 every 60 sec
         ↓
When they see new timestamp → refetch all data
         ↓
All dashboards show fresh data ✨
```

---

## 🔒 Security Note

The Apps Script URL is **public**, but:
- Anyone with the URL can only update Config!B2 (just a timestamp)
- They cannot read or modify other sheets
- Worst case scenario: someone triggers a refresh (no actual harm)

If you want to add security, you can modify the script to require a secret token:

```javascript
function doGet(e) {
  const token = e.parameter.token;
  if (token !== 'your_secret_token') {
    return ContentService.createTextOutput('Unauthorized');
  }
  // ... rest of code
}
```

Then update `triggerGlobalRefresh()` in `refreshSignal.js` to pass the token.
