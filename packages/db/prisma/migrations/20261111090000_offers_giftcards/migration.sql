-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_booking_id_fkey`;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `order_id` BIGINT UNSIGNED NULL,
    MODIFY `booking_id` BIGINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `offers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title_en` VARCHAR(160) NOT NULL,
    `title_bn` VARCHAR(160) NOT NULL,
    `summary_en` VARCHAR(300) NOT NULL,
    `summary_bn` VARCHAR(300) NOT NULL,
    `details_en` TEXT NOT NULL,
    `details_bn` TEXT NOT NULL,
    `price_minor` BIGINT NOT NULL,
    `original_price_minor` BIGINT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `hero_media_id` BIGINT UNSIGNED NULL,
    `valid_until` DATETIME(3) NULL,
    `stock` INTEGER UNSIGNED NULL,
    `sold` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offers_public_id_key`(`public_id`),
    UNIQUE INDEX `offers_slug_key`(`slug`),
    INDEX `offers_status_sort_order_idx`(`status`, `sort_order`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ads` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `title_en` VARCHAR(120) NOT NULL,
    `title_bn` VARCHAR(120) NOT NULL,
    `text_en` VARCHAR(240) NOT NULL DEFAULT '',
    `text_bn` VARCHAR(240) NOT NULL DEFAULT '',
    `media_id` BIGINT UNSIGNED NOT NULL,
    `link_href` VARCHAR(300) NOT NULL DEFAULT '',
    `placement` ENUM('HOME_TOP', 'HOME_MIDDLE', 'OFFERS_TOP') NOT NULL,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ads_public_id_key`(`public_id`),
    INDEX `ads_placement_active_idx`(`placement`, `active`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `reference` VARCHAR(12) NOT NULL,
    `kind` ENUM('OFFER', 'GIFT_CARD') NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `user_id` BIGINT UNSIGNED NOT NULL,
    `offer_id` BIGINT UNSIGNED NULL,
    `quantity` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `buyer_name` VARCHAR(120) NOT NULL,
    `buyer_email` VARCHAR(254) NOT NULL,
    `buyer_phone` VARCHAR(20) NOT NULL,
    `note` VARCHAR(500) NULL,
    `recipient_name` VARCHAR(120) NULL,
    `recipient_email` VARCHAR(254) NULL,
    `gift_message` VARCHAR(300) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `paid_offline` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_public_id_key`(`public_id`),
    UNIQUE INDEX `orders_reference_key`(`reference`),
    INDEX `orders_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `orders_status_expires_at_idx`(`status`, `expires_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_cards` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `code_hash` CHAR(64) NOT NULL,
    `last4` CHAR(4) NOT NULL,
    `code_sealed` TEXT NULL,
    `initial_minor` BIGINT NOT NULL,
    `balance_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `status` ENUM('ACTIVE', 'VOID') NOT NULL DEFAULT 'ACTIVE',
    `expires_at` DATETIME(3) NOT NULL,
    `recipient_name` VARCHAR(120) NOT NULL,
    `recipient_email` VARCHAR(254) NOT NULL,
    `order_id` BIGINT UNSIGNED NULL,
    `issued_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gift_cards_public_id_key`(`public_id`),
    UNIQUE INDEX `gift_cards_code_hash_key`(`code_hash`),
    UNIQUE INDEX `gift_cards_order_id_key`(`order_id`),
    INDEX `gift_cards_status_expires_at_idx`(`status`, `expires_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gift_card_txns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `gift_card_id` BIGINT UNSIGNED NOT NULL,
    `kind` ENUM('ISSUE', 'REDEEM', 'RELEASE', 'VOID') NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `balance_after` BIGINT NOT NULL,
    `booking_id` BIGINT UNSIGNED NULL,
    `note` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gift_card_txns_gift_card_id_created_at_idx`(`gift_card_id`, `created_at`),
    INDEX `gift_card_txns_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `payments_order_id_idx` ON `payments`(`order_id`);

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ads` ADD CONSTRAINT `ads_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_cards` ADD CONSTRAINT `gift_cards_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gift_card_txns` ADD CONSTRAINT `gift_card_txns_gift_card_id_fkey` FOREIGN KEY (`gift_card_id`) REFERENCES `gift_cards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- Safety rules the application must never break (ADR-0032).
ALTER TABLE `payments` ADD CONSTRAINT `payments_target_chk`
  CHECK ((`booking_id` IS NULL) <> (`order_id` IS NULL));
ALTER TABLE `offers` ADD CONSTRAINT `offers_price_chk`
  CHECK (`price_minor` > 0 AND (`original_price_minor` IS NULL OR `original_price_minor` > `price_minor`));
ALTER TABLE `offers` ADD CONSTRAINT `offers_stock_chk`
  CHECK (`stock` IS NULL OR `sold` <= `stock`);
ALTER TABLE `orders` ADD CONSTRAINT `orders_amount_chk` CHECK (`amount_minor` > 0 AND `quantity` >= 1);
ALTER TABLE `gift_cards` ADD CONSTRAINT `gift_cards_balance_chk`
  CHECK (`balance_minor` >= 0 AND `balance_minor` <= `initial_minor` AND `initial_minor` > 0);
