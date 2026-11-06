successfully downloaded text file (SHA: 038c0b74f9dd0ca1d561d1c2a923f6c076c074af)package com.fpt.hms.service;

import com.fpt.hms.dto.billing_report.HotelServiceRequest;
import com.fpt.hms.dto.billing_report.InvoiceDto;
import com.fpt.hms.dto.billing_report.ServiceOrderDto;
import com.fpt.hms.dto.billing_report.ServiceOrderRequest;
import com.fpt.hms.entity.HotelService;
import com.fpt.hms.entity.Voucher;

import java.util.List;

public interface BillingService {
    // UC-34 / UC-31..33
    List<HotelService> getActiveServices();
    List<HotelService> getAllServices();
    HotelService createService(HotelServiceRequest request);
    HotelService updateService(Integer serviceId, HotelServiceRequest request);
    HotelService updateServiceStatus(Integer serviceId, String status);

    // UC-35 / UC-36
    List<com.fpt.hms.dto.billing_report.ActiveStaySelectDto> getActiveStaysForSelect();
    List<com.fpt.hms.dto.billing_report.ActiveStaySelectDto> getActiveStaysForSelect(Integer callerAccountId, String callerRole);
    List<ServiceOrderDto> getServiceOrders(Integer stayId, Integer callerAccountId, String callerRole);
    ServiceOrderDto orderServiceToFolio(ServiceOrderRequest request, Integer callerAccountId, String callerRole);
    ServiceOrderDto confirmServiceOrder(Integer orderId, Integer callerAccountId);
    ServiceOrderDto completeServiceOrder(Integer orderId, Integer callerAccountId);
    ServiceOrderDto voidServiceOrder(Integer orderId, String cancelReason, Integer callerAccountId);
    ServiceOrderDto voidServiceOrder(Integer orderId, String cancelReason, Integer callerAccountId, String callerRole);

    // Read-only voucher list (CRUD arrives in Feature 2)
    List<Voucher> getAllVouchers();

    // Pre-order services before check-in (Airport Transfer, Buffet, Spa...)
    String savePreOrderToNotes(com.fpt.hms.dto.billing_report.PreOrderRequest request, Integer callerAccountId, String callerRole);
    String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer callerAccountId, String callerRole);
    String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer itemIndex, Integer cancelQuantity, Integer callerAccountId, String callerRole);
    List<com.fpt.hms.dto.booking.ReservationDto> getMyConfirmedReservations(Integer callerAccountId);
    List<com.fpt.hms.dto.booking.ReservationDto> getAllUpcomingPreOrders();

    // UC-37..40 (existing, Feature 2)
    InvoiceDto compileAndSettleInvoice(Integer stayId, String voucherCode, String paymentMethod);
}
