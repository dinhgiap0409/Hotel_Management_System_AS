package com.fpt.hms.controller;

import com.fpt.hms.entity.HotelService;
import com.fpt.hms.service.BillingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
@Tag(name = "4. Ancillary Services & Folio Billing (Public - Module 4)")
public class PublicServiceController {

    private final BillingService billingService;

    @GetMapping("/services")
    @Operation(summary = "UC-34: Public catalog of active hotel ancillary services for home and landing pages")
    public ResponseEntity<List<HotelService>> getPublicServices() {
        return ResponseEntity.ok(billingService.getActiveServices());
    }
}