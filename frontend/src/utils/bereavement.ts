export type BereavementCatalogItem = { code: string; label: string };

export type BereavementOption = {
  eventType: string;
  eventTypeLabel: string;
  familyRelation: string;
  familyRelationLabel: string;
  allowedDays: number;
  payType: "PAID" | "UNPAID";
  evidenceRequired: boolean;
};

export const BEREAVEMENT_EVENT_TYPES: BereavementCatalogItem[] = [
  { code: "MARRIAGE", label: "결혼" },
  { code: "BIRTH", label: "출산" },
  { code: "DEATH", label: "사망" }
];

export const BEREAVEMENT_RELATIONS: BereavementCatalogItem[] = [
  { code: "SELF", label: "본인" },
  { code: "SPOUSE", label: "배우자" },
  { code: "CHILD", label: "자녀" },
  { code: "PARENT", label: "부모" },
  { code: "SPOUSE_PARENT", label: "배우자 부모" },
  { code: "GRANDPARENT", label: "조부모" },
  { code: "SIBLING", label: "형제자매" }
];

export function bereavementLabel(items: BereavementCatalogItem[], code: string) {
  return items.find((item) => item.code === code)?.label ?? code;
}
