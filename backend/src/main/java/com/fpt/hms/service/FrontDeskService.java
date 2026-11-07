package com.fpt.hms.service;

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

import java.time.LocalDate;
import java.util.List;

public interface FrontDeskService {
    ReservationDto createDirectBooking(DirectBookingRequest request, Integer staffAccountId);
    FrontDeskBookingQuoteResponse calculateBookingQuote(FrontDeskBookingQuoteRequest request);
    List<FrontDeskRoomTypeAvailabilityDto> getAvailableRoomTypes(LocalDate checkInDate, LocalDate checkOutDate, Integer guests);
    List<ReservationDto> getArrivals();
    List<RoomDto> getAvailableRoomsForCheckIn(Integer roomTypeId);
    GuestStayDto checkInGuest(CheckInRequest request);
    List<GuestStayDto> getActiveStays();
    GuestStayDto extendStay(Integer stayId, ExtendStayRequest request);
    GuestStayDto transferRoom(Integer stayId, RoomTransferRequest request);
    GuestStayDto checkOutGuest(Integer stayId);
}
