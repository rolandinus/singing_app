import { SKILL_DEFINITIONS } from "../config/curriculum.js";

const SKILL_LABEL_BY_KEY = Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, skill.label]));

export class DashboardView {
  constructor(elements) {
    this.elements = elements;
  }

  renderSummary({ dailyGoal, lastSession }) {
    if (!lastSession) {
      this.elements.dashboardSummary.textContent = `Tagesziel: ${dailyGoal} Übungen. Noch keine Session abgeschlossen.`;
      return;
    }

    this.elements.dashboardSummary.textContent = `Tagesziel: ${dailyGoal} Übungen. Letzte Session: ${lastSession.summary.correct}/${lastSession.summary.total} korrekt (${Math.round(lastSession.summary.accuracy * 100)}%).`;
  }

  renderSkillMap(skillRows) {
    if (!skillRows.length) {
      this.elements.skillMapContainer.innerHTML = "<p class='text-sm text-slate-500 col-span-2'>Keine Skills verfügbar.</p>";
      return;
    }

    const CLEF_LABELS = { treble: "Violinschlüssel", bass: "Bassschlüssel" };

    const byClef = {};
    skillRows.forEach((row) => {
      if (!byClef[row.clef]) byClef[row.clef] = [];
      byClef[row.clef].push(row);
    });

    let html = "";

    Object.entries(byClef).forEach(([clef, rows]) => {
      html += `<div class="col-span-full clef-header">${CLEF_LABELS[clef] ?? clef}</div>`;

      rows.forEach((row) => {
        const label = SKILL_LABEL_BY_KEY[row.skillKey] ?? row.skillKey;
        const fillClass =
          row.mastery >= 80 ? "mastery-fill-high"
          : row.mastery >= 40 ? "mastery-fill-mid"
          : "mastery-fill-low";
        const masteryColorClass =
          row.mastery >= 80 ? "skill-mastery-high"
          : row.mastery >= 40 ? "skill-mastery-mid"
          : "skill-mastery-low";

        html += `
          <div class="skill-card">
            <div class="skill-card-header">
              <span class="skill-name">${label}</span>
              <span class="skill-level">L${row.level}</span>
            </div>
            <div class="mastery-track">
              <div class="mastery-fill ${fillClass}" data-mastery="${row.mastery}"></div>
            </div>
            <div class="skill-card-footer">
              <span class="skill-attempts">${row.attemptsTotal} Versuche</span>
              <span class="skill-mastery-value ${masteryColorClass}">${row.mastery}%</span>
            </div>
          </div>
        `;
      });
    });

    this.elements.skillMapContainer.innerHTML = html;
    this.elements.skillMapContainer.querySelectorAll(".mastery-fill[data-mastery]").forEach((fill) => {
      const mastery = Number(fill.dataset.mastery) || 0;
      fill.style.width = `${Math.max(0, Math.min(100, mastery))}%`;
    });
  }

  renderRecentSessions(sessions) {
    if (!sessions.length) {
      this.elements.recentSessionsContainer.innerHTML = "<p>Noch keine Sessions.</p>";
      return;
    }

    const html = sessions
      .slice(0, 5)
      .map((session) => {
        const date = new Date(session.completedAt).toLocaleString("de-DE");
        const accuracy = Math.round((session.summary?.accuracy ?? 0) * 100);
        return `<p>${date}: ${session.summary.correct}/${session.summary.total} (${accuracy}%)</p>`;
      })
      .join("");

    this.elements.recentSessionsContainer.innerHTML = html;
  }
}
