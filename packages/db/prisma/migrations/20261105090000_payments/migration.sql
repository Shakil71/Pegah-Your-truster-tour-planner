-- Phase 5 foundation: hosted-payment attempts and provider callbacks (ADR-0022).
-- Additive only: safe to apply before the code that uses it.
-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(30) NOT NULL,
    `provider_txn_id` VARCHAR(64) NOT NULL,
    `provider_session` VARCHAR(128) NULL,
    `provider_val_id` VARCHAR(64) NULL,
    `bank_txn_id` VARCHAR(80) NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `status` ENUM('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUND_REQUIRED') NOT NULL DEFAULT 'INITIATED',
    `failure_reason` VARCHAR(255) NULL,
    `risk_level` TINYINT UNSIGNED NULL,
    `method` VARCHAR(60) NULL,
    `succeeded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_public_id_key`(`public_id`),
    INDEX `payments_booking_id_idx`(`booking_id`),
    INDEX `payments_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `payments_provider_provider_txn_id_key`(`provider`, `provider_txn_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `payment_id` BIGINT UNSIGNED NULL,
    `provider` VARCHAR(30) NOT NULL,
    `event_key` VARCHAR(160) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `payload` JSON NOT NULL,
    `signature_ok` BOOLEAN NULL,
    `processed_at` DATETIME(3) NULL,
    `outcome` VARCHAR(80) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_events_payment_id_idx`(`payment_id`),
    UNIQUE INDEX `payment_events_provider_event_key_key`(`provider`, `event_key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints Prisma cannot express
ALTER TABLE `payments` ADD CONSTRAINT `payments_amount_positive` CHECK (`amount_minor` > 0);
