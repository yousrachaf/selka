import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const filePath = process.argv[2] || "data/hizb.json";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---- helpers ----
function parseVerseKey(key) {
  // "2:74" -> { surah: 2, ayah: 74 }
  const [s, a] = key.split(":").map(Number);
  if (!s || !a) throw new Error(`Invalid verse key: ${key}`);
  return { surah: s, ayah: a };
}

// ---- main ----
const raw = fs.readFileSync(path.resolve(filePath), "utf8");
const json = JSON.parse(raw);

const rows = [];

for (const k of Object.keys(json)) {
  const hizb = Number(json[k].hizb_number);
  const start = parseVerseKey(json[k].first_verse_key);
  const end = parseVerseKey(json[k].last_verse_key);

  rows.push({
    hizb,
    start_surah: start.surah,
    start_ayah: start.ayah,
    end_surah: end.surah,
    end_ayah: end.ayah,
  });
}

rows.sort((a, b) => a.hizb - b.hizb);

console.log(`📘 Hizb parsed: ${rows.length}`);

async function run() {
  // Nettoyer l’index existant
  const { error: delErr } = await supabase
    .from("hizb_index")
    .delete()
    .neq("hizb", 0);

  if (delErr) {
    console.error("❌ Failed to clean hizb_index", delErr);
    process.exit(1);
  }

  const { error } = await supabase
    .from("hizb_index")
    .upsert(rows, { onConflict: "hizb" });

  if (error) {
    console.error("❌ Insert error", error);
    process.exit(1);
  }

  console.log("✅ hizb_index imported successfully");
  console.log("➡️ Example:", rows[0], rows[rows.length - 1]);
}

run();
