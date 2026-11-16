-- Owner-made gift card designs shown on /gift-cards. Additive only.

CREATE TABLE `gift_card_designs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `name_en` VARCHAR(80) NOT NULL,
    `name_bn` VARCHAR(80) NOT NULL,
    `label_en` VARCHAR(60) NOT NULL DEFAULT '',
    `label_bn` VARCHAR(60) NOT NULL DEFAULT '',
    `line_en` VARCHAR(200) NOT NULL DEFAULT '',
    `line_bn` VARCHAR(200) NOT NULL DEFAULT '',
    `message_en` VARCHAR(300) NOT NULL DEFAULT '',
    `message_bn` VARCHAR(300) NOT NULL DEFAULT '',
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `media_id` BIGINT UNSIGNED NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gift_card_designs_public_id_key`(`public_id`),
    INDEX `gift_card_designs_active_sort_order_idx`(`active`, `sort_order`),
    INDEX `gift_card_designs_media_id_idx`(`media_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `gift_card_designs` ADD CONSTRAINT `gift_card_designs_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
