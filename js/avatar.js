// Character looks, shared by the 3D room and the character picker.
// Anything you haven't chosen comes from your name, so everyone still looks different by default.

export const SKINS = ['#f6d5b8', '#e9bb92', '#c98d64', '#9c6743', '#6f472c'];
export const HAIR_COLORS = ['#2b1d14', '#4a2c1a', '#16131a', '#8a5a2b', '#d9b26a', '#7a2f3a', '#3d3a66', '#e8a0bf'];
export const HAIRS = [['short', 'Short'], ['long', 'Long'], ['bun', 'Bun'], ['curly', 'Curly'], ['pigtails', 'Pigtails'], ['buzz', 'Buzz']];
export const EXTRAS = [['headphones', 'Phones'], ['glasses', 'Glasses'], ['beanie', 'Beanie'], ['bow', 'Bow'], ['none', 'Nothing']];
export const OUTFITS = ['#6c47ff', '#e0725f', '#4fb3a9', '#f2c14e', '#ec4899', '#3b82f6', '#2b2838', '#e8e1d6'];

const hashOf = (str) => [...(str || '?')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

// → { skin, hair, hairColor, outfit, extra } with every field filled in
export function lookFor(name, avatar = {}, color = '#6c47ff') {
  const h = hashOf(name);
  return {
    skin: SKINS.includes(avatar.skin) ? avatar.skin : SKINS[h % 5],
    hair: HAIRS.some(([k]) => k === avatar.hair) ? avatar.hair : ['bun', 'long', 'short'][(h >> 5) % 3],
    hairColor: HAIR_COLORS.includes(avatar.hairColor) ? avatar.hairColor : HAIR_COLORS[(h >> 3) % 7],
    outfit: /^#[0-9a-f]{6}$/i.test(avatar.outfit || '') ? avatar.outfit : color,
    extra: EXTRAS.some(([k]) => k === avatar.extra) ? avatar.extra : 'headphones',
    side: h % 2 ? 1 : -1, // which way the fringe sweeps
  };
}
