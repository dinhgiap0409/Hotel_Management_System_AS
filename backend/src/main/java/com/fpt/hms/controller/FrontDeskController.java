package com.fpt.hms.controller;

import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.frontdesk.CheckInRequest;
import com.fpt.hms.dto.frontdesk.DirectBookingRequest;
import com.fpt.hms.dto.frontdesk.GuestStayDto;
import com.fpt.hms.dto.room.RoomDto;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.FrontDeskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    @PostMapping("/direct-booking")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-26: Direct walk-in reservation created at front desk")
    public ResponseEntity<ReservationDto> createDirectBooking(
            @Valid @RequestBody DirectBookingRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        Integer staffAccountId = principal != null ? principal.getAccountId() : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(frontDeskService.createDirectBooking(request, staffAccountId));
    }

    @GetMapping("/reservations/pending")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-26: List all pending reservations awaiting front-desk confirmation")
    public ResponseEntity<List<ReservationDto>> getPendingReservations() {
        return ResponseEntity.ok(frontDeskService.getPendingReservations());
    }

    @GetMapping("/arrivals")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-27: List confirmed arrivals scheduled for check-in")
    public ResponseEntity<List<ReservationDto>> getArrivals() {
        return ResponseEntity.ok(frontDeskService.getArrivals());
    }

    @GetMapping("/available-rooms")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-27: Get vacant inspected/clean physical rooms available for check-in assignment")
    public ResponseEntity<List<RoomDto>> getAvailableRoomsForCheckIn(
            @RequestParam(required = false) Integer roomTypeId) {
        return ResponseEntity.ok(frontDeskService.getAvailableRoomsForCheckIn(roomTypeId));
    }

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
