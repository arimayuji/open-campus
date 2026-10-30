-- A track is an ordered group of lectures, for example "Machine learning foundations".
ALTER TABLE lessons ADD COLUMN track TEXT NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN track_order INTEGER NOT NULL DEFAULT 0;
