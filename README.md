# HMS - Hotel Management System (SBA301 Group Project)

Hệ thống Quản lý Khách sạn (Hotel Management System - HMS) được xây dựng theo kiến trúc **Client-Server 3-Layer** dựa trên tài liệu đặc tả yêu cầu **HMS-SRS v1.3** và tài liệu thiết kế **HMS-SDD v1.1** (với hệ thống phân quyền **10 Roles chuyên biệt**).

## 1. Công Nghệ Sử Dụng (Tech Stack)
- **Database**: Microsoft SQL Server 2019/2022 (24 bảng nghiệp vụ + 2 bảng hệ thống `Refresh_Token`, `System_Error_Log`)
- **Backend**: Java 21, Spring Boot 3.2.5, Spring Security 6 (JWT + RBAC 10 Roles), Spring Data JPA (Hibernate), Jakarta Validation, Springdoc OpenAPI (Swagger 3)
- **Frontend**: React 18 (**Vite + Pure JavaScript / JSX `.js` & `.jsx`**, không sử dụng TypeScript/TSX), React Router DOM v6, React-Bootstrap, Bootstrap 5 & Bootstrap Icons, Axios

---

## 2. Cấu Trúc Thư Mục Dự Án (Monorepo)
```text
Hotel_Management_System/
├── database/
│   ├── V1__init_schema.sql          # Script khởi tạo 24 bảng nghiệp vụ + 2 bảng hệ thống
│   └── V2__seed_master_data.sql     # Dữ liệu mẫu (10 Roles chuyên biệt, 10 Accounts mẫu, 7 Departments, Staff, Customers, Rooms, Services, Vouchers)
├── backend/                         # Spring Boot 3 RESTful API (/api/v1)
├── frontend/                        # ReactJS 18 Single Page Application (JSX + JS thuần)
└── docs/
    └── HMS_Analysis_And_Team_Allocation.md  # Tài liệu phân chia công việc nhóm 5 người
```

---

## 3. Hướng Dẫn Cài Đặt & Chạy Dự Án

### Bước 1: Khởi tạo Cơ sở dữ liệu (SQL Server)
1. Mở **SQL Server Management Studio (SSMS)** hoặc **Azure Data Studio**.
2. Chạy file `database/V1__init_schema.sql` để tạo database `HMS_DB` và toàn bộ bảng.
3. Chạy tiếp file `database/V2__seed_master_data.sql` để nạp dữ liệu mẫu.

### Bước 2: Chạy Backend (Spring Boot)
1. Mở thư mục `backend/` trong IntelliJ IDEA hoặc terminal.
2. Kiểm tra cấu hình kết nối SQL Server trong `backend/src/main/resources/application.yml` (mặc định: `localhost:1433`, database `HMS_DB`, user `sa`, password `123456` — có thể ghi đè qua biến môi trường `DB_USERNAME`, `DB_PASSWORD`).
3. Chạy ứng dụng:
   ```bash
   cd backend
   mvn spring-boot:run
   ```
4. Truy cập Swagger UI tại: `http://localhost:8080/swagger-ui.html`

### Bước 3: Chạy Frontend (ReactJS + Vite)
1. Mở terminal tại thư mục `frontend/`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Mở trình duyệt tại: `http://localhost:5173`

---

## 4. Phân Chia Phân Hệ Nhóm 5 Người
Chi tiết phân công Use Cases (`UC-01` – `UC-51`), bảng Database, màn hình và quy trình Git Flow xem tại:
👉 [docs/HMS_Analysis_And_Team_Allocation.md](./docs/HMS_Analysis_And_Team_Allocation.md)

| Thành viên | Phân hệ phụ trách | Package / Folder chính |
| :--- | :--- | :--- |
| **1. KhangND** | Core Security, Auth, User Admin & Audit/System Logs (`UC-01`..`10`, `UC-48`..`49`) | `controller/auth`, `pages/auth`, `pages/admin` |
| **2. HieuVQ** | Room Types, Inventory, Housekeeping & Maintenance (`UC-11`..`13`, `UC-15`..`20`, `UC-51`) | `controller/room`, `pages/housekeeping`, `pages/manager-rooms` |
| **3. GiapND** | Public Room Search, Online Booking, VNPay & Customer Portal (`UC-14`, `UC-21`..`25`) | `controller/booking`, `pages/booking` |
| **4. TungPV** | Front-Desk Operations: Direct Booking, Check-in, Active Stay, Transfer, Extend (`UC-26`..`30`) | `controller/frontdesk`, `pages/frontdesk` |
| **5. LinhNH** | Services, Folio Billing, Vouchers, Reviews & Analytics Reports (`UC-31`..`47`, `UC-50`) | `controller/billing`, `pages/services-billing`, `pages/reports-reviews` |
