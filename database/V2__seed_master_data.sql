-- =============================================================================
-- HOTEL MANAGEMENT SYSTEM (HMS) - MASTER SEED DATA
-- Default password for all sample accounts: Admin@123
-- BCrypt Hash (cost 10) for "Admin@123": $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
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
    (1,  N'admin@hms.com',           '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (2,  N'gm@hms.com',              '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (3,  N'sales.manager@hms.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (4,  N'hk.manager@hms.com',      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (5,  N'service.manager@hms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (6,  N'accountant@hms.com',      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (7,  N'frontdesk@hms.com',       '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (8,  N'housekeeping@hms.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (9,  N'service@hms.com',         '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE'),
    (10, N'customer@gmail.com',      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', N'ACTIVE');
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

-- 6. Seed Room Types
IF NOT EXISTS (SELECT 1 FROM dbo.[Room_Type])
BEGIN
    INSERT INTO dbo.[Room_Type] (type_name, capacity, base_price, amenities, description, is_active) VALUES
    (N'Standard Twin',   2, 850000.00,  N'Wi-Fi, Smart TV 43", Air Conditioning, Minibar, Work Desk', N'Phòng tiêu chuẩn 2 giường đơn hiện đại, phù hợp công tác và du lịch ngắn ngày.', 1),
    (N'Deluxe King',     2, 1350000.00, N'Wi-Fi, Smart TV 55", Bathtub, Balcony, Minibar, Safe Box',  N'Phòng Deluxe giường cỡ King có ban công hướng phố và bồn tắm nằm.', 1),
    (N'Family Suite',    4, 2200000.00, N'Wi-Fi, 2 Queen Beds, Living Area, Kitchenette, Bathtub',    N'Phòng Suite gia đình rộng rãi gồm 2 giường lớn và khu vực tiếp khách riêng.', 1),
    (N'Executive Suite', 2, 3100000.00, N'Wi-Fi, King Bed, Jacuzzi, Lounge Access, Espresso Machine', N'Phòng hạng sang tầng cao với phòng khách riêng biệt và dịch vụ cao cấp.', 1);
END
GO

-- 7. Seed Physical Rooms
IF NOT EXISTS (SELECT 1 FROM dbo.[Room])
BEGIN
    INSERT INTO dbo.[Room] (room_type_id, room_number, floor, stay_status, cleaning_status, room_status, notes) VALUES
    (1, N'101', 1, N'VACANT',   N'INSPECTED', N'ACTIVE', N'Near elevator'),
    (1, N'102', 1, N'VACANT',   N'CLEAN',     N'ACTIVE', NULL),
    (1, N'103', 1, N'VACANT',   N'DIRTY',     N'ACTIVE', N'Just checked out'),
    (2, N'201', 2, N'VACANT',   N'INSPECTED', N'ACTIVE', N'City view'),
    (2, N'202', 2, N'VACANT',   N'INSPECTED', N'ACTIVE', N'City view'),
    (2, N'203', 2, N'VACANT',   N'DIRTY',     N'UNDER_MAINTENANCE', N'AC maintenance'),
    (3, N'301', 3, N'VACANT',   N'INSPECTED', N'ACTIVE', N'Corner family room'),
    (4, N'401', 4, N'VACANT',   N'INSPECTED', N'ACTIVE', N'VIP Penthouse Suite');
END
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
