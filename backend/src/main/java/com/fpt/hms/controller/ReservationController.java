package com.fpt.hms.controller;

import com.fpt.hms.dto.booking.CreateReservationRequest;
import com.fpt.hms.dto.booking.PublicRoomCategoryDto;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.booking.RoomCategoryDetailDto;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.ReservationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Module 3A (Owner: GiapND) - Public Catalog, Room Search & Online Reservation Controller (UC-14, UC-21 to UC-25).
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
    @Operation(summary = "UC-23: Create a new room reservation (holds quota for 24 hours)")
    public ResponseEntity<ReservationDto> createReservation(
            @Valid @RequestBody CreateReservationRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        Integer accountId = principal != null ? principal.getAccountId() : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reservationService.createReservation(request, accountId));
    }

    @GetMapping("/reservations")
    @Operation(summary = "UC-24 & UC-26: List reservations")
    public ResponseEntity<List<ReservationDto>> listReservations() {
        return ResponseEntity.ok(reservationService.getAllReservations());
    }

    @GetMapping("/public/reservations/{code}")
    @Operation(summary = "Find booking by reference code")
    public ResponseEntity<ReservationDto> findByCode(@PathVariable String code) {
        return ResponseEntity.ok(reservationService.findByCode(code));
    }

    @PostMapping("/reservations/{reservationId}/cancel")
    @Operation(summary = "UC-25: Cancel an unfulfilled reservation")
    public ResponseEntity<ReservationDto> cancelReservation(@PathVariable Integer reservationId) {
        return ResponseEntity.ok(reservationService.cancelReservation(reservationId));
    }
}
