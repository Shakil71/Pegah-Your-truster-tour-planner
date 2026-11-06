-- Import of the old Pegah website (ADR-0038). Additive only: new tables and
-- nullable/defaulted columns, so existing rows and code paths are unchanged.

-- Every imported source row, verbatim (minus credentials), so no field is lost.
CREATE TABLE `legacy_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `source_table` VARCHAR(64) NOT NULL,
    `source_id` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `target_type` VARCHAR(40) NULL,
    `target_id` BIGINT UNSIGNED NULL,
    `imported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `legacy_records_source_table_source_id_key`(`source_table`, `source_id`),
    INDEX `legacy_records_target_type_target_id_idx`(`target_type`, `target_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Destinations: long description (tourist spot guides).
ALTER TABLE `destinations` ADD COLUMN `description` TEXT NULL;

-- Hotels: contact, location notes and house policies.
ALTER TABLE `hotels`
    ADD COLUMN `property_type` VARCHAR(20) NULL,
    ADD COLUMN `phone` VARCHAR(40) NULL,
    ADD COLUMN `email` VARCHAR(254) NULL,
    ADD COLUMN `map_url` TEXT NULL,
    ADD COLUMN `distance_from_city` VARCHAR(120) NULL,
    ADD COLUMN `distance_from_spot` VARCHAR(160) NULL,
    ADD COLUMN `floors` SMALLINT UNSIGNED NULL,
    ADD COLUMN `room_count` SMALLINT UNSIGNED NULL,
    ADD COLUMN `child_policy` TEXT NULL,
    ADD COLUMN `pet_policy` VARCHAR(255) NULL,
    ADD COLUMN `house_rules` TEXT NULL,
    ADD COLUMN `breakfast` VARCHAR(120) NULL,
    ADD COLUMN `special_note` TEXT NULL,
    ADD COLUMN `nearby_places` JSON NULL,
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `hotels` ADD CONSTRAINT `hotels_property_type_chk`
    CHECK (`property_type` IS NULL OR `property_type` IN ('HOTEL', 'RESORT', 'HOTEL_RESORT'));

-- Rooms: details, beds and reference prices (never charged directly; rates come from room_rates).
ALTER TABLE `hotel_rooms`
    ADD COLUMN `room_type` VARCHAR(80) NULL,
    ADD COLUMN `room_number` VARCHAR(40) NULL,
    ADD COLUMN `floor` VARCHAR(40) NULL,
    ADD COLUMN `details` TEXT NULL,
    ADD COLUMN `note` VARCHAR(255) NULL,
    ADD COLUMN `size_label` VARCHAR(40) NULL,
    ADD COLUMN `beds` JSON NULL,
    ADD COLUMN `air_conditioned` BOOLEAN NULL,
    ADD COLUMN `units` SMALLINT UNSIGNED NULL,
    ADD COLUMN `extra_beds` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN `extra_bed_price_minor` BIGINT NULL,
    ADD COLUMN `rack_rate_minor` BIGINT NULL,
    ADD COLUMN `discount_rate_minor` BIGINT NULL;

ALTER TABLE `hotel_rooms` ADD CONSTRAINT `hotel_rooms_reference_prices_chk`
    CHECK ((`rack_rate_minor` IS NULL OR `rack_rate_minor` >= 0)
       AND (`discount_rate_minor` IS NULL OR `discount_rate_minor` >= 0)
       AND (`extra_bed_price_minor` IS NULL OR `extra_bed_price_minor` >= 0));

-- Tours: the long-form sections of the old tour pages.
ALTER TABLE `tours`
    ADD COLUMN `tour_type` VARCHAR(80) NULL,
    ADD COLUMN `overview` TEXT NULL,
    ADD COLUMN `itinerary` TEXT NULL,
    ADD COLUMN `policy` TEXT NULL,
    ADD COLUMN `cancellation_policy` TEXT NULL,
    ADD COLUMN `travel_tips` TEXT NULL,
    ADD COLUMN `additional_info` TEXT NULL,
    ADD COLUMN `timing` VARCHAR(120) NULL,
    ADD COLUMN `transport` TEXT NULL,
    ADD COLUMN `pickup_points` JSON NULL,
    ADD COLUMN `tags` JSON NULL,
    ADD COLUMN `map_url` TEXT NULL,
    ADD COLUMN `min_adults` TINYINT UNSIGNED NULL,
    ADD COLUMN `booking_cutoff_days` SMALLINT UNSIGNED NULL,
    ADD COLUMN `list_price_minor` BIGINT NULL,
    ADD COLUMN `sale_price_minor` BIGINT NULL;

ALTER TABLE `tours` ADD CONSTRAINT `tours_reference_prices_chk`
    CHECK ((`list_price_minor` IS NULL OR `list_price_minor` >= 0)
       AND (`sale_price_minor` IS NULL OR `sale_price_minor` >= 0));

-- Photo galleries.
CREATE TABLE `hotel_media` (
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `hotel_media_media_id_idx`(`media_id`),
    PRIMARY KEY (`hotel_id`, `media_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `room_media` (
    `room_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `room_media_media_id_idx`(`media_id`),
    PRIMARY KEY (`room_id`, `media_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tour_media` (
    `tour_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `tour_media_media_id_idx`(`media_id`),
    PRIMARY KEY (`tour_id`, `media_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `offer_media` (
    `offer_id` BIGINT UNSIGNED NOT NULL,
    `media_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `offer_media_media_id_idx`(`media_id`),
    PRIMARY KEY (`offer_id`, `media_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Amenities (facilities) for hotels, rooms and tours.
CREATE TABLE `amenities` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `scope` ENUM('HOTEL', 'ROOM', 'TOUR') NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `group_name` VARCHAR(80) NULL,
    `icon_media_id` BIGINT UNSIGNED NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `amenities_scope_slug_key`(`scope`, `slug`),
    INDEX `amenities_icon_media_id_idx`(`icon_media_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `hotel_amenities` (
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `amenity_id` BIGINT UNSIGNED NOT NULL,

    INDEX `hotel_amenities_amenity_id_idx`(`amenity_id`),
    PRIMARY KEY (`hotel_id`, `amenity_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `room_amenities` (
    `room_id` BIGINT UNSIGNED NOT NULL,
    `amenity_id` BIGINT UNSIGNED NOT NULL,

    INDEX `room_amenities_amenity_id_idx`(`amenity_id`),
    PRIMARY KEY (`room_id`, `amenity_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tour_amenities` (
    `tour_id` BIGINT UNSIGNED NOT NULL,
    `amenity_id` BIGINT UNSIGNED NOT NULL,

    INDEX `tour_amenities_amenity_id_idx`(`amenity_id`),
    PRIMARY KEY (`tour_id`, `amenity_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hotel_media` ADD CONSTRAINT `hotel_media_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `hotel_media` ADD CONSTRAINT `hotel_media_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `room_media` ADD CONSTRAINT `room_media_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `hotel_rooms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `room_media` ADD CONSTRAINT `room_media_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `tour_media` ADD CONSTRAINT `tour_media_tour_id_fkey` FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `tour_media` ADD CONSTRAINT `tour_media_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `offer_media` ADD CONSTRAINT `offer_media_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `offer_media` ADD CONSTRAINT `offer_media_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `amenities` ADD CONSTRAINT `amenities_icon_media_id_fkey` FOREIGN KEY (`icon_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE `hotel_amenities` ADD CONSTRAINT `hotel_amenities_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `hotel_amenities` ADD CONSTRAINT `hotel_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `room_amenities` ADD CONSTRAINT `room_amenities_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `hotel_rooms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `room_amenities` ADD CONSTRAINT `room_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `tour_amenities` ADD CONSTRAINT `tour_amenities_tour_id_fkey` FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `tour_amenities` ADD CONSTRAINT `tour_amenities_amenity_id_fkey` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
