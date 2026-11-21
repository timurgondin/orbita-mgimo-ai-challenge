"use server";

import { searchPeople } from "@/server/data/directory";
import type { PersonHit } from "@/server/data/types";

/** Поиск людей для строки на /people. Вход проверяется внутри; параметры — только строка запроса и вкладка. */
export async function findPeople(query: unknown, kind: unknown): Promise<PersonHit[]> {
  return searchPeople(query, kind);
}
