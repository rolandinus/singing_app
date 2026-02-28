import type { Clef, Locale, SkillKey } from '../types';

const TRANSLATIONS = {
  de: {
    nav_dashboard: 'Dashboard',
    nav_practice: 'Üben',
    nav_settings: 'Einstellungen',
    nav_summary: 'Zusammenfassung',
    hero_program: 'Geführtes Programm',
    hero_next_session: 'Nächste Session starten',
    daily_goal: 'Tagesziel: {count} Übungen',
    loading_data: 'Lade Daten...',
    start_guided: 'Geführte Session starten',
    recent_sessions: 'Letzte Sessions',
    no_sessions: 'Noch keine Sessions.',
    skill_map_visual: 'Skill-Map (visuell)',
    skill_map_training: 'Skill-Map (Training)',
    custom_practice: 'Custom Practice',
    settings: 'Einstellungen',
    attempts: 'Versuche',
    custom_session: 'Custom Session',
    family: 'Bereich',
    family_visual: 'Visuell',
    family_aural: 'Gehör',
    family_singing: 'Singen',
    skill: 'Skill',
    clef: 'Schlüssel',
    level: 'Level',
    count: 'Anzahl',
    start_custom: 'Custom starten',
    session_label: 'Session',
    no_active_session: 'Keine aktive Session',
    guided: 'Geführt',
    custom: 'Custom',
    exercise_label: 'Übung',
    next_exercise: 'Nächste Übung',
    end_session: 'Session beenden',
    start_session_above: 'Starte eine Session oben.',
    which_note: 'Welche Note ist das? ({clef})',
    which_interval: 'Welches Intervall siehst du? ({clef})',
    which_rhythm: 'Welches Rhythmusmuster ist dargestellt?',
    identify_heard_interval: 'Höre das Intervall und identifiziere es.',
    interval_visual_hint: 'Bestimme den Abstand zwischen den beiden Noten.',
    interval_aural_hint: 'Tippe auf Prompt abspielen, dann wähle das Intervall.',
    sing_note_prompt: 'Singe diesen Ton nach ({clef})',
    sing_interval_prompt: 'Singe den Zielton des Intervalls ({clef})',
    sing_melody_prompt: 'Singe die Melodie nach ({clef})',
    sing_note_hint: 'Optional Prompt abspielen, dann aufnehmen und auswerten.',
    sing_interval_hint: 'Erster Ton ist Referenz, zweiter ist Zielton.',
    sing_melody_hint: 'Spiele die Melodie ab und singe sie mit gleicher Tonfolge nach.',
    play_prompt: 'Prompt abspielen',
    record_and_evaluate: 'Aufnehmen und auswerten',
    exercise_unknown: 'Übung',
    session_finished: 'Session abgeschlossen',
    mode: 'Modus',
    correct: 'Korrekt',
    accuracy: 'Accuracy',
    back_dashboard: 'Zum Dashboard',
    no_finished_session: 'Keine abgeschlossene Session.',
    enabled_clefs: 'Aktive Schlüssel',
    default_clef: 'Standard-Schlüssel',
    daily_goal_label: 'Tagesziel',
    language: 'Sprache',
    save: 'Speichern',
    saved: 'Gespeichert',
    treble: 'Violinschlüssel',
    bass: 'Bassschlüssel',
    lang_de: 'Deutsch',
    lang_en: 'Englisch',
    skill_note_naming: 'Notennamen',
    skill_interval_visual: 'Intervalle (visuell)',
    skill_rhythm_id: 'Rhythmen',
    skill_interval_aural: 'Intervalle (gehör)',
    skill_sing_note: 'Ton singen',
    skill_sing_interval: 'Intervall singen',
    skill_sing_melody: 'Melodien singen',
  },
  en: {
    nav_dashboard: 'Dashboard',
    nav_practice: 'Practice',
    nav_settings: 'Settings',
    nav_summary: 'Summary',
    hero_program: 'Guided Program',
    hero_next_session: 'Start next session',
    daily_goal: 'Daily goal: {count} exercises',
    loading_data: 'Loading data...',
    start_guided: 'Start guided session',
    recent_sessions: 'Recent Sessions',
    no_sessions: 'No sessions yet.',
    skill_map_visual: 'Skill Map (visual)',
    skill_map_training: 'Skill Map (training)',
    custom_practice: 'Custom Practice',
    settings: 'Settings',
    attempts: 'attempts',
    custom_session: 'Custom Session',
    family: 'Family',
    family_visual: 'Visual',
    family_aural: 'Aural',
    family_singing: 'Singing',
    skill: 'Skill',
    clef: 'Clef',
    level: 'Level',
    count: 'Count',
    start_custom: 'Start custom',
    session_label: 'Session',
    no_active_session: 'No active session',
    guided: 'Guided',
    custom: 'Custom',
    exercise_label: 'Exercise',
    next_exercise: 'Next exercise',
    end_session: 'End session',
    start_session_above: 'Start a session above.',
    which_note: 'Which note is this? ({clef})',
    which_interval: 'Which interval do you see? ({clef})',
    which_rhythm: 'Which rhythm pattern is shown?',
    identify_heard_interval: 'Listen to the interval and identify it.',
    interval_visual_hint: 'Determine the distance between the two notes.',
    interval_aural_hint: 'Tap Play prompt, then choose the interval.',
    sing_note_prompt: 'Sing back this note ({clef})',
    sing_interval_prompt: 'Sing the target note of the interval ({clef})',
    sing_melody_prompt: 'Sing back the melody ({clef})',
    sing_note_hint: 'Optionally play prompt, then record and evaluate.',
    sing_interval_hint: 'First tone is reference, second is target.',
    sing_melody_hint: 'Play the melody prompt, then sing the same pitch contour.',
    play_prompt: 'Play prompt',
    record_and_evaluate: 'Record and evaluate',
    exercise_unknown: 'Exercise',
    session_finished: 'Session completed',
    mode: 'Mode',
    correct: 'Correct',
    accuracy: 'Accuracy',
    back_dashboard: 'Back to dashboard',
    no_finished_session: 'No completed session.',
    enabled_clefs: 'Enabled clefs',
    default_clef: 'Default clef',
    daily_goal_label: 'Daily goal',
    language: 'Language',
    save: 'Save',
    saved: 'Saved',
    treble: 'Treble',
    bass: 'Bass',
    lang_de: 'German',
    lang_en: 'English',
    skill_note_naming: 'Note naming',
    skill_interval_visual: 'Intervals (visual)',
    skill_rhythm_id: 'Rhythm',
    skill_interval_aural: 'Intervals (aural)',
    skill_sing_note: 'Sing note',
    skill_sing_interval: 'Sing interval',
    skill_sing_melody: 'Sing melodies',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.de;

type TranslationParams = Record<string, string | number>;

export function t(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const dictionary = TRANSLATIONS[locale] ?? TRANSLATIONS.de;
  const template = dictionary[key] ?? TRANSLATIONS.de[key] ?? key;

  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, token) => {
    const value = params[token];
    return value === undefined ? '' : String(value);
  });
}

export function clefLabel(locale: Locale, clef: Clef): string {
  return t(locale, clef);
}

export function modeLabel(locale: Locale, mode: 'guided' | 'custom'): string {
  return t(locale, mode);
}

export function skillLabel(locale: Locale, skillKey: SkillKey): string {
  return t(locale, `skill_${skillKey}` as TranslationKey);
}

export function localeTag(locale: Locale): string {
  return locale === 'de' ? 'de-DE' : 'en-US';
}
