import { normalizeVn } from "@/lib/vn-text";

export type Rule = {
  field: "counterparty" | "description";
  pattern: string;
  categoryId: string;
  priority: number;
};
type CategoryKinds = Map<string, "income" | "expense">;

/** Sắp quy tắc: ưu tiên cao trước, cùng ưu tiên thì mẫu dài (cụ thể hơn) trước. */
export function sortRules<T extends Rule>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length,
  );
}

/**
 * Gợi ý danh mục cho một dòng: quy tắc đầu tiên khớp (không dấu, không phân biệt hoa thường)
 * và có danh mục cùng loại thu/chi với dòng. Không khớp → null (chưa phân loại).
 */
export function suggestCategory(
  row: {
    type: "income" | "expense";
    counterparty: string | null;
    rawDescription: string | null;
  },
  sortedRules: Rule[],
  kinds: CategoryKinds,
): string | null {
  const text = {
    counterparty: normalizeVn(row.counterparty ?? ""),
    description: normalizeVn(row.rawDescription ?? ""),
  };
  for (const rule of sortedRules) {
    const pattern = normalizeVn(rule.pattern);
    if (!pattern || kinds.get(rule.categoryId) !== row.type) continue;
    if (text[rule.field].includes(pattern)) return rule.categoryId;
  }
  return null;
}
