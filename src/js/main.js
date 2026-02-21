import { getDomElements } from "./app/dom.js";
import { SingingTrainerApp } from "./app/singing-trainer-app.js";

window.addEventListener("DOMContentLoaded", () => {
  try {
    const dom = getDomElements();
    const app = new SingingTrainerApp(dom);
    app.init();
  } catch (error) {
    console.error("Initialization failed:", error);
  }
});
