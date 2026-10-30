package com.fpt.hms.service;

import com.fpt.hms.dto.billing_report.InvoiceDto;
import com.fpt.hms.dto.billing_report.ServiceOrderRequest;
import com.fpt.hms.entity.HotelService;

import java.util.List;

public interface BillingService {
    List<HotelService> getActiveServices();
    void orderServiceToFolio(ServiceOrderRequest request);
    InvoiceDto compileAndSettleInvoice(Integer stayId, String voucherCode, String paymentMethod);
}