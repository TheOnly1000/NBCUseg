-- STEP 12: Notifications RLS + cleanup improvements
-- Run this in Supabase SQL Editor (safe to re-run)

-- Enable RLS on notifications if not already
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own notifications
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (auth.role() = 'authenticated' AND target_email = auth.email());

-- Allow users to update their own notifications (e.g. mark as read)
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE USING (auth.role() = 'authenticated' AND target_email = auth.email());

-- Allow users to delete their own notifications
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications
    FOR DELETE USING (auth.role() = 'authenticated' AND target_email = auth.email());

-- Allow the system to insert notifications for any user (via service_role or trigger)
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
