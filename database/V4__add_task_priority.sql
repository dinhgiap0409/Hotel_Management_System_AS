-- =============================================================================
-- V4: Housekeeping_Task.priority (UC-51)
-- Run after V1/V2/V3 on an existing HMS_DB. Idempotent: the ALTER and the
-- backfill are guarded, so the script is safe to run more than once.
-- SRS UC-51: "Manager inputs cleaning priority or instructions" — the old
-- schema only had `note`, so the API answered a hardcoded "NORMAL" priority.
-- Values: LOW, NORMAL, HIGH, URGENT (default NORMAL).
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('dbo.[Housekeeping_Task]') AND name = 'priority')
BEGIN
    ALTER TABLE dbo.[Housekeeping_Task] ADD priority NVARCHAR(20) NULL;
END
GO

UPDATE dbo.[Housekeeping_Task] SET priority = N'NORMAL' WHERE priority IS NULL;
GO
