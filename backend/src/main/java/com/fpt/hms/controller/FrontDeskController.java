package com.fpt.hms.controller;

import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.frontdesk.CheckInRequest;
import com.fpt.hms.dto.frontdesk.DirectBookingRequest;
import com.fpt.hms.dto.frontdesk.ExtendStayRequest;
import com.fpt.hms.dto.frontdesk.FrontDeskBookingQuoteRequest;
import com.fpt.hms.dto.frontdesk.FrontDeskBookingQuoteResponse;
import com.fpt.hms.dto.frontdesk.FrontDeskRoomTypeAvailabilityDto;
import com.fpt.hms.dto.frontdesk.GuestStayDto;
import com.fpt.hms.dto.frontdesk.RoomTransferRequest;
import com.fpt.hms.dto.room.RoomDto;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.FrontDeskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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

    @PostMapping("/reservations/{reservationCode}/confirm-cash")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-26: Confirm direct cash payment for walk-in reservation at front desk")
    public ResponseEntity<ReservationDto> confirmCashPayment(@PathVariable String reservationCode) {
        return ResponseEntity.ok(frontDeskService.confirmCashPayment(reservationCode));
    }

    @GetMapping("/reservations/{reservationCode}/payment-status")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-26: Check real-time payment status of reservation deposit")
    public ResponseEntity<Map<String, Object>> getReservationPaymentStatus(@PathVariable String reservationCode) {
        return ResponseEntity.ok(frontDeskService.getReservationPaymentStatus(reservationCode));
    }

    @PostMapping("/reservations/{reservationCode}/cancel")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-26: Cancel unpaid walk-in reservation")
    public ResponseEntity<ReservationDto> cancelDirectBooking(
            @PathVariable String reservationCode,
            @RequestParam(required = false, defaultValue = "Khách không đặt cọc / hủy tại quầy") String reason) {
        return ResponseEntity.ok(frontDeskService.cancelDirectBooking(reservationCode, reason));
    }

    @PostMapping("/quote")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-26: Calculate official price quote with nightly tariffs breakdown per room type and date range")
    public ResponseEntity<FrontDeskBookingQuoteResponse> calculateBookingQuote(
            @Valid @RequestBody FrontDeskBookingQuoteRequest request) {
        return ResponseEntity.ok(frontDeskService.calculateBookingQuote(request));
    }

    @GetMapping("/available-room-types")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-26: Get real-time room category availability and quota for given date range and guest count")
    public ResponseEntity<List<FrontDeskRoomTypeAvailabilityDto>> getAvailableRoomTypes(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkInDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOutDate,
            @RequestParam(required = false, defaultValue = "1") Integer guests) {
        return ResponseEntity.ok(frontDeskService.getAvailableRoomTypes(checkInDate, checkOutDate, guests));
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

    @PostMapping("/check-in")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-27: Check in guest, verify ID, assign VACANT+INSPECTED room, initialize Folio")
    public ResponseEntity<GuestStayDto> checkInGuest(@Valid @RequestBody CheckInRequest request) {
        return ResponseEntity.ok(frontDeskService.checkInGuest(request));
    }

    @GetMapping("/active-stays")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'SERVICE_STAFF', 'SERVICE_MANAGER', 'ACCOUNTANT', 'GENERAL_MANAGER')")
    @Operation(summary = "View all active in-house guest stays")
    public ResponseEntity<List<GuestStayDto>> listActiveStays() {
        return ResponseEntity.ok(frontDeskService.getActiveStays());
    }

    @PostMapping("/stays/{stayId}/extend")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-29: Extend guest stay with new check-out date and update folio")
    public ResponseEntity<GuestStayDto> extendStay(
            @PathVariable Integer stayId,
            @Valid @RequestBody ExtendStayRequest request) {
        return ResponseEntity.ok(frontDeskService.extendStay(stayId, request));
    }

    @PostMapping("/stays/{stayId}/transfer")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-28: Transfer in-house guest to another clean vacant room")
    public ResponseEntity<GuestStayDto> transferRoom(
            @PathVariable Integer stayId,
            @Valid @RequestBody RoomTransferRequest request) {
        return ResponseEntity.ok(frontDeskService.transferRoom(stayId, request));
    }

    @PostMapping("/stays/{stayId}/check-out")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-30: Complete guest departure check-out and set room to DIRTY")
    public ResponseEntity<GuestStayDto> checkOutGuest(@PathVariable Integer stayId) {
        return ResponseEntity.ok(frontDeskService.checkOutGuest(stayId));
    }
}
