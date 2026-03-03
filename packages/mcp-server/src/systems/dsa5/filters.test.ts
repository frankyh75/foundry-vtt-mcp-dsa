import { describe, expect, it } from 'vitest';
import {
  describeDSA5Filters,
  isValidDSA5Species,
  isValidExperienceLevel,
  matchesDSA5Filters,
} from './filters.js';
import type { DSA5Filters } from './filters.js';

const testCreature = {
  id: 'test-goblin-1',
  name: 'Goblin Krieger',
  type: 'character',
  systemData: {
    level: 2,
    species: 'goblin',
    culture: 'Bergstamm',
    size: 'small',
    hasSpells: false,
    experiencePoints: 1200,
  },
};

const testSpellcaster = {
  id: 'test-magier-1',
  name: 'Elf Magier',
  type: 'character',
  systemData: {
    level: 5,
    species: 'elf',
    culture: 'Auelfen',
    size: 'medium',
    hasSpells: true,
    experiencePoints: 4000,
  },
};

describe('DSA5 filters', () => {
  it('matches exact level filter', () => {
    const filter: DSA5Filters = { level: 2 };
    expect(describeDSA5Filters(filter)).toBe('Stufe 2');
    expect(matchesDSA5Filters(testCreature, filter)).toBe(true);
    expect(matchesDSA5Filters(testSpellcaster, filter)).toBe(false);
  });

  it('matches level range filter', () => {
    const filter: DSA5Filters = { level: { min: 2, max: 5 } };
    expect(describeDSA5Filters(filter)).toBe('Stufe 2-5');
    expect(matchesDSA5Filters(testCreature, filter)).toBe(true);
    expect(matchesDSA5Filters(testSpellcaster, filter)).toBe(true);
  });

  it('matches species filter', () => {
    const filter: DSA5Filters = { species: 'goblin' };
    expect(describeDSA5Filters(filter)).toBe('goblin');
    expect(matchesDSA5Filters(testCreature, filter)).toBe(true);
    expect(matchesDSA5Filters(testSpellcaster, filter)).toBe(false);
  });

  it('matches has-spells filter', () => {
    const filter: DSA5Filters = { hasSpells: true };
    expect(describeDSA5Filters(filter)).toBe('Zauberer');
    expect(matchesDSA5Filters(testCreature, filter)).toBe(false);
    expect(matchesDSA5Filters(testSpellcaster, filter)).toBe(true);
  });

  it('matches combined filters', () => {
    const filter: DSA5Filters = {
      level: { min: 1, max: 3 },
      size: 'small',
      hasSpells: false,
    };
    expect(describeDSA5Filters(filter)).toBe('Stufe 1-3, small');
    expect(matchesDSA5Filters(testCreature, filter)).toBe(true);
    expect(matchesDSA5Filters(testSpellcaster, filter)).toBe(false);
  });

  it('matches experience points range filter', () => {
    const filter: DSA5Filters = { experiencePoints: { min: 1000, max: 2000 } };
    expect(describeDSA5Filters(filter)).toBe('1000-2000 AP');
    expect(matchesDSA5Filters(testCreature, filter)).toBe(true);
    expect(matchesDSA5Filters(testSpellcaster, filter)).toBe(false);
  });

  it('validates helper functions', () => {
    expect(isValidDSA5Species('goblin')).toBe(true);
    expect(isValidDSA5Species('unicorn')).toBe(false);
    expect(isValidExperienceLevel(3)).toBe(true);
    expect(isValidExperienceLevel(0)).toBe(false);
    expect(isValidExperienceLevel(8)).toBe(false);
  });
});
