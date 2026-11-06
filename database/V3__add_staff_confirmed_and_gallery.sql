-- =============================================================================
-- V3: staff_confirmed (Service_Order) + gallery_images (Room_Type)
-- Run after V1/V2 on an existing HMS_DB. Fresh installs already get these
-- columns from V1__init_schema.sql. Idempotent: each ALTER is guarded.
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('dbo.[Service_Order]') AND name = 'staff_confirmed')
BEGIN
    ALTER TABLE dbo.[Service_Order]
        ADD staff_confirmed BIT NOT NULL CONSTRAINT DF_Service_Order_staff_confirmed DEFAULT 0;
    -- Backfill: rows whose cancel_reason still carries the legacy marker.
    UPDATE dbo.[Service_Order]
       SET staff_confirmed = 1
     WHERE cancel_reason LIKE N'%[ĐÃ XÁC NHẬN]%';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('dbo.[Room_Type]') AND name = 'gallery_images')
BEGIN
    ALTER TABLE dbo.[Room_Type] ADD gallery_images NVARCHAR(MAX) NULL;
END
GO
