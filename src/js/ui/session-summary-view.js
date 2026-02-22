export class SessionSummaryView {
  constructor(elements) {
    this.elements = elements;
  }

  show(summary) {
    const accuracy = Math.round((summary.accuracy ?? 0) * 100);
    this.elements.sessionSummaryText.textContent = `Modus: ${summary.mode}. Korrekt: ${summary.correct}/${summary.total}. Accuracy: ${accuracy}%`;
    this.elements.sessionSummaryPanel.classList.remove("hidden");
  }

  hide() {
    this.elements.sessionSummaryPanel.classList.add("hidden");
  }
}
