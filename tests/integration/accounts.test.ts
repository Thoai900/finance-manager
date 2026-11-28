import "dotenv/config";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createAccount,
  deleteAccount,
  setAccountArchived,
  updateAccount,
} from "@/server/actions/accounts";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const PREFIX = "__test_account__";
const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const findTest = (name: string) =>
  db.account.findFirst({ where: { name: PREFIX + name } });

afterEach(async () => {
  await db.transaction.deleteMany({
    where: { account: { name: { startsWith: PREFIX } } },
  });
  await db.account.deleteMany({ where: { name: { startsWith: PREFIX } } });
});
afterAll(() => db.$disconnect());

describe("createAccount", () => {
  test("tạo ví, lưu số dư ban đầu dạng bigint", async () => {
    const r = await createAccount(
      form({ name: PREFIX + "Ví", type: "cash", initialBalance: "1.250.000" }),
    );
    expect(r).toEqual({ ok: true });
    const acc = await findTest("Ví");
    expect(acc?.type).toBe("cash");
    expect(acc?.initialBalance).toBe(1250000n);
  });

  test("số dư để trống là 0; cho phép số âm (thẻ tín dụng)", async () => {
    await createAccount(
      form({ name: PREFIX + "A", type: "bank", initialBalance: "" }),
    );
    await createAccount(
      form({ name: PREFIX + "B", type: "credit", initialBalance: "-500.000" }),
    );
    expect((await findTest("A"))?.initialBalance).toBe(0n);
    expect((await findTest("B"))?.initialBalance).toBe(-500000n);
  });

  test.each([
    [{ name: "  ", type: "cash", initialBalance: "0" }, "Nhập tên ví"],
    [{ name: PREFIX + "x", type: "gold", initialBalance: "0" }, "Chọn loại ví"],
    [
      { name: PREFIX + "x", type: "cash", initialBalance: "1,5" },
      "Số dư không hợp lệ",
    ],
    [
      { name: PREFIX + "x".repeat(60), type: "cash", initialBalance: "0" },
      "tối đa 50",
    ],
  ])("từ chối dữ liệu sai %#", async (values, message) => {
    const r = await createAccount(form(values));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
    expect(
      await db.account.count({ where: { name: { startsWith: PREFIX } } }),
    ).toBe(0);
  });
});

describe("sửa, lưu trữ, xoá", () => {
  test("sửa ví", async () => {
    await createAccount(
      form({ name: PREFIX + "Cũ", type: "cash", initialBalance: "0" }),
    );
    const acc = (await findTest("Cũ"))!;
    const r = await updateAccount(
      form({
        id: acc.id,
        name: PREFIX + "Mới",
        type: "ewallet",
        initialBalance: "20000",
      }),
    );
    expect(r.ok).toBe(true);
    const updated = await db.account.findUnique({ where: { id: acc.id } });
    expect(updated).toMatchObject({
      name: PREFIX + "Mới",
      type: "ewallet",
      initialBalance: 20000n,
    });
  });

  test("sửa ví không tồn tại", async () => {
    const r = await updateAccount(
      form({
        id: "khong-co",
        name: PREFIX + "x",
        type: "cash",
        initialBalance: "0",
      }),
    );
    expect(r).toEqual({ ok: false, error: "Không tìm thấy ví" });
  });

  test("lưu trữ và khôi phục", async () => {
    await createAccount(
      form({ name: PREFIX + "L", type: "cash", initialBalance: "0" }),
    );
    const acc = (await findTest("L"))!;
    await setAccountArchived(acc.id, true);
    expect((await findTest("L"))?.archived).toBe(true);
    await setAccountArchived(acc.id, false);
    expect((await findTest("L"))?.archived).toBe(false);
  });

  test("xoá ví trống được; ví có giao dịch thì không", async () => {
    await createAccount(
      form({ name: PREFIX + "Trống", type: "cash", initialBalance: "0" }),
    );
    await createAccount(
      form({ name: PREFIX + "CóGD", type: "cash", initialBalance: "0" }),
    );
    const empty = (await findTest("Trống"))!;
    const used = (await findTest("CóGD"))!;
    await db.transaction.create({
      data: {
        type: "expense",
        amount: 1000n,
        accountId: used.id,
        occurredAt: new Date(),
      },
    });

    expect(await deleteAccount(empty.id)).toEqual({ ok: true });
    expect(await findTest("Trống")).toBeNull();

    const r = await deleteAccount(used.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("lưu trữ");
    expect(await findTest("CóGD")).not.toBeNull();
  });
});
