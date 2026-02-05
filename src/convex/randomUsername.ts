// Random username generator for new accounts
// Format: adjective + noun + 4 random digits

const adjectives = [
  "swift",
  "bright",
  "cosmic",
  "golden",
  "silver",
  "cyber",
  "turbo",
  "rapid",
  "mega",
  "ultra",
  "super",
  "hyper",
  "prime",
  "alpha",
  "beta",
  "delta",
  "omega",
  "neo",
  "epic",
  "mystic",
  "lucky",
  "brave",
  "clever",
  "quick",
  "sharp",
  "bold",
  "cool",
  "wild",
  "free",
  "pure",
];

const nouns = [
  "hooper",
  "baller",
  "player",
  "shooter",
  "dunker",
  "scorer",
  "passer",
  "guard",
  "forward",
  "center",
  "mvp",
  "champ",
  "legend",
  "star",
  "ace",
  "pro",
  "fan",
  "hawk",
  "tiger",
  "eagle",
  "wolf",
  "bear",
  "lion",
  "phoenix",
  "dragon",
  "knight",
  "warrior",
  "ranger",
  "scout",
  "pilot",
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDigits(count: number): string {
  let result = "";
  for (let i = 0; i < count; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

export function generateRandomUsername(): string {
  const adjective = getRandomElement(adjectives);
  const noun = getRandomElement(nouns);
  const digits = getRandomDigits(4);
  return `${adjective}${noun}${digits}`;
}
