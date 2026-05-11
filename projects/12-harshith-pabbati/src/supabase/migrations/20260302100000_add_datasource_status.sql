-- Add status column to datasource table to track embedding progress
ALTER TABLE datasource
  ADD COLUMN status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'error'));
