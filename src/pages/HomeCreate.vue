<script setup>
import { computed, ref } from "vue";
import { createGroup } from "../services/selkaApi";

const groupName = ref("");
const loading = ref(false);
const error = ref("");
const result = ref(null);
const copied = ref(false);

const joinLink = computed(() =>
  result.value?.join_code
    ? `${window.location.origin}/#/g/${result.value.join_code}`
    : ""
);

const waLink = computed(() => {
  if (!joinLink.value) return "";
  const message = `Rejoins notre سلكة: ${joinLink.value}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
});

async function onCreate() {
  if (!groupName.value || loading.value) return;
  loading.value = true;
  error.value = "";
  copied.value = false;
  try {
    result.value = await createGroup(groupName.value.trim());
  } catch (err) {
    error.value =
      err?.message ||
      "Une erreur est survenue lors de la creation du groupe.";
  } finally {
    loading.value = false;
  }
}

async function copyLink() {
  if (!joinLink.value || !navigator?.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(joinLink.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch (err) {
    error.value =
      err?.message || "Impossible de copier le lien dans le presse-papiers.";
  }
}
</script>

<template>
  <main class="page">
    <section class="card">
      <h1 class="title">Creer une سلكة</h1>

      <label class="label" for="groupName">Nom du groupe</label>
      <input
        id="groupName"
        v-model="groupName"
        class="input"
        type="text"
        placeholder="Ex: Selka Ramdan"
        :disabled="loading"
      />

      <button
        class="primary"
        type="button"
        :disabled="loading || !groupName.trim()"
        @click="onCreate"
      >
        {{ loading ? "Creation..." : "Creer le groupe" }}
      </button>

      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="result" class="result">
        <h2 class="subtitle">Groupe cree</h2>
        <p><strong>Nom:</strong> {{ result.name }}</p>
        <p><strong>Code:</strong> {{ result.join_code }}</p>
        <p class="link">{{ joinLink }}</p>

        <div class="actions">
          <button type="button" class="secondary" @click="copyLink">
            {{ copied ? "Lien copie" : "Copier le lien" }}
          </button>
          <a
            v-if="waLink"
            class="secondary"
            :href="waLink"
            target="_blank"
            rel="noopener"
          >
            Partager WhatsApp
          </a>
        </div>
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
  max-width: 520px;
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 18px 40px rgba(12, 12, 12, 0.2);
  backdrop-filter: blur(6px);
}

.title {
  margin: 0 0 16px;
  font-size: 28px;
  font-weight: 700;
}

.label {
  display: block;
  font-size: 14px;
  margin-bottom: 8px;
}

.input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 16px;
  margin-bottom: 16px;
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

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 12px;
  color: #b42318;
  font-size: 14px;
}

.result {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.subtitle {
  margin: 0 0 8px;
  font-size: 18px;
}

.link {
  margin: 8px 0 16px;
  word-break: break-all;
  color: #3a2a20;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.secondary {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--paper-strong);
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
</style>
