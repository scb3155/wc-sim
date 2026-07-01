// matchups.js — R32 matchup baselines for wc-sim
// xGBase = hand-calibrated from public WC '26 group-stage xG + tournament priors
// possExp = possession exponent (higher = more sensitive to possession, i.e. possession-based attackers)
//           NED 0.55, MAR 0.30 archived; counter teams get lower exponents.
// style: "possession" | "hybrid" | "counter" — informs UI copy, not the math
// espnKeys: strings that match ESPN scoreboard event name to auto-pull live state

window.MATCHUPS = [
  {
    id: "BEL-SEN",
    label: "Belgium vs Senegal",
    home: { code: "BEL", name: "Belgium", xGBase: 1.72, possDefault: 55, possExp: 0.50, style: "possession" },
    away: { code: "SEN", name: "Senegal", xGBase: 1.48, possDefault: 45, possExp: 0.35, style: "hybrid" },
    tempo: 21, pressure: 68,
    espnKeys: ["Belgium", "Senegal"],
    espnEventId: "760493",
    players: [
      { team: "BEL", name: "De Bruyne",     role: "AM",  sotBase: 1.35 },
      { team: "BEL", name: "Lukaku",        role: "ST",  sotBase: 1.20 },
      { team: "BEL", name: "Doku",          role: "LW",  sotBase: 1.05 },
      { team: "BEL", name: "Trossard",      role: "RW",  sotBase: 0.95 },
      { team: "SEN", name: "Sarr",          role: "RW",  sotBase: 1.10 },
      { team: "SEN", name: "H. Diarra",     role: "CM",  sotBase: 0.80 },
      { team: "SEN", name: "Jackson",       role: "ST",  sotBase: 0.95 },
      { team: "SEN", name: "Ndiaye (Iliman)", role: "AM", sotBase: 0.90 }
    ],
    notes: "Belgium slight favorite pre-match (Mirror 6/5). Senegal beat Iraq 5-0 in final group game; Belgium beat NZ 5-1 after Egypt/Iran draws."
  },
  {
    id: "ENG-COD",
    label: "England vs DR Congo",
    home: { code: "ENG", name: "England", xGBase: 2.15, possDefault: 62, possExp: 0.55, style: "possession" },
    away: { code: "COD", name: "DR Congo", xGBase: 0.95, possDefault: 38, possExp: 0.30, style: "counter" },
    tempo: 22, pressure: 65,
    espnKeys: ["England", "Congo"],
    players: [
      { team: "ENG", name: "Kane",     role: "ST", sotBase: 1.35 },
      { team: "ENG", name: "Bellingham", role: "AM", sotBase: 1.10 },
      { team: "ENG", name: "Saka",     role: "RW", sotBase: 1.05 },
      { team: "ENG", name: "Foden",    role: "AM", sotBase: 1.00 },
      { team: "COD", name: "Bakambu",  role: "ST", sotBase: 0.85 },
      { team: "COD", name: "Wissa",    role: "ST", sotBase: 0.80 }
    ],
    notes: "England pure striker (Kane) — trustworthy archetype per audit rules."
  },
  {
    id: "USA-BIH",
    label: "USA vs Bosnia",
    home: { code: "USA", name: "USA", xGBase: 1.70, possDefault: 55, possExp: 0.45, style: "hybrid" },
    away: { code: "BIH", name: "Bosnia", xGBase: 1.25, possDefault: 45, possExp: 0.35, style: "hybrid" },
    tempo: 23, pressure: 68,
    espnKeys: ["United States", "Bosnia"],
    players: [
      { team: "USA", name: "Pulisic",   role: "LW", sotBase: 1.15 },
      { team: "USA", name: "Balogun",   role: "ST", sotBase: 1.00 },
      { team: "USA", name: "Reyna",     role: "AM", sotBase: 0.90 },
      { team: "BIH", name: "Džeko",     role: "ST", sotBase: 0.90 },
      { team: "BIH", name: "Tabaković", role: "ST", sotBase: 0.75 }
    ],
    notes: "Home leg for USA."
  },
  {
    id: "FRA-SWE",
    label: "France vs Sweden (archived)",
    home: { code: "FRA", name: "France", xGBase: 2.08, possDefault: 58, possExp: 0.55, style: "possession" },
    away: { code: "SWE", name: "Sweden", xGBase: 1.20, possDefault: 42, possExp: 0.35, style: "hybrid" },
    tempo: 23, pressure: 65,
    espnKeys: ["France", "Sweden"],
    players: [
      { team: "FRA", name: "Dembélé",  role: "RW", sotBase: 1.15 },
      { team: "FRA", name: "Mbappé",   role: "LW", sotBase: 1.50 },
      { team: "SWE", name: "Gyökeres", role: "ST", sotBase: 1.30 },
      { team: "SWE", name: "Isak",     role: "ST", sotBase: 1.15 }
    ],
    notes: "Archived — FRA won 3-0. Retained for model verification."
  },
  {
    id: "NED-MAR",
    label: "Netherlands vs Morocco (archived HT 0-0 build)",
    home: { code: "NED", name: "Netherlands", xGBase: 2.68, possDefault: 58, possExp: 0.55, style: "possession" },
    away: { code: "MAR", name: "Morocco", xGBase: 1.85, possDefault: 42, possExp: 0.30, style: "counter" },
    tempo: 23, pressure: 65,
    espnKeys: ["Netherlands", "Morocco"],
    players: [
      { team: "NED", name: "Gakpo",     role: "LW", sotBase: 0.71 },
      { team: "NED", name: "Brobbey",   role: "ST", sotBase: 1.05 },
      { team: "MAR", name: "Hakimi",    role: "RB", sotBase: 1.50, hakimiEngine: true },
      { team: "MAR", name: "En-Nesyri", role: "ST", sotBase: 0.85, enNesyriChannel: true },
      { team: "MAR", name: "Díaz",      role: "AM", sotBase: 0.80 },
      { team: "MAR", name: "Saibari",   role: "CM", sotBase: 0.55 }
    ],
    notes: "Reference build. Hakimi transition engine active for this matchup only."
  }
];
