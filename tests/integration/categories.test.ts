import "dotenv/config";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/server/actions/categories";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/auth-guard", () => ({
  requireOwner: async () => ({ email: "owner@test" }),
}));

const PREFIX = "__test_cat__";
const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const find = (name: string) =>
  db.category.findFirst({ where: { name: PREFIX + name } });
const create = async (
  name: string,
  kind: string,
  parentId = "",
  extra: Record<string, string> = {},
) => {
  const r = await createCategory(
    form({ name: PREFIX + name, kind, parentId, ...extra }),
  );
  return { r, cat: await find(name) };
};

afterEach(async () => {
  await db.transaction.deleteMany({
    where: { category: { name: { startsWith: PREFIX } } },
  });
  await db.category.deleteMany({
    where: { name: { startsWith: PREFIX }, parentId: { not: null } },
  });
  await db.category.deleteMany({ where: { name: { startsWith: PREFIX } } });
});
afterAll(() => db.$disconnect());

describe("createCategory", () => {
  test("tạo danh mục gốc và danh mục con", async () => {
    const { r, cat: root } = await create("Ăn", "expense", "", {
      excludeFromReports: "on",
    });
    expect(r.ok).toBe(true);
    expect(root).toMatchObject({
      kind: "expense",
      parentId: null,
      excludeFromReports: true,
    });

    const { r: r2, cat: child } = await create("Cà phê", "expense", root!.id);
    expect(r2.ok).toBe(true);
    expect(child?.parentId).toBe(root!.id);
    expect(child?.excludeFromReports).toBe(false);
  });

  test("không cho tạo cấp thứ 3", async () => {
    const { cat: root } = await create("Gốc", "expense");
    const { cat: child } = await create("Con", "expense", root!.id);
    const { r } = await create("Cháu", "expense", child!.id);
    expect(r).toEqual({
      ok: false,
      error: "Chỉ được tạo tối đa 2 cấp danh mục",
    });
  });

  test("cha phải cùng loại thu/chi", async () => {
    const { cat: income } = await create("Thu", "income");
    const { r } = await create("Chi", "expense", income!.id);
    expect(r).toEqual({
      ok: false,
      error: "Danh mục cha phải cùng loại thu/chi",
    });
  });

  test("từ chối tên trống và loại sai", async () => {
    expect(
      (await createCategory(form({ name: " ", kind: "expense" }))).ok,
    ).toBe(false);
    expect(
      (await createCategory(form({ name: PREFIX + "x", kind: "other" }))).ok,
    ).toBe(false);
  });
});

describe("updateCategory", () => {
  test("đổi tên, bỏ cha, giữ nguyên loại", async () => {
    const { cat: root } = await create("R", "expense");
    const { cat: child } = await create("C", "expense", root!.id);
    const r = await updateCategory(
      form({
        id: child!.id,
        name: PREFIX + "C2",
        parentId: "",
        kind: "income",
      }),
    );
    expect(r.ok).toBe(true);
    expect(await find("C2")).toMatchObject({ parentId: null, kind: "expense" });
  });

  test("không làm cha của chính nó; danh mục có con không thể thành con", async () => {
    const { cat: a } = await create("A", "expense");
    const { cat: b } = await create("B", "expense");
    await create("A-con", "expense", a!.id);

    const self = await updateCategory(
      form({ id: b!.id, name: PREFIX + "B", parentId: b!.id }),
    );
    expect(self.ok).toBe(false);

    const r = await updateCategory(
      form({ id: a!.id, name: PREFIX + "A", parentId: b!.id }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("danh mục con");
  });
});

describe("deleteCategory", () => {
  test("chặn xoá khi có giao dịch hoặc danh mục con; xoá được khi trống", async () => {
    const { cat: root } = await create("Xoá", "expense");
    await create("Xoá-con", "expense", root!.id);
    const { cat: used } = await create("CóGD", "expense");
    await db.transaction.create({
      data: {
        type: "expense",
        amount: 5000n,
        accountId: "acc_techcombank",
        categoryId: used!.id,
        occurredAt: new Date(),
      },
    });

    const r1 = await deleteCategory(root!.id);
    expect(r1.ok).toBe(false);
    const r2 = await deleteCategory(used!.id);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain("1 giao dịch");

    const child = await find("Xoá-con");
    expect(await deleteCategory(child!.id)).toEqual({ ok: true });
    expect(await deleteCategory(root!.id)).toEqual({ ok: true });
  });
});
