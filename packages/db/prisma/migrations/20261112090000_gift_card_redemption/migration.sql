-- Gift card redemption at checkout (ADR-0034): a gift card payment points at its card.
ALTER TABLE `payments` ADD COLUMN `gift_card_id` BIGINT UNSIGNED NULL;

CREATE INDEX `payments_gift_card_id_idx` ON `payments`(`gift_card_id`);

ALTER TABLE `payments` ADD CONSTRAINT `payments_gift_card_id_fkey` FOREIGN KEY (`gift_card_id`) REFERENCES `gift_cards`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- A gift card payment always names its card, and only gift card payments do.
ALTER TABLE `payments` ADD CONSTRAINT `payments_gift_card_chk` CHECK ((`provider` = 'GIFT_CARD') = (`gift_card_id` IS NOT NULL));
