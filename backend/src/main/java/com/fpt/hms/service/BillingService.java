package com.fpt.hms.service;

import com.fpt.hms.dto.billing_report.*;
import com.fpt.hms.dto.booking.ReservationDto;
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
    List<ActiveStaySelectDto> getActiveStaysForSelect();
    List<ActiveStaySelectDto> getActiveStaysForSelect(Integer callerAccountId, String callerRole);
    List<ServiceOrderDto> getServiceOrders(Integer stayId, Integer callerAccountId, String callerRole);
    ServiceOrderDto orderServiceToFolio(ServiceOrderRequest request, Integer callerAccountId, String callerRole);
    ServiceOrderDto confirmServiceOrder(Integer orderId, Integer callerAccountId);
    ServiceOrderDto completeServiceOrder(Integer orderId, Integer callerAccountId);
    ServiceOrderDto voidServiceOrder(Integer orderId, String cancelReason, Integer callerAccountId);
    ServiceOrderDto voidServiceOrder(Integer orderId, String cancelReason, Integer callerAccountId, String callerRole);

    // Pre-order services before check-in (Airport Transfer, Buffet, Spa...)
    String savePreOrderToNotes(PreOrderRequest request, Integer callerAccountId, String callerRole);
    String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer callerAccountId, String callerRole);
    String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer itemIndex, Integer cancelQuantity, Integer callerAccountId, String callerRole);
    String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer itemIndex, Integer cancelQuantity, String cancelReason, Integer callerAccountId, String callerRole);
    List<ReservationDto> getMyConfirmedReservations(Integer callerAccountId);
    List<ReservationDto> getAllUpcomingPreOrders();

    // UC-38: Voucher Management (CRUD for SALES_MANAGER, Validation for FRONT_DESK/ACCOUNTANT)
    List<Voucher> getAllVouchers();
    Voucher createVoucher(VoucherRequest request);
    Voucher updateVoucher(Integer voucherId, VoucherRequest request);
    Voucher toggleVoucherStatus(Integer voucherId, String status);
    VoucherValidateResponse validateVoucher(VoucherValidateRequest request);

    // UC-37: Folio breakdown & Additional Charges (FRONT_DESK / ACCOUNTANT)
    FolioDetailDto getFolioDetail(Integer stayId, Integer callerAccountId, String callerRole);
    AdditionalChargeDto addAdditionalCharge(Integer folioId, AdditionalChargeRequest request, Integer callerAccountId);
    void deleteAdditionalCharge(Integer chargeId, Integer callerAccountId, String callerRole);

    // UC-39: Settlement & Payment Recording (FRONT_DESK / ACCOUNTANT)
    InvoiceDto compileAndSettleInvoice(Integer stayId, String voucherCode, String paymentMethod);
    InvoiceDetailDto settleFolio(Integer stayId, FolioSettlementRequest request, Integer callerAccountId);
    FolioVnPayInitResponse createFolioVnPayUrl(Integer stayId, FolioSettlementRequest request, Integer callerAccountId);
    InvoiceDetailDto processFolioVnPayCallback(FolioVnPayCallbackRequest request, Integer callerAccountId);

    // UC-40: Printable VAT Invoice Details (FRONT_DESK, ACCOUNTANT, CUSTOMER, GENERAL_MANAGER)
    InvoiceDetailDto getInvoiceDetail(Integer invoiceId, Integer callerAccountId, String callerRole);
    InvoiceDetailDto getInvoiceDetailByStay(Integer stayId, Integer callerAccountId, String callerRole);
}
