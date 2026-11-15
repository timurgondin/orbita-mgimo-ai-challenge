import "server-only";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db/client";

export const verifyUrl = (token: string) => `${(process.env.PUBLIC_BASE_URL || "https://vibebox-de-com--3000.getbb.app").replace(/\/+$/, "")}/verify/${token}`;

/** 32 байта из CSPRNG, base64url (43 символа). */
export const newVerifyToken = () => randomBytes(32).toString("base64url");

export const headingFor = (typeId: string) => (typeId === "grades" ? "ВЫПИСКА" : "СПРАВКА");

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1b1b1d", light: "#ffffff" } });
}

/** Документ только своего владельца; чужой и несуществующий неотличимы (null → 404). */
export async function getOwnDocument(id: string, userId: string) {
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return null;
  return db.document.findFirst({ where: { id, userId } });
}

export function paragraphsOf(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
