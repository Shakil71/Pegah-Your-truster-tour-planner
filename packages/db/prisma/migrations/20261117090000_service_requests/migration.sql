-- Visa services and flight requests (ADR-0039). Additive only.

CREATE TABLE `visa_products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `country` VARCHAR(80) NOT NULL,
    `country_bn` VARCHAR(80) NULL,
    `visa_type` VARCHAR(80) NOT NULL,
    `summary` VARCHAR(300) NOT NULL,
    `processing_time` VARCHAR(80) NOT NULL,
    `validity` VARCHAR(80) NULL,
    `fee_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `requirements` JSON NOT NULL,
    `notes` TEXT NULL,
    `hero_media_id` BIGINT UNSIGNED NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `visa_products_public_id_key`(`public_id`),
    UNIQUE INDEX `visa_products_slug_key`(`slug`),
    INDEX `visa_products_status_sort_order_idx`(`status`, `sort_order`),
    INDEX `visa_products_hero_media_id_idx`(`hero_media_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `visa_products` ADD CONSTRAINT `visa_products_fee_chk` CHECK (`fee_minor` >= 0);

CREATE TABLE `service_requests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `reference` VARCHAR(12) NOT NULL,
    `kind` ENUM('VISA', 'FLIGHT') NOT NULL,
    `status` ENUM('SUBMITTED', 'NEEDS_INFO', 'QUOTED', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `user_id` BIGINT UNSIGNED NOT NULL,
    `visa_product_id` BIGINT UNSIGNED NULL,
    `contact_name` VARCHAR(120) NOT NULL,
    `contact_email` VARCHAR(254) NOT NULL,
    `contact_phone` VARCHAR(20) NOT NULL,
    `travellers` SMALLINT UNSIGNED NOT NULL,
    `details` JSON NOT NULL,
    `note` VARCHAR(1000) NULL,
    `quote_minor` BIGINT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `quote_note` VARCHAR(1000) NULL,
    `quoted_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `paid_offline` VARCHAR(200) NULL,
    `closed_at` DATETIME(3) NULL,
    `documents_purged_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_requests_public_id_key`(`public_id`),
    UNIQUE INDEX `service_requests_reference_key`(`reference`),
    INDEX `service_requests_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `service_requests_status_updated_at_idx`(`status`, `updated_at`),
    INDEX `service_requests_kind_status_idx`(`kind`, `status`),
    INDEX `service_requests_visa_product_id_idx`(`visa_product_id`),
    INDEX `service_requests_closed_at_idx`(`closed_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_quote_chk`
    CHECK (`quote_minor` IS NULL OR `quote_minor` > 0);
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_travellers_chk`
    CHECK (`travellers` BETWEEN 1 AND 50);
-- Only visa requests point at a visa product.
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_visa_product_chk`
    CHECK (`visa_product_id` IS NULL OR `kind` = 'VISA');
-- Paid and later states always have a price and a payment time.
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_paid_chk`
    CHECK (`status` NOT IN ('PAID', 'IN_PROGRESS', 'COMPLETED') OR (`quote_minor` IS NOT NULL AND `paid_at` IS NOT NULL));

CREATE TABLE `service_request_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `request_id` BIGINT UNSIGNED NOT NULL,
    `actor_type` ENUM('CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `from_status` VARCHAR(20) NULL,
    `to_status` VARCHAR(20) NULL,
    `message` VARCHAR(2000) NULL,
    `visible_to_customer` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_request_events_request_id_id_idx`(`request_id`, `id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Uploaded documents: metadata here, AES-256-GCM ciphertext in service_document_blobs.
CREATE TABLE `service_documents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `request_id` BIGINT UNSIGNED NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `file_name` VARCHAR(160) NOT NULL,
    `mime` VARCHAR(60) NOT NULL,
    `byte_size` INTEGER UNSIGNED NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `key_id` VARCHAR(16) NOT NULL,
    `iv` VARBINARY(12) NOT NULL,
    `auth_tag` VARBINARY(16) NOT NULL,
    `uploaded_by_staff` BOOLEAN NOT NULL DEFAULT false,
    `uploaded_by_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `service_documents_public_id_key`(`public_id`),
    INDEX `service_documents_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `service_document_blobs` (
    `document_id` BIGINT UNSIGNED NOT NULL,
    `ciphertext` LONGBLOB NOT NULL,

    PRIMARY KEY (`document_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `visa_products` ADD CONSTRAINT `visa_products_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_visa_product_id_fkey` FOREIGN KEY (`visa_product_id`) REFERENCES `visa_products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `service_request_events` ADD CONSTRAINT `service_request_events_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `service_documents` ADD CONSTRAINT `service_documents_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `service_document_blobs` ADD CONSTRAINT `service_document_blobs_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `service_documents`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
