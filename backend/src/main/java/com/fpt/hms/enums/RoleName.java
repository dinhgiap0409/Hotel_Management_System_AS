package com.fpt.hms.enums;

/**
 * 10 Distinct System Roles aligned with SRS Section 1.1 & 2.1 Organizational Divisions:
 * - ADMIN: IT & Technical Department
 * - GENERAL_MANAGER: Executive Management Board
 * - SALES_MANAGER: Sales & Marketing Department (Room Types, Pricing, Vouchers, Review Moderation)
 * - HOUSEKEEPING_MANAGER: Housekeeping Department Supervisor (Physical Rooms, Task Assignment UC-51, Maintenance)
 * - SERVICE_MANAGER: Services & Ancillary Division Supervisor (Service Catalog & Tariffs UC-31..33)
 * - ACCOUNTANT: Accounting Department (Folio/Invoice Audit, Revenue Reports UC-46..47, Export UC-50)
 * - FRONT_DESK: Front Office Department (Reservations, Check-in, Stay Management, Check-out)
 * - HOUSEKEEPING: Housekeeping Floor Staff (Dirty -> Clean -> Inspected UC-19, Report Faults UC-20)
 * - SERVICE_STAFF: Ancillary Service Staff (Deliver & Post Service Orders UC-35..36)
 * - CUSTOMER: External Hotel Guest
 */
public enum RoleName {
    ADMIN,
    GENERAL_MANAGER,
    SALES_MANAGER,
    HOUSEKEEPING_MANAGER,
    SERVICE_MANAGER,
    ACCOUNTANT,
    FRONT_DESK,
    HOUSEKEEPING,
    SERVICE_STAFF,
    CUSTOMER
}
