import { getDomElements } from "./app/dom.js";
import { AppShell } from "./app/app-shell.js";

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const dom = getDomElements();
    const app = new AppShell(dom);
    await app.init();
  } catch (error) {
    console.error("Initialization failed:", error);
  }
});
