-- Language for customer emails (ADR-0036).
ALTER TABLE `users` ADD COLUMN `locale` VARCHAR(5) NOT NULL DEFAULT 'en';

ALTER TABLE `users` ADD CONSTRAINT `users_locale_chk` CHECK (`locale` IN ('en', 'bn'));
