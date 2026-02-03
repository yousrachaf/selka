import { createRouter, createWebHistory } from "vue-router";
import HomeCreate from "../pages/HomeCreate.vue";
import GroupPage from "../pages/GroupPage.vue";

const routes = [
  { path: "/", name: "home", component: HomeCreate },
  { path: "/g/:code", name: "group", component: GroupPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
