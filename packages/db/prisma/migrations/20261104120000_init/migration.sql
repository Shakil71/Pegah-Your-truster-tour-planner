-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `kind` ENUM('CUSTOMER', 'STAFF') NOT NULL DEFAULT 'CUSTOMER',
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_public_id_key`(`public_id`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_key_key`(`key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(60) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_key_key`(`key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permissions_permission_id_idx`(`permission_id`),
    PRIMARY KEY (`role_id`, `permission_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `granted_by_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_roles_role_id_idx`(`role_id`),
    INDEX `user_roles_granted_by_id_idx`(`granted_by_id`),
    PRIMARY KEY (`user_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `token_hash` CHAR(64) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `kind` ENUM('CUSTOMER', 'STAFF') NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `last_seen_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `storage_key` VARCHAR(255) NOT NULL,
    `alt_text` VARCHAR(255) NOT NULL,
    `credit` VARCHAR(255) NULL,
    `license` VARCHAR(80) NULL,
    `width` SMALLINT UNSIGNED NULL,
    `height` SMALLINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `media_assets_storage_key_key`(`storage_key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destinations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `name_bn` VARCHAR(120) NULL,
    `region` VARCHAR(80) NOT NULL,
    `summary` VARCHAR(500) NOT NULL,
    `hero_media_id` BIGINT UNSIGNED NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `destinations_slug_key`(`slug`),
    INDEX `destinations_status_sort_order_idx`(`status`, `sort_order`),
    INDEX `destinations_hero_media_id_idx`(`hero_media_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hotels` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `destination_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `name_bn` VARCHAR(160) NULL,
    `star_rating` TINYINT UNSIGNED NULL,
    `address_line` VARCHAR(255) NOT NULL,
    `summary` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `check_in_time` CHAR(5) NOT NULL DEFAULT '14:00',
    `check_out_time` CHAR(5) NOT NULL DEFAULT '12:00',
    `cancellation_policy` VARCHAR(500) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `service_charge_bps` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `vat_bps` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `hero_media_id` BIGINT UNSIGNED NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hotels_public_id_key`(`public_id`),
    UNIQUE INDEX `hotels_slug_key`(`slug`),
    INDEX `hotels_destination_id_status_idx`(`destination_id`, `status`),
    INDEX `hotels_hero_media_id_idx`(`hero_media_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hotel_rooms` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `max_adults` TINYINT UNSIGNED NOT NULL,
    `max_children` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `bed_type` VARCHAR(60) NOT NULL,
    `size_sqm` SMALLINT UNSIGNED NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hotel_rooms_public_id_key`(`public_id`),
    UNIQUE INDEX `hotel_rooms_hotel_id_name_key`(`hotel_id`, `name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_inventory` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id` BIGINT UNSIGNED NOT NULL,
    `stay_date` DATE NOT NULL,
    `total` SMALLINT UNSIGNED NOT NULL,
    `held` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `sold` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `room_inventory_stay_date_idx`(`stay_date`),
    UNIQUE INDEX `room_inventory_room_id_stay_date_key`(`room_id`, `stay_date`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_rates` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id` BIGINT UNSIGNED NOT NULL,
    `stay_date` DATE NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `room_rates_room_id_stay_date_key`(`room_id`, `stay_date`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tours` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `destination_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `title_bn` VARCHAR(160) NULL,
    `summary` VARCHAR(500) NOT NULL,
    `description` TEXT NOT NULL,
    `duration_days` TINYINT UNSIGNED NOT NULL,
    `duration_nights` TINYINT UNSIGNED NOT NULL,
    `meeting_point` VARCHAR(255) NOT NULL,
    `group_size_max` SMALLINT UNSIGNED NOT NULL,
    `highlights` JSON NOT NULL,
    `includes` JSON NOT NULL,
    `excludes` JSON NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `vat_bps` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `hero_media_id` BIGINT UNSIGNED NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tours_public_id_key`(`public_id`),
    UNIQUE INDEX `tours_slug_key`(`slug`),
    INDEX `tours_destination_id_status_idx`(`destination_id`, `status`),
    INDEX `tours_hero_media_id_idx`(`hero_media_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tour_schedules` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `tour_id` BIGINT UNSIGNED NOT NULL,
    `departs_at` DATETIME(3) NOT NULL,
    `returns_at` DATETIME(3) NOT NULL,
    `capacity` SMALLINT UNSIGNED NOT NULL,
    `held` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `sold` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `price_adult_minor` BIGINT NOT NULL,
    `price_child_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `status` ENUM('SCHEDULED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tour_schedules_public_id_key`(`public_id`),
    INDEX `tour_schedules_tour_id_departs_at_idx`(`tour_id`, `departs_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` CHAR(26) NOT NULL,
    `reference` VARCHAR(12) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_AVAILABILITY', 'PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED', 'COMPLETED', 'FAILED', 'EXPIRED', 'MANUAL_REVIEW', 'CANCELLATION_REQUESTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED') NOT NULL DEFAULT 'DRAFT',
    `product_type` ENUM('HOTEL', 'TOUR') NOT NULL,
    `product_name` VARCHAR(160) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `guest_count` SMALLINT UNSIGNED NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `base_minor` BIGINT NOT NULL,
    `service_charge_minor` BIGINT NOT NULL DEFAULT 0,
    `vat_minor` BIGINT NOT NULL DEFAULT 0,
    `total_minor` BIGINT NOT NULL,
    `contact_name` VARCHAR(120) NOT NULL,
    `contact_email` VARCHAR(254) NOT NULL,
    `contact_phone` VARCHAR(20) NOT NULL,
    `hold_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_public_id_key`(`public_id`),
    UNIQUE INDEX `bookings_reference_key`(`reference`),
    INDEX `bookings_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `bookings_status_created_at_idx`(`status`, `created_at`),
    INDEX `bookings_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `item_type` ENUM('HOTEL_ROOM', 'TOUR_SEAT') NOT NULL,
    `hotel_room_id` BIGINT UNSIGNED NULL,
    `tour_schedule_id` BIGINT UNSIGNED NULL,
    `description` VARCHAR(255) NOT NULL,
    `quantity` SMALLINT UNSIGNED NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'BDT',
    `price_snapshot` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `booking_items_booking_id_idx`(`booking_id`),
    INDEX `booking_items_hotel_room_id_idx`(`hotel_room_id`),
    INDEX `booking_items_tour_schedule_id_idx`(`tour_schedule_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_guests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `age_group` ENUM('ADULT', 'CHILD') NOT NULL DEFAULT 'ADULT',
    `is_lead` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `booking_guests_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_holds` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `booking_item_id` BIGINT UNSIGNED NULL,
    `hotel_room_id` BIGINT UNSIGNED NULL,
    `tour_schedule_id` BIGINT UNSIGNED NULL,
    `stay_date` DATE NULL,
    `quantity` SMALLINT UNSIGNED NOT NULL,
    `status` ENUM('ACTIVE', 'CONVERTED', 'RELEASED') NOT NULL DEFAULT 'ACTIVE',
    `expires_at` DATETIME(3) NOT NULL,
    `released_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_holds_status_expires_at_idx`(`status`, `expires_at`),
    INDEX `inventory_holds_booking_id_idx`(`booking_id`),
    INDEX `inventory_holds_booking_item_id_idx`(`booking_item_id`),
    INDEX `inventory_holds_hotel_room_id_stay_date_idx`(`hotel_room_id`, `stay_date`),
    INDEX `inventory_holds_tour_schedule_id_idx`(`tour_schedule_id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_status_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id` BIGINT UNSIGNED NOT NULL,
    `from_status` ENUM('DRAFT', 'PENDING_AVAILABILITY', 'PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED', 'COMPLETED', 'FAILED', 'EXPIRED', 'MANUAL_REVIEW', 'CANCELLATION_REQUESTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED') NULL,
    `to_status` ENUM('DRAFT', 'PENDING_AVAILABILITY', 'PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED', 'COMPLETED', 'FAILED', 'EXPIRED', 'MANUAL_REVIEW', 'CANCELLATION_REQUESTED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED') NOT NULL,
    `actor_type` ENUM('CUSTOMER', 'STAFF', 'SYSTEM', 'PAYMENT_PROVIDER') NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_status_history_booking_id_created_at_idx`(`booking_id`, `created_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_keys` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_key` VARCHAR(64) NOT NULL,
    `key` VARCHAR(128) NOT NULL,
    `route` VARCHAR(120) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `response_status` SMALLINT UNSIGNED NULL,
    `response_body` JSON NULL,
    `locked_until` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idempotency_keys_expires_at_idx`(`expires_at`),
    UNIQUE INDEX `idempotency_keys_actor_key_key_route_key`(`actor_key`, `key`, `route`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(80) NOT NULL,
    `aggregate_type` VARCHAR(40) NOT NULL,
    `aggregate_id` VARCHAR(40) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `available_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `outbox_events_status_available_at_idx`(`status`, `available_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_type` ENUM('CUSTOMER', 'STAFF', 'SYSTEM', 'PAYMENT_PROVIDER') NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(80) NOT NULL,
    `target_type` VARCHAR(40) NULL,
    `target_id` VARCHAR(40) NULL,
    `ip_address` VARCHAR(45) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_events_target_type_target_id_idx`(`target_type`, `target_id`),
    INDEX `audit_events_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    INDEX `audit_events_action_created_at_idx`(`action`, `created_at`),
    INDEX `audit_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_granted_by_id_fkey` FOREIGN KEY (`granted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destinations` ADD CONSTRAINT `destinations_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_destination_id_fkey` FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hotel_rooms` ADD CONSTRAINT `hotel_rooms_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_inventory` ADD CONSTRAINT `room_inventory_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `hotel_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_rates` ADD CONSTRAINT `room_rates_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `hotel_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tours` ADD CONSTRAINT `tours_destination_id_fkey` FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tours` ADD CONSTRAINT `tours_hero_media_id_fkey` FOREIGN KEY (`hero_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tour_schedules` ADD CONSTRAINT `tour_schedules_tour_id_fkey` FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_hotel_room_id_fkey` FOREIGN KEY (`hotel_room_id`) REFERENCES `hotel_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_tour_schedule_id_fkey` FOREIGN KEY (`tour_schedule_id`) REFERENCES `tour_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_guests` ADD CONSTRAINT `booking_guests_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_holds` ADD CONSTRAINT `inventory_holds_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_holds` ADD CONSTRAINT `inventory_holds_booking_item_id_fkey` FOREIGN KEY (`booking_item_id`) REFERENCES `booking_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_holds` ADD CONSTRAINT `inventory_holds_hotel_room_id_fkey` FOREIGN KEY (`hotel_room_id`) REFERENCES `hotel_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_holds` ADD CONSTRAINT `inventory_holds_tour_schedule_id_fkey` FOREIGN KEY (`tour_schedule_id`) REFERENCES `tour_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Hand-written integrity constraints (Prisma cannot express CHECK) ──────────
-- Overbooking is impossible at the database level, whatever the application does.
ALTER TABLE `room_inventory`
    ADD CONSTRAINT `room_inventory_capacity_chk` CHECK (`held` + `sold` <= `total`);

ALTER TABLE `tour_schedules`
    ADD CONSTRAINT `tour_schedules_capacity_chk` CHECK (`held` + `sold` <= `capacity`),
    ADD CONSTRAINT `tour_schedules_dates_chk` CHECK (`returns_at` >= `departs_at`);

ALTER TABLE `room_rates`
    ADD CONSTRAINT `room_rates_amount_chk` CHECK (`amount_minor` >= 0);

ALTER TABLE `bookings`
    ADD CONSTRAINT `bookings_amounts_chk` CHECK (
        `base_minor` >= 0 AND `service_charge_minor` >= 0 AND `vat_minor` >= 0
        AND `total_minor` = `base_minor` + `service_charge_minor` + `vat_minor`
    );
