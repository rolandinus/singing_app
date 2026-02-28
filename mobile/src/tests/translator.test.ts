import { describe, expect, it } from 'vitest';
import { clefLabel, localeTag, modeLabel, skillLabel, t } from '../core/i18n/translator';

describe('translator', () => {
  it('resolves German and English labels with interpolation', () => {
    expect(t('de', 'daily_goal', { count: 12 })).toBe('Tagesziel: 12 Übungen');
    expect(t('en', 'daily_goal', { count: 12 })).toBe('Daily goal: 12 exercises');
  });

  it('returns localized helper labels for clef/mode/skill', () => {
    expect(clefLabel('de', 'treble')).toBe('Violinschlüssel');
    expect(modeLabel('en', 'guided')).toBe('Guided');
    expect(skillLabel('en', 'note_naming')).toBe('Note naming');
  });

  it('returns locale tags used for date formatting', () => {
    expect(localeTag('de')).toBe('de-DE');
    expect(localeTag('en')).toBe('en-US');
  });
});
