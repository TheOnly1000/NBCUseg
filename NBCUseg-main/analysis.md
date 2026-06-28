# Segmentor — Analysis & Recommendations

## Security Assessment: Rating **4/10**

### What's good
- No hardcoded service role key or admin password (recently removed)
- Magic Link auth replaces OTP (no shared code to intercept)
- Ban enforcement works at login, page load, and realtime
- RLS policies exist for admin ops (though not all applied yet)
- RPC function for auth.users deletion uses SECURITY DEFINER (correct approach)
- Notifications filtered per-user in realtime subscription

### Critical Issues

1. **Supabase anon key is client-side but that's expected** — that's fine, RLS is supposed to protect data. But **are all tables protected by RLS?** If any table lacks row-level security, the anon key can read/write everything. Need to verify `schedule_entries`, `ticket_comments`, `notification_reads`, `comment_views`, `ticket_views`, `audit_logs` all have RLS policies.

2. **No email verification enforcement** — If Supabase "Confirm email" is off, anyone with an email can register. Rate limiting on signup is handled client-side only (`_signupCooldown`).

3. **Password reset flow** calls `resetPasswordForEmail` — the redirect URL for password reset is the Supabase default (likely `index.html`), which may not handle the hash fragment properly.

4. **No audit trail for admin actions** — admin panel logs to `audit_logs` but there's no enforced schema or validation on what gets logged (it's all client-side).

5. **No rate limiting on API calls** — all Supabase calls are client-initiated. A malicious user could spam the DB by calling `sb.from(...)` from the console.

6. **Thumbnail upload uses client-side session token** — the `/upload` endpoint relies on storage RLS. Without the `admin_delete_thumbnails` and other storage RLS policies applied, uploads/cleanup fail with "violates row-level security".

7. **No CSRF protection** — session is validated via Supabase's built-in auth, but there's no state/nonce for critical operations.

8. **No input validation on server-side** — `server.js` is a bare-bones static file server. Sensitive operations (handover, delete, save) run entirely on the client against Supabase.

### How to improve security (actionable steps)

1. **Enable RLS on every table** — go to Supabase Dashboard → Authentication → Policies and ensure **all** tables have RLS enabled. Without it, anon key can do anything.
2. **Create RLS policies for `schedule_entries`** — users should only see/update their own assignments or have viewer access.
3. **Create RLS policies for `audit_logs`** — INSERT for authenticated users, SELECT for admins only.
4. **Reduce anon key exposure surface** — switch some sensitive operations (handover, asset delete, user deletion) to use **Edge Functions** with `service_role` key on the server side.
5. **Add CAPTCHA to signup** — Supabase supports hCaptcha. Enable it in Auth settings and pass the token from the client.
6. **Enforce email confirmation** — turn on "Confirm email" in Supabase Auth settings. The `verified.html` page already handles the redirect.
7. **Add rate limiting middleware** — even in a static server, you could add a simple IP-based rate limiter in `server.js`.
8. **Run `migrate_admin_rls.sql` immediately** — storage operations are currently broken without it.
9. **Add `banned` column migration** — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false` — ban checks silently return undefined without it.
10. **Validate JSON inputs** — metadata, transfers, working_time are stored as JSON but there's no schema validation. A malicious client could inject large/skewed data.

---

## Feature & UI/UX Upgrade Ideas

### High value, low effort

1. **Dark/Light theme toggle** — the CSS uses CSS custom properties (`--c-surface`, `--c-bg`, etc.) which suggests dark mode variables are partially ready. Just needs a toggle button and `class` switch on `<html>`.

2. **Persistent column sorting & layout preference** — save `lg-list`/`lg-grid` choice and column sort order to localStorage per view.

3. **Keyboard shortcuts reference** — a `?` modal showing all shortcuts (Ctrl+N new asset, Ctrl+S save, Ctrl+E load editor, etc.)

4. **Bulk segment operations** — multi-select segments + batch edit (glitch type, MCR format, breaks)

5. **Comment edit** — currently comments are deletable but not editable

6. **Drag-and-drop segment reordering** — segments are lettered A-Z but there's no visual drag-to-reorder

### Medium value, medium effort

7. **Advanced search** — full-text search across asset titles, IDs, comments, metadata fields, with date range + type filters

8. **Schedule calendar view** — weekly/monthly calendar instead of just a date-picker list. Show overlapping slots visually.

9. **Live status dashboard** — a "Live Now" section showing which assets are currently being edited and by whom, with editing time

10. **FSO (full-screen overlay) improvements** — side-by-side editor and report view, resizable panels, comments sidebar

11. **Responsive mobile layout** — the bottom nav (`bn-*`) works but main views likely break on small screens. Need proper stacking for mobile.

12. **Toast notification history** — a small expandable list of recent toasts so you don't miss transient messages

13. **Print-friendly report** — a CSS `@media print` stylesheet so report/MCR format prints cleanly

14. **Quick asset switcher** — `Ctrl+K` Spotlight-style palette: type asset ID or title, press Enter to load in editor

### High value, high effort

15. **Real-time collaborative editing** — multiple users editing the same asset simultaneously with presence indicators (like Google Docs). Currently uses locking (single user at a time).

16. **Version history / audit trail per asset** — track every change to segments: who changed what and when. Storage in a `segment_versions` or `segment_audit` table.

17. **Export to PDF/Excel** — direct download buttons for:
    - MCR report as PDF
    - All segments as CSV/XLSX
    - Dashboard filtered view as CSV

18. **Email notifications** — currently notifications are in-app only. Hook into Brevo SMTP to send email digests or critical alerts.

19. **Dashboard widgets** — customizable widgets:
    - My active assets count
    - Pending handover requests
    - Today's schedule count
    - Open tickets count
    - Recent activity feed

20. **Global search** — search across assets, tickets, schedule entries, and users from a single search bar in the sidebar header

---

## Automation Ideas

1. **Auto-release stale locks** — if an asset is locked by a user who hasn't interacted for >N minutes (configurable), auto-release the lock and notify the locker. Prevents "locked forever" scenarios.

2. **Auto-close tickets** — tickets with no activity for 7 days auto-transition to "Closed" with a notification.

3. **Schedule reminders** — email/in-app push N minutes before a scheduled event start time. Already has `schedule_alert` notification type — could be automated server-side.

4. **Auto-thumbnail fallback chain** — already partially implemented (`fetchThumbnailForTitle` tries TVMaze → Wikipedia → DuckDuckGo). Could add Google Custom Search API as 4th fallback.

5. **Auto-glitch detection** — integrate with external QC systems or parse timecode patterns to auto-tag potential glitches (e.g., consecutive segments with exactly 0 duration).

6. **Daily digest** — summarize all changes from the day: which assets were edited, tickets created/closed, handovers completed. Sent via Brevo at end of day.

7. **Auto-prune old data** — already prunes `audit_logs` > 7 days. Could extend to auto-delete notifications > 30 days, and orphaned thumbnails from storage (currently only removed on asset delete).

8. **Save to Google Sheets** — the code has a `saveToSheets` function placeholder. Could implement actual Google Sheets API integration for compliance/archive.

9. **Auto-assign scheduled events to users** — when a schedule is imported, auto-assign events based on user availability/role/rotation.

10. **Segment countdown** — in the editor, show a live countdown to the next scheduled event end time (useful for live productions).
