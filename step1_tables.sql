-- STEP 1: Create tables (run this first, then check "profiles", "segments", "notifications" appear in Table Editor)

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users PRIMARY KEY,
  name        TEXT DEFAULT '',
  avatar      TEXT DEFAULT '',
  role        TEXT DEFAULT 'editor',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segments (
  id          BIGSERIAL PRIMARY KEY,
  year        SMALLINT NOT NULL DEFAULT date_part('year', now()),
  date        DATE NOT NULL,
  asset_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'Record',
  seg         TEXT NOT NULL,
  tc_in       TEXT DEFAULT '',
  tc_out      TEXT DEFAULT '',
  glitch      TEXT DEFAULT '-',
  comment     TEXT DEFAULT '',
  duration    TEXT DEFAULT '',
  breaks      TEXT DEFAULT '',
  mcr_fmt     TEXT DEFAULT '',
  created_by  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'In Progress',
  handover_by TEXT DEFAULT '',
  handover_to TEXT DEFAULT '',
  handover_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id           BIGSERIAL PRIMARY KEY,
  target_email TEXT NOT NULL,
  from_user    TEXT NOT NULL,
  asset_id     TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  read         BOOLEAN DEFAULT false,
  sync_needed  BOOLEAN DEFAULT false
);
