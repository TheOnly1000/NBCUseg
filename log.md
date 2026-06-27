# Session Log

## 2026-06-27: Schedule Realtime Fix

### Problem
Schedule entries synced from Google Sheet appeared only on the syncing user's screen but not for other users. On page refresh (Ctrl+R), entries disappeared. Tickets worked correctly in realtime.

### Root Causes Found

**1. Missing RLS policies for `schedule_entries` table** (PRIMARY CAUSE)
- The `schedule_entries` table had Row-Level Security enabled but **no policies** for SELECT, INSERT, DELETE, or UPDATE
- `scheduleDbWrite` in `js/schedule.js:55-72` uses DELETE+INSERT pattern. Without DELETE/INSERT policies, all DB writes silently failed
- The error was caught and re-thrown by `scheduleDbWrite`, then caught by the caller which showed "DB save failed" toast — but with `renderSchedule()` still called using local cache, giving a false positive appearance of success
- On page refresh, `loadScheduleFromDb` SELECT would also fail (no SELECT policy), returning empty

**2. Date format mismatch between Postgres and JS** (CRITICAL)
- `schedule_date` stored in Postgres might come back with time component (e.g., `"2026-06-27T00:00:00"`) while the filter uses `"2026-06-27"` 
- Strict `===` comparison in `renderSchedule()` (line 334), `renderDashUpcoming()` (lines 523, 531), and multiple other filter points would ALWAYS return false
- This made the schedule appear empty even when data existed in the cache

**3. Navigation didn't trigger DB load** (CONTRIBUTING)
- `nav('schedule')` in `js/nav.js:344-346` called `renderSchedule()` which reads from in-memory `scheduleEntries` cache
- If the cache was empty (no prior `loadScheduleFromDb` completed), the schedule showed "no entries"
- Never called `loadScheduleFromDb()` to populate the cache

### Fixes Applied

**SQL (run in Supabase SQL Editor):**
```sql
-- Add to realtime publication (confirmed already present)
-- ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries;

-- RLS policies
CREATE POLICY "schedule_entries select" ON public.schedule_entries
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "schedule_entries insert" ON public.schedule_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "schedule_entries delete" ON public.schedule_entries
  FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "schedule_entries update" ON public.schedule_entries
  FOR UPDATE USING (auth.role() = 'authenticated');
```

**Code changes:**
- `js/schedule.js`: Added `normDate()` helper function that normalizes dates to `"YYYY-MM-DD"` string format
- `js/schedule.js`: Updated `scheduleDbRead` to normalize dates from DB
- `js/schedule.js`: Updated `loadScheduleFromDb` to normalize `schedule_date` when mapping DB rows
- `js/schedule.js`: Updated `renderSchedule()` filter to use `normDate()` comparison
- `js/schedule.js`: Updated `renderDashUpcoming()` to use `normDate()` in all comparisons
- `js/schedule.js`: Updated `syncScheduleFromSheet()` to use `normDate()` in comparisons
- `js/schedule.js`: Updated `upsertScheduleEntriesForDate()` to use `normDate()` in comparisons
- `js/schedule.js`: Updated `scheduleDbWrite()` to use `normDate()` for filtering and storing
- `js/nav.js`: Changed `nav('schedule')` handler from `renderSchedule()` to `loadScheduleFromDb(true)` — fetches from DB first, then renders via `scheduleRenderAll()`

### Lessons Learned / Mistakes

1. **DON'T guess, investigate**: Started theorizing without checking actual DB schema/response format. Should have added console.log debug first.
2. **Date type mismatch is a common Postgres-JS pitfall**: Always normalize date strings from Postgres before using them in JS comparisons. Postgres `date`/`timestamp` columns can return in different formats depending on client config.
3. **Silent failures are the worst**: The `scheduleDbWrite` error was caught, a toast shown, but `renderSchedule()` still ran with local cache — making the user think it succeeded. The catch handler should have shown a persistent error indicator.
4. **Navigation must load data**: Never assume the cache is populated. Any view navigation should trigger a DB refresh.
5. **Always create ALL RLS policies upfront**: Supabase creates tables with RLS enabled by default but no policies. This blocks ALL operations silently.

## 2026-06-27: Schedule Realtime Bug Analysis — Round 2

### Four Remaining Race Conditions Identified

Even with the initial fixes, schedule updates still failed to sync instantly like tickets. The root cause was 4 architectural differences between the ticket and schedule realtime paths:

**Bug 1 — DELETE+INSERT storm unbatched**: `scheduleDbWrite` fires DELETE then INSERT. Each row produces a separate RT event (8 deletes + 8 inserts = 16 events). Each event mutated `scheduleEntries` in-memory incrementally, then called `renderDashUpcoming()` which made its own async DB fetch. During the DELETE window, the DB returned 0 rows → section hidden.

**Bug 2 — Parallel async race**: Each of the 16 RT events called `renderDashUpcoming()` simultaneously, launching 16 parallel `scheduleDbRead(todayStr)` queries. A DELETE-era query (0 rows) could resolve AFTER an INSERT-era query (rows found), hiding the section permanently. No debounce guard existed.

**Bug 3 — Double timer conflict**: `init.js` set a 15s poll and `realtime.js` set a 30s poll, both writing to `schedulePollTimer`. The async `.then()` in `init.js` always cancelled the 30s timer before it could fire. The 15s poll did correct the state eventually, but instant cross-user sync never worked.

**Bug 4 — Empty cache flash on reload**: `renderSchedule()` ran synchronously before `loadScheduleFromDb()` completed, showing "Click Sync from Sheet" momentarily even when DB had data. This made users believe data was lost.

### Fixes Applied (2026-06-27)

**Fix 1 — Debounced RT handler** (`js/realtime.js:152-188`):
- Replaced incremental in-memory mutation with a 400ms debounced `loadScheduleFromDb(true)` call
- A 16-event DELETE+INSERT storm collapses into exactly one DB fetch, which fires after all changes have committed
- Same pattern as tickets: one RT event → one debounced fetch → one render

**Fix 2 — Debounced `renderDashUpcoming()`** (`js/schedule.js:501-548`):
- Wrapped `renderDashUpcoming()` body in `_renderDashUpcomingImpl()` with a 200ms debounce timer
- Eliminates the parallel async race: only one DB fetch (or cache fallback) executes at a time

**Fix 3 — Removed redundant 15s poll** (`js/init.js:40`):
- Changed `loadScheduleFromDb(true).then(...)` with 15s poll to just `loadScheduleFromDb(true);`
- The 30s poll in `realtime.js` is the sole fallback; no timer conflict

**Fix 4 — Loading state on reload** (`js/schedule.js:350-357`):
- `renderSchedule()` now checks `scheduleEntries.length` before deciding the message
- Shows "Loading schedule..." when cache is empty (DB fetch pending), "Click Sync from Sheet" only when cache has data but nothing matches the selected date

### Key Insight
Tickets worked correctly because `loadTickets()` is a single atomic async operation called once per RT event. Schedule had 4 layers of complexity that broke this simplicity: (1) incremental cache mutations, (2) parallel fetches with no debounce, (3) timer conflicts, (4) synchronous render before async load. The fix was to make schedule behave exactly like tickets.

## 2026-06-27: Date Filtering Removed from Display

### Problem
After Round 2 fixes, the RT chain worked perfectly (events received, debounce fired, data loaded), but the other user still saw nothing. Root cause: the display was **date-filtered** to only show entries matching the selected date or today's date. The syncing user synced for one date, but the other user's schedule tab defaulted to today — showing empty.

### Fix — `renderSchedule()` + `_renderDashUpcomingImpl()`
- **`renderSchedule()`** now passes ALL `scheduleEntries` to `renderScheduleTable()` with no date filtering
- **`_renderDashUpcomingImpl()`** reads from the cache (not a date-specific DB query) and filters for `schedule_date >= today` — showing all future entries
- The `schedule-date-filter` input is preserved only for the "Sync from Sheet" operation

### Key Principle
The date filter exists only for the Google Sheet export/sync workflow. Display and realtime sync should treat schedule entries like tickets — show everything from the cache, update instantly across users.
