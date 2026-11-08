package com.fpt.hms.dto.billing_report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagementReportResponse {

    private LocalDate fromDate;
    private LocalDate toDate;
    private long periodDays;

    // 1. Occupancy KPIs (UC-45)
    private long totalRooms;
    private long occupiedRooms;
    private long vacantRooms;
    private long maintenanceRooms;
    private double currentOccupancyRate;
    private long periodRoomNightsSold;
    private long periodAvailableRoomNights;
    private double periodOccupancyRate;
    private List<RoomTypeOccupancyItem> occupancyByRoomType;

    // 2. Revenue KPIs & Breakdown (UC-46)
    private int paidInvoicesCount;
    private int openFoliosCount;
    private BigDecimal totalRoomRevenue;
    private BigDecimal totalServiceRevenue;
    private BigDecimal totalAdditionalRevenue;
    private BigDecimal totalSubtotalBeforeTax;
    private BigDecimal totalDiscountAmount;
    private BigDecimal totalTaxAmount;
    private BigDecimal totalNetRevenue;
    private BigDecimal totalDepositCollected;
    private BigDecimal outstandingFolioBalance;
    private List<PaymentMethodBreakdownItem> revenueByPaymentMethod;
    private List<DailyRevenueItem> revenueByDate;
    private List<InvoiceReportItem> invoices;

    // 3. Service Consumption Analytics (UC-47)
    private int activeServicesCount;
    private int completedServiceOrdersCount;
    private int voidedServiceOrdersCount;
    private int totalServiceUnitsSold;
    private List<ServiceConsumptionItem> serviceConsumptionRanking;
    private List<ServiceCategoryBreakdownItem> serviceByCategory;

    // 4. Guest Reviews Summary (UC-42..44)
    private double averageRating;
    private int totalReviewsCount;
    private int publishedReviewsCount;
    private int hiddenReviewsCount;
    private int repliedReviewsCount;
    private Map<Integer, Integer> ratingDistribution;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomTypeOccupancyItem {
        private Integer roomTypeId;
        private String roomTypeName;
        private BigDecimal basePrice;
        private int capacity;
        private int totalRooms;
        private int occupiedRooms;
        private int vacantRooms;
        private int maintenanceRooms;
        private double currentOccupancyPercent;
        private long nightsSoldInPeriod;
        private long availableRoomNightsInPeriod;
        private double periodOccupancyPercent;
        private BigDecimal estimatedRoomRevenue;
        private Double averageRating;
        private int reviewCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentMethodBreakdownItem {
        private String paymentMethod;
        private String label;
        private int transactionCount;
        private BigDecimal totalAmount;
        private double sharePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyRevenueItem {
        private LocalDate date;
        private int invoiceCount;
        private BigDecimal roomRevenue;
        private BigDecimal serviceRevenue;
        private BigDecimal additionalRevenue;
        private BigDecimal taxAmount;
        private BigDecimal discountAmount;
        private BigDecimal netRevenue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InvoiceReportItem {
        private Integer invoiceId;
        private String invoiceCode;
        private Integer stayId;
        private String reservationCode;
        private String customerName;
        private String roomNumber;
        private String roomTypeName;
        private BigDecimal roomSubtotal;
        private BigDecimal serviceSubtotal;
        private BigDecimal additionalSubtotal;
        private BigDecimal totalAmount;
        private BigDecimal discountAmount;
        private BigDecimal taxAmount;
        private BigDecimal depositDeducted;
        private BigDecimal finalAmount;
        private String paymentMethod;
        private String voucherCode;
        private String status;
        private Instant issueDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceConsumptionItem {
        private Integer serviceId;
        private String serviceName;
        private String category;
        private String billingUnit;
        private BigDecimal unitPrice;
        private int ordersCount;
        private int totalQuantity;
        private BigDecimal totalRevenue;
        private double revenueSharePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceCategoryBreakdownItem {
        private String category;
        private String label;
        private int servicesCount;
        private int ordersCount;
        private int totalQuantity;
        private BigDecimal totalRevenue;
        private double sharePercent;
    }
}

