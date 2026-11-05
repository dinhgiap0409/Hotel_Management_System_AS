package com.fpt.hms.controller;

import com.fpt.hms.dto.billing_report.HotelServiceRequest;
import com.fpt.hms.dto.billing_report.InvoiceDto;
import com.fpt.hms.dto.billing_report.PreOrderRequest;
import com.fpt.hms.dto.billing_report.ServiceOrderDto;
import com.fpt.hms.dto.billing_report.ServiceOrderRequest;
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
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ACCOUNTANT', 'GENERAL_MANAGER')")
    @Operation(summary = "List service orders, optionally by stay (customers only see their own)")
    public ResponseEntity<List<ServiceOrderDto>> listServiceOrders(
            @RequestParam(required = false) Integer stayId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.getServiceOrders(stayId, principal.getAccountId(), principal.getRoleName()));
    }

    @PostMapping("/service-orders")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER')")
    @Operation(summary = "UC-35: Order an ancillary service for an ACTIVE guest stay")
    public ResponseEntity<ServiceOrderDto> orderService(@Valid @RequestBody ServiceOrderRequest request,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.orderServiceToFolio(request, principal.getAccountId(), principal.getRoleName()));
    }

    @PatchMapping("/service-orders/{orderId}/complete")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'SERVICE_MANAGER', 'FRONT_DESK', 'ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-35: Mark service as provided and post the charge to the stay folio")
    public ResponseEntity<ServiceOrderDto> completeServiceOrder(@PathVariable Integer orderId,
                                                                @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.completeServiceOrder(orderId, principal.getAccountId()));
    }

    @PatchMapping("/service-orders/{orderId}/void")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'SERVICE_MANAGER', 'FRONT_DESK')")
    @Operation(summary = "UC-36: Void a service order that has not been provided yet")
    public ResponseEntity<ServiceOrderDto> voidServiceOrder(@PathVariable Integer orderId,
                                                            @RequestParam String cancelReason,
                                                            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.voidServiceOrder(orderId, cancelReason, principal.getAccountId()));
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
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "Hủy dịch vụ đặt trước của khách hàng (Xóa khỏi lịch hẹn trước)")
    public ResponseEntity<String> cancelPreOrder(
            @RequestParam Integer reservationId,
            @RequestParam Integer serviceId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(billingService.cancelPreOrderFromNotes(
                reservationId,
                serviceId,
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
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'SERVICE_MANAGER', 'FRONT_DESK', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-35: Lấy danh sách tất cả các đơn đặt phòng có lịch đặt trước dịch vụ (đưa đón sân bay, buffet, spa...)")
    public ResponseEntity<List<ReservationDto>> getAllUpcomingPreOrders() {
        return ResponseEntity.ok(billingService.getAllUpcomingPreOrders());
    }

    // ---------------------------------------------------------------- Vouchers (read-only for now)

    @GetMapping("/vouchers")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'FRONT_DESK', 'ACCOUNTANT', 'GENERAL_MANAGER')")
    @Operation(summary = "List vouchers (read-only; CRUD for SALES_MANAGER arrives in Feature 2)")
    public ResponseEntity<List<Voucher>> listVouchers() {
        return ResponseEntity.ok(billingService.getAllVouchers());
    }

    // ---------------------------------------------------------------- UC-37..39 (existing, refined in Feature 2)

    @PostMapping("/stays/{stayId}/settle")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'ACCOUNTANT')")
    @Operation(summary = "UC-37, UC-38 & UC-39: Compile itemized invoice, apply voucher, and record payment settlement (FRONT_DESK & ACCOUNTANT)")
    public ResponseEntity<InvoiceDto> compileAndSettleInvoice(
            @PathVariable Integer stayId,
            @RequestParam(required = false) String voucherCode,
            @RequestParam(defaultValue = "CASH") String paymentMethod) {
        return ResponseEntity.ok(billingService.compileAndSettleInvoice(stayId, voucherCode, paymentMethod));
    }
}
