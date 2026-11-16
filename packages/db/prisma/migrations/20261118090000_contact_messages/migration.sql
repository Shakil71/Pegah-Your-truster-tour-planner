-- Contact form messages (ADR-0041). Additive only.

CREATE TABLE `contact_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `reference` VARCHAR(12) NOT NULL,
    `topic` ENUM('BOOKING', 'RESERVATION', 'PACKAGE', 'OTHER') NOT NULL,
    `status` ENUM('NEW', 'IN_PROGRESS', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `travel_date` DATE NULL,
    `guests` SMALLINT UNSIGNED NULL,
    `message` TEXT NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `staff_note` VARCHAR(1000) NULL,
    `handled_by_id` BIGINT UNSIGNED NULL,
    `handled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contact_messages_public_id_key`(`public_id`),
    UNIQUE INDEX `contact_messages_reference_key`(`reference`),
    INDEX `contact_messages_status_created_at_idx`(`status`, `created_at`),
    INDEX `contact_messages_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `contact_messages` ADD CONSTRAINT `contact_messages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;
