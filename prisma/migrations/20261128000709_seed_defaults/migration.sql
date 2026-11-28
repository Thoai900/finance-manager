-- Dữ liệu mặc định: ví Techcombank và bộ danh mục cơ bản (xem PLAN.md mục 1, 3).
-- ID cố định để migration chạy giống nhau ở mọi môi trường.

INSERT INTO "accounts" ("id", "name", "type", "bank_code", "initial_balance") VALUES
  ('acc_techcombank', 'Techcombank', 'bank', 'TCB', 0);

INSERT INTO "categories" ("id", "name", "kind", "exclude_from_reports") VALUES
  ('cat_an_uong', 'Ăn uống', 'expense', false),
  ('cat_di_lai', 'Đi lại', 'expense', false),
  ('cat_nha_o', 'Nhà ở', 'expense', false),
  ('cat_hoa_don', 'Hoá đơn & tiện ích', 'expense', false),
  ('cat_mua_sam', 'Mua sắm', 'expense', false),
  ('cat_giai_tri', 'Giải trí', 'expense', false),
  ('cat_suc_khoe', 'Sức khoẻ', 'expense', false),
  ('cat_giao_duc', 'Giáo dục', 'expense', false),
  ('cat_chi_khac', 'Chi khác', 'expense', false),
  ('cat_chuyen_tk_khac', 'Chuyển sang tài khoản khác', 'expense', true),
  ('cat_luong', 'Lương', 'income', false),
  ('cat_thuong', 'Thưởng', 'income', false),
  ('cat_tien_lai', 'Tiền lãi', 'income', false),
  ('cat_thu_khac', 'Thu khác', 'income', false);
