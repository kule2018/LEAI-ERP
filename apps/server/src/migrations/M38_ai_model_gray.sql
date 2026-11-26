-- M38 AI：模型能力范围与灰度比例

ALTER TABLE `ai_model_config`
  ADD COLUMN `capability` VARCHAR(60) NOT NULL DEFAULT 'ALL' AFTER `provider`,
  ADD COLUMN `gray_percent` INT NOT NULL DEFAULT 0 AFTER `capability`;
