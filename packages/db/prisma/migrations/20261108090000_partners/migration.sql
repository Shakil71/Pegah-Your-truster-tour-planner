-- Phase 7: partner companies (suppliers, agents), ownership, agent commission (ADR-0026).
-- Expand-only: new table, nullable FKs, defaulted columns, new enum values.
-- AlterTable
ALTER TABLE `users` ADD COLUMN `partner_id` BIGINT UNSIGNED NULL,
    MODIFY `kind` ENUM('CUSTOMER', 'STAFF', 'PARTNER') NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE `sessions` MODIFY `kind` ENUM('CUSTOMER', 'STAFF', 'PARTNER') NOT NULL;

-- AlterTable
ALTER TABLE `hotels` ADD COLUMN `partner_id` BIGINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `tours` ADD COLUMN `partner_id` BIGINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `agent_partner_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `commission_minor` BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `booking_status_history` MODIFY `actor_type` ENUM('CUSTOMER', 'STAFF', 'SYSTEM', 'PAYMENT_PROVIDER', 'PARTNER') NOT NULL;

-- AlterTable
ALTER TABLE `audit_events` MODIFY `actor_type` ENUM('CUSTOMER', 'STAFF', 'SYSTEM', 'PAYMENT_PROVIDER', 'PARTNER') NOT NULL;

-- CreateTable
CREATE TABLE `partners` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `kind` ENUM('SUPPLIER', 'AGENT') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `commission_bps` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `partners_public_id_key`(`public_id`),
    INDEX `partners_kind_status_idx`(`kind`, `status`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_partner_id_idx` ON `users`(`partner_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tours` ADD CONSTRAINT `tours_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_agent_partner_id_fkey` FOREIGN KEY (`agent_partner_id`) REFERENCES `partners`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints Prisma cannot express
ALTER TABLE `partners` ADD CONSTRAINT `partners_commission_chk` CHECK (`commission_bps` <= 5000);
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_commission_chk` CHECK (`commission_minor` >= 0 AND `commission_minor` <= `total_minor`);
