import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const filePath = process.argv[2] || "data/tanzil-uthmani-min.txt";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Missing env vars: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const content = fs.readFileSync(path.resolve(filePath), "utf8");
const lines = content.split(/\r?\n/).filter(Boolean);

const rows = [];
for (const line of lines) {
  const parts = line.split("|");
  if (parts.length < 3) continue;
  const surah = Number(parts[0]);
  const ayah = Number(parts[1]);
  const text_ar = parts.slice(2).join("|").trim();
  if (!surah || !ayah || !text_ar) continue;
  rows.push({ surah, ayah, text_ar });
}

console.log(`📖 Lines: ${lines.length}, Parsed rows: ${rows.length}`);
if (rows.length === 0) process.exit(1);

async function run() {
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabase
      .from("quran_ayahs")
      .upsert(batch, { onConflict: "surah,ayah" });

    if (error) {
      console.error("❌ Supabase error on batch", i, error);
      process.exit(1);
    }

    console.log(`✅ Upserted ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }

  console.log("🎉 Import finished");
}

run();
