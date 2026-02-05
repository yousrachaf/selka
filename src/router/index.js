import { createRouter, createWebHashHistory } from "vue-router";
import HomeCreate from "../pages/HomeCreate.vue";
import GroupPage from "../pages/GroupPage.vue";
import ReadPage from "../pages/ReadPage.vue";
import KhatmPage from "../pages/KhatmPage.vue";

const routes = [
  { path: "/", name: "home", component: HomeCreate },
  { path: "/g/:code", name: "group", component: GroupPage },
  { path: "/read", name: "read", component: ReadPage },
  { path: "/khatm", name: "khatm", component: KhatmPage },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
