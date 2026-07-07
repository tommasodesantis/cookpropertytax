export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type {
  AssessmentHistoryRow,
  CaseFile,
  Comparable,
  Parcel,
  Sale,
} from "./models";
