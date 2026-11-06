package com.fpt.hms.service;

import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.frontdesk.CheckInRequest;
import com.fpt.hms.dto.frontdesk.DirectBookingRequest;
import com.fpt.hms.dto.frontdesk.GuestStayDto;
import com.fpt.hms.dto.room.RoomDto;

import java.util.List;

public interface FrontDeskService {
    ReservationDto createDirectBooking(DirectBookingRequest request, Integer staffAccountId);
    List<ReservationDto> getPendingReservations();
    List<ReservationDto> getArrivals();
    List<RoomDto> getAvailableRoomsForCheckIn(Integer roomTypeId);
    ReservationDto confirmReservation(Integer reservationId);
    GuestStayDto checkInGuest(CheckInRequest request);
    List<GuestStayDto> getActiveStays();
    GuestStayDto checkOutGuest(Integer stayId);
}
