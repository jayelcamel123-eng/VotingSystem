-- Run this after the initial schema exists and before production use.
-- These constraints strengthen database integrity without changing the current app flow.

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'voter'));

ALTER TABLE login
  ADD CONSTRAINT login_username_unique UNIQUE (username);

ALTER TABLE voters
  ADD CONSTRAINT voters_voter_id_unique UNIQUE (voter_id),
  ADD CONSTRAINT voters_grade_check CHECK (grade BETWEEN 7 AND 12),
  ADD CONSTRAINT voters_status_check CHECK (status IN ('active', 'inactive'));

ALTER TABLE elections
  ADD CONSTRAINT elections_dates_check CHECK (end_date > start_date);

ALTER TABLE candidates
  ADD CONSTRAINT candidates_name_check CHECK (candidate_name IS NOT NULL AND btrim(candidate_name) <> ''),
  ADD CONSTRAINT candidates_grade_check CHECK (grade IS NULL OR (grade BETWEEN 7 AND 12));

CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_position_vote
  ON votes (voter_id, election_id, position_id);

CREATE INDEX IF NOT EXISTS votes_election_idx
  ON votes (election_id);

CREATE INDEX IF NOT EXISTS candidates_election_position_idx
  ON candidates (election_id, position_id);
