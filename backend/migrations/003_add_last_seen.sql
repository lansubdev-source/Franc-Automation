-- 003_add_last_seen.sql
ALTER TABLE devices
ADD COLUMN last_seen DATETIME;
