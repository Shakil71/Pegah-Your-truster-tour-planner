-- Refunds back to gift cards (ADR-0037): the gift card share of an approved
-- refund is credited to the card it came from, recorded as an already-paid refund.
ALTER TABLE `gift_card_txns` MODIFY `kind` ENUM('ISSUE', 'REDEEM', 'RELEASE', 'VOID', 'REFUND') NOT NULL;

ALTER TABLE `refunds` ADD COLUMN `gift_card_id` BIGINT UNSIGNED NULL;

CREATE INDEX `refunds_gift_card_id_idx` ON `refunds`(`gift_card_id`);

ALTER TABLE `refunds` ADD CONSTRAINT `refunds_gift_card_id_fkey` FOREIGN KEY (`gift_card_id`) REFERENCES `gift_cards`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- A gift card refund is credited at approval, so it is never left pending.
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_gift_card_paid_chk` CHECK (`gift_card_id` IS NULL OR `status` = 'PAID');
