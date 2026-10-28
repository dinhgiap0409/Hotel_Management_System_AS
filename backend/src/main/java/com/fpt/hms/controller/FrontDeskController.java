package com.fpt.hms.controller;

import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.frontdesk.CheckInRequest;
import com.fpt.hms.dto.frontdesk.GuestStayDto;
import com.fpt.hms.service.FrontDeskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Module 3B (Owner: TungPV) - Front-Desk Operations Controller (UC-26 to UC-30).
 */
@RestController
@RequestMapping("/api/v1/front-desk")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
@Tag(name = "3B. Front-Desk & Stay Operations (Module 3B - TungPV)")
public class FrontDeskController {

    private final FrontDeskService frontDeskService;

    @PostMapping("/reservations/{reservationId}/confirm")
    @PreAuthorize("hasRole('FRONT_DESK')")
    @Operation(summary = "UC-26: Confirm a PENDING reservation (FRONT_DESK)")
    public ResponseEntity<ReservationDto> confirmReservation(@PathVariable Integer reservationId) {
        return ResponseEntity.ok(frontDeskService.confirmReservation(reservationId));
    }

    @PostMapping("/check-in")
    @PreAuthorize("hasRole('FRONT_DESK')")
    @Operation(summary = "UC-27: Check in guest, verify ID, assign VACANT+INSPECTED room, initialize Folio (FRONT_DESK)")
    public ResponseEntity<GuestStayDto> checkInGuest(@Valid @RequestBody CheckInRequest request) {
        return ResponseEntity.ok(frontDeskService.checkInGuest(request));
    }

    @GetMapping("/active-stays")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ACCOUNTANT', 'GENERAL_MANAGER')")
    @Operation(summary = "View all active in-house guest stays")
    public ResponseEntity<List<GuestStayDto>> listActiveStays() {
        return ResponseEntity.ok(frontDeskService.getActiveStays());
    }

    @PostMapping("/stays/{stayId}/check-out")
    @PreAuthorize("hasRole('FRONT_DESK')")
    @Operation(summary = "UC-30: Complete guest departure check-out and set room to DIRTY (FRONT_DESK)")
    public ResponseEntity<GuestStayDto> checkOutGuest(@PathVariable Integer stayId) {
        return ResponseEntity.ok(frontDeskService.checkOutGuest(stayId));
    }
}
