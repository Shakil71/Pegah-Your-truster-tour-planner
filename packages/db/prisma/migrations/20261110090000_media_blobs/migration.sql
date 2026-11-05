-- AlterTable
ALTER TABLE `media_assets` ADD COLUMN `byte_size` INTEGER UNSIGNED NULL,
    ADD COLUMN `uploaded_by` BIGINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `media_blobs` (
    `asset_id` BIGINT UNSIGNED NOT NULL,
    `mime` VARCHAR(40) NOT NULL,
    `bytes` LONGBLOB NOT NULL,

    PRIMARY KEY (`asset_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `media_blobs` ADD CONSTRAINT `media_blobs_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
