package com.fpt.hms.service;

import com.fpt.hms.dto.booking.CreateReservationRequest;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.room.RoomTypeDto;

import java.time.LocalDate;
import java.util.List;

public interface ReservationService {
    List<RoomTypeDto> searchAvailableRoomTypes(LocalDate checkInDate, LocalDate checkOutDate, int guests);
    ReservationDto createReservation(CreateReservationRequest request, Integer accountId);
    List<ReservationDto> getAllReservations();
    ReservationDto findByCode(String reservationCode);
    ReservationDto cancelReservation(Integer reservationId);
}