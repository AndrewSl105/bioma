import { describe, expect, it } from 'vitest';
import { computeZone, parseBands } from './bands';

const VITD = [
  { level: 'DEFICIENT', label: 'дефіцит', labels: { en: 'deficiency' }, max: 50 },
  { level: 'LOW', label: 'недостатність', labels: { en: 'insufficiency' }, min: 50, max: 75 },
  { level: 'OPTIMAL', label: 'достатній', labels: { en: 'sufficient' }, min: 75, max: 125 },
];

describe('локалізація підписів смуг', () => {
  it('віддає переклад для запитаної локалі', () => {
    expect(computeZone(90, parseBands(VITD, 'en'))?.label).toBe('sufficient');
    expect(computeZone(40, parseBands(VITD, 'en'))?.label).toBe('deficiency');
  });

  it('українська — канон, її беремо і без перекладу, і з ним', () => {
    expect(computeZone(90, parseBands(VITD, 'uk'))?.label).toBe('достатній');
    expect(computeZone(90, parseBands(VITD))?.label).toBe('достатній');
  });

  it('невідома локаль відкочується на канон, а не на порожньо', () => {
    expect(computeZone(90, parseBands(VITD, 'de'))?.label).toBe('достатній');
  });

  it('смуга без перекладів лишається робочою (старі дані)', () => {
    const legacy = [{ level: 'OPTIMAL', label: 'норма', min: 1, max: 5 }];
    expect(computeZone(3, parseBands(legacy, 'en'))?.label).toBe('норма');
  });

  it('порожній переклад не витісняє канон', () => {
    const blank = [{ level: 'OPTIMAL', label: 'норма', labels: { en: '   ' }, min: 1, max: 5 }];
    expect(computeZone(3, parseBands(blank, 'en'))?.label).toBe('норма');
  });

  it('битий labels не ламає розбір', () => {
    const bad = [{ level: 'OPTIMAL', label: 'норма', labels: 'not-an-object', min: 1, max: 5 }];
    expect(computeZone(3, parseBands(bad, 'en'))?.label).toBe('норма');
  });

  it('рівні лишаються мовно-незалежними — від локалі не залежать', () => {
    expect(computeZone(90, parseBands(VITD, 'en'))?.level).toBe('OPTIMAL');
    expect(computeZone(90, parseBands(VITD, 'uk'))?.level).toBe('OPTIMAL');
  });
});
