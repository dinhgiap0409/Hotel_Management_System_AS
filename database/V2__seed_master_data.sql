successfully downloaded text file (SHA: fc90f85f684b23a0882f45b826f0a6cb53468836)-- =============================================================================
-- HOTEL MANAGEMENT SYSTEM (HMS) - MASTER SEED DATA
-- Default password for all sample accounts: Admin@123
-- BCrypt Hash (cost 10) for "Admin@123": $2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76
-- =============================================================================

USE [HMS_DB];
GO

-- 1. Seed 10 Specialized Roles (Separated per Mentor Feedback & SRS Section 1.1)
IF NOT EXISTS (SELECT 1 FROM dbo.[Role])
BEGIN
    INSERT INTO dbo.[Role] (role_name, description) VALUES
    (N'ADMIN',                N'IT System Administrator governing user accounts, role assignments, and security audit logs (UC-07..09, UC-48..49)'),
    (N'GENERAL_MANAGER',      N'Executive Hotel General Manager overseeing property-wide occupancy, revenue, service reports, and operational audit logs (UC-45..50)'),
    (N'SALES_MANAGER',        N'Sales & Marketing Manager configuring room categories, tariffs, promotional vouchers, and moderating guest reviews (UC-11..14, UC-43..45)'),
    (N'HOUSEKEEPING_MANAGER', N'Housekeeping Supervisor/Manager managing physical room inventory, assigning cleaning tasks, and overseeing maintenance lockouts (UC-15..20, UC-51)'),
    (N'SERVICE_MANAGER',      N'Ancillary Service Manager configuring F&B/Spa/Laundry service catalogs, tariffs, and analyzing service consumption (UC-31..34, UC-47)'),
    (N'ACCOUNTANT',           N'Hotel Accountant reconciling folio invoices, payment settlements, revenue analytics, and financial exports (UC-46, UC-47, UC-50)'),
    (N'FRONT_DESK',           N'Front-Desk Receptionist handling reservations, guest check-in, room transfers, stay extensions, billing, and check-out (UC-21..30, UC-37..40)'),
    (N'HOUSEKEEPING',         N'Housekeeping Floor Staff executing assigned room cleaning tasks (Dirty -> Clean -> Inspected) and reporting malfunctions (UC-18..20)'),
    (N'SERVICE_STAFF',        N'Ancillary Service Staff fulfilling guest room service orders and posting charges to active stay folios (UC-34..36)'),
    (N'CUSTOMER',             N'External hotel guest searching rooms, booking online, ordering in-stay services, and submitting reviews (UC-01, UC-21..25, UC-41)');
END
GO

-- 2. Seed Sample Accounts (9 Internal Staff/Manager roles + 1 Customer)
IF NOT EXISTS (SELECT 1 FROM dbo.[Account])
BEGIN
    INSERT INTO dbo.[Account] (role_id, email, password_hash, status) VALUES
    (1,  N'admin@hms.com',           '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (2,  N'gm@hms.com',              '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (3,  N'sales.manager@hms.com',   '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (4,  N'hk.manager@hms.com',      '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (5,  N'service.manager@hms.com', '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (6,  N'accountant@hms.com',      '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (7,  N'frontdesk@hms.com',       '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (8,  N'housekeeping@hms.com',    '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (9,  N'service@hms.com',         '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE'),
    (10, N'customer@gmail.com',      '$2a$10$.cIM9Fza/3AtZ5yZwoUD6emyp9rDA0m/Q2CoQgYZ3VFs4O3xwXP76', N'ACTIVE');
END
GO

-- 3. Seed Functional Departments (Matching SRS Section 1.1 Organizational Context)
IF NOT EXISTS (SELECT 1 FROM dbo.[Department])
BEGIN
    INSERT INTO dbo.[Department] (manager_id, department_name, description) VALUES
    (NULL, N'IT & Technical Department',       N'System administration, user access control, and security audit management'),
    (NULL, N'Executive Management Board',      N'General hotel direction, operational supervision, and strategic analytics'),
    (NULL, N'Sales & Marketing Department',    N'Room category tariffs, promotional vouchers, occupancy trends, and guest review management'),
    (NULL, N'Housekeeping Department',         N'Physical room inventory, floor sanitation task assignment, and maintenance coordination'),
    (NULL, N'Services & Ancillary Division',   N'Food & Beverage, Room Service, Minibar, Spa, and Laundry operations'),
    (NULL, N'Accounting & Finance Department', N'Revenue ledgers, invoice settlement reconciliation, and financial reporting'),
    (NULL, N'Front Office Department',         N'Reception desk, reservations, guest check-in/out, and stay coordination');
END
GO

-- 4. Seed Staff Records for the 9 Internal Accounts
IF NOT EXISTS (SELECT 1 FROM dbo.[Staff])
BEGIN
    INSERT INTO dbo.[Staff] (account_id, department_id, staff_code, full_name, gender, phone, email, hire_date, employment_status) VALUES
    (1, 1, 'STF-001', N'Nguyễn Đình Khang (IT Admin)',          N'Nam', '0901000001', N'admin@hms.com',           '2025-01-15', N'ACTIVE'),
    (2, 2, 'STF-002', N'Nguyễn Thị Linh (General Manager)',     N'Nữ',  '0901000002', N'gm@hms.com',              '2025-01-20', N'ACTIVE'),
    (3, 3, 'STF-003', N'Nguyễn Đức Giáp (Sales Manager)',       N'Nam', '0901000003', N'sales.manager@hms.com',   '2025-02-01', N'ACTIVE'),
    (4, 4, 'STF-004', N'Vũ Quang Hiếu (Housekeeping Manager)',  N'Nam', '0901000004', N'hk.manager@hms.com',      '2025-02-10', N'ACTIVE'),
    (5, 5, 'STF-005', N'Nguyễn Thị Linh (Service Manager)',     N'Nữ',  '0901000005', N'service.manager@hms.com', '2025-02-15', N'ACTIVE'),
    (6, 6, 'STF-006', N'Lê Hoàng Kế Toán (Accountant)',         N'Nữ',  '0901000006', N'accountant@hms.com',      '2025-03-01', N'ACTIVE'),
    (7, 7, 'STF-007', N'Phạm Văn Tùng (Front-Desk Staff)',      N'Nam', '0901000007', N'frontdesk@hms.com',       '2025-03-10', N'ACTIVE'),
    (8, 4, 'STF-008', N'Trần Văn Buồng Phòng (HK Staff)',       N'Nam', '0901000008', N'housekeeping@hms.com',    '2025-03-15', N'ACTIVE'),
    (9, 5, 'STF-009', N'Hoàng Minh Dịch Vụ (Service Staff)',    N'Nam', '0901000009', N'service@hms.com',         '2025-04-01', N'ACTIVE');
END
GO

-- Update Department Managers to their respective specialized Manager Staff IDs
UPDATE dbo.[Department] SET manager_id = 1 WHERE department_id = 1; -- IT Admin
UPDATE dbo.[Department] SET manager_id = 2 WHERE department_id = 2; -- General Manager
UPDATE dbo.[Department] SET manager_id = 3 WHERE department_id = 3; -- Sales & Marketing Manager
UPDATE dbo.[Department] SET manager_id = 4 WHERE department_id = 4; -- Housekeeping Manager
UPDATE dbo.[Department] SET manager_id = 5 WHERE department_id = 5; -- Service Manager
UPDATE dbo.[Department] SET manager_id = 6 WHERE department_id = 6; -- Accountant
UPDATE dbo.[Department] SET manager_id = 2 WHERE department_id = 7; -- Front Office reports to GM
GO

-- 5. Seed Sample Customer
IF NOT EXISTS (SELECT 1 FROM dbo.[Customer])
BEGIN
    INSERT INTO dbo.[Customer] (account_id, created_by_staff_id, full_name, email, phone, identity_number) VALUES
    (10, NULL, N'Trần Minh Khách', N'customer@gmail.com', '0912345678', '001200012345');
END
GO

-- 6. Seed Room Types (9 Active Categories - Idempotent per category)
IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Standard Twin')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Standard Twin', 2, 850000.00, N'Wi-Fi, Smart TV 43", Air Conditioning, Minibar, Work Desk', N'Phòng tiêu chuẩn 2 giường đơn hiện đại, phù hợp công tác và du lịch ngắn ngày.', N'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Phòng tiêu chuẩn 2 giường đơn hiện đại, phù hợp công tác và du lịch ngắn ngày.', image_url = N'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Standard Twin';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Superior Double')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Superior Double', 2, 1100000.00, N'Wi-Fi, Queen Bed, Smart TV 50", Rain Shower, Minibar, Tea/Coffee Maker', N'Phòng Superior giường đôi ấm cúng với cửa sổ lớn đón nắng tự nhiên và nội thất gỗ cao cấp.', N'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Phòng Superior giường đôi ấm cúng với cửa sổ lớn đón nắng tự nhiên và nội thất gỗ cao cấp.', image_url = N'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Superior Double';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Deluxe King')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Deluxe King', 2, 1350000.00, N'Wi-Fi, Smart TV 55", Bathtub, Balcony, Minibar, Safe Box', N'Phòng Deluxe giường cỡ King có ban công hướng phố và bồn tắm nằm thư giãn.', N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Phòng Deluxe giường cỡ King có ban công hướng phố và bồn tắm nằm thư giãn.', image_url = N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Deluxe King';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Deluxe Twin City View')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Deluxe Twin City View', 2, 1550000.00, N'Wi-Fi, 2 Twin Beds, Panorama Window, Bathtub, Work Lounge, Safe Box', N'Phòng Deluxe 2 giường đơn tầm nhìn toàn cảnh thành phố về đêm, trang bị bàn làm việc rộng rãi.', N'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Phòng Deluxe 2 giường đơn tầm nhìn toàn cảnh thành phố về đêm, trang bị bàn làm việc rộng rãi.', image_url = N'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Deluxe Twin City View';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Premier Panorama King')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Premier Panorama King', 3, 1850000.00, N'Wi-Fi, King Bed + Daybed, Balcony, Bathtub, Espresso Machine, Smart TV 55"', N'Phòng Premier góc 2 mặt thoáng với ghế sofa thư giãn, máy pha cà phê viên nén và ban công riêng.', N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Phòng Premier góc 2 mặt thoáng với ghế sofa thư giãn, máy pha cà phê viên nén và ban công riêng.', image_url = N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Premier Panorama King';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Family Suite')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Family Suite', 4, 2200000.00, N'Wi-Fi, 2 Queen Beds, Living Area, Kitchenette, Bathtub, Dining Table', N'Phòng Suite gia đình rộng rãi gồm 2 giường lớn, bếp nhỏ tiện nghi và khu vực tiếp khách riêng.', N'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Phòng Suite gia đình rộng rãi gồm 2 giường lớn, bếp nhỏ tiện nghi và khu vực tiếp khách riêng.', image_url = N'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Family Suite';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Garden Villa Suite')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Garden Villa Suite', 4, 2650000.00, N'Wi-Fi, Private Terrace, 2 Bedrooms, Outdoor Jacuzzi, Minibar, Butler Service', N'Biệt thự sân vườn biệt lập với sân hiên riêng tư, bồn sục ngoài trời và không gian xanh mát.', N'https://images.unsplash.com/photo-1540518614846-7ede433c4573?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Biệt thự sân vườn biệt lập với sân hiên riêng tư, bồn sục ngoài trời và không gian xanh mát.', image_url = N'https://images.unsplash.com/photo-1540518614846-7ede433c4573?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Garden Villa Suite';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Executive Suite')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Executive Suite', 2, 3100000.00, N'Wi-Fi, King Bed, Jacuzzi, Executive Lounge, Espresso Machine, Walk-in Closet', N'Phòng hạng sang tầng cao với phòng khách riêng biệt và đặc quyền sử dụng Executive Lounge.', N'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Phòng hạng sang tầng cao với phòng khách riêng biệt và đặc quyền sử dụng Executive Lounge.', image_url = N'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Executive Suite';

IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type] WHERE type_name = N'Presidential Penthouse')
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, image_url, is_active)
    VALUES (N'Presidential Penthouse', 6, 4800000.00, N'Wi-Fi, 3 Bedrooms, Private Pool, Jacuzzi, Grand Piano, 24/7 Butler, Bar', N'Tuyệt tác Penthouse tầng thượng sang trọng bậc nhất với hồ bơi riêng, phòng tiệc và quản gia 24/7.', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1000&q=80', 1);
ELSE
    UPDATE dbo.[Room_Type] SET description = N'Tuyệt tác Penthouse tầng thượng sang trọng bậc nhất với hồ bơi riêng, phòng tiệc và quản gia 24/7.', image_url = N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1000&q=80' WHERE type_name = N'Presidential Penthouse';
GO

-- 7. Seed Physical Rooms (Idempotent by room_number & looked-up room_type_id)
DECLARE @rtStandard INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Standard Twin');
DECLARE @rtSuperior INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Superior Double');
DECLARE @rtDeluxeKing INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Deluxe King');
DECLARE @rtDeluxeTwin INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Deluxe Twin City View');
DECLARE @rtPremier INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Premier Panorama King');
DECLARE @rtFamily INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Family Suite');
DECLARE @rtVilla INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Garden Villa Suite');
DECLARE @rtExec INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Executive Suite');
DECLARE @rtPenthouse INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Presidential Penthouse');

IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'101') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtStandard, N'101', 1, N'VACANT', N'INSPECTED', N'ACTIVE', N'Near elevator');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'102') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtStandard, N'102', 1, N'VACANT', N'CLEAN', N'ACTIVE', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'103') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtStandard, N'103', 1, N'VACANT', N'DIRTY', N'ACTIVE', N'Just checked out');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'104') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtSuperior, N'104', 1, N'VACANT', N'INSPECTED', N'ACTIVE', N'Quiet garden side');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'105') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtSuperior, N'105', 1, N'VACANT', N'INSPECTED', N'ACTIVE', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'201') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtDeluxeKing, N'201', 2, N'VACANT', N'INSPECTED', N'ACTIVE', N'City view');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'202') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtDeluxeKing, N'202', 2, N'VACANT', N'INSPECTED', N'ACTIVE', N'City view');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'203') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtDeluxeKing, N'203', 2, N'VACANT', N'DIRTY', N'UNDER_MAINTENANCE', N'AC maintenance');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'204') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtDeluxeTwin, N'204', 2, N'VACANT', N'INSPECTED', N'ACTIVE', N'High floor twin');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'205') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtDeluxeTwin, N'205', 2, N'VACANT', N'CLEAN', N'ACTIVE', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'301') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtFamily, N'301', 3, N'VACANT', N'INSPECTED', N'ACTIVE', N'Corner family room');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'302') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtPremier, N'302', 3, N'VACANT', N'INSPECTED', N'ACTIVE', N'Corner panorama');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'303') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtPremier, N'303', 3, N'VACANT', N'INSPECTED', N'ACTIVE', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'304') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtFamily, N'304', 3, N'VACANT', N'INSPECTED', N'ACTIVE', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'401') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtExec, N'401', 4, N'VACANT', N'INSPECTED', N'ACTIVE', N'VIP Penthouse Suite');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'402') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtVilla, N'402', 4, N'VACANT', N'INSPECTED', N'ACTIVE', N'Garden terrace');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'403') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtVilla, N'403', 4, N'VACANT', N'CLEAN', N'ACTIVE', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'501') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtExec, N'501', 5, N'VACANT', N'INSPECTED', N'ACTIVE', N'Executive floor');
IF NOT EXISTS (SELECT 1 FROM dbo.[Room] WHERE room_number = N'601') INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES (@rtPenthouse, N'601', 6, N'VACANT', N'INSPECTED', N'ACTIVE', N'VIP Presidential Penthouse');
GO

-- 8. Seed Hotel Services
IF NOT EXISTS (SELECT 1 FROM dbo.[Hotel_Service])
BEGIN
    INSERT INTO dbo.[Hotel_Service] (service_name, category, billing_unit, unit_price, description, status) VALUES
    (N'Buffet Sáng Quốc Tế',     N'F&B',       N'PAX',     250000.00, N'Buffet sáng tại nhà hàng tầng 1 từ 06:00 - 10:00', N'ACTIVE'),
    (N'Giặt Là Nhanh (Express)', N'LAUNDRY',   N'KG',      120000.00, N'Giặt sấy và ủi trả trong ngày', N'ACTIVE'),
    (N'Spa Thư Giãn Toàn Thân',  N'SPA',       N'SESSION', 650000.00, N'Liệu trình massage đá nóng 60 phút', N'ACTIVE'),
    (N'Combo Minibar Tiêu Chuẩn',N'MINIBAR',   N'SET',     180000.00, N'Nước suối, nước ngọt và snack tại phòng', N'ACTIVE'),
    (N'Đưa Đón Sân Bay Nội Bài', N'TRANSPORT', N'TRIP',    450000.00, N'Xe 4-7 chỗ đưa đón sân bay riêng', N'ACTIVE');
END
GO

-- 9. Seed Promotional Vouchers
IF NOT EXISTS (SELECT 1 FROM dbo.[Voucher])
BEGIN
    INSERT INTO dbo.[Voucher] (code, discount_type, discount_value, valid_from, valid_to, min_spend, max_discount_amount, usage_limit, used_count, status) VALUES
    ('WELCOME10',  N'PERCENTAGE',   10.00,     '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1000000.00, 500000.00, 500, 0, N'ACTIVE'),
    ('SUMMER200K', N'FIXED_AMOUNT', 200000.00, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1500000.00, 200000.00, 200, 0, N'ACTIVE');
END
GO

-- 10. Seed Room_Type_Price (Day-of-Week Tariffs for UC-22: Mon-Thu standard base_price, Fri-Sun +10% to +15%)
INSERT INTO dbo.[Room_Type_Price] (room_type_id, day_of_week, price, effective_from, effective_to, is_active)
SELECT rt.room_type_id, d.day_of_week,
       CASE
           WHEN d.day_of_week IN (5, 6) THEN ROUND(rt.base_price * 1.15, -3)
           WHEN d.day_of_week = 7       THEN ROUND(rt.base_price * 1.10, -3)
           ELSE rt.base_price
       END,
       '2026-01-01', '2027-12-31', 1
FROM dbo.[Room_Type] rt
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) AS d(day_of_week)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.[Room_Type_Price] rtp
    WHERE rtp.room_type_id = rt.room_type_id AND rtp.day_of_week = d.day_of_week
);
GO

-- 11. Seed Sample Completed Stays & Verified Guest Reviews for UC-22 & UC-42
DECLARE @custId INT = (SELECT TOP 1 customer_id FROM dbo.[Customer] ORDER BY customer_id);
IF @custId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.[Review])
BEGIN
    DECLARE @rt1 INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Standard Twin');
    DECLARE @rt2 INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Deluxe King');
    DECLARE @rt3 INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Family Suite');
    DECLARE @rt4 INT = (SELECT room_type_id FROM dbo.[Room_Type] WHERE type_name = N'Executive Suite');

    DECLARE @rm101 INT = (SELECT room_id FROM dbo.[Room] WHERE room_number = N'101');
    DECLARE @rm201 INT = (SELECT room_id FROM dbo.[Room] WHERE room_number = N'201');
    DECLARE @rm301 INT = (SELECT room_id FROM dbo.[Room] WHERE room_number = N'301');
    DECLARE @rm401 INT = (SELECT room_id FROM dbo.[Room] WHERE room_number = N'401');

    -- Completed Reservation 1 (Standard Twin)
    INSERT INTO dbo.[Reservation] (customer_id, reservation_code, reservation_date, check_in_date, check_out_date, guest_count, status, contact_name, contact_email, contact_phone, hold_expires_at)
    VALUES (@custId, 'BK-2026-REV01', '2026-09-10 09:00:00', '2026-09-12', '2026-09-14', 2, N'COMPLETED', N'Trần Minh Khách', N'customer@gmail.com', '0912345678', '2026-09-11 09:00:00');
    DECLARE @res1 INT = SCOPE_IDENTITY();
    INSERT INTO dbo.[Reservation_Detail] (reservation_id, room_type_id, quantity) VALUES (@res1, @rt1, 1);
    INSERT INTO dbo.[Guest_Stay] (reservation_id, actual_check_in, actual_check_out, guest_id_number, key_card_number, status)
    VALUES (@res1, '2026-09-12 14:05:00', '2026-09-14 11:30:00', '001200012345', 'KEY-101', N'COMPLETED');
    DECLARE @stay1 INT = SCOPE_IDENTITY();
    IF @rm101 IS NOT NULL INSERT INTO dbo.[Stay_Room_Assignment] (stay_id, room_id, assigned_from, assigned_to) VALUES (@stay1, @rm101, '2026-09-12 14:05:00', '2026-09-14 11:30:00');
    INSERT INTO dbo.[Review] (customer_id, stay_id, rating, comment, review_date, is_hidden, management_reply, replied_at)
    VALUES (@custId, @stay1, 5, N'Phòng rất sạch sẽ, giường êm ái, bàn làm việc rộng rãi và Wi-Fi tốc độ cao. Rất hài lòng với kỳ công tác tại HMS Luxury!', '2026-09-15 10:00:00', 0, N'Cảm ơn quý khách Trần Minh Khách đã tin tưởng lựa chọn HMS Luxury Hotel. Rất mong được đón tiếp quý khách trong các chuyến công tác tiếp theo!', '2026-09-15 14:00:00');

    -- Completed Reservation 2 (Deluxe King)
    INSERT INTO dbo.[Reservation] (customer_id, reservation_code, reservation_date, check_in_date, check_out_date, guest_count, status, contact_name, contact_email, contact_phone, hold_expires_at)
    VALUES (@custId, 'BK-2026-REV02', '2026-09-20 10:00:00', '2026-09-22', '2026-09-25', 2, N'COMPLETED', N'Nguyễn Lan Anh', N'lananh@gmail.com', '0987654321', '2026-09-21 10:00:00');
    DECLARE @res2 INT = SCOPE_IDENTITY();
    INSERT INTO dbo.[Reservation_Detail] (reservation_id, room_type_id, quantity) VALUES (@res2, @rt2, 1);
    INSERT INTO dbo.[Guest_Stay] (reservation_id, actual_check_in, actual_check_out, guest_id_number, key_card_number, status)
    VALUES (@res2, '2026-09-22 14:15:00', '2026-09-25 11:45:00', '001200099999', 'KEY-201', N'COMPLETED');
    DECLARE @stay2 INT = SCOPE_IDENTITY();
    IF @rm201 IS NOT NULL INSERT INTO dbo.[Stay_Room_Assignment] (stay_id, room_id, assigned_from, assigned_to) VALUES (@stay2, @rm201, '2026-09-22 14:15:00', '2026-09-25 11:45:00');
    INSERT INTO dbo.[Review] (customer_id, stay_id, rating, comment, review_date, is_hidden, management_reply, replied_at)
    VALUES (@custId, @stay2, 5, N'Ban công hướng phố cực đẹp về đêm, bồn tắm nằm thư giãn và nhân viên lễ tân hỗ trợ nhận phòng rất nhiệt tình.', '2026-09-26 09:30:00', 0, N'Ban Quản lý HMS Luxury chân thành cảm ơn đánh giá 5 sao của quý khách!', '2026-09-26 15:20:00');

    -- Completed Reservation 3 (Family Suite)
    INSERT INTO dbo.[Reservation] (customer_id, reservation_code, reservation_date, check_in_date, check_out_date, guest_count, status, contact_name, contact_email, contact_phone, hold_expires_at)
    VALUES (@custId, 'BK-2026-REV03', '2026-10-01 08:00:00', '2026-10-03', '2026-10-06', 4, N'COMPLETED', N'Phạm Quốc Bảo', N'quocbao@gmail.com', '0933445566', '2026-10-02 08:00:00');
    DECLARE @res3 INT = SCOPE_IDENTITY();
    INSERT INTO dbo.[Reservation_Detail] (reservation_id, room_type_id, quantity) VALUES (@res3, @rt3, 1);
    INSERT INTO dbo.[Guest_Stay] (reservation_id, actual_check_in, actual_check_out, guest_id_number, key_card_number, status)
    VALUES (@res3, '2026-10-03 14:00:00', '2026-10-06 11:50:00', '001200088888', 'KEY-301', N'COMPLETED');
    DECLARE @stay3 INT = SCOPE_IDENTITY();
    IF @rm301 IS NOT NULL INSERT INTO dbo.[Stay_Room_Assignment] (stay_id, room_id, assigned_from, assigned_to) VALUES (@stay3, @rm301, '2026-10-03 14:00:00', '2026-10-06 11:50:00');
    INSERT INTO dbo.[Review] (customer_id, stay_id, rating, comment, review_date, is_hidden, management_reply, replied_at)
    VALUES (@custId, @stay3, 4, N'Phòng Family Suite rất rộng rãi cho gia đình 4 người, có khu bếp nhỏ tiện lợi và phòng khách riêng biệt.', '2026-10-07 11:00:00', 0, N'Cảm ơn gia đình quý khách đã nghỉ dưỡng tại HMS Luxury Hotel!', '2026-10-07 16:00:00');

    -- Completed Reservation 4 (Executive Suite)
    INSERT INTO dbo.[Reservation] (customer_id, reservation_code, reservation_date, check_in_date, check_out_date, guest_count, status, contact_name, contact_email, contact_phone, hold_expires_at)
    VALUES (@custId, 'BK-2026-REV04', '2026-10-12 08:00:00', '2026-10-14', '2026-10-16', 2, N'COMPLETED', N'Lê Hoàng Nam', N'hoangnam@gmail.com', '0977889900', '2026-10-13 08:00:00');
    DECLARE @res4 INT = SCOPE_IDENTITY();
    INSERT INTO dbo.[Reservation_Detail] (reservation_id, room_type_id, quantity) VALUES (@res4, @rt4, 1);
    INSERT INTO dbo.[Guest_Stay] (reservation_id, actual_check_in, actual_check_out, guest_id_number, key_card_number, status)
    VALUES (@res4, '2026-10-14 14:00:00', '2026-10-16 12:00:00', '001200077777', 'KEY-401', N'COMPLETED');
    DECLARE @stay4 INT = SCOPE_IDENTITY();
    IF @rm401 IS NOT NULL INSERT INTO dbo.[Stay_Room_Assignment] (stay_id, room_id, assigned_from, assigned_to) VALUES (@stay4, @rm401, '2026-10-14 14:00:00', '2026-10-16 12:00:00');
    INSERT INTO dbo.[Review] (customer_id, stay_id, rating, comment, review_date, is_hidden, management_reply, replied_at)
    VALUES (@custId, @stay4, 5, N'Trải nghiệm đẳng cấp 5 sao thực thụ! Bồn sục Jacuzzi, máy pha Espresso tại phòng và đặc quyền Executive Lounge quá tuyệt vời.', '2026-10-17 09:15:00', 0, N'Cảm ơn quý khách đã dành lời khen ngợi cho dịch vụ Executive Suite của HMS Luxury!', '2026-10-17 13:40:00');
END
GO
