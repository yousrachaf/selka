<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient.js";
import { markCompleted } from "../services/selkaApi";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const error = ref("");
const completing = ref(false);
const completed = ref(false);
const ayahs = ref([]);
const range = ref(null);

const hizbStart = computed(() => Number(route.query.hizb_start));
const hizbEnd = computed(() => Number(route.query.hizb_end || hizbStart.value));
const groupCode = computed(() => String(route.query.code || "").trim());

const title = computed(() => {
  if (!range.value) return "Lecture";
  if (range.value.startHizb === range.value.endHizb) {
    return `Lecture — Hizb ${range.value.startHizb}`;
  }
  return `Lecture — Hizb ${range.value.startHizb} a ${range.value.endHizb}`;
});

async function loadReadRange() {
  error.value = "";
  ayahs.value = [];
  range.value = null;
  completed.value = false;

  if (!Number.isFinite(hizbStart.value) || hizbStart.value <= 0) {
    error.value = "Hizb invalide.";
    return;
  }

  let startHizb = hizbStart.value;
  let endHizb = hizbEnd.value || hizbStart.value;
  if (!Number.isFinite(endHizb)) endHizb = startHizb;
  if (endHizb < startHizb) {
    const tmp = startHizb;
    startHizb = endHizb;
    endHizb = tmp;
  }

  loading.value = true;
  try {
    const { data: hizbRows, error: hizbError } = await supabase
      .from("hizb_index")
      .select("hizb, start_surah, start_ayah, end_surah, end_ayah")
      .in("hizb", [startHizb, endHizb]);

    if (hizbError) throw hizbError;
    if (!hizbRows || hizbRows.length < 1) {
      throw new Error("Hizb introuvable.");
    }

    const startEntry = hizbRows.find((h) => h.hizb === startHizb);
    const endEntry = hizbRows.find((h) => h.hizb === endHizb);
    if (!startEntry || !endEntry) {
      throw new Error("Hizb introuvable.");
    }

    range.value = {
      startHizb,
      endHizb,
      start_surah: startEntry.start_surah,
      start_ayah: startEntry.start_ayah,
      end_surah: endEntry.end_surah,
      end_ayah: endEntry.end_ayah,
    };

    const startFilter = `surah.gt.${range.value.start_surah},and(surah.eq.${range.value.start_surah},ayah.gte.${range.value.start_ayah})`;
    const endFilter = `surah.lt.${range.value.end_surah},and(surah.eq.${range.value.end_surah},ayah.lte.${range.value.end_ayah})`;

    const { data: ayahRows, error: ayahError } = await supabase
      .from("quran_ayahs")
      .select("surah, ayah, text_ar")
      .or(startFilter)
      .or(endFilter)
      .order("surah", { ascending: true })
      .order("ayah", { ascending: true });

    if (ayahError) throw ayahError;
    ayahs.value = ayahRows ?? [];
  } catch (err) {
    error.value =
      err?.message || "Impossible de charger la lecture pour ce hizb.";
  } finally {
    loading.value = false;
  }
}

async function onMarkCompleted() {
  if (completing.value) return;
  if (!groupCode.value) {
    error.value = "Code du groupe manquant.";
    return;
  }
  let stored = null;
  try {
    const raw = localStorage.getItem(
      `selka:${groupCode.value}:participation`
    );
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }
  if (!stored?.participationId || !stored?.editToken) {
    error.value = "Participation introuvable pour valider la fin.";
    return;
  }
  completing.value = true;
  error.value = "";
  try {
    await markCompleted(stored.participationId, stored.editToken);
    completed.value = true;
    router.push(`/g/${groupCode.value}`);
  } catch (err) {
    error.value =
      err?.message ||
      "Impossible de marquer la participation comme terminee.";
  } finally {
    completing.value = false;
  }
}

onMounted(loadReadRange);
watch(
  () => route.query,
  () => {
    loadReadRange();
  }
);
</script>

<template>
  <main class="page">
    <section class="card">
      <button class="secondary brown" type="button" @click="router.back()">
        Retour au groupe
      </button>

      <p class="title">{{ title }}</p>

      <p v-if="loading" class="muted">Chargement...</p>
      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="ayahs.length" class="quran-section">
        <div class="quran-flow" dir="rtl" lang="ar">
          <template v-for="a in ayahs" :key="`${a.surah}:${a.ayah}`">
            <span class="ayah-text">{{ a.text_ar }}</span>
            <span class="ayah-badge">
              <span class="ayah-number">{{ a.ayah }}</span>
            </span>
          </template>
        </div>
      </div>
      <div v-if="ayahs.length" class="done-actions">
        <button
          class="secondary brown"
          type="button"
          :disabled="completing || completed"
          @click="onMarkCompleted"
        >
          {{ completed ? "Part terminee" : "J'ai termine ma part" }}
        </button>
      </div>
      <p v-else-if="!loading && !error" class="muted">
        Aucune ayah disponible pour ce hizb.
      </p>

      <footer class="read-footer">
        <p>
          Qur’an text © Tanzil Project — Uthmani Minimal. Used under CC BY 3.0.
          Source:
          <a href="https://tanzil.net" target="_blank" rel="noopener"
            >tanzil.net</a
          >. Text unchanged.
        </p>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--ink);
}

.card {
  width: 100%;
  max-width: 720px;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 24px 0;
  box-shadow: none;
  backdrop-filter: none;
}

.title {
  margin: 12px 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.quran-section {
  margin: 12px 0 18px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #f3ead8;
}

.quran-flow {
  font-size: 22px;
  line-height: 2.1;
  text-align: right;
}

.ayah-text {
  display: inline;
  margin-left: 6px;
}

.ayah-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background-image: url("https://upload.wikimedia.org/wikipedia/commons/a/a8/U%2B06DD_Scheherazade.svg");
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  font-size: 12px;
  line-height: 1;
  margin: 0 10px;
  vertical-align: middle;
  user-select: none;
}

.ayah-number {
  display: inline-block;
  color: #3a2a20;
  font-weight: 600;
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .quran-flow {
    font-size: 20px;
  }

  .ayah-badge {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
}

.muted {
  color: #6b5b50;
  font-size: 14px;
}

.done-actions {
  margin-top: 16px;
  text-align: center;
}

.secondary {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--paper-strong);
  color: var(--ink);
  font-weight: 600;
  cursor: pointer;
}

.secondary.brown {
  border-color: transparent;
  background: var(--accent);
  color: #ffffff;
}

.read-footer {
  margin-top: 24px;
  text-align: center;
  color: #ffffff;
  font-size: 12px;
}

.read-footer a {
  color: inherit;
  text-decoration: underline;
}

.error {
  margin: 12px 0 0;
  color: #b42318;
  font-size: 14px;
}
</style>
