Import Tanzil Uthmani Minimal into Supabase

Prerequisites:
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell env (never in frontend).

Place the file at:
data/tanzil-uthmani-min.txt

Or pass a custom path as the first argument.

Run:
node scripts/import_tanzil_minimal.mjs

Custom file path:
node scripts/import_tanzil_minimal.mjs "D:\Telechargements\quran-simple-min.txt"

Optional:
Set BATCH_SIZE (default 500):
BATCH_SIZE=500 node scripts/import_tanzil_minimal.mjs
