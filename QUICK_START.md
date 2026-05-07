# 🚀 QUICK START — 25 Minutes to Live

Follow these steps in order.

---

## ✅ CHECKLIST

### **1. Make Google Sheet Public (1 min)**

1. Open your Google Sheet
2. Click **Share** (top right)
3. Change to **Anyone with the link → Viewer**
4. Copy Sheet ID from URL (the long string between `/d/` and `/edit`)

### **2. Add "Config" Tab to Google Sheet (2 min)**

Add a new sheet called **`Config`** with this content:

| | A | B |
|---|---|---|
| 1 | Last Refresh Trigger | 2026-05-07T00:00:00Z |
| 2 | Refresh Timestamp | |

### **3. Get Google API Key (5 min)**

1. https://console.cloud.google.com/
2. Create new project: "AIAS Dashboard"
3. **APIs & Services → Library → Google Sheets API → Enable**
4. **APIs & Services → Credentials → Create Credentials → API Key**
5. **Copy the API key**

### **4. Set Up Apps Script for Admin Refresh (5 min)**

Follow `APPS_SCRIPT.md` to:
- Create the script in Extensions → Apps Script
- Deploy as Web App (Anyone access)
- Copy the Web App URL

### **5. Install Node.js (3 min)**

Download LTS version from https://nodejs.org/

### **6. Run Locally (3 min)**

```bash
# In project folder
npm install

cp .env.example .env

# Edit .env file - add:
# VITE_GOOGLE_SHEET_ID=your_sheet_id
# VITE_GOOGLE_API_KEY=your_api_key
# VITE_APPS_SCRIPT_URL=your_apps_script_url

npm run dev
```

Open http://localhost:3000 → Click any counsellor link → Test!

### **7. Push to GitHub (3 min)**

```bash
git init
git add .
git commit -m "Initial commit"
```

Create new repo at https://github.com/new (name: `counsellor-dashboard`), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/counsellor-dashboard.git
git branch -M main
git push -u origin main
```

### **8. Deploy on Vercel (3 min)**

1. https://vercel.com/ → Sign in with GitHub
2. **Add New Project** → Import your repo
3. **Environment Variables** — Add all 3:
   - `VITE_GOOGLE_SHEET_ID` = your sheet ID
   - `VITE_GOOGLE_API_KEY` = your API key
   - `VITE_APPS_SCRIPT_URL` = your Apps Script URL
4. Click **Deploy**
5. Wait 2 min → Get live URL: `https://your-app.vercel.app`

---

## 🎉 YOU'RE LIVE!

Share these links with your team:

- **Jasmeet:** `https://your-app.vercel.app/jasmeet`
- **Komal:** `https://your-app.vercel.app/komal`
- **Prerna:** `https://your-app.vercel.app/prerna`
- **Admin:** `https://your-app.vercel.app/admin`

---

## 📌 Important Notes

- **No login required** — anyone with the link can access
- **Bookmark the URL** for quick daily access
- Data **auto-refreshes** at 10:30 AM every day
- Admin can click **"⚡ Force Refresh All"** to update all dashboards instantly
- Counsellor dashboards check for refresh signal every **60 seconds**
