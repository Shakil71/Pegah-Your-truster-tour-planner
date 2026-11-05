-- CreateTable
CREATE TABLE `site_settings` (
    `key` VARCHAR(60) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `secret_settings` (
    `key` VARCHAR(60) NOT NULL,
    `ciphertext` TEXT NOT NULL,
    `key_id` VARCHAR(16) NOT NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
