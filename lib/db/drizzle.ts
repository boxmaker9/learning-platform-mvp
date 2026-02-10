import "server-only"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"

import * as schema from "@/lib/db/schema"

const databaseUrl = process.env.SUPABASE_DB_URL

if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL is not configured.")
}

const client = postgres(databaseUrl, { prepare: false })

export const db = drizzle(client, { schema })

