export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'
  | 'unknown'

export interface Element {
  atomicNumber: number
  symbol: string
  name: string
  atomicMass: string
  category: ElementCategory
  electronConfig: string
  group: number | null
  period: number
}

export const categoryColors: Record<ElementCategory, string> = {
  'alkali-metal': 'bg-red-500/20 text-red-400',
  'alkaline-earth': 'bg-orange-500/20 text-orange-400',
  'transition-metal': 'bg-yellow-500/20 text-yellow-400',
  'post-transition-metal': 'bg-green-500/20 text-green-400',
  'metalloid': 'bg-teal-500/20 text-teal-400',
  'nonmetal': 'bg-sky-500/20 text-sky-400',
  'halogen': 'bg-cyan-500/20 text-cyan-400',
  'noble-gas': 'bg-purple-500/20 text-purple-400',
  'lanthanide': 'bg-pink-500/20 text-pink-400',
  'actinide': 'bg-rose-500/20 text-rose-400',
  'unknown': 'bg-surface-500/20 text-surface-400',
}

export const categoryLabels: Record<ElementCategory, string> = {
  'alkali-metal': 'Alkali Metal',
  'alkaline-earth': 'Alkaline Earth',
  'transition-metal': 'Transition Metal',
  'post-transition-metal': 'Post-Transition Metal',
  'metalloid': 'Metalloid',
  'nonmetal': 'Nonmetal',
  'halogen': 'Halogen',
  'noble-gas': 'Noble Gas',
  'lanthanide': 'Lanthanide',
  'actinide': 'Actinide',
  'unknown': 'Unknown',
}

export const elements: Element[] = [
  // Period 1
  { atomicNumber: 1, symbol: 'H', name: 'Hydrogen', atomicMass: '1.008', category: 'nonmetal', electronConfig: '1s1', group: 1, period: 1 },
  { atomicNumber: 2, symbol: 'He', name: 'Helium', atomicMass: '4.003', category: 'noble-gas', electronConfig: '1s2', group: 18, period: 1 },

  // Period 2
  { atomicNumber: 3, symbol: 'Li', name: 'Lithium', atomicMass: '6.941', category: 'alkali-metal', electronConfig: '[He] 2s1', group: 1, period: 2 },
  { atomicNumber: 4, symbol: 'Be', name: 'Beryllium', atomicMass: '9.012', category: 'alkaline-earth', electronConfig: '[He] 2s2', group: 2, period: 2 },
  { atomicNumber: 5, symbol: 'B', name: 'Boron', atomicMass: '10.81', category: 'metalloid', electronConfig: '[He] 2s2 2p1', group: 13, period: 2 },
  { atomicNumber: 6, symbol: 'C', name: 'Carbon', atomicMass: '12.01', category: 'nonmetal', electronConfig: '[He] 2s2 2p2', group: 14, period: 2 },
  { atomicNumber: 7, symbol: 'N', name: 'Nitrogen', atomicMass: '14.01', category: 'nonmetal', electronConfig: '[He] 2s2 2p3', group: 15, period: 2 },
  { atomicNumber: 8, symbol: 'O', name: 'Oxygen', atomicMass: '16.00', category: 'nonmetal', electronConfig: '[He] 2s2 2p4', group: 16, period: 2 },
  { atomicNumber: 9, symbol: 'F', name: 'Fluorine', atomicMass: '19.00', category: 'halogen', electronConfig: '[He] 2s2 2p5', group: 17, period: 2 },
  { atomicNumber: 10, symbol: 'Ne', name: 'Neon', atomicMass: '20.18', category: 'noble-gas', electronConfig: '[He] 2s2 2p6', group: 18, period: 2 },

  // Period 3
  { atomicNumber: 11, symbol: 'Na', name: 'Sodium', atomicMass: '22.99', category: 'alkali-metal', electronConfig: '[Ne] 3s1', group: 1, period: 3 },
  { atomicNumber: 12, symbol: 'Mg', name: 'Magnesium', atomicMass: '24.31', category: 'alkaline-earth', electronConfig: '[Ne] 3s2', group: 2, period: 3 },
  { atomicNumber: 13, symbol: 'Al', name: 'Aluminium', atomicMass: '26.98', category: 'post-transition-metal', electronConfig: '[Ne] 3s2 3p1', group: 13, period: 3 },
  { atomicNumber: 14, symbol: 'Si', name: 'Silicon', atomicMass: '28.09', category: 'metalloid', electronConfig: '[Ne] 3s2 3p2', group: 14, period: 3 },
  { atomicNumber: 15, symbol: 'P', name: 'Phosphorus', atomicMass: '30.97', category: 'nonmetal', electronConfig: '[Ne] 3s2 3p3', group: 15, period: 3 },
  { atomicNumber: 16, symbol: 'S', name: 'Sulfur', atomicMass: '32.07', category: 'nonmetal', electronConfig: '[Ne] 3s2 3p4', group: 16, period: 3 },
  { atomicNumber: 17, symbol: 'Cl', name: 'Chlorine', atomicMass: '35.45', category: 'halogen', electronConfig: '[Ne] 3s2 3p5', group: 17, period: 3 },
  { atomicNumber: 18, symbol: 'Ar', name: 'Argon', atomicMass: '39.95', category: 'noble-gas', electronConfig: '[Ne] 3s2 3p6', group: 18, period: 3 },

  // Period 4
  { atomicNumber: 19, symbol: 'K', name: 'Potassium', atomicMass: '39.10', category: 'alkali-metal', electronConfig: '[Ar] 4s1', group: 1, period: 4 },
  { atomicNumber: 20, symbol: 'Ca', name: 'Calcium', atomicMass: '40.08', category: 'alkaline-earth', electronConfig: '[Ar] 4s2', group: 2, period: 4 },
  { atomicNumber: 21, symbol: 'Sc', name: 'Scandium', atomicMass: '44.96', category: 'transition-metal', electronConfig: '[Ar] 3d1 4s2', group: 3, period: 4 },
  { atomicNumber: 22, symbol: 'Ti', name: 'Titanium', atomicMass: '47.87', category: 'transition-metal', electronConfig: '[Ar] 3d2 4s2', group: 4, period: 4 },
  { atomicNumber: 23, symbol: 'V', name: 'Vanadium', atomicMass: '50.94', category: 'transition-metal', electronConfig: '[Ar] 3d3 4s2', group: 5, period: 4 },
  { atomicNumber: 24, symbol: 'Cr', name: 'Chromium', atomicMass: '52.00', category: 'transition-metal', electronConfig: '[Ar] 3d5 4s1', group: 6, period: 4 },
  { atomicNumber: 25, symbol: 'Mn', name: 'Manganese', atomicMass: '54.94', category: 'transition-metal', electronConfig: '[Ar] 3d5 4s2', group: 7, period: 4 },
  { atomicNumber: 26, symbol: 'Fe', name: 'Iron', atomicMass: '55.85', category: 'transition-metal', electronConfig: '[Ar] 3d6 4s2', group: 8, period: 4 },
  { atomicNumber: 27, symbol: 'Co', name: 'Cobalt', atomicMass: '58.93', category: 'transition-metal', electronConfig: '[Ar] 3d7 4s2', group: 9, period: 4 },
  { atomicNumber: 28, symbol: 'Ni', name: 'Nickel', atomicMass: '58.69', category: 'transition-metal', electronConfig: '[Ar] 3d8 4s2', group: 10, period: 4 },
  { atomicNumber: 29, symbol: 'Cu', name: 'Copper', atomicMass: '63.55', category: 'transition-metal', electronConfig: '[Ar] 3d10 4s1', group: 11, period: 4 },
  { atomicNumber: 30, symbol: 'Zn', name: 'Zinc', atomicMass: '65.38', category: 'transition-metal', electronConfig: '[Ar] 3d10 4s2', group: 12, period: 4 },
  { atomicNumber: 31, symbol: 'Ga', name: 'Gallium', atomicMass: '69.72', category: 'post-transition-metal', electronConfig: '[Ar] 3d10 4s2 4p1', group: 13, period: 4 },
  { atomicNumber: 32, symbol: 'Ge', name: 'Germanium', atomicMass: '72.63', category: 'metalloid', electronConfig: '[Ar] 3d10 4s2 4p2', group: 14, period: 4 },
  { atomicNumber: 33, symbol: 'As', name: 'Arsenic', atomicMass: '74.92', category: 'metalloid', electronConfig: '[Ar] 3d10 4s2 4p3', group: 15, period: 4 },
  { atomicNumber: 34, symbol: 'Se', name: 'Selenium', atomicMass: '78.97', category: 'nonmetal', electronConfig: '[Ar] 3d10 4s2 4p4', group: 16, period: 4 },
  { atomicNumber: 35, symbol: 'Br', name: 'Bromine', atomicMass: '79.90', category: 'halogen', electronConfig: '[Ar] 3d10 4s2 4p5', group: 17, period: 4 },
  { atomicNumber: 36, symbol: 'Kr', name: 'Krypton', atomicMass: '83.80', category: 'noble-gas', electronConfig: '[Ar] 3d10 4s2 4p6', group: 18, period: 4 },

  // Period 5
  { atomicNumber: 37, symbol: 'Rb', name: 'Rubidium', atomicMass: '85.47', category: 'alkali-metal', electronConfig: '[Kr] 5s1', group: 1, period: 5 },
  { atomicNumber: 38, symbol: 'Sr', name: 'Strontium', atomicMass: '87.62', category: 'alkaline-earth', electronConfig: '[Kr] 5s2', group: 2, period: 5 },
  { atomicNumber: 39, symbol: 'Y', name: 'Yttrium', atomicMass: '88.91', category: 'transition-metal', electronConfig: '[Kr] 4d1 5s2', group: 3, period: 5 },
  { atomicNumber: 40, symbol: 'Zr', name: 'Zirconium', atomicMass: '91.22', category: 'transition-metal', electronConfig: '[Kr] 4d2 5s2', group: 4, period: 5 },
  { atomicNumber: 41, symbol: 'Nb', name: 'Niobium', atomicMass: '92.91', category: 'transition-metal', electronConfig: '[Kr] 4d4 5s1', group: 5, period: 5 },
  { atomicNumber: 42, symbol: 'Mo', name: 'Molybdenum', atomicMass: '95.95', category: 'transition-metal', electronConfig: '[Kr] 4d5 5s1', group: 6, period: 5 },
  { atomicNumber: 43, symbol: 'Tc', name: 'Technetium', atomicMass: '(98)', category: 'transition-metal', electronConfig: '[Kr] 4d5 5s2', group: 7, period: 5 },
  { atomicNumber: 44, symbol: 'Ru', name: 'Ruthenium', atomicMass: '101.1', category: 'transition-metal', electronConfig: '[Kr] 4d7 5s1', group: 8, period: 5 },
  { atomicNumber: 45, symbol: 'Rh', name: 'Rhodium', atomicMass: '102.9', category: 'transition-metal', electronConfig: '[Kr] 4d8 5s1', group: 9, period: 5 },
  { atomicNumber: 46, symbol: 'Pd', name: 'Palladium', atomicMass: '106.4', category: 'transition-metal', electronConfig: '[Kr] 4d10', group: 10, period: 5 },
  { atomicNumber: 47, symbol: 'Ag', name: 'Silver', atomicMass: '107.9', category: 'transition-metal', electronConfig: '[Kr] 4d10 5s1', group: 11, period: 5 },
  { atomicNumber: 48, symbol: 'Cd', name: 'Cadmium', atomicMass: '112.4', category: 'transition-metal', electronConfig: '[Kr] 4d10 5s2', group: 12, period: 5 },
  { atomicNumber: 49, symbol: 'In', name: 'Indium', atomicMass: '114.8', category: 'post-transition-metal', electronConfig: '[Kr] 4d10 5s2 5p1', group: 13, period: 5 },
  { atomicNumber: 50, symbol: 'Sn', name: 'Tin', atomicMass: '118.7', category: 'post-transition-metal', electronConfig: '[Kr] 4d10 5s2 5p2', group: 14, period: 5 },
  { atomicNumber: 51, symbol: 'Sb', name: 'Antimony', atomicMass: '121.8', category: 'metalloid', electronConfig: '[Kr] 4d10 5s2 5p3', group: 15, period: 5 },
  { atomicNumber: 52, symbol: 'Te', name: 'Tellurium', atomicMass: '127.6', category: 'metalloid', electronConfig: '[Kr] 4d10 5s2 5p4', group: 16, period: 5 },
  { atomicNumber: 53, symbol: 'I', name: 'Iodine', atomicMass: '126.9', category: 'halogen', electronConfig: '[Kr] 4d10 5s2 5p5', group: 17, period: 5 },
  { atomicNumber: 54, symbol: 'Xe', name: 'Xenon', atomicMass: '131.3', category: 'noble-gas', electronConfig: '[Kr] 4d10 5s2 5p6', group: 18, period: 5 },

  // Period 6
  { atomicNumber: 55, symbol: 'Cs', name: 'Caesium', atomicMass: '132.9', category: 'alkali-metal', electronConfig: '[Xe] 6s1', group: 1, period: 6 },
  { atomicNumber: 56, symbol: 'Ba', name: 'Barium', atomicMass: '137.3', category: 'alkaline-earth', electronConfig: '[Xe] 6s2', group: 2, period: 6 },

  // Lanthanides (57-71)
  { atomicNumber: 57, symbol: 'La', name: 'Lanthanum', atomicMass: '138.9', category: 'lanthanide', electronConfig: '[Xe] 5d1 6s2', group: null, period: 6 },
  { atomicNumber: 58, symbol: 'Ce', name: 'Cerium', atomicMass: '140.1', category: 'lanthanide', electronConfig: '[Xe] 4f1 5d1 6s2', group: null, period: 6 },
  { atomicNumber: 59, symbol: 'Pr', name: 'Praseodymium', atomicMass: '140.9', category: 'lanthanide', electronConfig: '[Xe] 4f3 6s2', group: null, period: 6 },
  { atomicNumber: 60, symbol: 'Nd', name: 'Neodymium', atomicMass: '144.2', category: 'lanthanide', electronConfig: '[Xe] 4f4 6s2', group: null, period: 6 },
  { atomicNumber: 61, symbol: 'Pm', name: 'Promethium', atomicMass: '(145)', category: 'lanthanide', electronConfig: '[Xe] 4f5 6s2', group: null, period: 6 },
  { atomicNumber: 62, symbol: 'Sm', name: 'Samarium', atomicMass: '150.4', category: 'lanthanide', electronConfig: '[Xe] 4f6 6s2', group: null, period: 6 },
  { atomicNumber: 63, symbol: 'Eu', name: 'Europium', atomicMass: '152.0', category: 'lanthanide', electronConfig: '[Xe] 4f7 6s2', group: null, period: 6 },
  { atomicNumber: 64, symbol: 'Gd', name: 'Gadolinium', atomicMass: '157.3', category: 'lanthanide', electronConfig: '[Xe] 4f7 5d1 6s2', group: null, period: 6 },
  { atomicNumber: 65, symbol: 'Tb', name: 'Terbium', atomicMass: '158.9', category: 'lanthanide', electronConfig: '[Xe] 4f9 6s2', group: null, period: 6 },
  { atomicNumber: 66, symbol: 'Dy', name: 'Dysprosium', atomicMass: '162.5', category: 'lanthanide', electronConfig: '[Xe] 4f10 6s2', group: null, period: 6 },
  { atomicNumber: 67, symbol: 'Ho', name: 'Holmium', atomicMass: '164.9', category: 'lanthanide', electronConfig: '[Xe] 4f11 6s2', group: null, period: 6 },
  { atomicNumber: 68, symbol: 'Er', name: 'Erbium', atomicMass: '167.3', category: 'lanthanide', electronConfig: '[Xe] 4f12 6s2', group: null, period: 6 },
  { atomicNumber: 69, symbol: 'Tm', name: 'Thulium', atomicMass: '168.9', category: 'lanthanide', electronConfig: '[Xe] 4f13 6s2', group: null, period: 6 },
  { atomicNumber: 70, symbol: 'Yb', name: 'Ytterbium', atomicMass: '173.0', category: 'lanthanide', electronConfig: '[Xe] 4f14 6s2', group: null, period: 6 },
  { atomicNumber: 71, symbol: 'Lu', name: 'Lutetium', atomicMass: '175.0', category: 'lanthanide', electronConfig: '[Xe] 4f14 5d1 6s2', group: null, period: 6 },

  // Period 6 continued
  { atomicNumber: 72, symbol: 'Hf', name: 'Hafnium', atomicMass: '178.5', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d2 6s2', group: 4, period: 6 },
  { atomicNumber: 73, symbol: 'Ta', name: 'Tantalum', atomicMass: '180.9', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d3 6s2', group: 5, period: 6 },
  { atomicNumber: 74, symbol: 'W', name: 'Tungsten', atomicMass: '183.8', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d4 6s2', group: 6, period: 6 },
  { atomicNumber: 75, symbol: 'Re', name: 'Rhenium', atomicMass: '186.2', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d5 6s2', group: 7, period: 6 },
  { atomicNumber: 76, symbol: 'Os', name: 'Osmium', atomicMass: '190.2', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d6 6s2', group: 8, period: 6 },
  { atomicNumber: 77, symbol: 'Ir', name: 'Iridium', atomicMass: '192.2', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d7 6s2', group: 9, period: 6 },
  { atomicNumber: 78, symbol: 'Pt', name: 'Platinum', atomicMass: '195.1', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d9 6s1', group: 10, period: 6 },
  { atomicNumber: 79, symbol: 'Au', name: 'Gold', atomicMass: '197.0', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d10 6s1', group: 11, period: 6 },
  { atomicNumber: 80, symbol: 'Hg', name: 'Mercury', atomicMass: '200.6', category: 'transition-metal', electronConfig: '[Xe] 4f14 5d10 6s2', group: 12, period: 6 },
  { atomicNumber: 81, symbol: 'Tl', name: 'Thallium', atomicMass: '204.4', category: 'post-transition-metal', electronConfig: '[Xe] 4f14 5d10 6s2 6p1', group: 13, period: 6 },
  { atomicNumber: 82, symbol: 'Pb', name: 'Lead', atomicMass: '207.2', category: 'post-transition-metal', electronConfig: '[Xe] 4f14 5d10 6s2 6p2', group: 14, period: 6 },
  { atomicNumber: 83, symbol: 'Bi', name: 'Bismuth', atomicMass: '209.0', category: 'post-transition-metal', electronConfig: '[Xe] 4f14 5d10 6s2 6p3', group: 15, period: 6 },
  { atomicNumber: 84, symbol: 'Po', name: 'Polonium', atomicMass: '(209)', category: 'post-transition-metal', electronConfig: '[Xe] 4f14 5d10 6s2 6p4', group: 16, period: 6 },
  { atomicNumber: 85, symbol: 'At', name: 'Astatine', atomicMass: '(210)', category: 'halogen', electronConfig: '[Xe] 4f14 5d10 6s2 6p5', group: 17, period: 6 },
  { atomicNumber: 86, symbol: 'Rn', name: 'Radon', atomicMass: '(222)', category: 'noble-gas', electronConfig: '[Xe] 4f14 5d10 6s2 6p6', group: 18, period: 6 },

  // Period 7
  { atomicNumber: 87, symbol: 'Fr', name: 'Francium', atomicMass: '(223)', category: 'alkali-metal', electronConfig: '[Rn] 7s1', group: 1, period: 7 },
  { atomicNumber: 88, symbol: 'Ra', name: 'Radium', atomicMass: '(226)', category: 'alkaline-earth', electronConfig: '[Rn] 7s2', group: 2, period: 7 },

  // Actinides (89-103)
  { atomicNumber: 89, symbol: 'Ac', name: 'Actinium', atomicMass: '(227)', category: 'actinide', electronConfig: '[Rn] 6d1 7s2', group: null, period: 7 },
  { atomicNumber: 90, symbol: 'Th', name: 'Thorium', atomicMass: '232.0', category: 'actinide', electronConfig: '[Rn] 6d2 7s2', group: null, period: 7 },
  { atomicNumber: 91, symbol: 'Pa', name: 'Protactinium', atomicMass: '231.0', category: 'actinide', electronConfig: '[Rn] 5f2 6d1 7s2', group: null, period: 7 },
  { atomicNumber: 92, symbol: 'U', name: 'Uranium', atomicMass: '238.0', category: 'actinide', electronConfig: '[Rn] 5f3 6d1 7s2', group: null, period: 7 },
  { atomicNumber: 93, symbol: 'Np', name: 'Neptunium', atomicMass: '(237)', category: 'actinide', electronConfig: '[Rn] 5f4 6d1 7s2', group: null, period: 7 },
  { atomicNumber: 94, symbol: 'Pu', name: 'Plutonium', atomicMass: '(244)', category: 'actinide', electronConfig: '[Rn] 5f6 7s2', group: null, period: 7 },
  { atomicNumber: 95, symbol: 'Am', name: 'Americium', atomicMass: '(243)', category: 'actinide', electronConfig: '[Rn] 5f7 7s2', group: null, period: 7 },
  { atomicNumber: 96, symbol: 'Cm', name: 'Curium', atomicMass: '(247)', category: 'actinide', electronConfig: '[Rn] 5f7 6d1 7s2', group: null, period: 7 },
  { atomicNumber: 97, symbol: 'Bk', name: 'Berkelium', atomicMass: '(247)', category: 'actinide', electronConfig: '[Rn] 5f9 7s2', group: null, period: 7 },
  { atomicNumber: 98, symbol: 'Cf', name: 'Californium', atomicMass: '(251)', category: 'actinide', electronConfig: '[Rn] 5f10 7s2', group: null, period: 7 },
  { atomicNumber: 99, symbol: 'Es', name: 'Einsteinium', atomicMass: '(252)', category: 'actinide', electronConfig: '[Rn] 5f11 7s2', group: null, period: 7 },
  { atomicNumber: 100, symbol: 'Fm', name: 'Fermium', atomicMass: '(257)', category: 'actinide', electronConfig: '[Rn] 5f12 7s2', group: null, period: 7 },
  { atomicNumber: 101, symbol: 'Md', name: 'Mendelevium', atomicMass: '(258)', category: 'actinide', electronConfig: '[Rn] 5f13 7s2', group: null, period: 7 },
  { atomicNumber: 102, symbol: 'No', name: 'Nobelium', atomicMass: '(259)', category: 'actinide', electronConfig: '[Rn] 5f14 7s2', group: null, period: 7 },
  { atomicNumber: 103, symbol: 'Lr', name: 'Lawrencium', atomicMass: '(266)', category: 'actinide', electronConfig: '[Rn] 5f14 7s2 7p1', group: null, period: 7 },

  // Period 7 continued
  { atomicNumber: 104, symbol: 'Rf', name: 'Rutherfordium', atomicMass: '(267)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d2 7s2', group: 4, period: 7 },
  { atomicNumber: 105, symbol: 'Db', name: 'Dubnium', atomicMass: '(268)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d3 7s2', group: 5, period: 7 },
  { atomicNumber: 106, symbol: 'Sg', name: 'Seaborgium', atomicMass: '(269)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d4 7s2', group: 6, period: 7 },
  { atomicNumber: 107, symbol: 'Bh', name: 'Bohrium', atomicMass: '(270)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d5 7s2', group: 7, period: 7 },
  { atomicNumber: 108, symbol: 'Hs', name: 'Hassium', atomicMass: '(277)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d6 7s2', group: 8, period: 7 },
  { atomicNumber: 109, symbol: 'Mt', name: 'Meitnerium', atomicMass: '(278)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d7 7s2', group: 9, period: 7 },
  { atomicNumber: 110, symbol: 'Ds', name: 'Darmstadtium', atomicMass: '(281)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d8 7s2', group: 10, period: 7 },
  { atomicNumber: 111, symbol: 'Rg', name: 'Roentgenium', atomicMass: '(282)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d9 7s2', group: 11, period: 7 },
  { atomicNumber: 112, symbol: 'Cn', name: 'Copernicium', atomicMass: '(285)', category: 'transition-metal', electronConfig: '[Rn] 5f14 6d10 7s2', group: 12, period: 7 },
  { atomicNumber: 113, symbol: 'Nh', name: 'Nihonium', atomicMass: '(286)', category: 'post-transition-metal', electronConfig: '[Rn] 5f14 6d10 7s2 7p1', group: 13, period: 7 },
  { atomicNumber: 114, symbol: 'Fl', name: 'Flerovium', atomicMass: '(289)', category: 'post-transition-metal', electronConfig: '[Rn] 5f14 6d10 7s2 7p2', group: 14, period: 7 },
  { atomicNumber: 115, symbol: 'Mc', name: 'Moscovium', atomicMass: '(290)', category: 'post-transition-metal', electronConfig: '[Rn] 5f14 6d10 7s2 7p3', group: 15, period: 7 },
  { atomicNumber: 116, symbol: 'Lv', name: 'Livermorium', atomicMass: '(293)', category: 'post-transition-metal', electronConfig: '[Rn] 5f14 6d10 7s2 7p4', group: 16, period: 7 },
  { atomicNumber: 117, symbol: 'Ts', name: 'Tennessine', atomicMass: '(294)', category: 'halogen', electronConfig: '[Rn] 5f14 6d10 7s2 7p5', group: 17, period: 7 },
  { atomicNumber: 118, symbol: 'Og', name: 'Oganesson', atomicMass: '(294)', category: 'noble-gas', electronConfig: '[Rn] 5f14 6d10 7s2 7p6', group: 18, period: 7 },
]
