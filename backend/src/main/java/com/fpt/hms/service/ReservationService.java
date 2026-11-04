package com.fpt.hms.service;

import com.fpt.hms.dto.booking.*;

import java.time.LocalDate;
import java.util.List;

public interface ReservationService {
    List<PublicRoomCategoryDto> getActiveRoomCategories();
    List<PublicRoomCategoryDto> searchAvailableRoomTypes(LocalDate checkInDate, LocalDate checkOutDate, int guests);
    RoomCategoryDetailDto getRoomCategoryDetails(Integer roomTypeId, LocalDate checkInDate, LocalDate checkOutDate);
    ReservationDto createReservation(CreateReservationRequest request, Integer accountId);
    ReservationDto processVnPayCallback(VnPayCallbackRequest request);
    List<ReservationDto> getMyReservations(Integer accountId);
    List<ReservationDto> getAllReservations();
    ReservationDto findByCode(String reservationCode);
    ReservationDto cancelReservation(Integer reservationId);
}
