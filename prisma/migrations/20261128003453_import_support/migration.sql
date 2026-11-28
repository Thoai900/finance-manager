-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "initial_balance_before" BIGINT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "search_text" TEXT;

-- Điền chuỗi tìm kiếm cho giao dịch có sẵn (chỉ chữ thường; giao dịch mới được chuẩn hoá đầy đủ trong app).
UPDATE "transactions"
SET "search_text" = NULLIF(lower(concat_ws(' ', "note", "raw_description", "counterparty")), '');
