# SoftCreation Voucher System (v2.0)

A high-performance, modular Single Page Application (SPA) designed to be hosted directly on **GitHub Pages** (or any static hosting provider) with a **Supabase** backend (PostgreSQL + Cloud Storage).

---

## 🚀 Key Improvements & Architecture

1. **Zero Google Apps Script Dependency**:
   - Replaced Apps Script HTTP endpoints with direct, ultra-fast queries via the **Supabase JavaScript SDK**.
   - No 6-minute timeout limits, no Google Apps Script execution quotas, and zero middleman server latency.

2. **Professional Modular File Structure**:
   ```
   latest/
   ├── index.html           # Clean, semantic SPA entry point
   ├── css/
   │   └── style.css        # Modern design system (Dark/Light mode, custom tables, A4 print styles)
   ├── js/
   │   ├── config.js        # Supabase keys, table names, role definitions
   │   ├── supabase.js      # Direct Supabase API client & query services
   │   ├── storage.js       # Direct file uploads to Supabase Storage
   │   ├── vouchers.js      # Voucher form, auto-sequence generation, duplicate detection
   │   ├── ledger.js        # Unified paginated ledger table with multi-filter & search
   │   ├── approvals.js     # Dedicated Approvals hub (batch approve, reject with reason)
   │   ├── gallery.js       # Receipts & supporting documents visual gallery
   │   ├── reports.js       # Client-side monthly report PDF generation (jsPDF) & CSV backup
   │   └── app.js           # Router, session management, modals, and event bindings
   └── README.md
   ```

3. **Consolidated & Non-Redundant Tabs**:
   - **Voucher Ledger**: Single, unified paginated table replacing the previous redundant views. Supports switching between *My Vouchers* and *All Vouchers*, instant status pills (*All / Pending / Approved / Rejected*), multi-field search, and selectable page sizes (15, 25, 50, 100).
   - **New Voucher**: Real-time sequence numbering based on selected date, multi-bill file upload with drag-and-drop previews, and salary/commission employee validation.
   - **Approvals Hub**: Exclusively for authorized roles (`Owner`, `CFO`, `CEO`, `madumali.softcreation@gmail.com`) with batch approval and rejection tracking.
   - **Receipts Gallery**: High-performance visual image/PDF repository.
   - **Reports & System**: In-browser branded monthly PDF report generation (jsPDF) with zero server delay, full database CSV backup, and admin maintenance mode.

---

## 📦 Supabase Configuration

### 1. Storage Bucket
Create a storage bucket in your Supabase dashboard:
- **Bucket Name**: `voucher-bills`
- **Public**: Yes (Enable public bucket so bills can be accessed directly)

### 2. Database Tables
- `softcreation_vouchers` (Main ledger records)
- `softcreation_users` (Authentication & roles)
- `softcreation_logs` (Audit activity log)
- `softcreation_settings` (System flags such as `MAINTENANCE_MODE`)

---

## 🌐 Deploy to GitHub

1. Copy the contents of the `latest/` folder into your GitHub repository root.
2. In GitHub, go to **Settings** > **Pages**.
3. Under **Branch**, select `main` (or `master`) and folder `/ (root)`.
4. Click **Save**. Your site will be live instantly!

