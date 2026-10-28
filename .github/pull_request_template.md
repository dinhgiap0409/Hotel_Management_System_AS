## Mô tả thay đổi (Description)
- **Phân hệ (Module)**: [ ] Module 1 (Auth/Admin) | [ ] Module 2 (Room/Housekeeping) | [ ] Module 3A (Online Booking) | [ ] Module 3B (Front-Desk) | [ ] Module 4 & 5 (Services/Billing/Reports)
- **Use Case liên quan**: `UC-XX`
- **Tóm tắt công việc**:
  - 

## Checklist trước khi Merge (Self-Review)
- [ ] Đã pull và rebase/merge code mới nhất từ nhánh `develop` (`git pull origin develop`).
- [ ] Không sửa trực tiếp vào các file dùng chung của thành viên khác nếu chưa trao đổi.
- [ ] Backend: Controller chỉ gọi Service, trả về DTO (không trả trực tiếp JPA Entity).
- [ ] Backend: Đã sử dụng mã lỗi chuẩn (`MSG01A` - `MSG12B`) và `@Transactional` cho các thao tác ghi nhiều bảng.
- [ ] Frontend: Không lưu Access Token vào `localStorage`, gọi API qua `src/lib/http.ts`.
- [ ] Đã build thử không lỗi (`mvn compile` / `npm run build`).
