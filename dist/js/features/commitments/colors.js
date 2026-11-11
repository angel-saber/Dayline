import { getPersonality, personality } from '../../personalities/index.js?v=6d1be00d390d';
// The saved list position, not its temporary pending/done position, defines color.
export function commitmentColors(index, mode = personality()) {
  const palette = getPersonality(mode).commitmentPalette;
  const position = Number.isInteger(index) && index >= 0 ? index : 0;
  return {
    ...palette.cards[position % palette.cards.length],
    completedBackground: palette.completed.background,
    completedInk: palette.completed.ink,
  };
}
