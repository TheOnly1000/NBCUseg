# Database Commands Used

## Realtime Publication

### Add table to supabase_realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries;
```
Note: Duplicate error = already there, safe to ignore.

### Check if table is in publication
```sql
SELECT schemaname, tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'schedule_entries';
```

## RLS Policies for schedule_entries

### Check existing policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'schedule_entries';
```

### Create all RLS policies (safe to re-run, uses IF NOT EXISTS)
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_entries' AND policyname = 'schedule_entries select') THEN
    CREATE POLICY "schedule_entries select" ON public.schedule_entries
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_entries' AND policyname = 'schedule_entries insert') THEN
    CREATE POLICY "schedule_entries insert" ON public.schedule_entries
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_entries' AND policyname = 'schedule_entries delete') THEN
    CREATE POLICY "schedule_entries delete" ON public.schedule_entries
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_entries' AND policyname = 'schedule_entries update') THEN
    CREATE POLICY "schedule_entries update" ON public.schedule_entries
      FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;
```

## Known Tables in supabase_realtime
`segments`, `notifications`, `profiles`, `schedule_entries`, `tickets`, `ticket_comments`, `notification_reads`, `ticket_views`, `comment_views`, `asset_thumbnails`

## Troubleshooting Checklist
1. Is the table in `supabase_realtime`? → `pg_publication_tables` query
2. Are RLS policies created? → `pg_policies` query  
3. Is the JS realtime channel subscribing? → Check browser console for `"schedule-rt channel status:"`
4. Does the JS subscription trigger a render? → Handler should call `loadScheduleFromDb(true)` or equivalent
5. Is the date format consistent? → Use `normDate()` helper to normalize Postgres dates
