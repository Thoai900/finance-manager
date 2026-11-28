import { expect, test } from "vitest";
import { computeBalances } from "@/lib/balance";

const accounts = [
  { id: "tcb", initialBalance: 573504n },
  { id: "cash", initialBalance: 0n },
];

test("chưa có giao dịch → bằng số dư ban đầu", () => {
  const b = computeBalances(accounts, [], []);
  expect(b.get("tcb")).toBe(573504n);
  expect(b.get("cash")).toBe(0n);
});

test("thu cộng, chi trừ, chuyển khoản trừ ví nguồn và cộng ví đích", () => {
  const b = computeBalances(
    accounts,
    [
      { accountId: "tcb", type: "income", total: 19703740n },
      { accountId: "tcb", type: "expense", total: 18428848n },
      { accountId: "tcb", type: "transfer", total: 500000n },
    ],
    [{ toAccountId: "cash", total: 500000n }],
  );
  // Khớp số dư cuối kỳ sao kê Techcombank nếu không tính khoản chuyển khoản thêm.
  expect(b.get("tcb")).toBe(1848396n - 500000n);
  expect(b.get("cash")).toBe(500000n);
});

test("tổng số dư không đổi khi chuyển khoản giữa các ví", () => {
  const before = computeBalances(accounts, [], []);
  const after = computeBalances(
    accounts,
    [{ accountId: "tcb", type: "transfer", total: 200000n }],
    [{ toAccountId: "cash", total: 200000n }],
  );
  const sum = (m: Map<string, bigint>) =>
    [...m.values()].reduce((a, c) => a + c, 0n);
  expect(sum(after)).toBe(sum(before));
});

test("số dư có thể âm (thẻ tín dụng); bỏ qua ví không có trong danh sách", () => {
  const b = computeBalances(
    [{ id: "card", initialBalance: 0n }],
    [
      { accountId: "card", type: "expense", total: 1000n },
      { accountId: "other", type: "income", total: 5n },
    ],
    [{ toAccountId: "other", total: 5n }],
  );
  expect(b.get("card")).toBe(-1000n);
  expect(b.has("other")).toBe(false);
});
