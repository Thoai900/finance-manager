-- Quy tắc tự phân loại mặc định (PLAN.md mục 4). Chỉ gồm tên cửa hàng/nội dung phổ biến, không có tên người.
-- So khớp không dấu, không phân biệt hoa thường; quy tắc người dùng tạo có ưu tiên cao hơn (10).

INSERT INTO "category_rules" ("id", "field", "pattern", "category_id", "priority") VALUES
  ('rule_moca', 'counterparty', 'MOCA', 'cat_di_lai', 0),
  ('rule_grab', 'counterparty', 'GRAB', 'cat_di_lai', 0),
  ('rule_highlands', 'counterparty', 'HIGHLANDS', 'cat_an_uong', 0),
  ('rule_phuc_long', 'counterparty', 'PHUC LONG', 'cat_an_uong', 0),
  ('rule_starbucks', 'counterparty', 'STARBUCKS', 'cat_an_uong', 0),
  ('rule_shopee', 'counterparty', 'SHOPEE', 'cat_mua_sam', 0),
  ('rule_lazada', 'counterparty', 'LAZADA', 'cat_mua_sam', 0),
  ('rule_tra_lai', 'description', 'tra lai so du', 'cat_tien_lai', 0),
  ('rule_sinh_loi', 'description', 'loi nhuan sinh loi', 'cat_tien_lai', 0),
  ('rule_upoint', 'description', 'sang diem upoint', 'cat_chuyen_tk_khac', 0),
  ('rule_nap_dt', 'description', 'nap tien dien thoai', 'cat_hoa_don', 0),
  ('rule_nap_di_dong', 'description', 'nap tien di dong', 'cat_hoa_don', 0),
  ('rule_tien_dien', 'description', 'tien dien', 'cat_hoa_don', 0),
  ('rule_tien_nuoc', 'description', 'tien nuoc', 'cat_hoa_don', 0);
