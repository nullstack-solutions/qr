import { QR_TYPES as runtimeTypes, getTypeDefinition as runtimeGetDefinition } from "./qrTypesRuntime.mjs";

export type QRType =
  | "url"
  | "text"
  | "tel"
  | "sms"
  | "mailto"
  | "geo"
  | "wifi"
  | "vcard"
  | "mecard"
  | "ics";

export interface FieldSchema {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "textarea" | "number" | "email";
  helper?: string;
  pattern?: RegExp;
  validate?: (value: string, allValues: Record<string, string>) => string | null;
}

export interface QRTypeDefinition {
  type: QRType;
  title: string;
  description: string;
  fields: FieldSchema[];
  buildPayload: (values: Record<string, string>) => string;
}

export const QR_TYPES = runtimeTypes as QRTypeDefinition[];

export function getTypeDefinition(type: QRType): QRTypeDefinition {
  return runtimeGetDefinition(type) as QRTypeDefinition;
}

