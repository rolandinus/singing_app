function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required DOM element: #${id}`);
  }
  return element;
}

export function getDomElements() {
  return {
    navDashboardBtn: getRequiredElement("navDashboardBtn"),
    navPracticeBtn: getRequiredElement("navPracticeBtn"),
    navSettingsBtn: getRequiredElement("navSettingsBtn"),

    dashboardScreen: getRequiredElement("dashboardScreen"),
    practiceScreen: getRequiredElement("practiceScreen"),
    settingsScreen: getRequiredElement("settingsScreen"),

    dashboardSummary: getRequiredElement("dashboardSummary"),
    skillMapContainer: getRequiredElement("skillMapContainer"),
    recentSessionsContainer: getRequiredElement("recentSessionsContainer"),
    startGuidedBtn: getRequiredElement("startGuidedBtn"),
    goCustomFromDashboardBtn: getRequiredElement("goCustomFromDashboardBtn"),

    familySelect: getRequiredElement("familySelect"),
    skillSelect: getRequiredElement("skillSelect"),
    clefSelect: getRequiredElement("clefSelect"),
    levelSelect: getRequiredElement("levelSelect"),
    countInput: getRequiredElement("countInput"),
    startCustomBtn: getRequiredElement("startCustomBtn"),

    sessionMeta: getRequiredElement("sessionMeta"),
    sessionProgressBar: getRequiredElement("sessionProgressBar"),
    exercisePrompt: getRequiredElement("exercisePrompt"),
    exerciseSubPrompt: getRequiredElement("exerciseSubPrompt"),
    rhythmDisplay: getRequiredElement("rhythmDisplay"),
    standardExerciseBlock: getRequiredElement("standardExerciseBlock"),
    melodyTrainerPanel: getRequiredElement("melodyTrainerPanel"),
    practiceStaff: getRequiredElement("practiceStaff"),
    answerOptions: getRequiredElement("answerOptions"),
    playPromptBtn: getRequiredElement("playPromptBtn"),
    capturePitchBtn: getRequiredElement("capturePitchBtn"),
    nextExerciseBtn: getRequiredElement("nextExerciseBtn"),
    endSessionBtn: getRequiredElement("endSessionBtn"),
    exerciseFeedback: getRequiredElement("exerciseFeedback"),

    sessionSummaryPanel: getRequiredElement("sessionSummaryPanel"),
    sessionSummaryText: getRequiredElement("sessionSummaryText"),
    backToDashboardBtn: getRequiredElement("backToDashboardBtn"),

    settingClefTreble: getRequiredElement("settingClefTreble"),
    settingClefBass: getRequiredElement("settingClefBass"),
    settingDefaultClef: getRequiredElement("settingDefaultClef"),
    settingDailyGoal: getRequiredElement("settingDailyGoal"),
    saveSettingsBtn: getRequiredElement("saveSettingsBtn"),
    settingsStatus: getRequiredElement("settingsStatus"),
  };
}
