-- Phase 5 completion: refunds, traveller profiles, password resets, email log (ADR-0024).
-- Additive only.
-- CreateTable
CREATE TABLE `refunds` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `reason` VARCHAR(500) NOT NULL,
    `provider_ref` VARCHAR(120) NULL,
    `approved_by_id` BIGINT UNSIGNED NOT NULL,
    `paid_by_id` BIGINT UNSIGNED NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refunds_public_id_key`(`public_id`),
    INDEX `refunds_booking_id_idx`(`booking_id`),
    INDEX `refunds_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `traveller_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `age_group` ENUM('ADULT', 'CHILD') NOT NULL DEFAULT 'ADULT',
    `date_of_birth` DATE NULL,
    `nationality` CHAR(2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `traveller_profiles_public_id_key`(`public_id`),
    INDEX `traveller_profiles_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `token_hash` CHAR(64) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id` BIGINT UNSIGNED NULL,
    `to_address` VARCHAR(254) NOT NULL,
    `template` VARCHAR(60) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'QUEUED',
    `provider_id` VARCHAR(200) NULL,
    `error` VARCHAR(500) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_messages_booking_id_idx`(`booking_id`),
    INDEX `email_messages_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `traveller_profiles` ADD CONSTRAINT `traveller_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_messages` ADD CONSTRAINT `email_messages_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- CHECK constraints Prisma cannot express
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_amount_positive` CHECK (`amount_minor` > 0);
