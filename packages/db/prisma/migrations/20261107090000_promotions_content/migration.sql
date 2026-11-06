-- Phase 6: promotions (discount on bookings) and content pages (ADR-0025).
-- Expand-only: new nullable/defaulted column, new tables, widened CHECK.
-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `discount_minor` BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN `promotion_id` BIGINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `promotions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `kind` ENUM('PERCENT', 'FIXED') NOT NULL,
    `percent_bps` SMALLINT UNSIGNED NULL,
    `amount_minor` BIGINT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `min_spend_minor` BIGINT NOT NULL DEFAULT 0,
    `max_discount_minor` BIGINT NULL,
    `scope` ENUM('ALL', 'HOTEL', 'TOUR') NOT NULL DEFAULT 'ALL',
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `max_redemptions` INTEGER UNSIGNED NULL,
    `per_customer_limit` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `status` ENUM('ACTIVE', 'PAUSED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `promotions_public_id_key`(`public_id`),
    UNIQUE INDEX `promotions_code_key`(`code`),
    INDEX `promotions_status_starts_at_ends_at_idx`(`status`, `starts_at`, `ends_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_pages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `summary` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `updated_by_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `content_pages_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints Prisma cannot express
ALTER TABLE `promotions`
    ADD CONSTRAINT `promotions_value_chk` CHECK (
        (`kind` = 'PERCENT' AND `percent_bps` BETWEEN 1 AND 10000 AND `amount_minor` IS NULL)
        OR (`kind` = 'FIXED' AND `amount_minor` > 0 AND `percent_bps` IS NULL)
    ),
    ADD CONSTRAINT `promotions_window_chk` CHECK (`ends_at` > `starts_at`),
    ADD CONSTRAINT `promotions_limits_chk` CHECK (`min_spend_minor` >= 0 AND (`max_discount_minor` IS NULL OR `max_discount_minor` > 0));

-- Total now subtracts the promotion discount (taxes are computed on the discounted base).
ALTER TABLE `bookings` DROP CONSTRAINT `bookings_amounts_chk`;
ALTER TABLE `bookings`
    ADD CONSTRAINT `bookings_amounts_chk` CHECK (
        `base_minor` >= 0 AND `service_charge_minor` >= 0 AND `vat_minor` >= 0
        AND `discount_minor` >= 0 AND `discount_minor` <= `base_minor`
        AND `total_minor` = `base_minor` - `discount_minor` + `service_charge_minor` + `vat_minor`
    );
