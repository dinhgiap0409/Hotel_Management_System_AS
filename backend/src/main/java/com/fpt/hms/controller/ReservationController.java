successfully downloaded text file (SHA: 7649eab9e48f12554d6d817ca979b2eb7c392c3c)package com.fpt.hms.controller;

import com.fpt.hms.dto.booking.*;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.ReservationService;
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

/**
 * Module 3A (Owner: GiapND) - Public Catalog, Room Search & Online Reservation Controller (UC-14, UC-21 to UC-25).
 *
 * <p>Authorization (SRS v1.2, UC table §2.2) — public endpoints need no login
 * (UC-14/21/22 search & detail, UC-23 VNPay callback/IPN, Find Booking by code);
 * authenticated endpoints are role-checked below. Roles NOT listed on an
 * endpoint get 403: Housekeeping, Service Staff/Manager, Sales Manager,
 * Accountant and Administrator may NOT create bookings or view other
 * customers' My Bookings. Administrator may only view the room catalog
 * (UC-14) via the public endpoints.
 *
 * <p>SRS contradiction, recorded not resolved silently: screen table §3.1.3
 * marks screens 3, 4, 6, 6.1, 8, 8.1 as Customer-only, while UC table §2.2
 * also gives Front-Desk Staff UC-14/21/22/23/25. Resolution: Front-Desk does
 * NOT use these public customer pages to book; they use their own Front Desk
 * Dashboard / Direct Reservation Form (screens 9, 10, 10.3, 10.4 — TungPV's
 * module, untouched here). The FRONT_DESK role is still accepted on the
 * create/cancel/list endpoints so a front-desk operator can act on a guest's
 * behalf through the API when needed; UC-24 (My Bookings) stays CUSTOMER-only.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "3A. Room Search & Online Reservation (Module 3A - GiapND)")
public class ReservationController {

    private final ReservationService reservationService;

    @GetMapping("/public/room-types")
    @Operation(summary = "UC-14: View Room Categories - Displays public catalog of active accommodation categories, photos, descriptions, capacities, and base rates")
    public ResponseEntity<List<PublicRoomCategoryDto>> viewRoomCategories() {
        return ResponseEntity.ok(reservationService.getActiveRoomCategories());
    }

    @GetMapping("/public/rooms/search")
    @Operation(summary = "UC-21: Search available room types by check-in/out dates and guest count, excluding booked/occupied/maintenance units and computing estimated totals")
    public ResponseEntity<List<PublicRoomCategoryDto>> searchAvailableRooms(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkInDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOutDate,
            @RequestParam(defaultValue = "1") int guests) {
        return ResponseEntity.ok(reservationService.searchAvailableRoomTypes(checkInDate, checkOutDate, guests));
    }

    @GetMapping("/public/room-types/{roomTypeId}")
    @Operation(summary = "UC-22: View Room Details - Displays specifications, photo galleries, bed layouts, amenity checklists, rates, and verified reviews for a selected room type")
    public ResponseEntity<RoomCategoryDetailDto> viewRoomTypeDetails(
            @PathVariable Integer roomTypeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkInDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOutDate) {
        return ResponseEntity.ok(reservationService.getRoomCategoryDetails(roomTypeId, checkInDate, checkOutDate));
    }

    @PostMapping("/reservations")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK')")
    @Operation(summary = "UC-23: Create a new room reservation (holds quota for 24 hours per BR-19 and returns VNPay deposit URL)")
    public ResponseEntity<ReservationDto> createReservation(
            @Valid @RequestBody CreateReservationRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        Integer accountId = principal != null ? principal.getAccountId() : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reservationService.createReservation(request, accountId));
    }

    @PostMapping("/public/reservations/vnpay-callback")
    @Operation(summary = "UC-23: Process VNPay Deposit Payment Callback / IPN and confirm PENDING reservation")
    public ResponseEntity<ReservationDto> handleVnPayCallback(@Valid @RequestBody VnPayCallbackRequest request) {
        return ResponseEntity.ok(reservationService.processVnPayCallback(request));
    }

    @GetMapping("/reservations/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "UC-24: List reservations belonging to the currently logged-in customer")
    public ResponseEntity<List<ReservationDto>> getMyReservations(
            @AuthenticationPrincipal UserPrincipal principal) {
        Integer accountId = principal != null ? principal.getAccountId() : null;
        return ResponseEntity.ok(reservationService.getMyReservations(accountId));
    }

    @GetMapping("/reservations")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-24 & UC-26: List reservations (Customer sees own bookings; Staff sees all bookings)")
    public ResponseEntity<List<ReservationDto>> listReservations(
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal != null && "CUSTOMER".equalsIgnoreCase(principal.getRoleName())) {
            return ResponseEntity.ok(reservationService.getMyReservations(principal.getAccountId()));
        }
        return ResponseEntity.ok(reservationService.getAllReservations());
    }

    @GetMapping("/public/reservations/{code}")
    @Operation(summary = "Find booking by reference code")
    public ResponseEntity<ReservationDto> findByCode(@PathVariable String code) {
        return ResponseEntity.ok(reservationService.findByCode(code));
    }

    @PostMapping("/reservations/{reservationId}/cancel")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'FRONT_DESK')")
    @Operation(summary = "UC-25: Cancel an unfulfilled reservation")
    public ResponseEntity<ReservationDto> cancelReservation(
            @PathVariable Integer reservationId,
            @AuthenticationPrincipal UserPrincipal principal) {
        Integer accountId = principal != null ? principal.getAccountId() : null;
        String roleName = principal != null ? principal.getRoleName() : null;
        return ResponseEntity.ok(reservationService.cancelReservation(reservationId, accountId, roleName));
    }
}
