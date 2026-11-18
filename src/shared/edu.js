// The lesson, written for high-school students: what each stop shows, a short note for every clickable part, and one
// check-for-understanding question per stop. Numbers match kin.js (a human hair is taken as about 80 um).

export const LESSON = [
  {
    title: 'A silicon wafer',
    text: 'A wafer is a thin, shiny disc cut from one giant crystal of pure silicon. Factories print hundreds of identical chips on it at the same time, like printing a sheet of stamps. Each small square is one chip.',
    parts: {
      'SILICON WAFER': 'Silicon comes from ordinary sand. It is melted, purified until it is 99.9999999% pure, and grown into one big crystal log called an ingot. The ingot is sliced into wafers thinner than a credit card.',
      'THE DIE WE OPEN': 'Each square is called a die. Every die gets the same circuit pattern, printed with light shining through a stencil. This printing process is called photolithography.',
      'SCRIBE LANE': 'The thin gaps between the dies are scribe lanes. A diamond saw or a laser cuts along them to separate the chips, like tearing stamps along their perforations.',
      'EDGE EXCLUSION': 'The outer rim of the wafer is left blank. Patterns are hard to print sharply right at the edge, and the machines that carry the wafer grip it there.',
      'PARTIAL DIE': 'Squares that run off the round edge are incomplete, so they can never work and are thrown away. This is one reason factories moved to bigger wafers: less of the wafer is wasted at the edge.',
    },
    q: {
      ask: 'Why are the squares at the very edge of the wafer thrown away?',
      options: ['The round edge cuts them off, so their circuits are incomplete', 'They are only used for decoration', 'They are made of a different material', 'They are too hot to touch'],
      correct: 0,
      why: 'A square grid cannot fit perfectly inside a circle. Dies that cross the edge are missing part of their circuit, so they can never work.',
    },
  },
  {
    title: 'One die, one chip',
    text: 'One die is one computer chip. This one is about 18 mm on each side, smaller than a postage stamp, yet it holds billions of tiny switches. Chips are cut apart only after every chip on the wafer has been tested.',
    parts: {
      DIE: 'A die like this one can be a processor, the "brain" of a computer, phone or game console. The photo on its surface is a real processor die.',
      'SILICON BODY': 'Most of the die\'s thickness is plain silicon. It is there mainly to hold everything up, like the foundation under a building.',
      'WHERE IT WAS PRINTED': 'The dark square shows where the die sat on the wafer. In a real factory the wafer stays in one piece until testing is finished; here we lift the die out so you can see it.',
    },
    q: {
      ask: 'What is a single die?',
      options: ['One complete chip', 'A whole wafer', 'One single transistor', 'The saw that cuts the wafer'],
      correct: 0,
      why: 'Each die is one whole chip. Hundreds of identical dies are printed on one wafer and then cut apart.',
    },
  },
  {
    title: 'A chip is built in layers',
    text: 'A chip is built from the bottom up, like a tall building. The transistors, the switches, sit at the bottom, built right into the silicon. Above them are layers of copper wire that connect the switches, and a glass coating on top protects everything.',
    parts: {
      PASSIVATION: 'A tough, glass-like top layer. It seals the chip so moisture and scratches cannot damage the circuits underneath.',
      'UPPER METAL': 'Thick copper wires that carry power and timing signals across the whole chip, like highways. The picture on this layer is a real microscope photo of a chip\'s top metal.',
      'LOWER METAL': 'Thin copper wires that connect switches that are close together, like the streets of a neighbourhood.',
      CONTACTS: 'Tiny metal plugs, usually made of tungsten, that connect the copper wiring down to each transistor.',
      TRANSISTORS: 'The layer where billions of switches are built into the surface of the silicon. Every calculation the chip makes happens here. The picture is a real photo of a die with its metal layers removed.',
      'SILICON SUBSTRATE': 'The base of pure silicon that everything is built on. In this view each layer is stretched hundreds of times thicker so you can see it.',
    },
    q: {
      ask: 'In the stack of layers, where are the transistors?',
      options: ['At the bottom, built into the silicon', 'In the glass coating on top', 'Inside the thick copper wires', 'Outside the chip'],
      correct: 0,
      why: 'Transistors are made first, in the surface of the silicon. All the wiring layers are built on top of them afterwards.',
    },
  },
  {
    title: 'Copper wiring',
    text: 'Zoomed in this far, you can see the copper wires. They are stacked in levels that cross at right angles, like roads and overpasses. Vertical links called vias join one level to the next. The finest wires here are about 800 times thinner than a human hair.',
    parts: {
      'METAL 4': 'The thinnest wiring level shown here: 0.1 micrometres wide. Lower levels are finer because they connect switches that sit right next to each other.',
      'METAL 5': 'This level runs at right angles to the one below it. Alternating directions lets wires cross without touching.',
      'METAL 6': 'Wider wires carry signals farther across the chip. Wider wires have less electrical resistance, so signals lose less energy.',
      'METAL 7': 'The widest level shown, 0.8 micrometres wide. Upper levels carry power to large parts of the chip.',
      VIA: 'A via is a short vertical wire that connects one level to the next, like an elevator shaft connecting the floors of a building.',
      CONTACT: 'This contact leads down to a transistor. That is where we zoom next.',
    },
    q: {
      ask: 'What does a via do?',
      options: ['It connects one wiring level to the next', 'It stores electricity like a battery', 'It cools the chip down', 'It cuts the wafer into chips'],
      correct: 0,
      why: 'Vias are the vertical connections between wiring levels, like elevators between the floors of a building.',
    },
  },
  {
    title: 'A transistor is a switch',
    text: 'A transistor is an electric switch with no moving parts. When a voltage is put on the gate, electrons flow from the source to the drain: the switch is ON, a 1. Take the voltage away and the flow stops: OFF, a 0. Every app and game runs on billions of these 1s and 0s.',
    parts: {
      GATE: 'The gate controls the switch. A voltage on the gate opens a path for electrons. This gate is about 20 nanometres long, about 4,000 times thinner than a human hair.',
      FIN: 'A thin wall of silicon that electrons travel through. The gate wraps over it on three sides, which gives better control of the current. This design is called a FinFET.',
      SOURCE: 'The source is where electrons enter the transistor.',
      DRAIN: 'The drain is where electrons leave the transistor once the gate has switched it on.',
      CONTACT: 'Contacts connect the transistor up to the copper wiring above it.',
      'ISOLATION OXIDE': 'A layer of glass (silicon dioxide) between the fins. It keeps neighbouring transistors from leaking current into each other.',
    },
    q: {
      ask: 'What happens when a voltage is put on the gate?',
      options: ['Electrons flow from the source to the drain, so the switch turns ON', 'The transistor melts', 'All the electrons leave the chip', 'The silicon turns into glass'],
      correct: 0,
      why: 'The gate voltage opens a path in the channel, so electrons can flow from source to drain. That is the ON state, a 1.',
    },
  },
  {
    title: 'The silicon crystal',
    text: 'Silicon atoms line up in a perfect repeating pattern called a crystal lattice, the same pattern as a diamond. Each atom shares electrons with exactly four neighbours. These shared electrons are the bonds that hold the crystal together.',
    parts: {
      'ONE SILICON ATOM': 'Atoms are drawn here as soft clouds, because electrons are not tiny balls on tracks: they are spread out around the atom like a fog.',
      'COVALENT BOND': 'Where two atoms\' clouds meet, they share a pair of electrons. Sharing electrons like this is called a covalent bond.',
      'UNIT CELL': 'The orange cube is a unit cell, the smallest box of atoms that repeats to build the whole crystal. It is 0.543 nanometres wide.',
    },
    q: {
      ask: 'How many neighbours does each silicon atom bond to?',
      options: ['2', '4', '6', '8'],
      correct: 1,
      why: 'Silicon has four outer electrons, so each atom forms four bonds, one with each of four neighbours.',
    },
  },
  {
    title: 'One silicon atom',
    text: 'A silicon atom has 14 protons and 14 neutrons in its tiny nucleus, and 14 electrons around it. Ten electrons stay close to the nucleus. The outer four reach out to bond with neighbouring atoms. Those four bonds are why silicon forms such a strong, orderly crystal.',
    parts: {
      NUCLEUS: 'The nucleus holds the protons and neutrons. If the atom were the size of a football stadium, the nucleus would be about the size of a pea in the middle. Here it is drawn much bigger so you can see it.',
      'INNER ELECTRONS': 'Ten electrons are held tightly close to the nucleus. They do not take part in bonding.',
      'OUTER ELECTRONS': 'The four outer electrons are called valence electrons, and they form the bonds. Silicon is in group 14 of the periodic table, the same group as carbon, which also forms four bonds.',
      'BOND TO A NEIGHBOUR': 'Each orange lobe points toward a neighbouring atom 0.235 nanometres away. The four lobes point to the corners of a pyramid-like shape called a tetrahedron.',
    },
    q: {
      ask: 'How many outer (valence) electrons does a silicon atom use for bonding?',
      options: ['2', '4', '8', '14'],
      correct: 1,
      why: 'Silicon has 4 valence electrons in its outer shell. Each one pairs up with an electron from a neighbour to make a bond.',
    },
  },
];
