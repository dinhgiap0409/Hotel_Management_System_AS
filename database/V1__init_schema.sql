-- =============================================================================
-- HOTEL MANAGEMENT SYSTEM (HMS) - MICROSOFT SQL SERVER SCHEMA
-- Document Reference: HMS-SRS v1.2 & HMS-SDD v1.0 (Section 4.1 & Section 5.1)
-- Includes 24 Core Domain Tables (a -> x) + 2 System Infrastructure Tables
-- =============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'HMS_DB')
BEGIN
    CREATE DATABASE [HMS_DB];
END
GO

USE [HMS_DB];
GO

-- =============================================================================
-- 1. TABLE [a. Role]
-- =============================================================================
IF OBJECT_ID('dbo.Role', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Role] (
        role_id     INT IDENTITY(1,1) NOT NULL,
        role_name   NVARCHAR(100)     NOT NULL,
        description NVARCHAR(500)     NULL,
        CONSTRAINT PK_Role PRIMARY KEY (role_id),
        CONSTRAINT UQ_Role_RoleName UNIQUE (role_name)
    );
END
GO

-- =============================================================================
-- 2. TABLE [b. Account]
-- =============================================================================
IF OBJECT_ID('dbo.Account', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Account] (
        account_id            INT IDENTITY(1,1) NOT NULL,
        role_id               INT               NOT NULL,
        email                 NVARCHAR(254)     NOT NULL,
        password_hash         VARCHAR(255)      NOT NULL,
        status                NVARCHAR(30)      NOT NULL DEFAULT N'ACTIVE', -- ACTIVE, INACTIVE, LOCKED
        token_version         INT               NOT NULL DEFAULT 0,
        failed_login_attempts INT               NOT NULL DEFAULT 0,
        locked_until          DATETIME2(0)      NULL,
        created_at            DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Account PRIMARY KEY (account_id),
        CONSTRAINT UQ_Account_Email UNIQUE (email),
        CONSTRAINT FK_Account_Role FOREIGN KEY (role_id) REFERENCES dbo.[Role](role_id)
    );
END
GO

-- =============================================================================
-- 3. TABLE [t. Department]
-- Note: manager_id FK to Staff is added after Staff table creation to resolve
-- circular reference between Department and Staff.
-- =============================================================================
IF OBJECT_ID('dbo.Department', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Department] (
        department_id   INT IDENTITY(1,1) NOT NULL,
        manager_id      INT               NULL,
        department_name NVARCHAR(100)     NOT NULL,
        description     NVARCHAR(500)     NULL,
        CONSTRAINT PK_Department PRIMARY KEY (department_id),
        CONSTRAINT UQ_Department_Name UNIQUE (department_name)
    );
END
GO

-- =============================================================================
-- 4. TABLE [s. Staff]
-- =============================================================================
IF OBJECT_ID('dbo.Staff', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Staff] (
        staff_id          INT IDENTITY(1,1) NOT NULL,
        account_id        INT               NOT NULL,
        department_id     INT               NOT NULL,
        staff_code        VARCHAR(50)       NOT NULL,
        full_name         NVARCHAR(100)     NOT NULL,
        date_of_birth     DATE              NULL,
        gender            NVARCHAR(100)     NULL,
        phone             VARCHAR(20)       NULL,
        email             NVARCHAR(254)     NOT NULL,
        address           NVARCHAR(100)     NULL,
        hire_date         DATE              NOT NULL,
        employment_status NVARCHAR(30)      NOT NULL DEFAULT N'ACTIVE',
        created_at        DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at        DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Staff PRIMARY KEY (staff_id),
        CONSTRAINT UQ_Staff_Account UNIQUE (account_id),
        CONSTRAINT UQ_Staff_Code UNIQUE (staff_code),
        CONSTRAINT UQ_Staff_Email UNIQUE (email),
        CONSTRAINT FK_Staff_Account FOREIGN KEY (account_id) REFERENCES dbo.[Account](account_id),
        CONSTRAINT FK_Staff_Department FOREIGN KEY (department_id) REFERENCES dbo.[Department](department_id)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Department_Manager')
BEGIN
    ALTER TABLE dbo.[Department]
    ADD CONSTRAINT FK_Department_Manager FOREIGN KEY (manager_id) REFERENCES dbo.[Staff](staff_id);
END
GO

-- =============================================================================
-- 5. TABLE [q. Customer]
-- =============================================================================
IF OBJECT_ID('dbo.Customer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Customer] (
        customer_id         INT IDENTITY(1,1) NOT NULL,
        account_id          INT               NULL,
        created_by_staff_id INT               NULL,
        full_name           NVARCHAR(100)     NOT NULL,
        email               NVARCHAR(254)     NULL,
        phone               VARCHAR(20)       NULL,
        identity_number     VARCHAR(30)       NULL,
        CONSTRAINT PK_Customer PRIMARY KEY (customer_id),
        CONSTRAINT FK_Customer_Account FOREIGN KEY (account_id) REFERENCES dbo.[Account](account_id),
        CONSTRAINT FK_Customer_CreatedByStaff FOREIGN KEY (created_by_staff_id) REFERENCES dbo.[Staff](staff_id)
    );
END
GO

-- =============================================================================
-- 6. TABLE [c. Room_Type]
-- =============================================================================
IF OBJECT_ID('dbo.Room_Type', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Room_Type] (
        room_type_id INT IDENTITY(1,1) NOT NULL,
        type_name    NVARCHAR(100)     NOT NULL,
        capacity     INT               NOT NULL,
        base_price   DECIMAL(18,2)     NOT NULL,
        amenities    NVARCHAR(1000)    NULL,
        description  NVARCHAR(1000)    NULL,
        image_url    NVARCHAR(500)     NULL,
        is_active    BIT               NOT NULL DEFAULT 1,
        CONSTRAINT PK_Room_Type PRIMARY KEY (room_type_id),
        CONSTRAINT UQ_Room_Type_Name UNIQUE (type_name),
        CONSTRAINT CK_Room_Type_Price CHECK (base_price > 0),
        CONSTRAINT CK_Room_Type_Capacity CHECK (capacity >= 1)
    );
END
GO

-- =============================================================================
-- 7. TABLE [v. Room_Type_Price]
-- =============================================================================
IF OBJECT_ID('dbo.Room_Type_Price', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Room_Type_Price] (
        room_type_price_id INT IDENTITY(1,1) NOT NULL,
        room_type_id       INT               NOT NULL,
        day_of_week        INT               NOT NULL, -- 1 = Monday through 7 = Sunday
        price              DECIMAL(18,2)     NOT NULL,
        effective_from     DATE              NOT NULL,
        effective_to       DATE              NULL,
        is_active          BIT               NOT NULL DEFAULT 1,
        CONSTRAINT PK_Room_Type_Price PRIMARY KEY (room_type_price_id),
        CONSTRAINT FK_Room_Type_Price_RoomType FOREIGN KEY (room_type_id) REFERENCES dbo.[Room_Type](room_type_id),
        CONSTRAINT CK_Room_Type_Price_DayOfWeek CHECK (day_of_week BETWEEN 1 AND 7),
        CONSTRAINT CK_Room_Type_Price_Positive CHECK (price > 0)
    );
END
GO

-- =============================================================================
-- 8. TABLE [d. Room]
-- =============================================================================
IF OBJECT_ID('dbo.Room', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Room] (
        room_id         INT IDENTITY(1,1) NOT NULL,
        room_type_id    INT               NOT NULL,
        room_number     NVARCHAR(100)     NOT NULL,
        floor           INT               NOT NULL DEFAULT 1,
        stay_status     NVARCHAR(30)      NOT NULL DEFAULT N'VACANT',    -- VACANT, OCCUPIED
        cleaning_status NVARCHAR(30)      NOT NULL DEFAULT N'INSPECTED', -- DIRTY, CLEAN, INSPECTED
        room_status     NVARCHAR(30)      NOT NULL DEFAULT N'ACTIVE',    -- ACTIVE, UNDER_MAINTENANCE, ARCHIVED
        notes           NVARCHAR(500)     NULL,
        version         INT               NOT NULL DEFAULT 0,
        CONSTRAINT PK_Room PRIMARY KEY (room_id),
        CONSTRAINT UQ_Room_Number UNIQUE (room_number),
        CONSTRAINT FK_Room_RoomType FOREIGN KEY (room_type_id) REFERENCES dbo.[Room_Type](room_type_id)
    );
END
GO

-- =============================================================================
-- 9. TABLE [x. Housekeeping_Task]
-- =============================================================================
IF OBJECT_ID('dbo.Housekeeping_Task', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Housekeeping_Task] (
        task_id                   INT IDENTITY(1,1) NOT NULL,
        room_id                   INT               NOT NULL,
        assigned_to_staff_id      INT               NOT NULL,
        assigned_by_staff_id      INT               NOT NULL,
        task_type                 NVARCHAR(30)      NOT NULL, -- CLEANING, MAINTENANCE
        scheduled_at              DATETIME2(0)      NOT NULL,
        estimated_completion_date DATE              NULL,
        status                    NVARCHAR(30)      NOT NULL DEFAULT N'ASSIGNED', -- ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
        started_at                DATETIME2(0)      NULL,
        completed_at              DATETIME2(0)      NULL,
        note                      NVARCHAR(500)     NULL,
        created_at                DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Housekeeping_Task PRIMARY KEY (task_id),
        CONSTRAINT FK_Housekeeping_Task_Room FOREIGN KEY (room_id) REFERENCES dbo.[Room](room_id),
        CONSTRAINT FK_Housekeeping_Task_AssignedTo FOREIGN KEY (assigned_to_staff_id) REFERENCES dbo.[Staff](staff_id),
        CONSTRAINT FK_Housekeeping_Task_AssignedBy FOREIGN KEY (assigned_by_staff_id) REFERENCES dbo.[Staff](staff_id)
    );
END
GO

-- =============================================================================
-- 10. TABLE [e. Reservation]
-- =============================================================================
IF OBJECT_ID('dbo.Reservation', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Reservation] (
        reservation_id   INT IDENTITY(1,1) NOT NULL,
        customer_id      INT               NOT NULL,
        reservation_code VARCHAR(50)       NOT NULL,
        reservation_date DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        check_in_date    DATE              NOT NULL,
        check_out_date   DATE              NOT NULL,
        guest_count      INT               NOT NULL DEFAULT 1,
        special_notes    NVARCHAR(500)     NULL,
        status           NVARCHAR(30)      NOT NULL DEFAULT N'PENDING', -- PENDING, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED
        contact_name     NVARCHAR(100)     NOT NULL,
        contact_email    NVARCHAR(254)     NOT NULL,
        contact_phone    VARCHAR(20)       NOT NULL,
        hold_expires_at  DATETIME2(0)      NOT NULL,
        version          INT               NOT NULL DEFAULT 0,
        CONSTRAINT PK_Reservation PRIMARY KEY (reservation_id),
        CONSTRAINT UQ_Reservation_Code UNIQUE (reservation_code),
        CONSTRAINT FK_Reservation_Customer FOREIGN KEY (customer_id) REFERENCES dbo.[Customer](customer_id),
        CONSTRAINT CK_Reservation_Dates CHECK (check_out_date > check_in_date)
    );
END
GO

-- =============================================================================
-- 11. TABLE [f. Reservation_Detail]
-- =============================================================================
IF OBJECT_ID('dbo.Reservation_Detail', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Reservation_Detail] (
        reservation_detail_id INT IDENTITY(1,1) NOT NULL,
        reservation_id        INT               NOT NULL,
        room_type_id          INT               NOT NULL,
        quantity              INT               NOT NULL DEFAULT 1,
        CONSTRAINT PK_Reservation_Detail PRIMARY KEY (reservation_detail_id),
        CONSTRAINT FK_Reservation_Detail_Reservation FOREIGN KEY (reservation_id) REFERENCES dbo.[Reservation](reservation_id),
        CONSTRAINT FK_Reservation_Detail_RoomType FOREIGN KEY (room_type_id) REFERENCES dbo.[Room_Type](room_type_id),
        CONSTRAINT CK_Reservation_Detail_Qty CHECK (quantity >= 1)
    );
END
GO

-- =============================================================================
-- 12. TABLE [w. Reservation_Nightly_Rate]
-- =============================================================================
IF OBJECT_ID('dbo.Reservation_Nightly_Rate', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Reservation_Nightly_Rate] (
        nightly_rate_id       INT IDENTITY(1,1) NOT NULL,
        reservation_detail_id INT               NOT NULL,
        stay_date             DATE              NOT NULL,
        unit_price            DECIMAL(18,2)     NOT NULL,
        CONSTRAINT PK_Reservation_Nightly_Rate PRIMARY KEY (nightly_rate_id),
        CONSTRAINT UQ_Reservation_Nightly_Rate_Date UNIQUE (reservation_detail_id, stay_date),
        CONSTRAINT FK_Reservation_Nightly_Rate_Detail FOREIGN KEY (reservation_detail_id) REFERENCES dbo.[Reservation_Detail](reservation_detail_id)
    );
END
GO

-- =============================================================================
-- 13. TABLE [g. Guest_Stay]
-- =============================================================================
IF OBJECT_ID('dbo.Guest_Stay', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Guest_Stay] (
        stay_id          INT IDENTITY(1,1) NOT NULL,
        reservation_id   INT               NOT NULL,
        actual_check_in  DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        actual_check_out DATETIME2(0)      NULL,
        guest_id_number  VARCHAR(30)       NULL,
        key_card_number  VARCHAR(50)       NULL,
        status           NVARCHAR(30)      NOT NULL DEFAULT N'ACTIVE', -- ACTIVE, COMPLETED
        CONSTRAINT PK_Guest_Stay PRIMARY KEY (stay_id),
        CONSTRAINT FK_Guest_Stay_Reservation FOREIGN KEY (reservation_id) REFERENCES dbo.[Reservation](reservation_id)
    );
END
GO

-- =============================================================================
-- 14. TABLE [h. Stay_Room_Assignment]
-- =============================================================================
IF OBJECT_ID('dbo.Stay_Room_Assignment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Stay_Room_Assignment] (
        assignment_id   INT IDENTITY(1,1) NOT NULL,
        stay_id         INT               NOT NULL,
        room_id         INT               NOT NULL,
        assigned_from   DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        assigned_to     DATETIME2(0)      NULL,
        transfer_reason NVARCHAR(500)     NULL,
        CONSTRAINT PK_Stay_Room_Assignment PRIMARY KEY (assignment_id),
        CONSTRAINT FK_Stay_Room_Assignment_Stay FOREIGN KEY (stay_id) REFERENCES dbo.[Guest_Stay](stay_id),
        CONSTRAINT FK_Stay_Room_Assignment_Room FOREIGN KEY (room_id) REFERENCES dbo.[Room](room_id)
    );
END
GO

-- =============================================================================
-- 15. TABLE [i. Review]
-- =============================================================================
IF OBJECT_ID('dbo.Review', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Review] (
        review_id        INT IDENTITY(1,1) NOT NULL,
        customer_id      INT               NOT NULL,
        stay_id          INT               NOT NULL,
        rating           INT               NOT NULL,
        comment          NVARCHAR(2000)    NULL,
        review_date      DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        is_hidden        BIT               NOT NULL DEFAULT 0,
        hidden_reason    NVARCHAR(500)     NULL,
        management_reply NVARCHAR(2000)    NULL,
        replied_at       DATETIME2(0)      NULL,
        CONSTRAINT PK_Review PRIMARY KEY (review_id),
        CONSTRAINT UQ_Review_Stay UNIQUE (stay_id), -- BR-36: Only Completed stays can be reviewed once
        CONSTRAINT FK_Review_Customer FOREIGN KEY (customer_id) REFERENCES dbo.[Customer](customer_id),
        CONSTRAINT FK_Review_Stay FOREIGN KEY (stay_id) REFERENCES dbo.[Guest_Stay](stay_id),
        CONSTRAINT CK_Review_Rating CHECK (rating BETWEEN 1 AND 5)
    );
END
GO

-- =============================================================================
-- 16. TABLE [j. Hotel_Service]
-- =============================================================================
IF OBJECT_ID('dbo.Hotel_Service', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Hotel_Service] (
        service_id   INT IDENTITY(1,1) NOT NULL,
        service_name NVARCHAR(100)     NOT NULL,
        category     NVARCHAR(50)      NOT NULL DEFAULT N'GENERAL', -- F&B, SPA, LAUNDRY, MINIBAR, TRANSPORT
        billing_unit NVARCHAR(50)      NOT NULL DEFAULT N'ITEM',
        unit_price   DECIMAL(18,2)     NOT NULL,
        description  NVARCHAR(500)     NULL,
        status       NVARCHAR(30)      NOT NULL DEFAULT N'ACTIVE',  -- ACTIVE, INACTIVE
        CONSTRAINT PK_Hotel_Service PRIMARY KEY (service_id),
        CONSTRAINT CK_Hotel_Service_Price CHECK (unit_price > 0)
    );
END
GO

-- =============================================================================
-- 17. TABLE [k. Service_Order]
-- =============================================================================
IF OBJECT_ID('dbo.Service_Order', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Service_Order] (
        service_order_id      INT IDENTITY(1,1) NOT NULL,
        stay_id               INT               NOT NULL,
        service_id            INT               NOT NULL,
        recorded_by_staff_id  INT               NULL,
        order_time            DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        quantity              INT               NOT NULL,
        unit_price            DECIMAL(18,2)     NOT NULL, -- Snapshot at ordering time (BR-27)
        completed_at          DATETIME2(0)      NULL,
        cancelled_by_staff_id INT               NULL,
        cancelled_at          DATETIME2(0)      NULL,
        cancel_reason         NVARCHAR(500)     NULL,
        status                NVARCHAR(30)      NOT NULL DEFAULT N'ORDERED', -- ORDERED, COMPLETED, VOIDED
        CONSTRAINT PK_Service_Order PRIMARY KEY (service_order_id),
        CONSTRAINT FK_Service_Order_Stay FOREIGN KEY (stay_id) REFERENCES dbo.[Guest_Stay](stay_id),
        CONSTRAINT FK_Service_Order_Service FOREIGN KEY (service_id) REFERENCES dbo.[Hotel_Service](service_id),
        CONSTRAINT FK_Service_Order_RecordedBy FOREIGN KEY (recorded_by_staff_id) REFERENCES dbo.[Staff](staff_id),
        CONSTRAINT FK_Service_Order_CancelledBy FOREIGN KEY (cancelled_by_staff_id) REFERENCES dbo.[Staff](staff_id),
        CONSTRAINT CK_Service_Order_Qty CHECK (quantity >= 1)
    );
END
GO

-- =============================================================================
-- 18. TABLE [l. Folio]
-- =============================================================================
IF OBJECT_ID('dbo.Folio', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Folio] (
        folio_id     INT IDENTITY(1,1) NOT NULL,
        stay_id      INT               NOT NULL,
        created_at   DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        total_amount DECIMAL(18,2)     NOT NULL DEFAULT 0.00,
        status       NVARCHAR(30)      NOT NULL DEFAULT N'OPEN', -- OPEN, CLOSED
        version      INT               NOT NULL DEFAULT 0,
        CONSTRAINT PK_Folio PRIMARY KEY (folio_id),
        CONSTRAINT UQ_Folio_Stay UNIQUE (stay_id),
        CONSTRAINT FK_Folio_Stay FOREIGN KEY (stay_id) REFERENCES dbo.[Guest_Stay](stay_id)
    );
END
GO

-- =============================================================================
-- 19. TABLE [m. Additional_Charge]
-- =============================================================================
IF OBJECT_ID('dbo.Additional_Charge', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Additional_Charge] (
        additional_charge_id  INT IDENTITY(1,1) NOT NULL,
        folio_id              INT               NOT NULL,
        created_by_account_id INT               NOT NULL,
        charge_type           NVARCHAR(30)      NOT NULL, -- ROOM_CHARGE, SERVICE_CHARGE, EARLY_CHECKIN_SURCHARGE, ROOM_UPGRADE, DAMAGE_PENALTY
        description           NVARCHAR(500)     NULL,
        amount                DECIMAL(18,2)     NOT NULL,
        created_at            DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        status                NVARCHAR(30)      NOT NULL DEFAULT N'POSTED', -- POSTED, VOIDED
        CONSTRAINT PK_Additional_Charge PRIMARY KEY (additional_charge_id),
        CONSTRAINT FK_Additional_Charge_Folio FOREIGN KEY (folio_id) REFERENCES dbo.[Folio](folio_id),
        CONSTRAINT FK_Additional_Charge_Account FOREIGN KEY (created_by_account_id) REFERENCES dbo.[Account](account_id)
    );
END
GO

-- =============================================================================
-- 20. TABLE [n. Voucher]
-- =============================================================================
IF OBJECT_ID('dbo.Voucher', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Voucher] (
        voucher_id          INT IDENTITY(1,1) NOT NULL,
        code                VARCHAR(50)       NOT NULL,
        discount_type       NVARCHAR(30)      NOT NULL, -- PERCENTAGE, FIXED_AMOUNT
        discount_value      DECIMAL(18,2)     NOT NULL,
        valid_from          DATETIME2(0)      NOT NULL,
        valid_to            DATETIME2(0)      NOT NULL,
        min_spend           DECIMAL(18,2)     NOT NULL DEFAULT 0.00,
        max_discount_amount DECIMAL(18,2)     NOT NULL DEFAULT 0.00,
        usage_limit         INT               NOT NULL DEFAULT 100,
        used_count          INT               NOT NULL DEFAULT 0,
        status              NVARCHAR(30)      NOT NULL DEFAULT N'ACTIVE', -- ACTIVE, INACTIVE, EXPIRED
        CONSTRAINT PK_Voucher PRIMARY KEY (voucher_id),
        CONSTRAINT UQ_Voucher_Code UNIQUE (code)
    );
END
GO

-- =============================================================================
-- 21. TABLE [o. Invoice]
-- =============================================================================
IF OBJECT_ID('dbo.Invoice', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Invoice] (
        invoice_id      INT IDENTITY(1,1) NOT NULL,
        folio_id        INT               NOT NULL,
        voucher_id      INT               NULL,
        invoice_code    VARCHAR(30)       NOT NULL,
        total_amount    DECIMAL(18,2)     NOT NULL,
        discount_amount DECIMAL(18,2)     NOT NULL DEFAULT 0.00,
        tax_amount      DECIMAL(18,2)     NOT NULL DEFAULT 0.00,
        final_amount    DECIMAL(18,2)     NOT NULL,
        status          NVARCHAR(30)      NOT NULL DEFAULT N'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID
        issue_date      DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Invoice PRIMARY KEY (invoice_id),
        CONSTRAINT UQ_Invoice_Code UNIQUE (invoice_code),
        CONSTRAINT FK_Invoice_Folio FOREIGN KEY (folio_id) REFERENCES dbo.[Folio](folio_id),
        CONSTRAINT FK_Invoice_Voucher FOREIGN KEY (voucher_id) REFERENCES dbo.[Voucher](voucher_id)
    );
END
GO

-- =============================================================================
-- 22. TABLE [p. Payment]
-- =============================================================================
IF OBJECT_ID('dbo.Payment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Payment] (
        payment_id      INT IDENTITY(1,1) NOT NULL,
        invoice_id      INT               NULL,
        reservation_id  INT               NULL,
        payment_type    NVARCHAR(30)      NOT NULL, -- DEPOSIT, SETTLEMENT, REFUND
        amount          DECIMAL(18,2)     NOT NULL,
        currency        CHAR(3)           NOT NULL DEFAULT 'VND',
        method          NVARCHAR(30)      NOT NULL, -- CASH, CARD, TRANSFER, VNPAY
        idempotency_key VARCHAR(100)      NULL,
        status          NVARCHAR(30)      NOT NULL DEFAULT N'PENDING', -- PENDING, PAID, FAILED, REFUNDED
        created_at      DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        paid_at         DATETIME2(0)      NULL,
        CONSTRAINT PK_Payment PRIMARY KEY (payment_id),
        CONSTRAINT FK_Payment_Invoice FOREIGN KEY (invoice_id) REFERENCES dbo.[Invoice](invoice_id),
        CONSTRAINT FK_Payment_Reservation FOREIGN KEY (reservation_id) REFERENCES dbo.[Reservation](reservation_id)
    );
END
GO

-- =============================================================================
-- 23. TABLE [r. Payment_Attempt]
-- =============================================================================
IF OBJECT_ID('dbo.Payment_Attempt', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Payment_Attempt] (
        attempt_id             INT IDENTITY(1,1) NOT NULL,
        payment_id             INT               NOT NULL,
        gateway_provider       NVARCHAR(100)     NOT NULL DEFAULT N'VNPAY',
        gateway_request_ref    NVARCHAR(100)     NOT NULL,
        gateway_transaction_id VARCHAR(100)      NULL,
        bank_code              VARCHAR(50)       NULL,
        status                 NVARCHAR(30)      NOT NULL DEFAULT N'PENDING', -- PENDING, SUCCESS, FAILED, EXPIRED, UNCERTAIN
        created_at             DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        expired_at             DATETIME2(0)      NULL,
        completed_at           DATETIME2(0)      NULL,
        CONSTRAINT PK_Payment_Attempt PRIMARY KEY (attempt_id),
        CONSTRAINT UQ_Payment_Attempt_Ref UNIQUE (gateway_request_ref),
        CONSTRAINT FK_Payment_Attempt_Payment FOREIGN KEY (payment_id) REFERENCES dbo.[Payment](payment_id)
    );
END
GO

-- =============================================================================
-- 24. TABLE [u. Audit_Log]
-- =============================================================================
IF OBJECT_ID('dbo.Audit_Log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Audit_Log] (
        audit_log_id     INT IDENTITY(1,1) NOT NULL,
        actor_account_id INT               NULL,
        actor_type       NVARCHAR(30)      NOT NULL,
        action           NVARCHAR(30)      NOT NULL, -- CREATE, UPDATE, DELETE, PAYMENT_CREATE, USER_DEACTIVATE, ROLE_CHANGE...
        entity_name      NVARCHAR(100)     NOT NULL,
        record_id        INT               NOT NULL,
        old_values       NVARCHAR(MAX)     NULL,
        new_values       NVARCHAR(MAX)     NULL,
        reason           NVARCHAR(500)     NULL,
        trace_id         VARCHAR(36)       NULL,
        performed_at     DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Audit_Log PRIMARY KEY (audit_log_id),
        CONSTRAINT FK_Audit_Log_Account FOREIGN KEY (actor_account_id) REFERENCES dbo.[Account](account_id)
    );
END
GO

-- Trigger enforcing immutability on Audit_Log (SDD Section 4.1.3.3 & BR-42)
CREATE OR ALTER TRIGGER dbo.TRG_Audit_Log_Immutable
ON dbo.[Audit_Log]
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR ('Audit_Log records are immutable and cannot be updated or deleted (BR-42).', 16, 1);
    ROLLBACK TRANSACTION;
END
GO

-- =============================================================================
-- 25. SYSTEM TABLE: Refresh_Token (SDD Section 4.1.5.1)
-- =============================================================================
IF OBJECT_ID('dbo.Refresh_Token', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Refresh_Token] (
        refresh_token_id BIGINT IDENTITY(1,1) NOT NULL,
        account_id       INT                  NOT NULL,
        token_hash       VARCHAR(255)         NOT NULL,
        expires_at       DATETIME2(3)         NOT NULL,
        revoked          BIT                  NOT NULL DEFAULT 0,
        created_at       DATETIME2(3)         NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Refresh_Token PRIMARY KEY (refresh_token_id),
        CONSTRAINT UQ_Refresh_Token_Hash UNIQUE (token_hash),
        CONSTRAINT FK_Refresh_Token_Account FOREIGN KEY (account_id) REFERENCES dbo.[Account](account_id)
    );
END
GO

-- =============================================================================
-- 26. SYSTEM TABLE: System_Error_Log (SDD Section 4.1.3.2 - Table 4.1-4)
-- =============================================================================
IF OBJECT_ID('dbo.System_Error_Log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[System_Error_Log] (
        id          BIGINT IDENTITY(1,1) NOT NULL,
        trace_id    VARCHAR(36)          NOT NULL,
        occurred_at DATETIME2(3)         NOT NULL DEFAULT SYSUTCDATETIME(),
        level       VARCHAR(10)          NOT NULL, -- ERROR, WARN
        source      VARCHAR(10)          NOT NULL, -- BACKEND, FRONTEND
        error_code  VARCHAR(40)          NOT NULL,
        http_status INT                  NOT NULL,
        message     NVARCHAR(MAX)        NOT NULL,
        stack_trace NVARCHAR(MAX)        NULL,
        user_id     INT                  NULL,
        client_ip   VARCHAR(45)          NULL,
        user_agent  VARCHAR(255)         NULL,
        endpoint    VARCHAR(255)         NULL,
        http_method VARCHAR(10)          NULL,
        status      VARCHAR(15)          NOT NULL DEFAULT 'NEW', -- NEW, ACKNOWLEDGED, RESOLVED
        CONSTRAINT PK_System_Error_Log PRIMARY KEY (id)
    );
    CREATE INDEX IX_System_Error_Log_TraceId ON dbo.[System_Error_Log](trace_id);
END
GO
