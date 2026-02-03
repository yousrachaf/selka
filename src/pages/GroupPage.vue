<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  computeNextSlot,
  finishGroup,
  getGroupByCode,
  joinGroup,
  listParticipations,
  markCompleted,
} from "../services/selkaApi";

const route = useRoute();
const router = useRouter();
const group = ref(null);
const participations = ref([]);
const loading = ref(false);
const error = ref("");
const notFound = ref(false);

const displayName = ref("");
const hizbTaken = ref("1");
const joining = ref(false);
const completing = ref(false);
const finishing = ref(false);

const code = computed(() => String(route.params.code || "").trim());

const totalCompleted = computed(() =>
  participations.value.reduce(
    (sum, p) => {
      if (!p.completed) return sum;
      const start = Number(p.start_hizb);
      const end = Number(p.end_hizb);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        return sum + (end - start + 1);
      }
      return sum + Number(p.hizb_taken || 0);
    },
    0
  )
);

const totalTaken = computed(() =>
  participations.value.reduce((sum, p) => {
    const start = Number(p.start_hizb);
    const end = Number(p.end_hizb);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return sum + (end - start + 1);
    }
    return sum + Number(p.hizb_taken || 0);
  }, 0)
);

const remaining = computed(() => {
  if (!group.value?.total_hizb) return 0;
  return Math.max(0, group.value.total_hizb - totalTaken.value);
});

const isFinished = computed(() => {
  if (!group.value?.total_hizb) return false;
  return totalTaken.value >= group.value.total_hizb;
});

const progressPercent = computed(() => {
  if (!group.value?.total_hizb) return 0;
  return Math.round((totalCompleted.value / group.value.total_hizb) * 100);
});

const isGroupFinished = computed(() => Boolean(group.value?.finished_at));

const expiresInDays = computed(() => {
  if (!group.value?.expires_at) return null;
  const ms = new Date(group.value.expires_at).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
});

const localParticipation = ref(null);

const storedParticipation = computed(() => {
  if (localParticipation.value) return localParticipation.value;
  if (!group.value?.join_code) return null;
  try {
    const raw = localStorage.getItem(
      `selka:${group.value.join_code}:participation`
    );
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
});

const hasLocalParticipation = computed(() => {
  const stored = storedParticipation.value;
  return Boolean(stored?.participationId);
});

const canComplete = computed(() => {
  const stored = storedParticipation.value;
  if (!stored?.participationId) return false;
  const row = participations.value.find(
    (p) => String(p.id) === String(stored.participationId)
  );
  return Boolean(row && !row.completed);
});

const hasCompletedLocal = computed(() => {
  const stored = storedParticipation.value;
  if (!stored?.participationId) return false;
  const row = participations.value.find(
    (p) => String(p.id) === String(stored.participationId)
  );
  return Boolean(row && row.completed);
});

async function loadGroupAndParticipations() {
  if (!code.value) return;
  loading.value = true;
  error.value = "";
  notFound.value = false;
  try {
    const g = await getGroupByCode(code.value);
    group.value = g;
    try {
      const raw = localStorage.getItem(
        `selka:${g.join_code}:participation`
      );
      localParticipation.value = raw ? JSON.parse(raw) : null;
    } catch {
      localParticipation.value = null;
    }
    participations.value = await listParticipations(g.id);
    await maybeFinishGroup();
  } catch (err) {
    const message =
      err?.message ||
      "Groupe introuvable. Verifiez le code et reessayez.";
    if (message.toLowerCase().includes("0 rows")) {
      notFound.value = true;
      error.value = "";
    } else {
      error.value = message;
    }
    group.value = null;
    participations.value = [];
    localParticipation.value = null;
  } finally {
    loading.value = false;
  }
}

async function onJoin() {
  if (!group.value || joining.value) return;
  if (!displayName.value.trim() || !hizbTaken.value) return;
  joining.value = true;
  error.value = "";
  try {
    const current = await listParticipations(group.value.id);
    const slot = computeNextSlot(
      current,
      Number(hizbTaken.value),
      group.value.total_hizb || 60
    );
    if (slot.end > group.value.total_hizb) {
      throw new Error("Plus de hizb disponibles pour cette taille");
    }
    const created = await joinGroup(
      group.value.id,
      displayName.value.trim(),
      Number(hizbTaken.value),
      slot.start,
      slot.end
    );
    localStorage.setItem(
      `selka:${group.value.join_code}:participation`,
      JSON.stringify({
        participationId: created.id,
        editToken: created.edit_token,
      })
    );
    localParticipation.value = {
      participationId: created.id,
      editToken: created.edit_token,
    };
    displayName.value = "";
    hizbTaken.value = "1";
    participations.value = await listParticipations(group.value.id);
    await maybeFinishGroup();
  } catch (err) {
    error.value =
      err?.message ||
      "Impossible de rejoindre le groupe. Reessayez plus tard.";
  } finally {
    joining.value = false;
  }
}

function rangeLabel(participation) {
  const start = Number(participation.start_hizb);
  const end = Number(participation.end_hizb);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return start === end ? `Hizb ${start}` : `Hizb ${start}-${end}`;
  }
  const fallback = Number(participation.hizb_taken || 0);
  return fallback ? `Hizb (${fallback})` : "Hizb ?";
}

async function onComplete() {
  if (!group.value || completing.value) return;
  const stored = storedParticipation.value;
  if (!stored?.participationId || !stored?.editToken) return;
  completing.value = true;
  error.value = "";
  try {
    await markCompleted(stored.participationId, stored.editToken);
    participations.value = await listParticipations(group.value.id);
    await maybeFinishGroup();
  } catch (err) {
    error.value =
      err?.message ||
      "Impossible de marquer comme termine. Reessayez plus tard.";
  } finally {
    completing.value = false;
  }
}

async function maybeFinishGroup() {
  if (!group.value || finishing.value) return;
  if (group.value.finished_at) return;
  if (totalCompleted.value < group.value.total_hizb) return;
  finishing.value = true;
  try {
    const updated = await finishGroup(group.value.id);
    if (updated) {
      group.value = updated;
    } else {
      group.value = await getGroupByCode(code.value);
    }
  } catch (err) {
    error.value =
      err?.message ||
      "Impossible de terminer le groupe automatiquement.";
  } finally {
    finishing.value = false;
  }
}

function resetLocalParticipation() {
  if (!group.value?.join_code) return;
  localStorage.removeItem(`selka:${group.value.join_code}:participation`);
  localParticipation.value = null;
}

onMounted(loadGroupAndParticipations);
watch(code, () => {
  loadGroupAndParticipations();
});
</script>

<template>
  <main class="page">
    <section class="card">
      <p v-if="loading" class="muted">Chargement...</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="notFound" class="landing">
        <h2 class="landing-title">Cette selka a expiré ou n'existe pas</h2>
        <button class="primary" type="button" @click="router.push('/')">
          Créer une autre selka
        </button>
      </div>

      <div v-if="group" class="content">
        <h1 class="title">{{ group.name }}</h1>

        <div class="progress">
          <div>
            <strong>{{ totalCompleted }}</strong> / {{ group.total_hizb }} hizb
          </div>
          <div class="muted">{{ progressPercent }}%</div>
        </div>
        <p class="muted">Il reste {{ remaining }} hizb</p>

        <div v-if="isFinished" class="finish">
          <p class="finish-title">الحمد لله، تمت الختمة</p>
          <p class="muted">
            Allahoumma taqabbal minna wa zidna hubban wa thabata.
          </p>
        </div>

        <section v-if="!isGroupFinished && !hasLocalParticipation" class="section">
          <h2 class="subtitle">Rejoindre</h2>
          <div class="form-row">
            <label class="label" for="displayName">Prenom</label>
            <input
              id="displayName"
              v-model="displayName"
              class="input"
              type="text"
              placeholder="Ex: Amina"
              :disabled="joining"
            />
          </div>
          <div class="form-row">
            <label class="label" for="hizbTaken">Je prends</label>
            <select
              id="hizbTaken"
              v-model="hizbTaken"
              class="input"
              :disabled="joining"
            >
              <option value="1">1 hizb</option>
              <option value="2">2 hizb</option>
            </select>
          </div>
          <button
            class="primary"
            type="button"
            :disabled="joining || !displayName.trim() || !hizbTaken"
            @click="onJoin"
          >
            {{ joining ? "En cours..." : "Je prends cette part" }}
          </button>
        </section>

        <section v-if="!isGroupFinished && hasLocalParticipation" class="section">
          <h2 class="subtitle">Merci de votre participation</h2>
          <div class="actions">
            <button
              class="secondary brown"
              type="button"
              :disabled="completing || !canComplete"
              @click="onComplete"
            >
              {{ completing ? "Mise a jour..." : "J'ai termine ma part" }}
            </button>
            <button
              class="secondary ghost"
              type="button"
              v-if="hasCompletedLocal"
              @click="resetLocalParticipation"
            >
              Je veux d'autres part
            </button>
          </div>
        </section>

        <section v-if="isGroupFinished" class="section">
          <div class="landing">
            <h2 class="landing-title">Selka terminée ✅</h2>
            <p class="muted">Merci pour votre participation. Barakallahu fikum.</p>
            <p v-if="expiresInDays !== null" class="muted">
              Cette selka sera supprimée dans {{ expiresInDays }} jours.
            </p>
            <button class="primary" type="button" @click="router.push('/')">
              Créer une autre selka
            </button>
          </div>
        </section>

        <section class="section">
          <h2 class="subtitle">Participations</h2>
          <div v-if="participations.length" class="list">
            <div v-for="p in participations" :key="p.id" class="item">
              <div class="item-main">
                <strong>{{ p.display_name }}</strong>
                <span class="muted">{{ rangeLabel(p) }}</span>
              </div>
              <span :class="p.completed ? 'badge ok' : 'badge'">
                {{ p.completed ? "✔ termine" : "⏳ en cours" }}
              </span>
            </div>
          </div>
          <p v-else class="muted">Aucune participation pour le moment.</p>
        </section>
      </div>
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
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 18px 40px rgba(12, 12, 12, 0.2);
  backdrop-filter: blur(6px);
}

.title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
}

.subtitle {
  margin: 0 0 10px;
  font-size: 18px;
}

.progress {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--paper-strong);
  margin-bottom: 18px;
}

.finish {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--paper-strong);
}

.finish-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
}

.landing {
  text-align: center;
  display: grid;
  gap: 10px;
}

.landing-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.list {
  display: grid;
  gap: 10px;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
}

.item-main {
  display: flex;
  gap: 12px;
  align-items: center;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(124, 74, 46, 0.12);
  color: #3a2a20;
  font-size: 12px;
}

.badge.ok {
  background: rgba(30, 111, 60, 0.12);
  color: #1e6f3c;
}

.form-row {
  margin-bottom: 12px;
}

.label {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 16px;
  background: var(--paper-strong);
  color: var(--ink);
}

.primary {
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.primary:disabled,
.secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.secondary.ghost {
  background: transparent;
  color: var(--ink);
}

.muted {
  color: #6b5b50;
  font-size: 14px;
}

.error {
  margin: 12px 0 0;
  color: #b42318;
  font-size: 14px;
}
</style>
