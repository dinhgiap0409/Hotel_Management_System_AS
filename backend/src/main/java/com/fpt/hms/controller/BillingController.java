package com.fpt.hms.controller;

import com.fpt.hms.dto.billing_report.*;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.entity.HotelService;
import com.fpt.hms.entity.Voucher;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.BillingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Module 4 (Owner: LinhNH) - Ancillary Services (SERVICE_MANAGER & SERVICE_STAFF) & Folio Billing (FRONT_DESK & ACCOUNTANT) (UC-31 to UC-40).
 */
@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
@Tag(name = "4. Ancillary Services & Folio Billing (Module 4 - LinhNH)")
public class BillingController {

    private final BillingService billingService;

    // ---------------------------------------------------------------- UC-31..34 Service catalog

    @GetMapping("/services")
    @Operation(summary = "UC-34: List active hotel services (any authenticated user)")
    public ResponseEntity<List<HotelService>> listServices() {
        return ResponseEntity.ok(billingService.getActiveServices());
    }

    @GetMapping("/services/all")
    @PreAuthorize("hasAnyRole('SERVICE_MANAGER', 'GENERAL_MANAGER')")
    @Operation(summary = "List all services including INACTIVE (SERVICE_MANAGER, GENERAL_MANAGER)")
    public ResponseEntity<List<HotelService>> listAllServices() {
        return ResponseEntity.ok(billingService.getAllServices());
    }

    @PostMapping("/services")
    @PreAuthorize("hasRole('SERVICE_MANAGER')")
    @Operation(summary = "UC-31: Create a new ancillary service (SERVICE_MANAGER)")
    public ResponseEntity<HotelService> createService(@Valid @RequestBody HotelServiceRequest request) {
        return ResponseEntity.ok(billingService.createService(request));
    }

    @PutMapping("/services/{serviceId}")
    @PreAuthorize("hasRole('SERVICE_MANAGER')")
    @Operation(summary = "UC-32: Update service information and unit price (SERVICE_MANAGER)")
    public ResponseEntity<HotelService> updateService(@PathVariable Integer serviceId,
                                                      @Valid @RequestBody HotelServiceRequest request) {
        return ResponseEntity.ok(billingService.updateService(serviceId, request));
    }

    @PatchMapping("/services/{serviceId}/status")
    @PreAuthorize("hasRole('SERVICE_MANAGER')")
    @Operation(summary = "UC-33: Discontinue (INACTIVE) or reactivate (ACTIVE) a service (SERVICE_MANAGER)")
    public ResponseEntity<HotelService> updateServiceStatus(@PathVariable Integer serviceId,
                                                            @RequestParam String status) {
        return ResponseEntity.ok(billingService.updateServiceStatus(serviceId, status));
    }

    // ---------------------------------------------------------------- UC-35..36 Service orders

    @GetMapping("/active-stays")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-35: Get active in-house guest stays for room selection dropdown")
    public ResponseEntity<List<com.fpt.hms.dto.billing_report.ActiveStaySelectDto>> getActiveStaysForSelect(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.getActiveStaysForSelect(
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        ));
    }

    @GetMapping("/service-orders")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "List service orders, optionally by stay (customers only see their own)")
    public ResponseEntity<List<ServiceOrderDto>> listServiceOrders(
            @RequestParam(required = false) Integer stayId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.getServiceOrders(stayId, principal.getAccountId(), principal.getRoleName()));
    }

    @PostMapping("/service-orders")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-35: Order an ancillary service for an ACTIVE guest stay")
    public ResponseEntity<ServiceOrderDto> orderService(@Valid @RequestBody ServiceOrderRequest request,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.orderServiceToFolio(request, principal.getAccountId(), principal.getRoleName()));
    }

    @PatchMapping("/service-orders/{orderId}/confirm")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-35: Staff (Front Desk or Service Staff/Manager) confirms a guest's service order to move it to waiting-for-service and lock cancellation")
    public ResponseEntity<ServiceOrderDto> confirmServiceOrder(@PathVariable Integer orderId,
                                                               @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.confirmServiceOrder(orderId, principal != null ? principal.getAccountId() : null));
    }

    @PatchMapping("/service-orders/{orderId}/complete")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'SERVICE_MANAGER', 'ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-35: Mark service as provided and post the charge to the stay folio (Service Staff/Manager only)")
    public ResponseEntity<ServiceOrderDto> completeServiceOrder(@PathVariable Integer orderId,
                                                                @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.completeServiceOrder(orderId, principal.getAccountId()));
    }

    @PatchMapping("/service-orders/{orderId}/void")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'SERVICE_MANAGER', 'FRONT_DESK', 'ACCOUNTANT', 'ADMIN', 'GENERAL_MANAGER', 'CUSTOMER')")
    @Operation(summary = "UC-36: Void a service order (Staff can void pending or completed orders before folio closure; Customer can void unconfirmed pending orders)")
    public ResponseEntity<ServiceOrderDto> voidServiceOrder(@PathVariable Integer orderId,
                                                            @RequestParam String cancelReason,
                                                            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.voidServiceOrder(
                orderId,
                cancelReason,
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        ));
    }

    // ---------------------------------------------------------------- Pre-orders before check-in

    @PostMapping("/pre-orders")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER')")
    @Operation(summary = "Khách hàng đặt trước dịch vụ cho kỳ nghỉ (Xe đón sân bay, Buffet, Spa, Setup phòng...)")
    public ResponseEntity<String> savePreOrder(
            @Valid @RequestBody PreOrderRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.savePreOrderToNotes(
                request,
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        ));
    }

    @DeleteMapping("/pre-orders")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ACCOUNTANT', 'ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "Hủy dịch vụ đặt trước của khách hàng (Hỗ trợ hủy 1 phần hoặc hủy theo từng lượt đặt)")
    public ResponseEntity<String> cancelPreOrder(
            @RequestParam Integer reservationId,
            @RequestParam Integer serviceId,
            @RequestParam(required = false) Integer itemIndex,
            @RequestParam(required = false) Integer cancelQuantity,
            @RequestParam(required = false) String cancelReason,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.cancelPreOrderFromNotes(
                reservationId,
                serviceId,
                itemIndex,
                cancelQuantity,
                cancelReason,
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        ));
    }

    @GetMapping("/my-confirmed-reservations")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER')")
    @Operation(summary = "Lấy danh sách các đơn đặt phòng CONFIRMED của khách hàng để đặt trước dịch vụ")
    public ResponseEntity<List<ReservationDto>> getMyConfirmedReservations(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.getMyConfirmedReservations(
                principal != null ? principal.getAccountId() : null
        ));
    }

    @GetMapping("/pre-orders")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'SERVICE_MANAGER', 'FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-35: Lấy danh sách tất cả các đơn đặt phòng có lịch đặt trước dịch vụ (đưa đón sân bay, buffet, spa...)")
    public ResponseEntity<List<ReservationDto>> getAllUpcomingPreOrders() {
        return ResponseEntity.ok(billingService.getAllUpcomingPreOrders());
    }

    // ---------------------------------------------------------------- UC-38: Voucher Management (SALES_MANAGER) & Validation

    @GetMapping("/vouchers")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-38: Danh sách các mã khuyến mãi (SALES_MANAGER, FRONT_DESK, ACCOUNTANT, GENERAL_MANAGER, ADMIN)")
    public ResponseEntity<List<Voucher>> listVouchers() {
        return ResponseEntity.ok(billingService.getAllVouchers());
    }

    @PostMapping("/vouchers")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-38: Tạo mã khuyến mãi mới (SALES_MANAGER, ADMIN)")
    public ResponseEntity<Voucher> createVoucher(@Valid @RequestBody VoucherRequest request) {
        return ResponseEntity.ok(billingService.createVoucher(request));
    }

    @PutMapping("/vouchers/{voucherId}")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-38: Cập nhật thông tin mã khuyến mãi (SALES_MANAGER, ADMIN)")
    public ResponseEntity<Voucher> updateVoucher(@PathVariable Integer voucherId,
                                                @Valid @RequestBody VoucherRequest request) {
        return ResponseEntity.ok(billingService.updateVoucher(voucherId, request));
    }

    @PatchMapping("/vouchers/{voucherId}/status")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-38: Bật/Tắt trạng thái hoạt động của mã khuyến mãi (SALES_MANAGER, ADMIN)")
    public ResponseEntity<Voucher> toggleVoucherStatus(@PathVariable Integer voucherId,
                                                       @RequestParam String status) {
        return ResponseEntity.ok(billingService.toggleVoucherStatus(voucherId, status));
    }

    @PostMapping("/vouchers/validate")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'SALES_MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "UC-38: Kiểm tra tính hợp lệ & tính tiền giảm giá của Voucher")
    public ResponseEntity<VoucherValidateResponse> validateVoucher(@Valid @RequestBody VoucherValidateRequest request) {
        return ResponseEntity.ok(billingService.validateVoucher(request));
    }

    // ---------------------------------------------------------------- UC-37: Folio Breakdown & Additional Charges

    @GetMapping("/stays/{stayId}/folio")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "UC-37: Xem chi tiết bảng kê hóa đơn phòng (tiền phòng, dịch vụ, phụ thu, trừ cọc)")
    public ResponseEntity<FolioDetailDto> getFolioDetail(@PathVariable Integer stayId,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.getFolioDetail(
                stayId,
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        ));
    }

    @PostMapping("/folios/{folioId}/additional-charges")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'ADMIN')")
    @Operation(summary = "UC-37: Thêm phụ thu (minibar, đền bù hư hại, trả muộn...) vào hóa đơn phòng (FRONT_DESK, ACCOUNTANT)")
    public ResponseEntity<AdditionalChargeDto> addAdditionalCharge(@PathVariable Integer folioId,
                                                                  @Valid @RequestBody AdditionalChargeRequest request,
                                                                  @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.addAdditionalCharge(
                folioId,
                request,
                principal != null ? principal.getAccountId() : null
        ));
    }

    @DeleteMapping("/additional-charges/{chargeId}")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'ADMIN')")
    @Operation(summary = "UC-37: Xóa phụ thu nhập nhầm khi Folio còn OPEN (FRONT_DESK, ACCOUNTANT)")
    public ResponseEntity<Void> deleteAdditionalCharge(@PathVariable Integer chargeId,
                                                       @AuthenticationPrincipal UserPrincipal principal) {
        billingService.deleteAdditionalCharge(
                chargeId,
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        );
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- UC-39: Folio Settlement & Payment Recording

    @PostMapping("/stays/{stayId}/settle")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT')")
    @Operation(summary = "UC-37, UC-38 & UC-39: Compile itemized invoice, apply voucher, and record payment settlement (Backward compatibility)")
    public ResponseEntity<InvoiceDto> compileAndSettleInvoice(
            @PathVariable Integer stayId,
            @RequestParam(required = false) String voucherCode,
            @RequestParam(defaultValue = "CASH") String paymentMethod) {
        return ResponseEntity.ok(billingService.compileAndSettleInvoice(stayId, voucherCode, paymentMethod));
    }

    @PostMapping("/stays/{stayId}/settle-folio")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-39: Quyết toán hóa đơn phòng, áp dụng voucher, thu tiền, đóng Folio & sinh Invoice PAID (FRONT_DESK, ACCOUNTANT, ADMIN)")
    public ResponseEntity<InvoiceDetailDto> settleFolio(@PathVariable Integer stayId,
                                                        @Valid @RequestBody FolioSettlementRequest request,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.settleFolio(
                stayId,
                request,
                principal != null ? principal.getAccountId() : null
        ));
    }

    @PostMapping("/stays/{stayId}/vnpay-url")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-39: Tạo URL thanh toán quyết toán Folio qua cổng VNPay Sandbox (FRONT_DESK, ACCOUNTANT, ADMIN)")
    public ResponseEntity<FolioVnPayInitResponse> createFolioVnPayUrl(@PathVariable Integer stayId,
                                                                      @RequestBody(required = false) FolioSettlementRequest request,
                                                                      @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.createFolioVnPayUrl(
                stayId,
                request,
                principal != null ? principal.getAccountId() : null
        ));
    }

    @PostMapping("/vnpay-callback")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "UC-39: Xác thực kết quả trả về từ cổng VNPay, chốt Invoice PAID và đóng Folio")
    public ResponseEntity<InvoiceDetailDto> processFolioVnPayCallback(@Valid @RequestBody FolioVnPayCallbackRequest request,
                                                                      @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.processFolioVnPayCallback(
                request,
                principal != null ? principal.getAccountId() : null
        ));
    }

    // ---------------------------------------------------------------- UC-40: Printable VAT Invoice Details

    @GetMapping("/invoices/{invoiceId}")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "UC-40: Lấy chi tiết hóa đơn thanh toán chuẩn VAT phục vụ in ấn/xuất phiếu thu")
    public ResponseEntity<InvoiceDetailDto> getInvoiceDetail(@PathVariable Integer invoiceId,
                                                            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.getInvoiceDetail(
                invoiceId,
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        ));
    }

    @GetMapping("/invoices/by-stay/{stayId}")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "UC-40: Lấy hóa đơn thanh toán theo lượt lưu trú (stayId)")
    public ResponseEntity<InvoiceDetailDto> getInvoiceDetailByStay(@PathVariable Integer stayId,
                                                                  @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.getInvoiceDetailByStay(
                stayId,
                principal != null ? principal.getAccountId() : null,
                principal != null ? principal.getRoleName() : null
        ));
    }
}
