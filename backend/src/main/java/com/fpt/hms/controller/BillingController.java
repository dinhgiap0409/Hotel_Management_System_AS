package com.fpt.hms.controller;

import com.fpt.hms.dto.billing_report.InvoiceDto;
import com.fpt.hms.dto.billing_report.ServiceOrderRequest;
import com.fpt.hms.entity.HotelService;
import com.fpt.hms.service.BillingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    @GetMapping("/services")
    @Operation(summary = "UC-34: List available active hotel services (Customer, Front-Desk, Service Staff, Service Manager)")
    public ResponseEntity<List<HotelService>> listServices() {
        return ResponseEntity.ok(billingService.getActiveServices());
    }

    @PostMapping("/service-orders")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER')")
    @Operation(summary = "UC-35: Order ancillary service to active guest stay folio")
    public ResponseEntity<Void> orderService(@Valid @RequestBody ServiceOrderRequest request) {
        billingService.orderServiceToFolio(request);
        return ResponseEntity.ok().build();
    }

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
