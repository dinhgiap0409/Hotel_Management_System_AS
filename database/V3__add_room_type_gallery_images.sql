-- =============================================================================
-- V3: Room_Type.gallery_images (UC-22 detail gallery)
-- Run after V1/V2 on an existing HMS_DB. Fresh installs already get this
-- column from V1__init_schema.sql. Idempotent: the ALTER is guarded.
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('dbo.[Room_Type]') AND name = 'gallery_images')
BEGIN
    ALTER TABLE dbo.[Room_Type] ADD gallery_images NVARCHAR(MAX) NULL;
END
GO
