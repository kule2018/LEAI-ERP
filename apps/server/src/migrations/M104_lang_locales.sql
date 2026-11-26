-- 扩展语言包：繁体中文 / 日语（未覆盖键由前端英文基线兜底）
INSERT IGNORE INTO `sys_lang` (`tenant_id`,`lang_code`,`locale_name`,`resource_key`,`resource_value`,`fallback_lang`,`status`)
VALUES
  (0,'zh_TW','繁體中文','common.action.confirm','確認','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','common.action.cancel','取消','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','common.action.save','儲存','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','common.action.export','匯出','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','common.action.import','匯入','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','nav.dashboard','工作台','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','nav.sales.order','銷售訂單','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','nav.purchase.order','採購訂單','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','nav.inventory.stock','庫存查詢','zh_CN','ENABLED'),
  (0,'zh_TW','繁體中文','nav.finance.report','財務報表','zh_CN','ENABLED'),
  (0,'ja_JP','日本語','common.action.confirm','確認','en_US','ENABLED'),
  (0,'ja_JP','日本語','common.action.cancel','キャンセル','en_US','ENABLED'),
  (0,'ja_JP','日本語','common.action.save','保存','en_US','ENABLED'),
  (0,'ja_JP','日本語','common.action.export','エクスポート','en_US','ENABLED'),
  (0,'ja_JP','日本語','common.action.import','インポート','en_US','ENABLED'),
  (0,'ja_JP','日本語','nav.dashboard','ダッシュボード','en_US','ENABLED'),
  (0,'ja_JP','日本語','nav.sales.order','販売注文','en_US','ENABLED'),
  (0,'ja_JP','日本語','nav.purchase.order','購買注文','en_US','ENABLED'),
  (0,'ja_JP','日本語','nav.inventory.stock','在庫照会','en_US','ENABLED'),
  (0,'ja_JP','日本語','nav.finance.report','財務レポート','en_US','ENABLED');
