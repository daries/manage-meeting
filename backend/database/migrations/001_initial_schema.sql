-- ============================================================
-- Migration 001: Initial Schema
-- ============================================================

-- gen_random_uuid() built-in sejak PostgreSQL 13, tidak perlu extension

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  jabatan VARCHAR(255),
  department VARCHAR(255),
  organization VARCHAR(255),
  avatar_url TEXT,
  is_profile_complete BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expires_at TIMESTAMPTZ,
  reset_token VARCHAR(255),
  reset_token_type VARCHAR(20) CHECK (reset_token_type IN ('password', 'reactivation')),
  reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEETINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location VARCHAR(500),
  meeting_type VARCHAR(20) DEFAULT 'offline' CHECK (meeting_type IN ('offline', 'online', 'hybrid')),
  online_link TEXT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  attendance_token VARCHAR(100) UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  minutes_locked BOOLEAN DEFAULT FALSE,
  search_vector tsvector,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEETING PARTICIPANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_email VARCHAR(255),
  external_name VARCHAR(255),
  external_phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('organizer', 'participant', 'notulen')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  notified_email BOOLEAN DEFAULT FALSE,
  notified_wa BOOLEAN DEFAULT FALSE,
  UNIQUE(meeting_id, user_id),
  UNIQUE(meeting_id, external_email)
);

-- ============================================================
-- AGENDAS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  pic_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pic_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'discussed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  jabatan VARCHAR(255),
  department VARCHAR(255),
  organization VARCHAR(255),
  attended_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(45),
  UNIQUE(meeting_id, email)
);

-- ============================================================
-- MEETING MINUTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_id UUID REFERENCES agendas(id) ON DELETE SET NULL,
  summary TEXT,
  discussion TEXT,
  decisions TEXT,
  action_items JSONB DEFAULT '[]',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MINUTES APPROVALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS minutes_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(meeting_id, user_id)
);

-- ============================================================
-- NOTIFICATIONS LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  notification_type VARCHAR(50) CHECK (notification_type IN ('invitation', 'reminder', 'minutes_review', 'minutes_locked', 'update')),
  channel VARCHAR(20) CHECK (channel IN ('email', 'whatsapp')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_attendance_token ON meetings(attendance_token);
CREATE INDEX IF NOT EXISTS idx_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_agendas_meeting ON agendas(meeting_id);
CREATE INDEX IF NOT EXISTS idx_attendance_meeting ON attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_minutes_meeting ON meeting_minutes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_approvals_meeting ON minutes_approvals(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_search ON meetings USING gin(search_vector);

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION meetings_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('indonesian', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('indonesian', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('indonesian', coalesce(NEW.location, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS (idempotent: drop then recreate)
-- ============================================================
DROP TRIGGER IF EXISTS meetings_search_vector_trigger ON meetings;
CREATE TRIGGER meetings_search_vector_trigger
  BEFORE INSERT OR UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION meetings_search_vector_update();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agendas_updated_at ON agendas;
CREATE TRIGGER update_agendas_updated_at
  BEFORE UPDATE ON agendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_minutes_updated_at ON meeting_minutes;
CREATE TRIGGER update_minutes_updated_at
  BEFORE UPDATE ON meeting_minutes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
