<template>
  <main class="page">
    <div class="stack">
      <img src="/Khatm_One.gif" alt="Khatm One" class="gif" />
      <img src="/Khatm_Two.gif" alt="Khatm Two" class="gif" />
    </div>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.stack {
  display: grid;
  gap: 0;
  width: min(720px, 100%);
}

.gif {
  width: 100%;
  display: block;
}
</style>
