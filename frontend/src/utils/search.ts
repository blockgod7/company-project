import type { GlobalSearchItem } from "../types";

export type GlobalSearchTarget = {
  type: GlobalSearchItem["type"];
  targetId: number;
  parentId: number | null;
  keyword: string;
  nonce: number;
};
