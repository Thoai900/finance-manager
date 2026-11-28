import { connection } from "next/server";
import type { Category } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type CategoryNode = Category & { children: Category[] };

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "vi");

/** Danh mục dạng cây 2 cấp, sắp theo tên tiếng Việt. */
export async function listCategoryTree(): Promise<CategoryNode[]> {
  await connection();
  const all = await db.category.findMany();
  return all
    .filter((c) => !c.parentId)
    .sort(byName)
    .map((root) => ({
      ...root,
      children: all.filter((c) => c.parentId === root.id).sort(byName),
    }));
}
