export type StampDisplayColumn = {
  key: string;
  header?: string;
  position: string;
  name: string;
  date: string | null | undefined;
  muted: boolean;
  delegateText: string | null;
};

export function emptyStampColumn(key: string): StampDisplayColumn {
  return {
    key,
    header: "",
    position: "",
    name: "",
    date: null,
    muted: true,
    delegateText: null
  };
}

export function padStampColumns(columns: StampDisplayColumn[], minCount = 2) {
  const padded = [...columns];
  while (padded.length < minCount) {
    padded.push(emptyStampColumn(`empty-${padded.length}`));
  }
  return withStampHeaders(padded);
}

function withStampHeaders(columns: StampDisplayColumn[]) {
  return columns.map((column, index) => ({
    ...column,
    header: index === 0 ? "작성" : index === columns.length - 1 ? "승인" : "검토"
  }));
}
