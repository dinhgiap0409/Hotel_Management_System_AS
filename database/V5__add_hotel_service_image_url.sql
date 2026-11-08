-- =============================================================================
-- V5: Hotel_Service.image_url (UC-31, UC-32, UC-34)
-- Run after V1/V2/V3/V4 on an existing HMS_DB. Idempotent: safe to run repeatedly.
-- Adds image_url column to Hotel_Service and seeds curated imagery
-- ONLY for the 5 default master data services.
-- =============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.[Hotel_Service]') AND name = 'image_url'
)
BEGIN
    ALTER TABLE dbo.[Hotel_Service] ADD image_url NVARCHAR(500) NULL;
END
GO

-- 1. Buffet Sáng Quốc Tế
UPDATE dbo.[Hotel_Service]
SET image_url = 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=80'
WHERE service_name = N'Buffet Sáng Quốc Tế';

-- 2. Giặt Là Nhanh (Express)
UPDATE dbo.[Hotel_Service]
SET image_url = 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=800&q=80'
WHERE service_name = N'Giặt Là Nhanh (Express)';

-- 3. Spa Thư Giãn Toàn Thân
UPDATE dbo.[Hotel_Service]
SET image_url = 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=800&q=80'
WHERE service_name = N'Spa Thư Giãn Toàn Thân';

-- 4. Combo Minibar Tiêu Chuẩn
UPDATE dbo.[Hotel_Service]
SET image_url = 'https://cdn2.fptshop.com.vn/unsafe/Uploads/images/tin-tuc/181226/Originals/tim-hieu-kich-thuoc-minibar-trong-khach-san-pho-bien-hien-nay-2.jpg'
WHERE service_name = N'Combo Minibar Tiêu Chuẩn';

-- 5. Đưa Đón Sân Bay Nội Bài
UPDATE dbo.[Hotel_Service]
SET image_url = 'https://www.noibaivip247.com/Portals/29370/noibaivip247/xe-di-tu-san-bay-noi-bai-ve-thai-binh-2-768x562.jpg'
WHERE service_name = N'Đưa Đón Sân Bay Nội Bài';
GO
