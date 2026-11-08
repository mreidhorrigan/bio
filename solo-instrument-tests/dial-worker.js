// native/openwind/rows.mjs
var WINDS_RATE = 48e3;
function lipsRow(rules, lip, pressure, valves = null) {
  const { lips, rows, cents } = rules.grid, at2 = Math.min(Math.max(1200 * Math.log2(lip / lips[0]) / cents, 0), lips.length - 1), k = Math.min(Math.floor(at2), lips.length - 2), share = at2 - k;
  const own2 = rows[k].map((v, c) => v + (rows[k + 1][c] - v) * share);
  own2[rules.columns.indexOf(rules.breath)] = pressure / own2[rules.columns.indexOf(rules.closing)];
  const laid = rowLayout(rules);
  if (!laid) return own2;
  const row = new Array(laid.width).fill(1);
  laid.lips.forEach((at3, c) => row[at3] = own2[c]);
  (rules.valves?.columns ?? []).forEach((columns, v) => columns.forEach((at3) => row[at3] = valves?.[v] ?? 1));
  (laid.closed ?? []).forEach((at3) => row[at3] = 0);
  return row;
}
var rowLayout = (rules) => rules.valves ?? rules.row ?? null;
var lipsColumn = (rules, name) => {
  const c = rules.columns.indexOf(name), laid = rowLayout(rules);
  return laid ? laid.lips[c] : c;
};
function lipsDirection(rules, lip, pressure, valves = null) {
  const h = rules.grid.cents, [down, up] = [-h, h].map((c) => lipsRow(rules, lip * 2 ** (c / 1200), pressure, valves)), columns = [], slopes = [];
  down.forEach((v, c) => {
    const w = up[c];
    if (v > 0 && w > 0 && w !== v) {
      columns.push(c);
      slopes.push(600 * Math.log2(w / v) / h);
    }
  });
  return { columns, slopes };
}
var noteKey = (n) => n.fingering ? `${n.fingering} ${n.partial}` : n.position != null ? `${n.position} ${n.partial}` : String(n.partial);

// render/synthesis/brass-lips-targets.json
var brass_lips_targets_default = {
  schema: "musebots.brass-lips-targets/1",
  about: `What was measured of brass players, in their mouths and mouthpieces -- physical measurements, never a recording's level or brightness (the owner, 24 October 2026: "be careful about using recordings as targets because of the many possible audio confounds") -- the targets and anchors of their lips' fit (tools/fit_lips.py; research/BRASS_LIPS_FIT_PLAN.md). SI units: Pa, m, m3, m3/s, Hz; shares as fractions. Each figure as its source states it, its words quoted where they decide what it means.`,
  sources: {
    boutin2015: { authors: "H. Boutin, N. Fletcher, J. Smith & J. Wolfe", year: 2015, title: "Relationships between pressure, flow, lip motion, and upstream and downstream impedances for the trombone", journal: "J. Acoust. Soc. Am. 137(3), 1195-1209", doi: "10.1121/1.4908236", held: "research-downloads/brass/lips/boutin-2015/" },
    campbell2021: { authors: "D. M. Campbell, J. Gilbert & A. Myers", year: 2021, title: "The Science of Brass Instruments", publisher: "Springer (Modern Acoustics and Signal Processing)", doi: "10.1007/978-3-030-55686-0", held: "research-downloads/brass/from-owner-2026-10-23/" },
    bouhuys1965: { authors: "A. Bouhuys", year: 1965, title: "Sound-power production in wind instruments", journal: "J. Acoust. Soc. Am. 37, 453-456", doi: "10.1121/1.1909350", held: "research-downloads/brass/from-owner-2026-10-25/453_1_online.pdf" },
    fletcherTarnopolsky1999: { authors: "N. H. Fletcher & A. Tarnopolsky", year: 1999, title: "Blowing pressure, power, and spectrum in trumpet playing", journal: "J. Acoust. Soc. Am. 105(2), 874-881", doi: "10.1121/1.426276", held: "research-downloads/brass/from-owner-2026-10-25/874_1_online.pdf" },
    boutin2020: { authors: "H. Boutin, J. Smith & J. Wolfe", year: 2020, title: 'Trombone lip mechanics with inertive and compliant loads ("lipping up and down")', journal: "J. Acoust. Soc. Am. 147(6), 4133-4144", doi: "10.1121/10.0001466", held: "research-downloads/brass/lips/boutin-2020-lipping/" },
    schwab2004: { authors: "B. Schwab & A. Schultze-Florey", year: 2004, title: "Velopharyngeal insufficiency in woodwind and brass players", journal: "Medical Problems of Performing Artists 19, 21-25", doi: "10.21091/mppa.2004.1004", held: "no: as campbell2021 (Sect. 2.1.3) reports it" },
    newton2008: { authors: "M. J. Newton, M. Campbell & J. Gilbert", year: 2008, title: "Mechanical response measurements of real and artificial brass players lips", journal: "J. Acoust. Soc. Am. 123(1), EL14-EL20", doi: "10.1121/1.2805042", held: "research-downloads/brass/from-owner-2026-10-24/el14_1_1.2805042.pdf" },
    newton2009: { authors: "M. J. Newton", year: 2009, title: "Experimental mechanical and fluid mechanical investigations of the brass instrument lip-reed and the human vocal folds", journal: "PhD thesis, University of Edinburgh (M. Campbell supervising)", handle: "http://hdl.handle.net/1842/3140", held: "research-downloads/brass/lips/newton-2009-thesis/MichaelNewton_PhDThesis_May2009.pdf" },
    cullen2000: { authors: "J. S. Cullen, J. Gilbert & D. M. Campbell", year: 2e3, title: "Brass instruments: linear stability analysis and experiments with an artificial mouth", journal: "Acta Acustica united with Acustica 86(4), 704-724", doi: null, hal: "hal-00474993", held: "research-downloads/brass/lips/cullen-2000/ (its text layer unreadable: read from its pages; Crossref holds no DOI for it)" },
    velut2017: { authors: "L. Velut, C. Vergez, J. Gilbert & M. Djahanbani", year: 2017, title: "How well can linear stability analysis predict the behaviour of an outward-striking valve brass instrument model?", journal: "Acta Acustica united with Acustica 103(1), 132-148", doi: "10.3813/AAA.919039", held: "research-downloads/brass/from-owner-2026-10-25/VelutEtColl_LSABrassInstrumentPedalNote_AAA2017.pdf" },
    stevenson2009: { authors: "S. D. F. Stevenson", year: 2009, title: "Experimental investigations of lip motion in brass instrument playing", type: "PhD thesis, University of Edinburgh (supervised by D. M. Campbell)", doi: null, handle: "http://hdl.handle.net/1842/4349", held: "research-downloads/brass/lips/stevenson-2009/Stevenson2009.pdf (the Edinburgh Research Archive's, fetched 31 October 2026)" },
    bouhuys1964: { authors: "A. Bouhuys", year: 1964, title: "Lung volumes and breathing patterns in wind-instrument players", journal: "J. Appl. Physiol. 19(5), 967-975", doi: "10.1152/jappl.1964.19.5.967", held: "no: as bouhuys1965 (its introduction) reports it" },
    freour2013: { authors: "V. Freour & G. P. Scavone", year: 2013, title: "Acoustical interaction between vibrating lips, downstream air column, and upstream airways in trombone performance", journal: "J. Acoust. Soc. Am. 134(5), 3887-3898", doi: "10.1121/1.4823847", held: "research-downloads/brass/from-owner-2026-10-25/freour_trombonevocal_jasa_2013.pdf" }
  },
  horn: {
    player: "horn players measured apart: JC (Stevenson 2009) and Bouhuys's (1964)",
    source: "stevenson2009",
    notes: [
      {
        note: "F3",
        hz: 174.61,
        threshold: 2e3,
        source: "stevenson2009",
        player: "JC, on a horn in F, open, and again with its valves 2 and 3 (Figs. 6.7, 6.8)",
        thresholdSays: "the mouthpiece pressure increases steadily until approximately 2kPa when the acoustic oscillation begins. In both measurements on the horn the pressure rise is approximately the same",
        read: `its text's "approximately 2kPa", the pressure its sensor in the player's mouth read where the note's oscillation began (Sect. 6.2, "Starting transients: pressure in the mouth of human players"; the note begun without the tongue, as asked, its pressure rising slowly): a threshold, to about the factor its residual allows. Its F3 sounding, "the target pitch of 174Hz (A = 440Hz)", the horn in F's fourth mode`
      },
      {
        note: "A4",
        hz: 440,
        dynamic: "pp",
        mouthPressure: 2666,
        source: "bouhuys1965",
        measuredIn: "bouhuys1964",
        says: "average mouth pressure for A4 (440 cps) on the French horn was about the same for the same note played on the oboe, i.e., about 20 mm Hg. Both notes were played pp",
        read: "about 20 mm Hg, 1 mm Hg 133.32 Pa: Bouhuys 1965's introduction, from Bouhuys 1964's measurements; no threshold or flow given"
      }
    ],
    notesFrom: "The horn's players' notes from two sources (31 October 2026): Stevenson's player JC's F3 begun without the tongue, its threshold; Bouhuys's A4 blown pp, its mouth pressure. Nothing else of horn players' mouths found: Bouhuys 1965's Fig. 1 has no horn; Stevenson's other horn measurements are of the lips' opening and the mouthpiece."
  },
  trombone: {
    notes: [
      {
        note: "B-flat 2",
        hz: 116.54,
        position: 1,
        player: "one advanced player, the waveforms averaged over 21 groups of two cycles (Figs. 6 and 7)",
        source: "boutin2015",
        mouthPressure: 1400,
        mouthPressureError: 0.1,
        mouthPressureSays: "The dc pressure, equal to 1.4 kPa in the mouth with an error less than 10%",
        secondHarmonicDb: -5,
        secondHarmonicSays: "the second harmonics of Pmouth and Pbore ... going from 3.3 dB above and 5.0 dB below the fundamental [B-flat 2] to 3.0 and 14.0 dB below the fundamental [F4]",
        sweptFlowPeakToPeak: 18e-5,
        flowPeakToPeak: 4e-4,
        flowSays: "for this low note, the peak to peak amplitude of the sweeping flow is 180 cm3 s-1, which is a considerable fraction of the total flow, whose peak to peak amplitude is about 400 cm3 s-1",
        sweptVolume: 21e-8,
        sweptVolumeSays: "the amplitude of the volume of tissue in the mouthpiece, 40 mm3 [F4], is reduced by a factor of 5.3 compared to B-flat 2, 210 mm3",
        width: [0.011, 0.015],
        widthSays: "The lip aperture and the vertical separation between the lips are almost exactly in phase. Further, their ratio varies very little over the cycle, between 1.1 and 1.5 cm, which is approximately the width of the aperture"
      },
      {
        note: "F4",
        hz: 349.23,
        position: 1,
        player: "the same advanced player (Figs. 8 and 9)",
        source: "boutin2015",
        secondHarmonicDb: -14,
        sweptVolume: 4e-8,
        width: [0.011, 0.013],
        widthSays: "their ratio has small variation over the cycle, between 1.1 and 1.3 cm"
      },
      {
        note: "F4",
        hz: 350,
        position: 1,
        player: "a trombonist in a crescendo (Figs. 2.2-2.5)",
        source: "campbell2021",
        threshold: 1700,
        thresholdSays: "to make the note sound, the trombone player had to raise pmouth above a threshold value of 1.7 kPa",
        forte: { mouthPressure: 3700, mouthpiecePeakToPeak: 10600 },
        forteSays: "the mean value of pmouth was increased, reaching 3.7 kPa at the forte level ... at t = 4.3 s the mouthpiece peak-to-peak pressure amplitude is 10.6 kPa",
        early: { mouthpiecePeakToPeak: 2800 },
        earlySays: "The peak-to-peak pressure amplitude at t = 1.1 s inside the mouthpiece is 2.8 kPa"
      }
    ],
    aboveResonance: {
      mean: 0.011,
      notes: "B-flat 2 to F4, the slide in first and fourth positions, ten players",
      source: "boutin2015",
      says: "For 85% of the samples played by all players and 88% of the samples played by professionals, the fundamental playing frequency was above the closest peak of Zbore (by 1.1% on average)",
      perNote: "their Fig. 4 (not yet traced)"
    },
    bending: {
      source: "boutin2015",
      says: "they could play over a range between 12.1% below and 8.1% above the normal playing frequency of F3, and between 10.0% below and 8.9% above that of B-flat 3",
      notes: [
        { note: "F3", hz: 174.61, below: 0.121, above: 0.081, players: "four amateur and professional players" },
        { note: "B-flat 3", hz: 233.08, below: 0.1, above: 0.089, players: "the same four" },
        {
          note: "B-flat 2",
          hz: 116.54,
          source: "boutin2020",
          players: "seven players, four advanced, 40 measurements; the same trombone, first position, its tuning slide 18 mm out",
          lowest: 100,
          highest: 126,
          normal: [112, 118],
          says: 'B-flat 2, nominally 116.5 Hz but which was "lipped" to frequencies in the range 100-125 Hz ... the averaged measurements for playing frequencies between 100 and 112 Hz [lipping down], between 112 and 118.0 Hz [normal pitch], and between 116 and 126 Hz [lipping up] ... frequency ranging from 100 to 126 Hz; they are capable of "lipping up" roughly half a semitone and "lipping down" roughly a tone'
        }
      ]
    },
    steadyFlow: { range: [14e-5, 25e-5], source: "boutin2015", says: "The measured average flow in our experiments was 140-250 mL s-1, which falls in the range measured for relatively quiet playing" },
    instrument: { source: "boutin2015", says: 'The trombone is a Yamaha model YBL 321 with a B-flat-F "trigger." The trigger valve that adds extra tubing was left in the shorter (B-flat) position throughout the study' },
    tuningSlide: { drawn: 0.018, source: "boutin2015", says: "The tuning slide position was constant at 18 mm from the shortest, i.e., fully closed position" },
    positions: { source: "boutin2015", fourth: 0.227, says: "the subjects played while the main slide was first all the way in, and then extended by 22.7 cm. These positions, used to play the harmonic series starting on B-flat 2 (nominally 117 Hz), and three semi-tones lower on G2 (nominally 98 Hz), are, respectively, referred to as first and fourth positions" },
    lips: {
      source: "newton2008",
      players: "four semiprofessional trombonists, each embouchure formed to play its note, then driven by a calibrated sine sweep and filmed (2 kHz)",
      q: { range: [1.2, 1.8], says: "In this study the lower outward striking resonances displayed Q values from 1.2 to 1.8", artificial: [8, 10] },
      outward: [
        { note: "B-flat 1", hz: 58, resonance: 32, inward: 74, from: "the text", says: "In the case of the B1 pedal note shown in the figure this resonance was at 32 Hz, identified from the -90 degree phase crossing. The played frequency was 58 Hz ... For the B1 pedal note this resonance was at 74 Hz" },
        { note: "F2", hz: 87, resonance: [49, 60], from: "Fig. 4, its phase read by tools/figure_crossings.py: near -90 degrees from 49 to 60 Hz" },
        { note: "B-flat 2", hz: 116, resonance: 76.5, from: "Fig. 4, its phase read by tools/figure_crossings.py (its B-flat 1 read 33.7 Hz against the text's 32)" },
        { note: "B-flat 2", hz: 116, resonance: [55, 58], inward: [165, 173], player: "TJ", source: "newton2009", from: "section 4.4.2, Fig. 4.12, the text", says: "For this embouchure the dominant resonance occurred between 55Hz and 58Hz in the magnitude curves ... Both curves in figure 4.12 show a clear second resonance, which occurs between 165Hz and 173Hz" },
        { note: "F3", hz: 170, resonance: 100, inward: 200, player: "TJ", source: "newton2009", from: "section 4.4.2, Fig. 4.13, the text: F3 played at 170 Hz on the double-shanked mouthpiece", says: "Once again a clear outward striking resonance can be seen at approximately 100Hz, with a Q factor of about 1.7 ... A further resonance is also seen around 200Hz, which shows inward striking character" }
      ],
      tolerance: { value: 0.05, says: "the resonance frequencies and the phase angles at these frequencies match to within 5% (the video method against the transmission method, on artificial lips)" },
      says: "All curves reveal one dominant resonance. This resonance consistently lies below the frequency of the played note ... the playing frequencies of all the notes fell between the two resonances"
    },
    artificialLips: {
      source: "cullen2000",
      lips: "an artificial mouth's latex lips on a trombone mouthpiece's rim, its embouchure set by a screw over twenty positions, slackest first (their Table B); each mode's resonance, Q and 1/mu, the lips' effective area over their effective mass (m2/kg), negative where it strikes inward",
      columns: ["embouchure", "outwardHz", "outwardQ", "outwardOneOverMu", "inwardHz", "inwardQ", "inwardOneOverMu"],
      measured: [
        [1, 182, 10, 0.041, 225.5, 10.5, -0.059],
        [3, 189.5, 10.5, 0.042, 230.5, 8, -0.084],
        [5, 196.5, 10, 0.044, 238, 12.5, -0.058],
        [7, 204.5, 7, 0.063, 244.5, 11, -0.073],
        [9, 213, 8.5, 0.059, 249.5, 10.5, -0.074],
        [11, 219, 9.5, 0.059, 256, 16, -0.048],
        [13, 222, 11, 0.057, 262, 15.5, -0.05],
        [15, 227.5, 12, 0.059, 267.5, 14, -0.053],
        [17, 232, 11.5, 0.067, 273.5, 12, -0.067],
        [19, 237, 12, 0.072, 278, 12.5, -0.069]
      ],
      kept: { which: "the odd embouchures: the even ones' inward modes, bold, left out", says: "Numbers in bold font indicate parameters which were estimated from extrapolating or interpolating neighbouring measured parameter values (standard font)" },
      third: { hz: [338.5, 362, 394], q: [8, 4, 13], oneOverMu: [-0.3, -0.26, -0.14], embouchures: ["slack", "medium", "tight"], from: "their Table 1", says: "mode fL3 could only be destabilized with unrealistically high values of Pm" },
      says: "A two mass model coupling the mode with outward striking characteristics, fL1, to the mode with inward striking characteristics, fL2, would allow the threshold frequency to lie above or below the acoustical resonance frequency, depending on the acoustic resonator conditions"
    },
    lipsReviewed: {
      source: "velut2017",
      from: "their Table 1, the measured lips (those fitted or adjusted for simulation left out), the outward mode's",
      columns: ["of", "lips", "h0", "W", "fl", "oneOverMu", "Q"],
      rows: [
        ["Lopez et al. 2006", "artificial", 2e-4, 0.03, 162, 0.03, 5],
        ["Gazengel et al. 2007, soft", "human, a saxophone-like position", null, null, 115.7, null, 0.79],
        ["Gazengel et al. 2007, medium", "human", null, null, 479.9, null, 0.46],
        ["Gazengel et al. 2007, tight", "human", null, null, 1073, null, 0.46],
        ["Richards 2003", "artificial (fit for good results)", 5e-4, 7e-3, 162, 0.19, 3.7]
      ],
      says: "Measurements from [Gazengel et al., 2007, Newton et al., 2008] tend to give low quality-factor values between 0.5 and 2 for human lips. However, preliminary analysis carried out with Ql ~ 1 showed very unrealistic pressure thresholds (order of magnitude : 10^4 to 10^5 Pa). Thus, a value for Ql = 7 was chosen, closer to the values measured on artificial lips (Ql in [3.7, 10.5])",
      geometry: "Geometric parameters (lip channel width, and lip channel height when the player is not blowing) given in all studies are consistent, around W = 12.10-3 m and h0 = 5.10-4 m"
    },
    upstream: {
      source: "freour2013",
      players: "nine trombonists, two professional, slurring the arpeggio F3-B-flat 3-D4-F4-B-flat 4-D5-F5 at a comfortable dynamic, the mouth's pressure and the mouthpiece's measured together",
      ratio: { from: "their Fig. 5, the upstream pressure's level at the fundamental against the mouthpiece's, dB, the least and most of the players who played each, read at 400 dpi (about 0.2 dB)", F3toF4: [-24, -9], "B-flat 4": [-21, -3], D5: [-10, 6.5], F5: [-1, 10.6] },
      transitions: "the duration of these |Pu/Pd| peaks (above 100 ms) suggest that an increase in |Pu/Pd| occurs before and after the transition",
      says: "Subjects able to play over the full range demonstrated significant upstream influence in the higher register of the instrument"
    }
  },
  tuba: {
    player: "a bass tuba player",
    source: "bouhuys1965",
    thresholds: [{ note: "A1", hz: 55, threshold: 330 }, { note: "A3", hz: 220, threshold: 1730 }],
    says: "Bouhuys measured threshold pressures in a bass tuba player's mouth of 330 Pa when playing the note A1 (55 Hz), rising to 1.73 kPa when playing the note A3 (220 Hz)",
    measured: {
      from: "bouhuys1965's Fig. 1 (mouth pressure, mm Hg, against air flow, L/s, both logarithmic; read at 400 dpi, about 1% each), each note blown pp and ff by a professional player; 1 mm Hg 133.32 Pa",
      notes: [
        { note: "A1", hz: 55, pp: { mouthPressure: 325, flow: 225e-6 }, ff: { mouthPressure: 1545, flow: 152e-5 } },
        { note: "A3", hz: 220, pp: { mouthPressure: 1664, flow: 142e-6 }, ff: { mouthPressure: 9810, flow: 165e-5 } }
      ],
      method: "All experiments were performed by professional players with 4-58 years' experience ... Each note was blown, both pp and ff, sufficiently long to obtain stable pressure and sound-pressure level readings",
      secondary: "Campbell, Gilbert & Myers 2021's thresholds (330 Pa, 1.73 kPa) are these notes blown pp: Bouhuys measured no threshold"
    }
  },
  trumpet: {
    player: "GC, a professional orchestral trumpeter",
    source: "fletcherTarnopolsky1999",
    instrument: { says: "a standard B-flat trumpet", measured: "Measurements were made on three players: a professional orchestral trumpeter (GC) and two experienced amateurs (NH and KB) ... In the case of player GC, the measurements were made in an anechoic chamber", playing: "a series of steady notes of given pitch played with increasing loudness from pianissimo up to the fortissimo limit for the particular player" },
    notes: [
      { note: "F3", hz: 174.61, threshold: 1600, forte: { mouthPressure: 4390, dBA: 92.2 }, least: { mouthPressure: 1610, dBA: 63.1 } },
      { note: "C4", hz: 261.63, threshold: 2e3, forte: { mouthPressure: 6580, dBA: 101.3 }, least: { mouthPressure: 2010, dBA: 74.2 } },
      { note: "F4", hz: 349.23, threshold: 2800, forte: { mouthPressure: 6700, dBA: 103.4 }, least: { mouthPressure: 2790, dBA: 82.1 } },
      { note: "C5", hz: 523.25, threshold: 4e3, forte: { mouthPressure: 12500, dBA: 108.4 }, least: { mouthPressure: 3300, dBA: 81.2 }, conflict: "its threshold 4.0 kPa in Fig. 4, its least pressure 3.3 kPa in Fig. 1 and in Fig. 6 (its spectrum at 3.3, 6.3 and 13.0 kPa)" },
      { note: "F5", hz: 698.46, threshold: 4800, forte: { mouthPressure: 19200, dBA: 111.9 }, least: { mouthPressure: 4680, dBA: 88.4 } },
      { note: "C6", hz: 1046.5, threshold: 7e3, forte: { mouthPressure: 23300, dBA: 112.5 }, least: { mouthPressure: 6670, dBA: 93.3 } }
    ],
    notesFrom: "GC's: `threshold` read from Fig. 4 (linear axes, at 400 dpi: each on a round tenth of a kPa); `least` and `forte` the first and last points of its curve in Fig. 1 (equivalent SPL at 1 m, dB(A), against blowing pressure on a logarithmic axis, read at 400 dpi: about 1% in pressure, 0.2 dB). Its notes named at sounding pitch: Fig. 4 places GC's first at 175 Hz.",
    others: {
      from: "Fig. 4",
      NH: [["B-flat 3", 233.08, 1600], ["F4", 349.23, 2200], ["B-flat 4", 466.16, 4e3], ["F5", 698.46, 6e3], ["B-flat 5", 932.33, 7e3]],
      KB: [["C4", 261.63, 1e3], ["G4", 392, 1500], ["C5", 523.25, 1700], ["G5", 783.99, 2400], ["C6", 1046.5, 4e3]],
      columns: ["note", "hz", "threshold"],
      plotted: "NH's B-flat 4 plotted at 495 Hz, its note B-flat 4 by Fig. 2's legend",
      mostSays: "The maximum blowing pressure used by KB was only about 7 kPa while NH used pressures up to about 15 kPa"
    },
    lines: {
      from: "Fig. 4's lines, read: threshold = a + b f",
      GC: { a: 560, b: 6.2 },
      NH: { a: -370, b: 8.4 },
      KB: { a: -50, b: 3.6 },
      says: "In all cases, the threshold pressure is very nearly proportional to the frequency of the note being played, but there is a range of about a factor of 2 in the slope of this characteristic, with the professional player GC having threshold pressures within the range spanned by the other two players"
    },
    most: { mouthPressure: 25e3, says: "the highest blowing pressure used by this particular player, who is of solid physique, is about 25 kPa" },
    cTrumpet: {
      source: "bouhuys1965",
      from: "its Fig. 1, read as the tuba's",
      note: "A5",
      hz: 880,
      pp: { mouthPressure: 4410, flow: 15e-5 },
      ff: { mouthPressure: 14500, flow: 473e-6 },
      unplotted: "its F-sharp 3 (185 Hz), named in the caption, has no line in Fig. 1"
    },
    secondary: "Campbell, Gilbert & Myers 2021 (Sect. 2.1.3) quote GC's 1.8 kPa at G3 (196 Hz) and 7 kPa at C6: the original's lowest note is F3 sounding (175 Hz, a B-flat trumpet's written G3) at 1.6 kPa, and its line at 196 Hz 1.8",
    says: "the professional trumpeter identified as GC used a threshold pressure of 1.8 kPa when playing G3 (196 Hz), rising to 7 kPa when playing C6 (1047 Hz)"
  },
  mostMouthPressure: { value: 2e4, source: "schwab2004", says: "Mean pressures greater than 20 kPa have been measured in the mouths of trumpet players" }
};

// public/shared/performers/sound-power.json
var sound_power_default = {
  source: "Weinzierl et al. (2017), A Database of Anechoic Microphone Array Measurements of Musical Instruments, TU Berlin, DOI 10.14279/depositonce-5861.2; its sound power per Shabtai et al. (2017), DOI 10.1121/1.4976071; discussed in Weinzierl et al. (2018), DOI 10.1121/1.5053113",
  method: "each modern instrument's single notes at pp and at ff (ISO 3745 enveloping surface, re 1 pW): at each dynamic the notes' median sound power level (dB), their median pitch (MIDI), the least-squares line of power against pitch (dB a semitone), and the notes' rms scatter about it (dB) (render/synthesis/tools/sound_power_table.py)",
  instruments: {
    violin: {
      label: "Violin modern",
      pp: {
        db: 56.2,
        pitch: 73,
        dbPerSemitone: -0.23,
        scatterDb: 3.33,
        notes: 37,
        compass: [
          55,
          91
        ]
      },
      ff: {
        db: 87.5,
        pitch: 73,
        dbPerSemitone: -0.1,
        scatterDb: 3.13,
        notes: 37,
        compass: [
          55,
          91
        ]
      }
    },
    viola: {
      label: "Viola modern",
      pp: {
        db: 68.3,
        pitch: 65,
        dbPerSemitone: 0.071,
        scatterDb: 5.66,
        notes: 130,
        compass: [
          48,
          101
        ]
      },
      ff: {
        db: 88.5,
        pitch: 65,
        dbPerSemitone: 6e-3,
        scatterDb: 3.94,
        notes: 102,
        compass: [
          48,
          101
        ]
      }
    },
    cello: {
      label: "Cello modern",
      pp: {
        db: 68.6,
        pitch: 63.5,
        dbPerSemitone: -0.128,
        scatterDb: 2.87,
        notes: 56,
        compass: [
          36,
          91
        ]
      },
      ff: {
        db: 90.4,
        pitch: 63.5,
        dbPerSemitone: -0.137,
        scatterDb: 2.26,
        notes: 56,
        compass: [
          36,
          91
        ]
      }
    },
    contrabass: {
      label: "Double bass modern",
      pp: {
        db: 67.9,
        pitch: 51,
        dbPerSemitone: -0.358,
        scatterDb: 3.95,
        notes: 94,
        compass: [
          28,
          75
        ]
      },
      ff: {
        db: 87.7,
        pitch: 51.5,
        dbPerSemitone: -0.276,
        scatterDb: 3.49,
        notes: 94,
        compass: [
          28,
          76
        ]
      }
    },
    flute: {
      label: "Transverse flute modern",
      pp: {
        db: 87.5,
        pitch: 78,
        dbPerSemitone: 0.357,
        scatterDb: 1.4,
        notes: 39,
        compass: [
          59,
          98
        ]
      },
      ff: {
        db: 91.9,
        pitch: 76.5,
        dbPerSemitone: 0.586,
        scatterDb: 2.13,
        notes: 36,
        compass: [
          59,
          94
        ]
      }
    },
    oboe: {
      label: "Oboe modern",
      pp: {
        db: 84.8,
        pitch: 73,
        dbPerSemitone: 0.066,
        scatterDb: 2.38,
        notes: 35,
        compass: [
          58,
          90
        ]
      },
      ff: {
        db: 97.5,
        pitch: 76.5,
        dbPerSemitone: 0.096,
        scatterDb: 1.89,
        notes: 38,
        compass: [
          58,
          93
        ]
      }
    },
    "english-horn": {
      label: "English horn modern",
      pp: {
        db: 85,
        pitch: 67,
        dbPerSemitone: -0.103,
        scatterDb: 2.84,
        notes: 31,
        compass: [
          52,
          82
        ]
      },
      ff: {
        db: 95.3,
        pitch: 67,
        dbPerSemitone: -6e-3,
        scatterDb: 2.51,
        notes: 31,
        compass: [
          52,
          82
        ]
      }
    },
    clarinet: {
      label: "Clarinet modern",
      pp: {
        db: 71.2,
        pitch: 72,
        dbPerSemitone: 0.536,
        scatterDb: 7.01,
        notes: 45,
        compass: [
          50,
          94
        ]
      },
      ff: {
        db: 100.4,
        pitch: 72,
        dbPerSemitone: 0.315,
        scatterDb: 1.86,
        notes: 45,
        compass: [
          50,
          94
        ]
      }
    },
    "bass-clarinet": {
      label: "Bass clarinet modern",
      pp: {
        db: 73.8,
        pitch: 54.5,
        dbPerSemitone: 0.374,
        scatterDb: 2.95,
        notes: 42,
        compass: [
          34,
          75
        ]
      },
      ff: {
        db: 97.1,
        pitch: 54.5,
        dbPerSemitone: 0.23,
        scatterDb: 1.24,
        notes: 42,
        compass: [
          34,
          75
        ]
      }
    },
    bassoon: {
      label: "Bassoon modern",
      pp: {
        db: 86.7,
        pitch: 55,
        dbPerSemitone: 0.026,
        scatterDb: 2.34,
        notes: 43,
        compass: [
          34,
          76
        ]
      },
      ff: {
        db: 100.4,
        pitch: 55,
        dbPerSemitone: 0.168,
        scatterDb: 1.96,
        notes: 43,
        compass: [
          34,
          76
        ]
      }
    },
    contrabassoon: {
      label: "Contrabassoon modern",
      pp: {
        db: 83.1,
        pitch: 37,
        dbPerSemitone: -0.061,
        scatterDb: 1.88,
        notes: 31,
        compass: [
          22,
          53
        ]
      },
      ff: {
        db: 94,
        pitch: 36.5,
        dbPerSemitone: 0.101,
        scatterDb: 1.35,
        notes: 30,
        compass: [
          22,
          51
        ]
      }
    },
    "alto-saxophone": {
      label: "Alto saxophone modern",
      pp: {
        db: 92.3,
        pitch: 65.5,
        dbPerSemitone: 0.048,
        scatterDb: 4.23,
        notes: 52,
        compass: [
          49,
          85
        ]
      },
      ff: {
        db: 105.4,
        pitch: 65.5,
        dbPerSemitone: -0.025,
        scatterDb: 2.69,
        notes: 52,
        compass: [
          49,
          85
        ]
      }
    },
    "tenor-saxophone": {
      label: "Tenor saxophone modern",
      pp: {
        db: 90.2,
        pitch: 60.5,
        dbPerSemitone: 0.043,
        scatterDb: 5.35,
        notes: 42,
        compass: [
          44,
          80
        ]
      },
      ff: {
        db: 107.8,
        pitch: 61,
        dbPerSemitone: 0.024,
        scatterDb: 2.25,
        notes: 43,
        compass: [
          44,
          80
        ]
      }
    },
    horn: {
      label: "French horn modern",
      pp: {
        db: 84.8,
        pitch: 60,
        dbPerSemitone: 0.566,
        scatterDb: 3.77,
        notes: 51,
        compass: [
          38,
          79
        ]
      },
      ff: {
        db: 107.6,
        pitch: 59.5,
        dbPerSemitone: 0.294,
        scatterDb: 4.22,
        notes: 50,
        compass: [
          38,
          78
        ]
      }
    },
    trumpet: {
      label: "Trumpet modern",
      pp: {
        db: 84.4,
        pitch: 71.5,
        dbPerSemitone: 0.652,
        scatterDb: 3.31,
        notes: 36,
        compass: [
          54,
          89
        ]
      },
      ff: {
        db: 107,
        pitch: 71.5,
        dbPerSemitone: 0.328,
        scatterDb: 1.2,
        notes: 36,
        compass: [
          54,
          89
        ]
      }
    },
    trombone: {
      label: "Tenor trombone modern",
      pp: {
        db: 77.4,
        pitch: 54.5,
        dbPerSemitone: 0.494,
        scatterDb: 2.58,
        notes: 46,
        compass: [
          31,
          77
        ]
      },
      ff: {
        db: 108.9,
        pitch: 54.5,
        dbPerSemitone: 0.161,
        scatterDb: 2.64,
        notes: 46,
        compass: [
          31,
          77
        ]
      }
    },
    "bass-trombone": {
      label: "Bass trombone modern",
      pp: {
        db: 77,
        pitch: 49.5,
        dbPerSemitone: 0.318,
        scatterDb: 3.42,
        notes: 44,
        compass: [
          28,
          65
        ]
      },
      ff: {
        db: 109.3,
        pitch: 49.5,
        dbPerSemitone: 0.277,
        scatterDb: 1.82,
        notes: 44,
        compass: [
          28,
          65
        ]
      }
    },
    tuba: {
      label: "Tuba modern",
      pp: {
        db: 90.5,
        pitch: 46,
        dbPerSemitone: 0.493,
        scatterDb: 3.51,
        notes: 59,
        compass: [
          17,
          76
        ]
      },
      ff: {
        db: 112.3,
        pitch: 44.5,
        dbPerSemitone: 0.329,
        scatterDb: 3.93,
        notes: 54,
        compass: [
          18,
          72
        ]
      }
    },
    harp: {
      label: "Double action harp modern",
      pp: {
        db: 56.5,
        pitch: 63.5,
        dbPerSemitone: -0.024,
        scatterDb: 1.48,
        notes: 78,
        compass: [
          23,
          102
        ]
      },
      ff: {
        db: 80.5,
        pitch: 63.5,
        dbPerSemitone: -0.104,
        scatterDb: 4.63,
        notes: 78,
        compass: [
          23,
          102
        ]
      }
    },
    guitar: {
      label: "Acoustic guitar modern",
      pp: {
        db: 66.2,
        pitch: 59.5,
        dbPerSemitone: -0.088,
        scatterDb: 2.99,
        notes: 50,
        compass: [
          40,
          83
        ]
      },
      ff: {
        db: 78.1,
        pitch: 59.5,
        dbPerSemitone: -0.016,
        scatterDb: 3.1,
        notes: 50,
        compass: [
          40,
          83
        ]
      }
    },
    soprano: {
      label: "Soprano",
      pp: {
        db: 68,
        pitch: 67.5,
        dbPerSemitone: 0.84,
        scatterDb: 5.72,
        notes: 26,
        compass: [
          55,
          80
        ]
      },
      ff: {
        db: 93.9,
        pitch: 67.5,
        dbPerSemitone: 1.329,
        scatterDb: 2.87,
        notes: 26,
        compass: [
          55,
          80
        ]
      }
    },
    piccolo: {
      label: "Transverse flute modern, its notes +15 semitones",
      derivedFrom: "flute",
      transposition: 15,
      pp: {
        db: 87.5,
        pitch: 93,
        dbPerSemitone: 0.357,
        scatterDb: 1.4,
        notes: 39,
        compass: [
          74,
          113
        ]
      },
      ff: {
        db: 91.9,
        pitch: 91.5,
        dbPerSemitone: 0.586,
        scatterDb: 2.13,
        notes: 36,
        compass: [
          74,
          109
        ]
      }
    },
    "alto-flute": {
      label: "Transverse flute modern, its notes -4 semitones",
      derivedFrom: "flute",
      transposition: -4,
      pp: {
        db: 87.5,
        pitch: 74,
        dbPerSemitone: 0.357,
        scatterDb: 1.4,
        notes: 39,
        compass: [
          55,
          94
        ]
      },
      ff: {
        db: 91.9,
        pitch: 72.5,
        dbPerSemitone: 0.586,
        scatterDb: 2.13,
        notes: 36,
        compass: [
          55,
          90
        ]
      }
    },
    "e-flat-clarinet": {
      label: "Clarinet modern, its notes +5 semitones",
      derivedFrom: "clarinet",
      transposition: 5,
      pp: {
        db: 71.2,
        pitch: 77,
        dbPerSemitone: 0.536,
        scatterDb: 7.01,
        notes: 45,
        compass: [
          55,
          99
        ]
      },
      ff: {
        db: 100.4,
        pitch: 77,
        dbPerSemitone: 0.315,
        scatterDb: 1.86,
        notes: 45,
        compass: [
          55,
          99
        ]
      }
    },
    "soprano-saxophone": {
      label: "Alto saxophone modern, its notes +7 semitones",
      derivedFrom: "alto-saxophone",
      transposition: 7,
      pp: {
        db: 92.3,
        pitch: 72.5,
        dbPerSemitone: 0.048,
        scatterDb: 4.23,
        notes: 52,
        compass: [
          56,
          92
        ]
      },
      ff: {
        db: 105.4,
        pitch: 72.5,
        dbPerSemitone: -0.025,
        scatterDb: 2.69,
        notes: 52,
        compass: [
          56,
          92
        ]
      }
    },
    "baritone-saxophone": {
      label: "Tenor saxophone modern, its notes -7 semitones",
      derivedFrom: "tenor-saxophone",
      transposition: -7,
      pp: {
        db: 90.2,
        pitch: 53.5,
        dbPerSemitone: 0.043,
        scatterDb: 5.35,
        notes: 42,
        compass: [
          37,
          73
        ]
      },
      ff: {
        db: 107.8,
        pitch: 54,
        dbPerSemitone: 0.024,
        scatterDb: 2.25,
        notes: 43,
        compass: [
          37,
          73
        ]
      }
    }
  }
};

// public/shared/dynamics.js
var DYNAMICS = Object.freeze([["ppp", 0.19], ["pp", 0.32], ["p", 0.44], ["mp", 0.57], ["mf", 0.69], ["f", 0.82], ["ff", 0.94], ["fff", 1.01]]);
var DYNAMIC_VELOCITY = Object.freeze({ ppp: 16 / 127, pp: 33 / 127, p: 49 / 127, mp: 64 / 127, mf: 80 / 127, f: 96 / 127, ff: 112 / 127, fff: 1 });
var BEYOND = Object.freeze({ marks: 5, loudest: 1.5, shrink: 0.6 });
var MARKS = Object.freeze([
  ...Array.from({ length: BEYOND.marks }, (_, k) => "p".repeat(3 + BEYOND.marks - k)),
  ...DYNAMICS.map(([m]) => m),
  ...Array.from({ length: BEYOND.marks }, (_, k) => "f".repeat(4 + k))
]);

// registry/sources.json
var sources_default = {
  schema: "musebots.registry-sources/1",
  about: "Every source a registry value cites, once (registry/README.md). literature: a published measurement or standard, its DOI checked with Crossref where it has one; vernacular: a maker's chart, a retailer's page, players' common knowledge, looked up, with the page and a saved copy; other: Printables, a dataset, an engine's own data, a CT, with where it is and its licence. Saved copies are in the trunk's research-downloads/.",
  sources: {
    "fletcher-rossing-1998": { kind: "literature", authors: "N. H. Fletcher, T. D. Rossing", title: "The Physics of Musical Instruments", year: 1998, doi: "10.1007/978-0-387-21603-4", edition: "2nd", publisher: "Springer" },
    "weinzierl-2017": { kind: "literature", authors: "S. Weinzierl, M. Vorländer, G. Behler, F. Brinkmann, H. von Coler, E. Detzner, J. Krämer, A. Lindau, M. Pollow, F. Schulz, N. R. Shabtai", title: "A Database of Anechoic Microphone Array Measurements of Musical Instruments", year: 2017, doi: "10.14279/depositonce-5861.2", url: "https://depositonce.tu-berlin.de/handle/11303/6305.2", note: "a published dataset, its DOI checked on DataCite (not on Crossref); its recordings in the trunk's research-downloads/tu-berlin-anechoic/, read by native/openwind/turbulence-fit.mjs and tools/sound_power_table.py" },
    "fletcher-1975": { kind: "literature", authors: "N. H. Fletcher", title: "Acoustical correlates of flute performance technique", year: 1975, doi: "10.1121/1.380430", in: "The Journal of the Acoustical Society of America 57(1), 233-237", note: "its laws as render/synthesis/workers/openwind_worker.py quotes them; the paper not yet fetched (research/SOURCES_TO_FETCH.md)" },
    "fletcher-1964": { kind: "literature", authors: "H. Fletcher", title: "Normal Vibration Frequencies of a Stiff Piano String", year: 1964, doi: "10.1121/1.1918933", in: "JASA 36(1), 203-209" },
    "schelleng-1973": { kind: "literature", authors: "J. C. Schelleng", title: "The bowed string and the player", year: 1973, doi: "10.1121/1.1913322", in: "JASA 53(1), 26-41" },
    "schoonderwaldt-2009": { kind: "literature", authors: "E. Schoonderwaldt", title: "The player and the bowed string: Coordination of bowing parameters in violin and viola performance", year: 2009, doi: "10.1121/1.3203209", in: "JASA 126(5), 2709-2720" },
    "schoonderwaldt-altenmuller-2014": { kind: "literature", authors: "E. Schoonderwaldt, E. Altenmüller", title: "Coordination in fast repetitive violin-bowing patterns", year: 2014, doi: "10.1371/journal.pone.0106615", in: "PLoS ONE 9(9), e106615" },
    "schoonderwaldt-guettler-askenfelt-2003": { kind: "literature", authors: "E. Schoonderwaldt, K. Guettler, A. Askenfelt", title: "Effect of the width of the bow hair on the violin string spectrum", year: 2003, in: "Proceedings of the Stockholm Music Acoustics Conference (SMAC 03), Stockholm", saved: "research-downloads/strings/bow-hair/schoonderwaldt-guettler-askenfelt-2003-smac-bow-width.pdf", noDoi: "conference proceedings: none found at Crossref (29 October 2026)" },
    "guettler-askenfelt-1997": { kind: "literature", authors: "K. Guettler, A. Askenfelt", title: "Acceptance limits for the duration of pre-Helmholtz transients in bowed string attacks", year: 1997, doi: "10.1121/1.418520", in: "JASA 101(5), 2903-2913" },
    "iso-16-1975": { kind: "literature", authors: "International Organization for Standardization", title: "ISO 16:1975 Acoustics -- Standard tuning frequency (Standard musical pitch)", year: 1975, standard: "ISO 16:1975" },
    "iso-3382-1-2009": { kind: "literature", authors: "International Organization for Standardization", title: "ISO 3382-1:2009 Acoustics -- Measurement of room acoustic parameters -- Part 1: Performance spaces", year: 2009, standard: "ISO 3382-1:2009" },
    "nist-sp811-2008": { kind: "literature", authors: "A. Thompson, B. N. Taylor", title: "Guide for the Use of the International System of Units (SI), NIST Special Publication 811", year: 2008, doi: "10.6028/NIST.SP.811e2008" },
    "physics-factbook-steel": { kind: "vernacular", who: 'G. Elert (ed.), The Physics Factbook: K. Sutherland 2004, "Density of Steel", a compilation of handbook values', url: "https://hypertextbook.com/facts/2004/KarenSutherland.shtml", accessed: "2026-10-27", saved: "research-downloads/physics/physics-factbook-density-of-steel.html" },
    "dadario-helicore-orchestral-bass": { kind: "vernacular", who: "D'Addario, the maker: Helicore orchestral double bass strings' tension chart (H611-H614, 3/4 medium)", url: null, accessed: null, saved: "research-downloads/strings/double-bass-strings/helicore-orchestral-bass-tension-chart.png", note: "its page and the date it was read were not recorded when it was saved (October 2026)" },
    "vsco2-ce": { kind: "other", who: "Versilian Studios, VSCO 2 Community Edition: orchestral samples, its contrabass's pizzicati among them", url: "https://versilian-studios.com/vsco-community/", licence: "CC0 1.0", note: "the recordings our fits read a bass's strings' stiffness and decays from (native/strings-model/string_tail.py --plucked)" },
    "rosa-size-chart": { kind: "vernacular", who: 'Rosa Musical Instrument, a retailer: its violin, viola and cello size chart ("approximate sizing and measurements; exact size will vary from maker to maker")', url: "https://www.rosamusicalinstrument.com/blogs/blog/violin-viola-cello-size-chart", accessed: "2026-10-27" },
    "simplyforstrings-bass-bows": { kind: "vernacular", who: `Simply for Strings, a retailer: "French and German double bass bows, what's the difference"`, url: "https://simplyforstrings.com.au/blogs/news/french-and-german-double-bass-bows-whats-the-difference", accessed: "2026-10-27" },
    "thomann-rjb-bass-bow-review": { kind: "vernacular", who: `Thomann, a retailer: a player's review (Baur, 28 March 2021) of the Roth & Junius RJB carbon bass bow 4/4 F -- "Bow total length: 72.5 cm", "Length of the working hair area: 57.5 cm" ("These are the parameters of my bow! You may have differences")`, url: "https://www.thomannmusic.com/roth_junius_rjb_carbon_bass_bow_4_4f_bk_reviews.htm", accessed: "2026-10-29" },
    artifastring: { kind: "other", who: `G. Percival, Artifastring, the bowed-string engine we play on: its strings' constants (constants/strings_<instrument>.h, made by its make-constants.py; each mode's decay calculated by its mode-detect/all-modes.py from recordings), and its bodies' measured impulse responses; Percival's thesis, 2013, University of Glasgow, "Physical modelling meets machine learning: performing music with a virtual string ensemble"`, url: "https://github.com/gperciva/artifastring", licence: "GPL-3.0-or-later" },
    "rayleigh-1896": { kind: "literature", authors: "J. W. Strutt (Lord Rayleigh)", title: "The Theory of Sound, vol. 2 (on the conductivity of apertures)", year: 1896, edition: "2nd", publisher: "Macmillan", noDoi: "a book of 1896, before DOIs" },
    "nia-2015": { kind: "literature", authors: "H. T. Nia, A. D. Jain, Y. Liu, M.-R. Alam, R. Barnas, N. C. Makris", title: "The evolution of air resonance power efficiency in the violin and its ancestors", year: 2015, doi: "10.1098/rspa.2014.0905", in: "Proc. R. Soc. A 471, 20140905" },
    "bellows-nakayama-2024": { kind: "literature", authors: "S. D. Bellows, D. Nakayama", title: "An investigation of the f-hole shape's influence on the modal response of the violin", year: 2024, doi: "10.1051/aacus/2024074", in: "Acta Acustica 8, 67" },
    "goldblatt-specs": { kind: "vernacular", who: "A. Goldblatt, luthier: his specification sheets for the violin, viola, cello and bass (4/4 violin and cello, a 16-16.5 in viola, a 3/4 bass)", url: "alangoldblatt.com/specs.html", accessed: "2026-10-17", saved: "research-downloads/strings/body-measurements/" },
    "vsl-academy-violin": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the violin's page (its strings and compass)", url: "https://www.vsl.co.at/academy/strings/violin", accessed: "2026-10-29" },
    "vsl-academy-viola": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the viola's page (its strings and compass)", url: "https://www.vsl.co.at/academy/strings/viola", accessed: "2026-10-29" },
    "vsl-academy-cello": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the cello's page (its strings and compass)", url: "https://www.vsl.co.at/academy/strings/cello", accessed: "2026-10-29" },
    "vsl-academy-double-bass": { kind: "vernacular", who: "Vienna Symphonic Library, Academy: the double bass's page (its strings, compass and notation)", url: "https://www.vsl.co.at/academy/strings/double-bass", accessed: "2026-10-29" },
    "galluzzo-2004": { kind: "literature", authors: "P. M. Galluzzo", title: "On the playability of stringed instruments (PhD thesis, University of Cambridge)", year: 2004, doi: "10.17863/CAM.14046", saved: "research-downloads/strings/bowed-friction-papers/galluzzo-2004-thesis-playability.pdf", note: "a DataCite DOI, checked there: section 4.2.3, the waveform identification" },
    "lampis-2024": { kind: "literature", authors: "A. Lampis, A. Mayer, V. Chatziioannou", title: "An experimental approach for comparing the influence of cello string type on bowed attack response", year: 2024, doi: "10.1121/10.0034330", in: "JASA Express Letters 4, 113201", saved: "research-downloads/strings/lampis-2024-cello-string-attack-jasael.pdf" },
    "lampis-acta-2024": { kind: "literature", authors: "A. Lampis, A. Mayer, V. Chatziioannou", title: "Assessing playability limits of bowed-string transients using experimental measurements", year: 2024, doi: "10.1051/aacus/2024034", in: "Acta Acustica 8, 44", saved: "research-downloads/strings/lampis-2024-playability-transients-acta.pdf", note: "CC BY; checked on Crossref" },
    "lampis-attacks-2024": { kind: "other", who: `A. Lampis, "Bridge force waveforms obtained by systematically bowing various cello G-string models", Zenodo 2024, doi:10.5281/zenodo.13374477: a bowing robot's attacks from rest on four cello G strings, each file a bow force and acceleration, its bridge force at 50 kHz -- the recordings behind lampis-acta-2024's Guettler diagrams`, url: "https://doi.org/10.5281/zenodo.13374477", licence: "CC BY 4.0", saved: "research-downloads/strings/lampis-attacks/waveforms", note: "two of its sessions fetched, string C's and string A's (research-downloads/README.md)" },
    "matusiak-chatziioannou-2024": { kind: "literature", authors: "E. Matusiak, V. Chatziioannou", title: "Elasto-plastic friction modeling toward reconstructing measured bowed-string transients", year: 2024, doi: "10.1121/10.0028228", in: "J. Acoust. Soc. Am. 156(2), 1135-1147", saved: "research-downloads/strings/matusiak-2024/matusiak-chatziioannou-2024-jasa.pdf", note: "CC BY; checked on Crossref" },
    "geringer-allen-2004": { kind: "literature", authors: "J. M. Geringer, M. L. Allen", title: "An Analysis of Vibrato among High School and University Violin and Cello Students", year: 2004, doi: "10.2307/3345438", in: "Journal of Research in Music Education 52(2), 167-178" },
    "allen-geringer-macleod-2009": { kind: "literature", authors: "M. L. Allen, J. M. Geringer, R. B. MacLeod", title: "Performance Practice of Violin Vibrato: An Artist-Level Case Study", year: 2009, doi: "10.1177/1948499209OS-400103", in: "String Research Journal os-4(1), 27-38" },
    "macleod-2008": { kind: "literature", authors: "R. B. MacLeod", title: "Influences of Dynamic Level and Pitch Register on the Vibrato Rates and Widths of Violin and Viola Players", year: 2008, doi: "10.1177/0022429408323070", in: "Journal of Research in Music Education 56(1), 43-54" },
    "geringer-allen-macleod-2005": { kind: "literature", authors: "J. M. Geringer, M. L. Allen, R. B. MacLeod", title: "Initial Movement and Continuity in Vibrato among High School and University String Players", year: 2005, doi: "10.1177/002242940505300306", in: "Journal of Research in Music Education 53(3), 248-259" },
    "mick-2024": { kind: "literature", authors: "J. P. Mick", title: "An Analysis of Double Bass Vibrato", year: 2024, doi: "10.1177/19484992241238989", in: "String Research Journal 15(1), 55-72" },
    "prame-1994": { kind: "literature", authors: "E. Prame", title: "Measurements of the vibrato rate of ten singers", year: 1994, doi: "10.1121/1.410141", in: "JASA 96(4), 1979-1984" },
    "prame-1997": { kind: "literature", authors: "E. Prame", title: "Vibrato extent and intonation in professional Western lyric singing", year: 1997, doi: "10.1121/1.419735", in: "JASA 102(1), 616-621", saved: "research-downloads/expression/from-owner-2026-10-25/616_1_online.pdf" },
    "mellody-wakefield-2000": { kind: "literature", authors: "M. Mellody, G. H. Wakefield", title: "The time-frequency characteristics of violin vibrato: Modal distribution analysis and synthesis", year: 2e3, doi: "10.1121/1.428326", in: "JASA 107(1), 598-611", saved: "research-downloads/expression/from-owner-2026-10-25/598_1_online.pdf" },
    "hu-2025": { kind: "literature", authors: "S. Hu, S. H. Kim, H. H. Kim, H. Mackay, E. J. Heller", title: "Influence of string register locations on vibratos among violoncellists", year: 2025, doi: "10.48550/arXiv.2512.18162", in: "arXiv:2512.18162 (a preprint; its data and code doi:10.5281/zenodo.17712642)" },
    "box-muller-1958": { kind: "literature", authors: "G. E. P. Box, M. E. Muller", title: "A Note on the Generation of Random Normal Deviates", year: 1958, doi: "10.1214/aoms/1177706645", in: "The Annals of Mathematical Statistics 29(2), 610-611" },
    "friberg-1991": { kind: "literature", authors: "A. Friberg", title: "Generative Rules for Music Performance: A Formal Description of a Rule System", year: 1991, doi: "10.2307/3680917", in: "Computer Music Journal 15(2), from p. 56" },
    "friberg-bresin-sundberg-2006": { kind: "literature", authors: "A. Friberg, R. Bresin, J. Sundberg", title: "Overview of the KTH rule system for musical performance", year: 2006, doi: "10.2478/v10053-008-0052-x", in: "Advances in Cognitive Psychology 2(2), 145-161" },
    "dannenberg-2006": { kind: "literature", authors: "R. B. Dannenberg", title: "The Interpretation of MIDI Velocity", year: 2006, in: "Proceedings of the International Computer Music Conference 2006 (New Orleans), 193-196", noDoi: "the ICMC's proceedings have none: the University of Michigan's Quod holds them, hdl:2027/spo.bbp2372.2006.042" },
    "brick-orchestration-notes": { kind: "vernacular", who: "A. Brick, composer and conductor: HMU 397A Orchestration, Class Notes 1a (Stevens Institute of Technology)", url: "https://personal.stevens.edu/~abrick/orchestration1/files/HMU397_notes_01a.html", accessed: "2026-10-29" },
    "musicaustria-atmospheres": { kind: "vernacular", who: "mica - music austria, its database's entry for Ligeti's Atmosphères (Universal Edition): its Orchestercode", url: "https://db.musicaustria.at/print/pdf/node/125570", accessed: "2026-10-29" },
    "boosey-pithoprakta": { kind: "vernacular", who: "Boosey & Hawkes, the publisher: its page for Xenakis's Pithoprakta, its scoring", url: "https://www.boosey.com/cr/music/Iannis-Xenakis-Pithoprakta/3078", accessed: "2026-10-29" },
    "pamies-vila-hofmann-chatziioannou-2018": { kind: "literature", authors: "M. Pàmies-Vilà, A. Hofmann, V. Chatziioannou", title: "Analysis of Tonguing and Blowing Actions During Clarinet Performance", year: 2018, doi: "10.3389/fpsyg.2018.00617", in: "Frontiers in Psychology 9, 617", saved: "research-downloads/winds/pamies-vila-2018-tonguing-blowing.pdf" },
    "fritz-wolfe-2005": { kind: "literature", authors: "C. Fritz, J. Wolfe", title: "How do clarinet players adjust the resonances of their vocal tracts for different playing effects?", year: 2005, doi: "10.1121/1.2041287", in: "The Journal of the Acoustical Society of America 118(5), 3306-3315", saved: "research-downloads/winds/vocal-tract/fritz-wolfe-2005-clarinet-vocal-tract.pdf" },
    "chen-smith-wolfe-2009": { kind: "literature", authors: "J.-M. Chen, J. Smith, J. Wolfe", title: "Pitch bending and glissandi on the clarinet: Roles of the vocal tract and partial tone hole closure", year: 2009, doi: "10.1121/1.3177269", in: "The Journal of the Acoustical Society of America 126(3), 1511-1520", saved: "research-downloads/winds/vocal-tract/chen-smith-wolfe-2009-clarinet-pitch-bending.pdf" },
    "chen-smith-wolfe-2008": { kind: "literature", authors: "J.-M. Chen, J. Smith, J. Wolfe", title: "Experienced saxophonists learn to tune their vocal tracts", year: 2008, doi: "10.1126/science.1151411", in: "Science 319(5864), 776", saved: "research-downloads/winds/vocal-tract/chen-smith-wolfe-2008-saxophonists-tune-vocal-tracts.pdf" },
    "chen-smith-wolfe-2011": { kind: "literature", authors: "J.-M. Chen, J. Smith, J. Wolfe", title: "Saxophonists tune vocal tract resonances in advanced performance techniques", year: 2011, doi: "10.1121/1.3514423", in: "The Journal of the Acoustical Society of America 129(1), 415-426", saved: "research-downloads/winds/vocal-tract/chen-smith-wolfe-2011-saxophonists-tune-vocal-tract-resonances.pdf" },
    "wiertlewski-hayward-2012": { kind: "literature", authors: "M. Wiertlewski, V. Hayward", title: "Transducer for mechanical impedance testing over a wide frequency range through active feedback", year: 2012, doi: "10.1063/1.3683572", in: "Review of Scientific Instruments 83(2), 025001", saved: "research-downloads/strings/finger/wiertlewski-hayward-2012-transducer-impedance-rsi.pdf" },
    "hennig-2011": { kind: "literature", authors: "H. Hennig, R. Fleischmann, A. Fredebohm, Y. Hagmayer, J. Nagler, A. Witt, F. J. Theis, T. Geisel", title: "The Nature and Perception of Fluctuations in Human Musical Rhythms", year: 2011, doi: "10.1371/journal.pone.0026457", in: "PLoS ONE 6(10), e26457", saved: "research-downloads/performer-noise/hennig-2011-fluctuations-human-musical-rhythms.pdf" },
    "mcauley-marsden-2000": { kind: "literature", authors: "J. H. McAuley, C. D. Marsden", title: "Physiological and pathological tremors and rhythmic central motor control", year: 2e3, doi: "10.1093/brain/123.8.1545", in: "Brain 123(8), 1545-1567", read: "its abstract (PubMed 10908186)" },
    "huron-1989-textures": { kind: "literature", authors: "D. Huron", title: "Characterizing Musical Textures", year: 1989, noDoi: "a conference paper without one: its handle hdl:2027/spo.bbp2372.1989.033 (Michigan Publishing)", in: "Proceedings of the 1989 International Computer Music Conference, Columbus, Ohio, 131-134", note: "texture as a bounded space of onset synchronization and semblant pitch motion (parallel and similar motions against contrary and oblique), monophony, homophony, polyphony and heterophony its quadrants, the works of each measured into their regions (Figure 1: hymns high in synchrony and about a third semblant, Bach's fugues and sinfonias low in both, Chinese, Siamese and Korean heterophony some 0.3 to 0.45 in synchrony and 0.5 to 0.75 semblant), and the space reversed as a composer's production model: the texture space's synchrony and semblance and its named locations' regions (public/shared/texture-space.js, test/texture-space.test.mjs)", saved: "research-downloads/counterpoint/Huron 1989 Characterizing musical textures (ICMC).pdf" },
    "bent-1983": { kind: "literature", authors: "M. Bent", title: '"Resfacta" and "Cantare Super Librum"', year: 1983, doi: "10.1525/jams.1983.36.3.03a00020", in: "Journal of the American Musicological Society 36(3), 371-391", note: "Tinctoris (Liber de arte contrapuncti, 1477, II.20) as Bent reads him: in res facta every part is bound to every other, while singers over the book (cantare super librum) are each bound to the tenor and need not be to one another -- a difference of how the parts are bound, not of writing against improvising: the texture space's binding (public/shared/texture-space.js), a process's parts bound to its first part alone at 0, every part to every other at 1" },
    "brown-1976": { kind: "literature", authors: "H. M. Brown", title: "Embellishing Sixteenth-Century Music", year: 1976, noDoi: "a book without one: ISBN 978-0-19-323175-7 (Oxford University Press, London; Early Music Series 1)", note: "the diminution treatises (Ganassi 1535, Ortiz 1553, Dalla Casa 1584, Bovicelli 1594 and others) as Brown reads them: a composition's notes divided by its performer into quicker passaggi, each leaving a note and arriving at the next, the composition's counterpoint unchanged beneath them" },
    "huron-1989-denumerability": { kind: "literature", authors: "D. Huron", title: "Voice Denumerability in Polyphonic Music of Homogeneous Timbres", year: 1989, doi: "10.2307/40285438", in: "Music Perception 6(4), 361-382", note: "identification of the voices falls from three to four: registry/perception/polyphony.json voices-followed, the voices a line's rules are kept against (conducting/counterpoint.js)" },
    "huron-2001": { kind: "literature", authors: "D. Huron", title: "Tone and Voice: A Derivation of the Rules of Voice-Leading from Perceptual Principles", year: 2001, doi: "10.1525/mp.2001.19.1.1", in: "Music Perception 19(1), 1-64", note: "the counterpoint space's rules as perception's (conducting/counterpoint.js)" },
    "ebcioglu-1990": { kind: "literature", authors: "K. Ebcioğlu", title: "An expert system for harmonizing chorales in the style of J.S. Bach", year: 1990, doi: "10.1016/0743-1066(90)90055-A", in: "The Journal of Logic Programming 8(1-2), 145-185", note: "counterpoint as constraint search (conducting/counterpoint.js)" },
    "herremans-sorensen-2013": { kind: "literature", authors: "D. Herremans, K. Sörensen", title: "Composing fifth species counterpoint music with a variable neighborhood search algorithm", year: 2013, doi: "10.1016/j.eswa.2013.05.071", in: "Expert Systems with Applications 40(16), 6427-6437", note: "counterpoint's rules as weighted costs (conducting/counterpoint.js)" },
    "hemmecke-koppe-lee-weismantel-2010": { kind: "literature", authors: "R. Hemmecke, M. Köppe, J. Lee, R. Weismantel", title: "Nonlinear Integer Programming", year: 2010, doi: "10.1007/978-3-540-68279-0_15", in: "50 Years of Integer Programming 1958-2008 (Springer), 561-618", note: "counterpoint's costs as a nonlinear integer program over linear constraints, where its complexity turns; the trunk's research-downloads/optimization/ (the owner's download, 5 November 2026)" },
    "samarotto-2009": { kind: "literature", authors: "F. Samarotto", title: '"Plays of Opposing Motion": Contra-Structural Melodic Impulses in Voice-leading Analysis', year: 2009, doi: "10.30535/mto.15.2.4", in: "Music Theory Online 15(2)", note: "a line's directionality and ambitus against the structure it prolongs; the trunk's research-downloads/counterpoint/ (the owner's download, 5 November 2026)" },
    "open-music-theory": { kind: "literature", authors: "M. Gotham, K. Gullings, C. Hamm, B. Hughes, B. Jarvis, M. Lavengood, J. Peterson (eds.)", title: "Open Music Theory, version 2", year: 2021, noDoi: "an open textbook without one (VIVA Pressbooks, CC BY-SA 4.0): https://viva.pressbooks.pub/openmusictheory", note: "its chapters Texture (Gotham & Brady: monophony, heterophony, homophony, polyphony), Metrical Dissonance (Gotham), Swing Rhythms (Lavengood) and the five species of counterpoint (Shaffer & Gotham); the whole book in the trunk's research-downloads/rhythm/ (the owner's download, 5 November 2026)" },
    "xenakis-1955": { kind: "literature", authors: "I. Xenakis", title: "La crise de la musique sérielle", year: 1955, noDoi: "a journal of 1955 without them: https://www.iannis-xenakis.org/en/?p=3720", in: "Gravesaner Blätter 1, 2-4", note: "a dense linear polyphony heard as a mass, the statistical mean of its parts' states replacing their rules: the texture space's masses as counterpoint extended" },
    "xenakis-1992": { kind: "literature", authors: "I. Xenakis", title: "Formalized Music: Thought and Mathematics in Composition, revised edition", year: 1992, noDoi: "a book (Pendragon Press, Stuyvesant NY), its ISBN not checked here", note: "chapter 1: Pithoprakta's glissandi, their speeds by Gauss's law; Achorripsis's events by Poisson's: the texture space's glide and chance" },
    "schaeffer-1966": { kind: "literature", authors: "P. Schaeffer", title: "Treatise on Musical Objects: An Essay across Disciplines", year: 2017, doi: "10.1525/9780520967465", in: "translated by C. North and J. Dack (University of California Press; Crossref dates its online edition 2019) from Traité des objets musicaux, Éditions du Seuil, 1966", note: "the typology of sound objects by their sustainment: an impulse, a sustained sound and an iteration, apart from what sounds them: the texture space's impulse and sustain (public/shared/texture-space.js), which each instrument's player plays as its own (a bowed string's point plucked, a wind's tongued as short as it goes)" },
    "gibson-2022": { kind: "literature", authors: "B. Gibson", title: "The Use of Stochastic Distributions in the Instrumental Works of Iannis Xenakis: Between Chance and Intuition", year: 2022, noDoi: "in the Universidade de Évora's repository without one: https://dspace.uevora.pt/rdpc/bitstream/10174/34491/1/", note: "which of Xenakis's instrumental works draw their events by Poisson's, Gauss's and the exponential laws, and where he set the draws aside: the texture space's chance" },
    "levy-2013": { kind: "literature", authors: "B. Levy", title: "'Rules as Strict as Palestrina's': The Regulation of Pitch and Rhythm in Ligeti's Requiem", year: 2013, doi: "10.1017/s1478572213000029", in: "Twentieth-Century Music 10(2), 203-230", note: "micropolyphony's canon under rules: the texture space's canon a counterpoint" },
    "bernard-1994": { kind: "literature", authors: "J. W. Bernard", title: "Voice Leading as a Spatial Function in the Music of Ligeti", year: 1994, doi: "10.2307/854260", in: "Music Analysis 13(2/3), 227-253", note: "a mass's voice leading as a function of the space it fills: the texture space's places and motion" },
    "douglas-noble-mcadams-2016": { kind: "literature", authors: "C. Douglas, J. Noble, S. McAdams", title: "Auditory Scene Analysis and the Perception of Sound Mass in Ligeti's Continuum", year: 2016, doi: "10.1525/mp.2016.33.3.287", in: "Music Perception 33(3), 287-305", note: "parts fuse into a mass by their density, rate and register, not at one threshold: the texture space's dimensions continuous" },
    "toussaint-2005": { kind: "literature", authors: "G. T. Toussaint", title: "The Euclidean algorithm generates traditional musical rhythms", year: 2005, noDoi: "a conference paper without one: https://archive.bridgesmathart.org/2005/bridges2005-47.pdf", in: "Proceedings of Bridges 2005, 47-56", note: "the rhythm engine's Euclidean rhythms (shared/euclidean.js); the trunk's research-downloads/rhythm/" },
    "clough-douthett-1991": { kind: "literature", authors: "J. Clough, J. Douthett", title: "Maximally Even Sets", year: 1991, doi: "10.2307/843811", in: "Journal of Music Theory 35(1/2), 93-173", note: "the rhythm engine's evenness (shared/euclidean.js)" },
    "block-douthett-1994": { kind: "literature", authors: "S. Block, J. Douthett", title: "Vector Products and Intervallic Weighting", year: 1994, doi: "10.2307/843826", in: "Journal of Music Theory 38(1), 21-41", note: "shared/euclidean.js" },
    "demaine-et-al-2009": { kind: "literature", authors: "E. D. Demaine, F. Gomez-Martin, H. Meijer, D. Rappaport, P. Taslakian, G. T. Toussaint, T. Winograd, D. R. Wood", title: "The distance geometry of music", year: 2009, doi: "10.1016/j.comgeo.2008.04.005", in: "Computational Geometry 42(5), 429-454", note: "the rhythm engine's rotations (shared/euclidean.js)" },
    "cohn-2001": { kind: "literature", authors: "R. Cohn", title: "Complex Hemiolas, Ski-Hill Graphs and Metric Spaces", year: 2001, doi: "10.1111/1468-2249.00141", in: "Music Analysis 20(3), 295-326", note: "meters as products of twos and threes (shared/euclidean.js, meter-space.js)" },
    "biamonte-2014": { kind: "literature", authors: "N. Biamonte", title: "Formal Functions of Metric Dissonance in Rock Music", year: 2014, doi: "10.30535/mto.20.2.1", in: "Music Theory Online 20(2)", note: "grouping and displacement dissonances by their formal function (shared/euclidean.js); the trunk's research-downloads/rhythm/" },
    "temperley-1999": { kind: "literature", authors: "D. Temperley", title: "Syncopation in rock: a perceptual perspective", year: 1999, doi: "10.1017/S0261143000008710", in: "Popular Music 18(1), 19-40", note: "a syncopation as a rotation (shared/euclidean.js)" },
    "longuet-higgins-lee-1984": { kind: "literature", authors: "H. C. Longuet-Higgins, C. S. Lee", title: "The Rhythmic Interpretation of Monophonic Music", year: 1984, doi: "10.2307/40285271", in: "Music Perception 1(4), 424-441", note: "metrical weights (shared/euclidean.js)" },
    "gillick-et-al-2019": { kind: "literature", authors: "J. Gillick, A. Roberts, J. Engel, D. Eck, D. Bamman", title: "Learning to Groove with Inverse Sequence Transformations", year: 2019, noDoi: "a conference paper without one: https://proceedings.mlr.press/v97/gillick19a.html", in: "Proceedings of the 36th International Conference on Machine Learning, PMLR 97", note: "the Groove MIDI Dataset v1.0.0 (CC BY 4.0), the feels' measured swing and offsets (shared/performance-timing.js MEASURED_TIMING, scripts/measure-drum-timing.mjs, measure-drum-groove.mjs)" },
    "van-noorden-1975": { kind: "literature", authors: "L. P. A. S. van Noorden", title: "Temporal coherence in the perception of tone sequences", year: 1975, noDoi: "a doctoral thesis without one (Technische Hogeschool Eindhoven): https://pure.tue.nl/ws/files/3389175/152538.pdf", note: "alternating and random sequences of 40-ms pure tones about 1 kHz at 35 dB SL: the fission boundary, below which the tones always hold together as one stream (about one semitone for tone repetition times of 0.1 to 0.4 s, Fig. 2.9; wider at shorter and longer ones), and the temporal coherence boundary, above which they never do, its interval rising with the gap between the end of a tone and the start of the tone after next (2T - D: Fig. 5.11, one curve for tone durations of 40 to 400 ms); between them either, as the listener attends. The measures of registry/perception/streaming.json.", saved: "research-downloads/perception/van-noorden-1975/van Noorden 1975 Temporal coherence in the perception of tone sequences.pdf" },
    "miller-heise-1950": { kind: "literature", authors: "G. A. Miller, G. A. Heise", title: "The Trill Threshold", year: 1950, doi: "10.1121/1.1906663", in: "The Journal of the Acoustical Society of America 22(5), 637-638", note: "two tones alternating ten times a second, each filling the time to the next: the interval past which a trill is heard as two separate tones, two streams (registry/perception/streaming.json trill-threshold)" },
    "davis-2006": { kind: "literature", authors: "S. Davis", title: "Implied Polyphony in the Solo String Works of J. S. Bach: A Case for the Perceptual Relevance of Structural Expression", year: 2006, doi: "10.1525/mp.2006.23.5.423", in: "Music Perception 23(5), 423-446", note: "a solo line's implied voices, a compound melody, heard as voices where its leaps and register keep them apart: the figure space's voices (public/shared/performers/figure-space.js)" },
    "sethares-1993": { kind: "literature", authors: "W. A. Sethares", title: "Local consonance and the relationship between timbre and scale", year: 1993, doi: "10.1121/1.408175", in: "The Journal of the Acoustical Society of America 94(3), 1218-1228", note: "the dissonance curve fitted to Plomp and Levelt's judgements of two pure tones, summed over partials for complex tones (registry/perception/roughness.json dissonance-curve)" },
    "plomp-levelt-1965": { kind: "literature", authors: "R. Plomp, W. J. M. Levelt", title: "Tonal Consonance and Critical Bandwidth", year: 1965, doi: "10.1121/1.1909741", in: "The Journal of the Acoustical Society of America 38(4), 548-560", note: "listeners' judgements of the consonance of two simultaneous pure tones by their frequency difference: the data Sethares's dissonance curve is fitted to (registry/perception/roughness.json)" },
    "london-2012": { kind: "literature", authors: "J. London", title: "Hearing in Time: Psychological Aspects of Musical Meter", year: 2012, doi: "10.1093/acprof:oso/9780199744374.001.0001", in: "Oxford University Press, 2nd ed.", note: "the limits of meter as heard: the shortest beat about 100 ms (registry/perception/timing.json beat-period-least), a measure within a few seconds" },
    "johnston-1988": { kind: "literature", authors: "J. D. Johnston", title: "Transform coding of audio signals using perceptual noise criteria", year: 1988, doi: "10.1109/49.608", in: "IEEE Journal on Selected Areas in Communications 6(2), 314-323", note: "a perceptual coder's masking threshold: the critical bands' edges (Table II) and the masking offsets by tonality (registry/perception/bands.json)" },
    "schroeder-atal-hall-1979": { kind: "literature", authors: "M. R. Schroeder, B. S. Atal, J. L. Hall", title: "Optimizing digital speech coders by exploiting masking properties of the human ear", year: 1979, doi: "10.1121/1.383662", in: "The Journal of the Acoustical Society of America 66(6), 1647-1652", note: "the spreading function of masking across critical bands (registry/perception/bands.json spreading-function)" },
    "zwicker-1961": { kind: "literature", authors: "E. Zwicker", title: "Subdivision of the Audible Frequency Range into Critical Bands (Frequenzgruppen)", year: 1961, doi: "10.1121/1.1908630", in: "The Journal of the Acoustical Society of America 33(2), 248", note: "the critical bands' edges, as Johnston 1988 tabulates them after Scharf 1970 (registry/perception/bands.json critical-band-edges)" },
    "zwicker-fastl-2007": { kind: "literature", authors: "H. Fastl, E. Zwicker", title: "Psychoacoustics: Facts and Models", year: 2007, doi: "10.1007/978-3-540-68888-4", in: "Springer, 3rd ed.", note: "specific loudness growing as excitation to about 0.23 (registry/perception/bands.json loudness-exponent)" },
    "cellofun-extensions": { kind: "vernacular", who: `cellofun.eu, a cellist's technique encyclopaedia: "Extensions On The Cello" and "Simple Extensions in the Neck Region"`, url: "https://cellofun.eu/?p=1661", accessed: "2026-11-06" },
    "gale-triangulation": { kind: "vernacular", who: `T. B. Gale, Triangulation of Fingering Systems for the Double Bass (A Complete Method), Vol. 1, its publisher's page: "Closed Hand (Simandl 1-2-4), Open Hand (extension fingering 1-2-3-4), and Thumb Positions"`, url: "https://www.sheetmusicplus.com/en/product/triangulation-of-fingering-systems-for-the-double-bass-a-complete-method-vol-1-22576307.html", accessed: "2026-11-06" },
    "visentin-2015": { kind: "literature", authors: "P. Visentin, S. Li, G. Tardif, G. Shan", title: "Unraveling mysteries of personal performance style; biomechanics of left-hand position changes (shifting) in violin performance", year: 2015, doi: "10.7717/peerj.1299", in: "PeerJ 3, e1299", saved: "research-downloads/strings/shifting/visentin-2015-peerj-1299.bioc.json (its PubMed Central text, PMC4636401, CC BY)" },
    "furneaux-1999": { kind: "literature", authors: "S. Furneaux, M. F. Land", title: "The effects of skill on the eye-hand span during musical sight-reading", year: 1999, doi: "10.1098/rspb.1999.0943", in: "Proceedings of the Royal Society of London B 266(1436), 2435-2440" },
    "gaillard-koehl-gazengel-2024": { kind: "literature", authors: "A. Gaillard, V. Koehl, B. Gazengel", title: "Theoretical and experimental studies about single cane reeds: a review", year: 2024, doi: "10.1051/aacus/2024050", in: "Acta Acustica 8, 63", licence: "CC BY 4.0", saved: "research-downloads/winds/saxophone-reed/aacus240040.pdf" },
    "ukshini-dirckx-2020": { kind: "literature", authors: "E. Ukshini, J. J. J. Dirckx", title: "Longitudinal and transversal elasticity of natural and artificial materials for musical instrument reeds", year: 2020, doi: "10.3390/ma13204566", in: "Materials 13(20), 4566", licence: "CC BY 4.0", saved: "research-downloads/materials/arundo-donax/ukshini-dirckx-2020-reed-elasticity.pdf" },
    "wood-handbook-2021": { kind: "literature", authors: "R. J. Ross (ed.), Forest Products Laboratory", title: "Wood handbook: wood as an engineering material", year: 2021, doi: "10.2737/FPL-GTR-282", in: "General Technical Report FPL-GTR-282, USDA Forest Service, Forest Products Laboratory, Madison, WI", licence: "public domain (a work of the United States government)", saved: "research-downloads/materials/wood-handbook/wood-handbook-2021-fpl-gtr-282.pdf" },
    "global-wood-density-database": { kind: "other", who: 'A. E. Zanne, G. Lopez-Gonzalez, D. A. Coomes, J. Ilic, S. Jansen, S. L. Lewis, R. B. Miller, N. G. Swenson, M. C. Wiemann, J. Chave, "Data from: Towards a worldwide wood economics spectrum", Dryad 2009 (Chave et al. 2009, Ecology Letters 12, 351-366, doi:10.1111/j.1461-0248.2009.01285.x): the Global Wood Density Database, 16,468 basic densities (oven-dry mass over green volume) of 8,412 taxa, each with its region and reference', url: "https://doi.org/10.5061/dryad.234", licence: "CC0 1.0 (Dryad's for every deposit)", saved: "research-downloads/materials/global-wood-density/archive", note: "the copy fetched is the Encyclopedia of Life's on Zenodo (record 13322441), the same records as a Darwin Core archive: Dryad's own refused the download (403)" },
    "concast-c26000": { kind: "vernacular", who: "Concast Metal Products, C26000 cartridge brass (70/30): its data sheet, the Copper Development Association's values", url: "https://www.concast.com/files/C26000.pdf", accessed: "2026-11-07", saved: "research-downloads/materials/metals/concast-c26000-cartridge-brass.pdf" },
    "concast-c23000": { kind: "vernacular", who: "Concast Metal Products, C23000 red brass (85/15, instrument makers' gold brass): its data sheet, the Copper Development Association's values", url: "https://www.concast.com/files/C23000.pdf", accessed: "2026-11-07", saved: "research-downloads/materials/metals/concast-c23000-red-brass.pdf" }
  }
};

// registry/physics/constants.json
var constants_default = {
  schema: "musebots.registry-constants/1",
  about: "The physical constants and units the physics is computed with, each with its source (registry/README.md).",
  constants: {
    a4: { value: 440, unit: "Hz", kind: "literature", source: "iso-16-1975", note: "the standard tuning frequency, A above middle C: MIDI 69" },
    "t60-db": { value: 60, unit: "dB", kind: "literature", source: "iso-3382-1-2009", note: "a reverberation time's fall: the time a sound takes to decay by 60 dB" },
    milli: { value: 1e3, unit: "1", kind: "literature", source: "nist-sp811-2008", note: "SI's milli: thousandths in one (ms in a second)" },
    "pound-force": { value: 4.4482216152605, unit: "N/lbf", kind: "literature", source: "nist-sp811-2008", note: "one pound-force in newtons, exactly" },
    "steel-density": { value: 7850, range: [7600, 8e3], unit: "kg/m^3", kind: "vernacular", source: "physics-factbook-steel", note: "the handbooks' steels span the range; 7850 the value engineers take (490 lb/ft^3). A wound string's stiffness enters the models only as E d^4, so its d is taken as the steel cylinder of its density and E what gives its measured stiffness" },
    "arundo-donax-density": { value: 500, range: [450, 520], unit: "kg/m^3", kind: "literature", source: "gaillard-koehl-gazengel-2024", at: "Table A2", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "clarinet reeds' cane: 450 (Facchinetti, Boutillon & Constantinescu 2003; Pinard, Laine & Vach 2003), 520 (Guimezanes 2008; Taillard et al. 2014), 500 (Chatziioannou 2010; the review gives Ukshini & Dirckx 2020 too, who do not state it)" },
    "arundo-donax-longitudinal-modulus": { value: 5e9, range: [3e9, 14e9], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "dry, along the fibres, 1 mm specimens: 5.0 (±0.7) GPa; 1.5 mm: 3.0 (±0.2). The range the others' (Gaillard, Koehl & Gazengel 2024, Table A2): 3 to 9.5 along a reed from heel to tip (Guimezanes 2008, Table A3), 10 (Facchinetti 2003; Chatziioannou 2010), 14 (Taillard et al. 2014). Its tissues by indentation: the fibres' sheaths about 7 GPa, the parenchyma 2 to 3, the vascular bundles 1.5 to 2 (Kawasaki et al. 2017, doi:10.1002/jemt.22889)" },
    "arundo-donax-longitudinal-modulus-wet": { value: 31e8, range: [21e8, 31e8], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "soaked 15 minutes, as a reed is played: 1 mm specimens 3.1 (±0.4) GPa, 1.5 mm 2.1 (±0.3)" },
    "arundo-donax-transverse-modulus": { value: 5e8, range: [2e8, 5e8], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "dry, across the fibres: 1 mm 0.5 (±0.03) GPa, 1.5 mm 0.4 (±0.06); 0.2 to 0.5 along a reed (Guimezanes 2008), 0.4 (Facchinetti 2003; Chatziioannou 2010) (Gaillard, Koehl & Gazengel 2024, Table A2). Ten times softer than along them" },
    "arundo-donax-transverse-modulus-wet": { value: 1e8, range: [1e8, 2e8], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "soaked: 1 mm 0.1 (±0.05) GPa, 1.5 mm 0.2 (±0.02); 24 times softer than along the fibres" },
    "arundo-donax-shear-modulus": { value: 13e8, range: [6e8, 13e8], unit: "Pa", kind: "literature", source: "gaillard-koehl-gazengel-2024", at: "Table A2", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "G_xz, along the fibres and through the thickness: 1.3 GPa (Facchinetti 2003; Chatziioannou 2010), 0.6 to 0.87 along a reed (Guimezanes 2008), 1.1 (Taillard et al. 2014)" },
    "arundo-donax-poisson": { value: 0.22, unit: "1", kind: "literature", source: "gaillard-koehl-gazengel-2024", at: "Table A2", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "nu_x (Facchinetti 2003; Guimezanes 2008; Chatziioannou 2010); nu_y 0.08 (Chatziioannou 2010)" },
    "arundo-donax-hysteresis-wet": { value: 0.157, range: [0.119, 0.191], unit: "1", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 3", material: "Arundo donax L. (giant cane): the single reeds of clarinets and saxophones and the double reeds of oboes, English horns and bassoons", note: "the share of the work of a slow bend lost as it is let go, soaked, along the fibres, 1 mm specimens (11.9, 16.1, 19.1 %); 1.5 mm 14.2 to 32.8 %, across the fibres 28.1 to 41.2 %: a quasi-static loss, not the reed's damping at its resonance" },
    "legere-longitudinal-modulus": { value: 75e8, range: [59e8, 75e8], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Légère (polypropylene fibres in polypropylene): the synthetic single reed", note: "1 mm specimens 7.5 (±0.3) GPa, 1.5 mm 5.9 (±0.2): half again cane's, and unchanged by water" },
    "legere-transverse-modulus": { value: 19e8, range: [18e8, 19e8], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Légère (polypropylene fibres in polypropylene): the synthetic single reed", note: "1 mm 1.9 (±0.1) GPa, 1.5 mm 1.8 (±0.01): four times softer than along its fibres, where cane is ten" },
    "legere-density": { value: 910, unit: "kg/m^3", kind: "literature", source: "ukshini-dirckx-2020", at: "4.2", material: "Légère (polypropylene fibres in polypropylene): the synthetic single reed", note: "isotropic polypropylene's, about 0.91 g/mL, as Légère's patent gives it (cited, not measured)" },
    "fiberreed-longitudinal-modulus": { value: 189e8, range: [154e8, 189e8], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Carbon Fiberreed (carbon fibres in a matrix): a synthetic single reed", note: "1 mm 18.9 (±6.4) GPa, 1.5 mm 15.4 (±1.1)" },
    "fiberreed-transverse-modulus": { value: 53e8, range: [43e8, 53e8], unit: "Pa", kind: "literature", source: "ukshini-dirckx-2020", at: "Table 2; Table 4", material: "Carbon Fiberreed (carbon fibres in a matrix): a synthetic single reed", note: "1 mm 5.3 (±0.3) GPa, 1.5 mm 4.3 (±0.3)" },
    "dalbergia-melanoxylon-gravity": { value: 1.08, range: [0.9, 1.2], unit: "1", kind: "other", source: "global-wood-density-database", material: "Dalbergia melanoxylon Guill. & Perr. (African blackwood, grenadilla, mpingo): the bodies of clarinets, oboes, English horns and piccolos", note: "basic specific gravity: oven-dry mass over green volume, over water's density; its five records, tropical Africa (the database's references 58, 147, 192, 192, 200): 1.08, 1.13, 0.90, 1.20, 1.076; the median taken. Its hygromechanical constants measured by Alkadri et al. 2020 (doi:10.1007/s00226-020-01215-z), not yet fetched" },
    "acer-pseudoplatanus-gravity": { value: 0.51, range: [0.508, 0.51], unit: "1", kind: "other", source: "global-wood-density-database", material: "Acer pseudoplatanus L. (sycamore maple, mountain maple): bassoons' and contrabassoons' bodies; the violin family's backs, ribs and necks", note: "basic specific gravity: oven-dry mass over green volume, over water's density; Europe (references 28, 60)" },
    "acer-platanoides-gravity": { value: 0.51, range: [0.508, 0.525], unit: "1", kind: "other", source: "global-wood-density-database", material: "Acer platanoides L. (Norway maple): the violin family's backs and ribs, bassoons' bodies", note: "basic specific gravity: oven-dry mass over green volume, over water's density; Europe (references 158, 28)" },
    "picea-abies-gravity": { value: 0.37, unit: "1", kind: "other", source: "global-wood-density-database", material: "Picea abies (L.) H. Karst. (Norway spruce, European spruce): the violin family's tops", note: "basic specific gravity: oven-dry mass over green volume, over water's density; Europe (reference 28)" },
    "paubrasilia-echinata-gravity": { value: 0.89, range: [0.86, 0.92], unit: "1", kind: "other", source: "global-wood-density-database", material: "Paubrasilia echinata (Lam.) Gagnon, H.C.Lima & G.P.Lewis (pernambuco, Caesalpinia echinata in the database): the violin family's bows", note: "basic specific gravity: oven-dry mass over green volume, over water's density; tropical South America (references 35, 44)" },
    "diospyros-crassiflora-gravity": { value: 0.83, range: [0.775, 0.99], unit: "1", kind: "other", source: "global-wood-density-database", material: "Diospyros crassiflora Hiern (African ebony): the violin family's fingerboards, pegs and tailpieces", note: "basic specific gravity: oven-dry mass over green volume, over water's density; tropical Africa (references 136, 1, 137, 99, 40): 0.80, 0.99, 0.826, 0.90, 0.775, the median taken" },
    "acer-saccharum-modulus": { value: 126e8, unit: "Pa", kind: "literature", source: "wood-handbook-2021", at: "Table 5-3a", material: "Acer saccharum Marshall (sugar maple, hard maple)", note: "its modulus in static bending at 12 % moisture, specific gravity 0.63 at 12 % (green: 10.7 GPa at 0.56); along the grain about 10 % above it (Table 5-1, note). Its elastic ratios at 12 %: E_T/E_L 0.065, E_R/E_L 0.132, G_LR/E_L 0.111, G_LT/E_L 0.063 (Table 5-1); its Poisson's ratios mu_LR 0.424, mu_LT 0.476, mu_RT 0.774, mu_TR 0.349 (Table 5-2)" },
    "picea-sitchensis-modulus": { value: 108e8, unit: "Pa", kind: "literature", source: "wood-handbook-2021", at: "Table 5-3a", material: "Picea sitchensis (Bong.) Carr. (Sitka spruce): soundboards and the tops of instruments made in America", note: "its modulus in static bending at 12 % moisture, specific gravity 0.40 at 12 % (green: 8.5 GPa at 0.37); red spruce (Picea rubens) 11.4 GPa at 0.40. Its elastic ratios at 12 %: E_T/E_L 0.043, E_R/E_L 0.078, G_LR/E_L 0.064, G_LT/E_L 0.061, G_RT/E_L 0.003 (Table 5-1)" },
    "wood-modulus-green-softwood-coefficient": { value: 161e8, unit: "Pa", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "a in E = a G^b, green softwoods (16,100 MPa)" },
    "wood-modulus-green-softwood-exponent": { value: 0.76, unit: "1", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "b in E = a G^b, green softwoods" },
    "wood-modulus-green-hardwood-coefficient": { value: 139e8, unit: "Pa", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "a in E = a G^b, green hardwoods (13,900 MPa)" },
    "wood-modulus-green-hardwood-exponent": { value: 0.72, unit: "1", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "b in E = a G^b, green hardwoods" },
    "wood-modulus-dry-softwood-coefficient": { value: 203e8, unit: "Pa", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "a in E = a G^b, softwoods at 12 % moisture (20,300 MPa); G their gravity at 12 %. Sitka spruce at 0.40 gives 9.5 GPa, measured 10.8" },
    "wood-modulus-dry-softwood-exponent": { value: 0.83, unit: "1", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "b in E = a G^b, softwoods at 12 % moisture" },
    "wood-modulus-dry-hardwood-coefficient": { value: 165e8, unit: "Pa", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "a in E = a G^b, hardwoods at 12 % moisture (16,500 MPa); G their gravity at 12 %. Sugar maple at 0.63 gives 11.9 GPa, measured 12.6" },
    "wood-modulus-dry-hardwood-exponent": { value: 0.7, unit: "1", kind: "literature", source: "wood-handbook-2021", at: "Table 5-11a", note: "b in E = a G^b, hardwoods at 12 % moisture" },
    "cartridge-brass-density": { value: 8530, unit: "kg/m^3", kind: "vernacular", source: "concast-c26000", material: "C26000 cartridge brass, 70 % copper and 30 % zinc (yellow brass): the saxophones' and most brass instruments' bodies and bells", note: "at 20 °C" },
    "cartridge-brass-modulus": { value: 110317e6, unit: "Pa", kind: "vernacular", source: "concast-c26000", material: "C26000 cartridge brass, 70 % copper and 30 % zinc (yellow brass)", note: "in tension, 16,000 ksi" },
    "gold-brass-density": { value: 8670, unit: "kg/m^3", kind: "vernacular", source: "concast-c23000", material: "C23000 red brass, 85 % copper and 15 % zinc (instrument makers' gold brass): bells and leadpipes", note: "at 20 °C" },
    "gold-brass-modulus": { value: 110317e6, unit: "Pa", kind: "vernacular", source: "concast-c23000", material: "C23000 red brass, 85 % copper and 15 % zinc (gold brass)", note: "in tension, 16,000 ksi" }
  }
};

// registry/physics/equations.json
var equations_default = {
  schema: "musebots.registry-equations/1",
  about: "Every equation a registry value is derived or passed down by (registry/README.md): its formula, its inputs and output with their units, its source, and checks -- inputs and the value they give -- that both implementations (registry/equations.js, registry/equations.py) are tested on. A statistic over measurements (a median, a mean) is an equation too, its choice ours and said so.",
  equations: {
    "midi-hz": { formula: "f = a4 2^((midi - 69) / 12)", inputs: { midi: "MIDI note (semitones, fractional allowed)", a4: "Hz" }, unit: "Hz", source: "iso-16-1975", checks: [{ inputs: { midi: 69, a4: 440 }, value: 440 }, { inputs: { midi: 28, a4: 440 }, value: 41.20344461410875 }] },
    "pounds-newtons": { formula: "T = pounds pound-force", inputs: { pounds: "lbf", poundForce: "N/lbf" }, unit: "N", source: "nist-sp811-2008", checks: [{ inputs: { pounds: 70, poundForce: 4.4482216152605 }, value: 311.37551306823497 }] },
    "string-density": { formula: "mu = T / (2 L f0)^2 (Mersenne: f0 = sqrt(T / mu) / 2L)", inputs: { T: "N", L: "m", f0: "Hz" }, unit: "kg/m", source: "fletcher-rossing-1998", checks: [{ inputs: { T: 311.37551306823497, L: 1.06, f0: 41.20344461410875 }, value: 0.04080803518983858 }] },
    "string-impedance": { formula: "Z0 = sqrt(T mu)", inputs: { T: "N", mu: "kg/m" }, unit: "kg/s", source: "fletcher-rossing-1998", checks: [{ inputs: { T: 100, mu: 0.01 }, value: 1 }] },
    "inharmonicity-at-open": { formula: "B = median(takes) / 2^(2 stopped / 12): a stopped note's B read at the open string's length (B goes as 1/L^2)", inputs: { takes: "B of each take, at the note played", stopped: "semitones above the open string the takes were played at" }, unit: "1", source: "fletcher-1964", statistic: "the median of the takes: ours", checks: [{ inputs: { takes: [572e-7, 955e-7], stopped: 0 }, value: 7635e-8 }, { inputs: { takes: [208e-6, 207e-6], stopped: 1 }, value: 1848614840141204e-19 }] },
    "stiffness-from-inharmonicity": { formula: "EI = B T L^2 / pi^2 (B = pi^2 EI / (T L^2))", inputs: { B: "1", T: "N", L: "m" }, unit: "N m^2", source: "fletcher-1964", checks: [{ inputs: { B: 1e-4, T: 300, L: 1 }, value: 0.0030396355092701336 }] },
    "cylinder-diameter": { formula: "d = sqrt(4 mu / (pi rho))", inputs: { mu: "kg/m", rho: "kg/m^3" }, unit: "m", source: "fletcher-rossing-1998", checks: [{ inputs: { mu: 0.04080803518983858, rho: 7850 }, value: 0.002572723262777005 }] },
    "young-from-stiffness": { formula: "E = 64 EI / (pi d^4)", inputs: { EI: "N m^2", d: "m" }, unit: "Pa", source: "fletcher-rossing-1998", checks: [{ inputs: { EI: 1e-3, d: 1e-3 }, value: 203718327157626e-4 }] },
    mean: { formula: "the mean of its values", inputs: { values: "a list" }, unit: "as its values", source: null, statistic: "ours: each take weighed alike", checks: [{ inputs: { values: [1.42, 0.479] }, value: 0.9495 }] },
    same: { formula: "x = value: a value taken as another's", inputs: { value: "as the value" }, unit: "as its value", source: null, statistic: "an identity", checks: [{ inputs: { value: 1.06 }, value: 1.06 }] },
    "mersenne-f0": { formula: "f0 = sqrt(T / mu) / 2L", inputs: { T: "N", mu: "kg/m", L: "m" }, unit: "Hz", source: "fletcher-rossing-1998", checks: [{ inputs: { T: 31.5, mu: 195e-5, L: 0.325 }, value: 195.53504901607462 }] },
    "cylinder-stiffness": { formula: "EI = E pi d^4 / 64", inputs: { E: "Pa", d: "m" }, unit: "N m^2", source: "fletcher-rossing-1998", checks: [{ inputs: { E: 2e9, d: 97e-5 }, value: 8691341838037078e-20 }] },
    "inharmonicity-of-stiffness": { formula: "B = pi^2 EI / (T L^2)", inputs: { EI: "N m^2", T: "N", L: "m" }, unit: "1", source: "fletcher-1964", checks: [{ inputs: { EI: 8691341838037078e-20, T: 31.5, L: 0.325 }, value: 2578156645997943e-19 }] },
    "elliptic-aperture-conductance": { formula: "C = 1 / (1 / (2 a AGM(1, b/a)) + t / (pi a b)): an elliptic aperture's conductance in a thin wall, semi-axes a over b (Rayleigh's pi a / K(e), K the complete elliptic integral of the first kind, pi / (2 AGM(1, b/a))), a wall of thickness t in series", inputs: { a: "m (or any length, alike)", b: "as a", t: "as a" }, unit: "as a", source: "rayleigh-1896", checks: [{ inputs: { a: 5, b: 5, t: 0 }, value: 10 }, { inputs: { a: 37.5, b: 3.25, t: 3 }, value: 24.747881684832045 }] },
    "f-holes-conductance": { formula: "K = 2 C(fLength / 2, fWidth / 2, fThickness): a body's two f-holes, each an elliptic aperture its length by its least width through the top about it", inputs: { fLength: "mm", fWidth: "mm", fThickness: "mm" }, unit: "mm", source: "nia-2015", checks: [{ inputs: { fLength: 75, fWidth: 6.5, fThickness: 3 }, value: 49.49576336966409 }] },
    "body-air-volume": { formula: "V = body (upper + middle + lower) / 3 (ribs + (archTop + archBack) / 2): the outline, its length by its three widths' mean, over the ribs' height and half of each arching, a dome's", inputs: { body: "mm", upper: "mm", middle: "mm", lower: "mm", ribs: "mm", archTop: "mm", archBack: "mm" }, unit: "mm^3", source: null, statistic: "ours: a body's shape as a box with domes, its walls, f-holes' wings and outline's shape left out alike", checks: [{ inputs: { body: 356, upper: 168, middle: 112, lower: 208, ribs: 30.75, archTop: 16, archBack: 15 }, value: 2678306666666667e-9 }] },
    "fingerboard-end-semitones": { formula: "12 log2(string / (string - fingerboard)): where the string meets the fingerboard's end, in semitones over the open string", inputs: { string: "mm", fingerboard: "mm" }, unit: "semitones", source: "fletcher-rossing-1998", checks: [{ inputs: { string: 328, fingerboard: 270 }, value: 29.99485211388614 }] },
    "helmholtz-ratio": { formula: "sqrt((K / V) / (K0 / V0)): a Helmholtz resonator's frequency over another's (f = c / 2pi sqrt(K / V)), each its conductance over its volume", inputs: { K: "conductance", V: "volume, in the conductance's length cubed", K0: "the other's conductance", V0: "the other's volume" }, unit: "1", source: "rayleigh-1896", checks: [{ inputs: { K: 4, V: 1, K0: 1, V0: 1 }, value: 2 }] },
    least: { formula: "the least of its values", inputs: { values: "a list" }, unit: "as its values", source: null, statistic: "an identity", checks: [{ inputs: { values: [3, 1, 2] }, value: 1 }] },
    ratio: { formula: "a / b", inputs: { a: "any", b: "as a" }, unit: "1", source: null, statistic: "an identity", checks: [{ inputs: { a: 102, b: 51 }, value: 2 }] },
    "lowest-hz": { formula: "f = a4 2^((min(tuning) - 69) / 12): an instrument's lowest open string's frequency", inputs: { tuning: "its open strings, MIDI", a4: "Hz" }, unit: "Hz", source: "iso-16-1975", checks: [{ inputs: { tuning: [43, 28, 33, 38], a4: 440 }, value: 41.20344461410875 }] },
    "loss-table": { formula: "each of a measured string's modes, its frequency n f0 sqrt(1 + B n^2) with its stiffness (B = pi^3 E d^4 / (64 T L^2)) and its measured decay, its first `modes` of them: a string's losses by frequency, read between their points", inputs: { decays: "1/s, each mode's", modes: "how many of them stand", f0: "Hz", E: "Pa", d: "m", T: "N", L: "m" }, unit: "[Hz, 1/s] pairs", source: "fletcher-1964", checks: [{ inputs: { decays: [0.5, 1, 2], modes: 2, f0: 100, E: 2e9, d: 1e-3, T: 50, L: 0.33 }, value: [[100.00889718130146, 0.5], [200.07116795461067, 1]] }] },
    "table-read": { formula: "y at x in a table of [x, y] points: its first y below its first point, read in a line between the points about x, and past its last two by their line", inputs: { table: "[x, y] pairs, x rising", x: "as the table's x" }, unit: "as the table's y", source: null, statistic: "ours: linear between measured points", checks: [{ inputs: { table: [[100, 1], [200, 3], [400, 4]], x: 50 }, value: 1 }, { inputs: { table: [[100, 1], [200, 3], [400, 4]], x: 150 }, value: 2 }, { inputs: { table: [[100, 1], [200, 3], [400, 4]], x: 500 }, value: 4.5 }] },
    "string-loss-law": { formula: "r = r0 + r2 f^2: a string's mode's decay at its frequency", inputs: { r0: "1/s", r2: "s", f: "Hz" }, unit: "1/s", source: null, checks: [{ inputs: { r0: 1, r2: 1e-6, f: 100 }, value: 1.01 }], statistic: "ours: the form our fits gave the contrabass's losses (native/strings-model/string_tail.py --plucked)" },
    "scale-ratio": { formula: "a / a0: a quantity over the reference's", inputs: { a: "any", a0: "as a" }, unit: "1", source: null, statistic: "an identity", checks: [{ inputs: { a: 1.6, a0: 1 }, value: 1.6 }] },
    "least-force-scale": { formula: "scale Z[0]^2 / mean(c0^2, c1^2, c2^2): a bow's force scale passed from another instrument's by Schelleng's least force, which grows as a string's wave impedance squared -- its lowest string's against the reference's lowest strings', each of its versions", inputs: { scale: "the reference's force scale", Z: "its strings' impedances, lowest first, kg/s", c0: "the reference's lowest string's impedance, its version 0", c1: "its version 1", c2: "its version 2" }, unit: "1", source: "schelleng-1973", checks: [{ inputs: { scale: 1.6, Z: [3.565, 2.632], c0: 1.85, c1: 1.66, c2: 1.39 }, value: 7.52192054449952 }] },
    "periods-in": { formula: "n = seconds hz: how many periods of a frequency fit in a time", inputs: { seconds: "s", hz: "Hz" }, unit: "periods", source: null, statistic: "an identity", checks: [{ inputs: { seconds: 0.6, hz: 196 }, value: 117.6 }] },
    "seconds-for": { formula: "t = max(least, periods / hz): a note's time to hold so many periods of its frequency, never under the least", inputs: { periods: "periods", hz: "Hz", least: "s" }, unit: "s", source: null, statistic: "an identity", checks: [{ inputs: { periods: 117.6, hz: 41.2, least: 0.6 }, value: 2.8543689320388346 }, { inputs: { periods: 117.6, hz: 440, least: 0.6 }, value: 0.6 }] },
    "finger-place": { formula: "x = 1 - 2^(-semitones / 12): the share of a string from its nut a finger stops to sound so many semitones over its open pitch (an ideal string's frequency goes as one over its sounding length)", inputs: { semitones: "semitones over the open string" }, unit: "share of the string", source: "fletcher-rossing-1998", checks: [{ inputs: { semitones: 7 }, value: 0.3325800729149828 }, { inputs: { semitones: 12 }, value: 0.5 }] },
    "log-grid": { formula: "x_k = least span^(k / (count - 1)), k = 0 .. count - 1: so many values evenly spaced in their logarithm from the least to the least times the span", inputs: { least: "as its values", span: "1", count: "values" }, unit: "as least", source: null, statistic: "an identity", checks: [{ inputs: { least: 0.05, span: 250, count: 4 }, value: [0.05, 0.3149802624737183, 1.984251314960249, 12.5] }] },
    "semitones-ratio": { formula: "r = 2^(semitones / 12): the frequency ratio of an interval in equal-tempered semitones (fractional allowed)", inputs: { semitones: "semitones" }, unit: "1", source: null, statistic: "a definition (twelve equal semitones to the octave)", checks: [{ inputs: { semitones: 7 }, value: 1.4983070768766815 }, { inputs: { semitones: 12 }, value: 2 }] },
    "ratio-semitones": { formula: "s = 12 log2(r): an interval's size in equal-tempered semitones from its frequency ratio", inputs: { ratio: "1" }, unit: "semitones", source: null, statistic: "a definition", checks: [{ inputs: { ratio: 1.5 }, value: 7.019550008653875 }, { inputs: { ratio: 2 }, value: 12 }] },
    "place-semitones": { formula: "s = -12 log2(1 - place): the semitones over its open pitch a finger sounds at this share of an ideal string from its nut (finger-place's inverse)", inputs: { place: "share of the string" }, unit: "semitones", source: "fletcher-rossing-1998", checks: [{ inputs: { place: 0.25 }, value: 4.980449991346125 }, { inputs: { place: 0.5 }, value: 12 }] },
    "cents-semitones": { formula: "s = cents / 100: cents as semitones", inputs: { cents: "cents" }, unit: "semitones", source: null, statistic: "a definition (a hundred cents to the equal-tempered semitone)", checks: [{ inputs: { cents: 50 }, value: 0.5 }] },
    "from-centi": { formula: "x = centi / 100: a quantity given in hundredths of its unit (cm, cm/s) in its unit", inputs: { centi: "hundredths of the unit" }, unit: "the unit", source: null, statistic: "a definition (SI's centi)", checks: [{ inputs: { centi: 250 }, value: 2.5 }] },
    "db-gain": { formula: "g = 10^(db / 20): an amplitude's ratio from its level's change in decibels", inputs: { db: "dB" }, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: { db: 6 }, value: 1.9952623149688795 }, { inputs: { db: 20 }, value: 10 }] },
    "loss-ratio-for": { formula: "k = ln(10^(db / 20)) / (rate seconds): how many times its own loss rate (1/s) brings a decaying amplitude down db decibels in seconds", inputs: { db: "dB", rate: "1/s, its own", seconds: "s" }, unit: "1", source: null, statistic: "an identity (an exponential decay)", checks: [{ inputs: { db: 60, rate: 2, seconds: 0.5 }, value: 6.907755278982137 }] },
    "helmholtz-force-scale": { formula: "x = F beta / (2 Z v): a bow's force against the string's Helmholtz force at its contact and speed -- Schelleng's scale of bow force", inputs: { force: "N", contact: "share of the string from the bridge", Z: "kg/s, the string's characteristic impedance", speed: "m/s" }, unit: "1", source: "schelleng-1973", checks: [{ inputs: { force: 1, contact: 0.1, Z: 0.5, speed: 0.2 }, value: 0.5 }] },
    "amplitude-db": { formula: "L = 20 log10(ratio): a ratio of amplitudes in decibels", inputs: { ratio: "1, of amplitudes" }, unit: "dB", source: null, statistic: "a definition", checks: [{ inputs: { ratio: 10 }, value: 20 }, { inputs: { ratio: 2 }, value: 6.020599913279624 }] },
    "likelihood-residual": { formula: "r = sqrt(max(0, -2 log p)): a probability's residual in a least-squares cost r^2 / 2, which is then its negative log-likelihood", inputs: { logp: "the probability's natural logarithm" }, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: { logp: -2 }, value: 2 }, { inputs: { logp: 0 }, value: 0 }, { inputs: { logp: 1e-17 }, value: 0 }] },
    "power-db": { formula: "L = 10 log10(ratio): a ratio of powers in decibels", inputs: { ratio: "1, of powers" }, unit: "dB", source: null, statistic: "a definition", checks: [{ inputs: { ratio: 100 }, value: 20 }, { inputs: { ratio: 2 }, value: 3.010299956639812 }] },
    "helmholtz-rise": { formula: "x = 2 Z v t / (beta T): the bridge force's rise under Helmholtz motion over a time t, its sawtooth climbing 2 Z v / beta each period T and falling as much at the flyback (t = T: the flyback's drop)", inputs: { Z: "kg/s, the string's characteristic impedance", speed: "m/s, the bow's", beta: "share of the string from the bridge", period: "s", t: "s" }, unit: "N", source: "galluzzo-2004", checks: [{ inputs: { Z: 1.09, speed: 0.1, beta: 0.1, period: 0.01, t: 0.01 }, value: 2.18 }, { inputs: { Z: 0.5, speed: 1, beta: 0.2, period: 4e-3, t: 1e-3 }, value: 1.25 }] },
    "semitones-octaves": { formula: "o = s / 12: an interval's octaves from its semitones", inputs: { semitones: "semitones" }, unit: "octaves", source: null, statistic: "a definition (the semitone a twelfth of an octave)", checks: [{ inputs: { semitones: 12 }, value: 1 }, { inputs: { semitones: 5.13 }, value: 0.4275 }] },
    "golden-section": { formula: "g = (sqrt(5) - 1) / 2: the golden ratio's inverse, the share of its interval a golden-section search keeps each step", inputs: {}, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: {}, value: 0.6180339887498949 }] },
    "parabola-peak": { formula: "d = (a - c) / (2 (a - 2 b + c)) where a - 2 b + c < 0, else 0: the peak of the parabola through three equally spaced values a, b, c, as its offset from the middle one in spacings (none where it does not peak)", inputs: { left: "1", middle: "1", right: "1" }, unit: "spacings", source: null, statistic: "an identity (a parabola's vertex)", checks: [{ inputs: { left: 0.5, middle: 1, right: 0.7 }, value: 0.12499999999999997 }, { inputs: { left: 1, middle: 0, right: 1 }, value: 0 }] },
    sawtooth: { formula: "x = 2 frac(f0 t) - 1: a sawtooth rising from -1 to 1 each period, falling back at once", inputs: { t: "s", f0: "Hz" }, unit: "1", source: null, statistic: "a definition", checks: [{ inputs: { t: 0.3, f0: 1 }, value: -0.4 }, { inputs: { t: 1.7, f0: 3 }, value: -0.8000000000000007 }] },
    "cents-ratio": { formula: "r = 2^(cents / 1200): the frequency ratio of an interval in cents", inputs: { cents: "cents" }, unit: "1", source: null, statistic: "a definition (twelve hundred cents to the octave)", checks: [{ inputs: { cents: 1200 }, value: 2 }, { inputs: { cents: -20 }, value: 0.9885140203528962 }] },
    "normal-deviate": { formula: "z = sqrt(-2 ln max(u, 1e-12)) cos(2 pi v): a standard normal deviate from two uniform ones in [0, 1) (u floored, so a draw of 0 gives a finite deviate)", inputs: { u: "1", v: "1" }, unit: "1", source: "box-muller-1958", statistic: "a transformation (Box & Muller)", checks: [{ inputs: { u: 0.5, v: 0 }, value: 1.1774100225154747 }, { inputs: { u: 0, v: 0.5 }, value: -7.4338443776996765 }] },
    "hz-midi": { formula: "midi = 69 + 12 log2(f / a4): a frequency as a MIDI note, midi-hz's inverse", inputs: { hz: "Hz", a4: "Hz" }, unit: "MIDI note (semitones, fractional)", source: "iso-16-1975", checks: [{ inputs: { hz: 440, a4: 440 }, value: 69 }, { inputs: { hz: 41.20344461410875, a4: 440 }, value: 28 }] },
    difference: { formula: "a - b: a quantity less another", inputs: { a: "any", b: "as a" }, unit: "as a", source: null, statistic: "an identity", checks: [{ inputs: { a: 1.537, b: 0.305 }, value: 1.232 }] },
    scaled: { formula: "x a / b: a quantity scaled by a ratio", inputs: { x: "any", a: "any", b: "as a" }, unit: "as x", source: null, statistic: "an identity", checks: [{ inputs: { x: 0.12, a: 1064, b: 419 }, value: 0.30472553699284 }] },
    "loss-per-frequency": { formula: "r2 = r1 (2 pi)^2 mu / T: a string's loss per squared wavenumber (its damping term 2 r1 rho A u_txx, m^2/s) as a loss per squared frequency, its modes at k = 2 pi f / c, c^2 = T / mu", inputs: { r1: "m^2/s", T: "N", mu: "kg/m" }, unit: "s", source: "matusiak-chatziioannou-2024", at: "Eq. (1)", checks: [{ inputs: { r1: 87e-4, T: 149.6, mu: 794e-5 }, value: 18229212107445202e-21 }] },
    "friction-drop-scale": { formula: "k = (s0 - d0) / (s1 - d1): a bow's force measured under one friction (static s0, dynamic d0) moved to another (s1, d1) -- both of Schelleng's bounds on the force, the most and the least, go as one over the drop from static to dynamic friction, so the force keeps its place between them", inputs: { s0: "the static coefficient it was measured under", d0: "its dynamic", s1: "the static coefficient it meets", d1: "its dynamic" }, unit: "1", source: "schelleng-1973", checks: [{ inputs: { s0: 0.654, d0: 0.301, s1: 1.4, d1: 0.5 }, value: 0.39222222222222 }] },
    "power-law": { formula: "y = a x^b", inputs: { a: "as y", x: "1", b: "1" }, unit: "as a", source: null, statistic: "a power law: the Wood Handbook's modulus from specific gravity (Table 5-11a) is one", checks: [{ inputs: { a: 139e8, x: 1.08, b: 0.72 }, value: 14691965647165176e-6 }, { inputs: { a: 165e8, x: 0.63, b: 0.7 }, value: 11940494937878204e-6 }] }
  }
};

// registry/modules.json
var modules_default = {
  schema: "musebots.registry-modules/1",
  about: "The modules whose values are the registry's (registry/README.md): an owned module holds no number about an instrument, a player, the physics or a method -- the registry's test reads it -- and a pending one is still to move, listed in REGISTRY.md.",
  owned: ["public/shared/performers/contrabass.js", "public/shared/performers/string-bodies.js", "public/shared/performers/bowed-instruments.js", "public/shared/performers/physical-strings.js", "public/shared/performers/sound-power.js", "native/strings-model/engine.mjs", "public/shared/performers/bowed-line.js", "public/shared/performers/bow.js", "native/strings-model/attack_transient.py", "native/strings-model/probe.py", "native/strings-model/schelleng.py", "native/strings-model/noise_profile.py", "native/strings-model/regions.py", "native/strings-model/neutral.py", "native/strings-model/fit_bowing.py", "native/strings-model/fit_player.py", "native/strings-model/fit_loop.py", "native/strings-model/fit_onsets.py", "public/shared/float-wav.js", "public/bots/lib/modules/section-seat.js", "public/shared/performers/string-section.js", "public/shared/performers/personality.js", "public/shared/performers/turbulence.js", "public/shared/performers/melody-rules.js", "public/shared/performers/streams.js", "public/shared/performers/figure-space.js"],
  pending: ["public/shared/performers/vibrato.js", "public/shared/performers/instrument-ranges.js"]
};

// registry/objects/bowed.json
var bowed_default = {
  schema: "musebots.registry-objects/1",
  about: "The bowed string instruments as a tree of types (registry/README.md): what is true of every bowed string at the top -- each string's pitch, density, impedance and stiffness from what was measured of it, by the physics' equations -- and below, each instrument's own. A value a node does not give is its parent's; `strings.*` a rule for each of a node's strings, read with that string's own values.",
  nodes: {
    instrument: {
      is: null,
      abstract: true,
      about: "Any instrument a player plays: the root of the tree, what every family shares."
    },
    "bowed-string-instrument": {
      is: "instrument",
      abstract: true,
      about: "An instrument whose strings are bowed: made of its strings (a set of strings, a part of its own), its body and its bow."
    },
    "violin-family": {
      is: "bowed-string-instrument",
      abstract: true,
      about: "The violin, viola, cello and contrabass, and an instrument made like them.",
      values: {
        tuning: { kind: "derived", derive: { equation: "same", inputs: { value: "strings.*.pitch" } }, unit: "MIDI", note: "its open strings, lowest first: its strings' pitches where it gives none" },
        lowestHz: { kind: "derived", derive: { equation: "lowest-hz", inputs: { tuning: "tuning", a4: "constant:a4" } }, unit: "Hz" },
        bow: {
          stringsAtOnce: { value: 2, unit: "strings", kind: "vernacular", source: "vsl-academy-violin", note: `the bridge's curvature and the bow's tension make it "not possible to sound more than two strings at the same time": a triple or quadruple stop arpeggiated (the violin's page; the family's bridges alike arched)` },
          hairWidth: { value: 0.01, unit: "m", kind: "unmeasured", reason: "the violin bow's measured width taken for every bow of the family: no viola, cello or bass bow's ribbon found measured (its rehairers set it by the bow's mortise and ferrule, bow by bow)", searched: [{ where: "web search", query: "bow hair ribbon width mm violin viola cello double bass", date: "2026-10-29", found: "retailers' bow lengths, weights and hair lengths; a museum bass bow's head 21.2 mm wide (University of Edinburgh MIMEd 17331); no ribbon width" }, { where: "web search", query: "bow ferrule width mm violin cello bass hair ribbon width rehair specification", date: "2026-10-29", found: "a violin ribbon 10 to 12 mm by its ferrule (violinist.com forum); Arcus's hair cross-sections by bow, mm2 (violin 5-8, cello 9-13, bass 11-16), not widths; no larger bow's ribbon width" }] },
          hairStiffness: { value: 4829700, unit: "N/m^2", kind: "literature", source: "matusiak-chatziioannou-2024", at: "Table I", note: "the robot's cello bow's hair a spring in series with its contact, per metre of its ribbon's width, optimized against its attacks on string A with the string's torsion and elasto-plastic friction; taken for every bow of the family (no other measured)" },
          hairDamping: { value: 5767.4, unit: "kg/(s m)", kind: "literature", source: "matusiak-chatziioannou-2024", at: "Table I", note: "the dashpot beside that spring, as it" },
          stringLoss: {
            r0: { kind: "derived", derive: { equation: "difference", inputs: { a: "object:lampis-2024-g-strings:A.bowedLoss.r0", b: "object:lampis-2024-g-strings:A.pluckLoss.r0" } }, unit: "1/s", note: "the losses a string has while the bow is on it beyond its own: string A's bowed less its plucked -- the torsion its friction drives and the hair's damping, which the engine does not model; one cello G string's, taken for every string of the family (none other measured)" },
            r2: { kind: "derived", derive: { equation: "difference", inputs: { a: "object:lampis-2024-g-strings:A.bowedLoss.r2", b: "object:lampis-2024-g-strings:A.pluckLoss.r2" } }, unit: "s", note: "as its r0" }
          },
          friction: {
            static: { value: 1.4, unit: "1", kind: "literature", source: "lampis-acta-2024", at: "4.1, Figure 11a", note: `rosined hair on a cello G string (Dominant), from its bridge force just before the first slip: "approximately 1.4" averaged over all their attacks, strongly dependent on the force, little on the acceleration (Galluzzo's 0.66 the measured span's other end); taken for every string of the family (no other measured), where Artifastring's tables drew theirs from 0.58 to 1.06` },
            dynamic: { value: 0.5, unit: "1", kind: "literature", source: "lampis-acta-2024", at: "4, Figure 10", note: 'the dynamic coefficient their limits took from the literature (Smith & Woodhouse 2000, "The tribology of rosin"); its drop from the static, 0.9, within the 0.6 at low force to 1 at high they measured at the first slip (4.1, Figure 11b)' },
            steepness: { value: 0.1, unit: "m/s", kind: "unmeasured", reason: "ours: the speed of slipping over which the friction falls from its static to its dynamic coefficient in Artifastring's hyperbola (its v0), within the 0.05 to 0.3 its tables were drawn from (Percival, Artifastring research/shared/published_constants.py); with it, the static and dynamic above and the hair and losses, the engine's attacks from rest on Lampis' string A met the robot's, 236 of its 859 within 20 periods to its 188 (Artifastring's contact 27) (native/strings-model/lampis_guettler.py, 7 November 2026)", searched: [{ where: "registry sources", query: "lampis-acta-2024: a friction curve's speed scale", date: "2026-11-07", found: 'the coefficients at the first slip and averaged over 0.1 s, a quadratic in force and acceleration "solely as a visualization tool"; no curve against slipping speed' }, { where: "registry sources", query: "matusiak-chatziioannou-2024: its friction law", date: "2026-11-07", found: "an elasto-plastic law (bristles, their stiffness and damping fitted) in place of a curve of slipping speed; no v0" }] }
          }
        },
        engine: {
          solver: { kind: "derived", like: { candidates: ["violin", "viola", "cello"], match: "lowestHz", take: "@id" }, unit: "Artifastring instrument", note: "the bowed-string engine plays it on the solver and rates of the measured instrument whose lowest open string is nearest its own (itself where it is one)" },
          bodyFrom: { kind: "derived", like: { candidates: ["violin", "viola", "cello"], match: "body.airMode", take: "@id" }, unit: "Artifastring instrument", note: "the measured body nearest it in its lowest air mode (itself where it is one), stretched in time to its own: interim, until its own is fitted" },
          bodyRatio: { kind: "derived", like: { candidates: ["violin", "viola", "cello"], match: "body.airMode", take: { equation: "ratio", inputs: { a: "body.airMode" }, here: { b: "body.airMode" } } }, unit: "1", note: "how much longer in time the borrowed body's responses are played: its air mode over this one's" }
        }
      }
    },
    violin: {
      is: "violin-family",
      about: "The violin, 4/4: Artifastring's three (its constants' first sets), each a version a seat plays.",
      parts: {
        strings: "violin-strings",
        body: "violin-body"
      },
      values: {
        compass: { value: [55, 105], unit: "MIDI", kind: "vernacular", source: "vsl-academy-violin", note: "stopped notes, sounding: G3 - A7" },
        harmonicCeiling: { value: 110, unit: "MIDI", kind: "vernacular", source: "vsl-academy-violin", note: "the highest harmonic: harmonic D8" },
        register: { value: [60, 88], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-violin's page", query: "its range and where it is mainly played", date: "2026-10-29", found: "the page's range G3 - A7 (harmonic D8): no register a line keeps to" }] },
        tuning: { value: [55, 62, 69, 76], unit: "MIDI", kind: "vernacular", source: "vsl-academy-violin", note: "in fifths, its open strings lowest first" },
        bow: {
          length: { value: 74.9, unit: "cm", kind: "vernacular", source: "rosa-size-chart", note: "a full-size bow, 29.5 in" },
          hairWidth: { value: 0.01, unit: "m", kind: "literature", source: "schoonderwaldt-guettler-askenfelt-2003", note: "a violin bow's hair across the string, about 10 mm" },
          hairLength: { value: 0.65, unit: "m", kind: "unmeasured", reason: "ours: the hair a bow draws over, frog to tip, along which its place is followed through each stroke (physical-strings.js MODEL.draw)", searched: [{ where: "web search", query: 'bow hair length mm violin viola cello bass bow specifications "hair length"', date: "2026-10-29", found: "a museum's method for measuring it (Birmingham Conservatoire, back of the head to the ferrule); a viol bow's 54.7 cm (Gewa); no violin-family bow's" }, { where: "web search", query: "violin bow playing hair length 650 mm cello bow hair length 600 mm bow maker dimensions", date: "2026-10-29", found: "sticks' lengths (Tourte's 74-75 cm violin, 74 viola, 72-73 cello); hair counts; no hair length" }, { where: "Thomann, a player's review of a Roth & Junius RJB carbon 4/4 F bass bow (thomannmusic.com, 28 March 2021)", date: "2026-10-29", found: "a bass bow 72.5 cm long, its working hair 57.5 cm -- one bow, its owner's measure" }] }
        }
      }
    },
    "violin.0": {
      is: "violin",
      about: "The violin a seat's version 0 plays: Artifastring's string set 0 (its version modulo its 5 sets).",
      parts: {
        strings: "violin-strings.0"
      }
    },
    "violin.1": {
      is: "violin",
      about: "The violin a seat's version 1 plays: Artifastring's string set 1 (its version modulo its 5 sets).",
      parts: {
        strings: "violin-strings.1"
      }
    },
    "violin.2": {
      is: "violin",
      about: "The violin a seat's version 2 plays: Artifastring's string set 2 (its version modulo its 5 sets).",
      parts: {
        strings: "violin-strings.2"
      }
    },
    viola: {
      is: "violin-family",
      about: "The viola, 16-16.5 in: Artifastring's three.",
      parts: {
        strings: "viola-strings",
        body: "viola-body"
      },
      values: {
        compass: { value: [48, 93], unit: "MIDI", kind: "vernacular", source: "vsl-academy-viola", note: "stopped notes, sounding: C3 - A6" },
        harmonicCeiling: { value: 100, unit: "MIDI", kind: "vernacular", source: "vsl-academy-viola", note: "the highest harmonic: harmonic E7" },
        register: { value: [53, 81], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-viola's page", query: "its range and where it is mainly played", date: "2026-10-29", found: `the page's range C3 - A6 (harmonic E7); "mainly between C3 and G5": no register a line keeps to but the viola's 'mainly'` }] },
        tuning: { value: [48, 55, 62, 69], unit: "MIDI", kind: "vernacular", source: "vsl-academy-viola", note: "in fifths, its open strings lowest first" },
        bow: {
          length: { value: 74.3, unit: "cm", kind: "vernacular", source: "rosa-size-chart", note: "a full-size viola bow, 29.25 in (the chart rounds it to 75 cm)" },
          hairLength: { value: 0.66, unit: "m", kind: "unmeasured", reason: "ours: the hair a bow draws over, frog to tip, along which its place is followed through each stroke (physical-strings.js MODEL.draw)", searched: [{ where: "web search", query: 'bow hair length mm violin viola cello bass bow specifications "hair length"', date: "2026-10-29", found: "a museum's method for measuring it (Birmingham Conservatoire, back of the head to the ferrule); a viol bow's 54.7 cm (Gewa); no violin-family bow's" }, { where: "web search", query: "violin bow playing hair length 650 mm cello bow hair length 600 mm bow maker dimensions", date: "2026-10-29", found: "sticks' lengths (Tourte's 74-75 cm violin, 74 viola, 72-73 cello); hair counts; no hair length" }, { where: "Thomann, a player's review of a Roth & Junius RJB carbon 4/4 F bass bow (thomannmusic.com, 28 March 2021)", date: "2026-10-29", found: "a bass bow 72.5 cm long, its working hair 57.5 cm -- one bow, its owner's measure" }] }
        }
      }
    },
    "viola.0": {
      is: "viola",
      about: "The viola a seat's version 0 plays: Artifastring's string set 0 (its version modulo its 2 sets).",
      parts: {
        strings: "viola-strings.0"
      }
    },
    "viola.1": {
      is: "viola",
      about: "The viola a seat's version 1 plays: Artifastring's string set 1 (its version modulo its 2 sets).",
      parts: {
        strings: "viola-strings.1"
      }
    },
    "viola.2": {
      is: "viola",
      about: "The viola a seat's version 2 plays: Artifastring's string set 0 (its version modulo its 2 sets).",
      parts: {
        strings: "viola-strings.0"
      }
    },
    cello: {
      is: "violin-family",
      about: "The cello, 4/4: Artifastring's three.",
      parts: {
        strings: "cello-strings",
        body: "cello-body"
      },
      values: {
        compass: { value: [36, 81], unit: "MIDI", kind: "vernacular", source: "vsl-academy-cello", note: "stopped notes, sounding: C2 - A5" },
        harmonicCeiling: { value: 105, unit: "MIDI", kind: "vernacular", source: "vsl-academy-cello", note: "the highest harmonic: harmonic A7" },
        register: { value: [41, 72], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-cello's page", query: "its range and where it is mainly played", date: "2026-10-29", found: "the page's range C2 - A5 (harmonic A7): no register a line keeps to" }] },
        tuning: { value: [36, 43, 50, 57], unit: "MIDI", kind: "vernacular", source: "vsl-academy-cello", note: "in fifths, its open strings lowest first" },
        bow: {
          length: { value: 71.1, unit: "cm", kind: "vernacular", source: "rosa-size-chart", note: "a full-size bow, 28 in" },
          hairLength: { value: 0.62, unit: "m", kind: "unmeasured", reason: "ours: the hair a bow draws over, frog to tip, along which its place is followed through each stroke (physical-strings.js MODEL.draw)", searched: [{ where: "web search", query: 'bow hair length mm violin viola cello bass bow specifications "hair length"', date: "2026-10-29", found: "a museum's method for measuring it (Birmingham Conservatoire, back of the head to the ferrule); a viol bow's 54.7 cm (Gewa); no violin-family bow's" }, { where: "web search", query: "violin bow playing hair length 650 mm cello bow hair length 600 mm bow maker dimensions", date: "2026-10-29", found: "sticks' lengths (Tourte's 74-75 cm violin, 74 viola, 72-73 cello); hair counts; no hair length" }, { where: "Thomann, a player's review of a Roth & Junius RJB carbon 4/4 F bass bow (thomannmusic.com, 28 March 2021)", date: "2026-10-29", found: "a bass bow 72.5 cm long, its working hair 57.5 cm -- one bow, its owner's measure" }] }
        }
      }
    },
    "cello.0": {
      is: "cello",
      about: "The cello a seat's version 0 plays: Artifastring's string set 0 (its version modulo its 3 sets).",
      parts: {
        strings: "cello-strings.0"
      }
    },
    "cello.1": {
      is: "cello",
      about: "The cello a seat's version 1 plays: Artifastring's string set 1 (its version modulo its 3 sets).",
      parts: {
        strings: "cello-strings.1"
      }
    },
    "cello.2": {
      is: "cello",
      about: "The cello a seat's version 2 plays: Artifastring's string set 2 (its version modulo its 3 sets).",
      parts: {
        strings: "cello-strings.2"
      }
    },
    contrabass: {
      is: "violin-family",
      about: "The orchestral double bass, 3/4, tuned in fourths: its strings D'Addario's Helicore orchestral, its stiffness and losses read from another bass's recorded pizzicati (its strings not known to be Helicores).",
      parts: {
        strings: "contrabass-strings",
        body: "contrabass-body"
      },
      values: {
        compass: { value: [28, 67], unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: "stopped notes, sounding: B0 - G4 sounding with five strings, from E1 with four" },
        harmonicCeiling: { value: 91, unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: "the highest harmonic: harmonic G6" },
        register: { value: [31, 55], unit: "MIDI", kind: "unmeasured", reason: "ours: the register a line keeps to, an authored preference, never physical evidence (instrument-ranges.js)", searched: [{ where: "vsl-academy-double-bass's page", query: "its range and where it is mainly played", date: "2026-10-29", found: "the page's range B0 - G4 sounding with five strings, from E1 with four (harmonic G6): no register a line keeps to" }] },
        writtenToSounding: { value: -12, unit: "semitones", kind: "vernacular", source: "vsl-academy-double-bass", note: '"written an octave higher than it sounds in bass clef"' },
        bow: {
          length: { value: 70, unit: "cm", kind: "vernacular", source: "simplyforstrings-bass-bows", note: "a French student bass bow, 70 cm (a German, 74)" },
          hairLength: { value: 0.575, unit: "m", kind: "vernacular", source: "thomann-rjb-bass-bow-review", note: "one player's 4/4 French bass bow, 72.5 cm long, its working hair 57.5 cm: no maker's or paper's found (the searches on the violin's)" }
        }
      }
    },
    "contrabass-five-string": {
      is: "contrabass",
      about: "The double bass with a fifth string a fourth under its four (VSL Academy): its compass and tuning its own; the rest the four-string's -- its body, its bow, its four upper strings, its register, its harmonics and its notation. Its low B string unmeasured; the engine plays only the four-string.",
      values: {
        compass: { value: [23, 67], unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: 'stopped notes, sounding: "Range of the double-bass: B0 - G4 (harmonic G6)"' },
        tuning: { value: [23, 28, 33, 38, 43], unit: "MIDI", kind: "vernacular", source: "vsl-academy-double-bass", note: '"On five-stringed instruments: B0 (C1), E1, A1, D2, G2": its lowest B0, as the compass' }
      }
    },
    violello: {
      is: "violin-family",
      fictional: true,
      about: "A made-up four-string instrument between the viola and the cello, tuned in fifths from F2: the pipeline's test, none of it any real instrument's (bowed-instruments.json).",
      parts: {
        strings: "violello-strings",
        body: "violello-body"
      }
    },
    "bowed-string-set": {
      is: null,
      abstract: true,
      about: "A set of strings for a bowed instrument: each string's pitch, impedance, stiffness and inharmonicity from its tension, density, length, modulus and diameter, by the physics' equations -- a rule for each of its strings, read with that string's own values.",
      values: {
        "*": {
          f0: { kind: "derived", derive: { equation: "mersenne-f0", inputs: { T: "{}.tension", mu: "{}.density", L: "{}.length" } }, unit: "Hz" },
          impedance: { kind: "derived", derive: { equation: "string-impedance", inputs: { T: "{}.tension", mu: "{}.density" } }, unit: "kg/s" },
          stiffness: { kind: "derived", derive: { equation: "cylinder-stiffness", inputs: { E: "{}.young", d: "{}.diameter" } }, unit: "N m^2" },
          inharmonicity: { kind: "derived", derive: { equation: "inharmonicity-of-stiffness", inputs: { EI: "{}.stiffness", T: "{}.tension", L: "{}.length" } }, unit: "1" }
        }
      }
    },
    "strings-by-pitch": {
      is: "bowed-string-set",
      abstract: true,
      about: "A set of strings given by their pitches, tensions and length (a maker's chart, a spec): each string's frequency from its pitch, its density from its tension, length and frequency, the steel cylinder of that density and the modulus that gives its stiffness.",
      values: {
        "*": {
          f0: { kind: "derived", derive: { equation: "midi-hz", inputs: { midi: "{}.pitch", a4: "constant:a4" } }, unit: "Hz" },
          length: { kind: "derived", derive: { equation: "same", inputs: { value: "length" } }, unit: "m" },
          density: { kind: "derived", derive: { equation: "string-density", inputs: { T: "{}.tension", L: "{}.length", f0: "{}.f0" } }, unit: "kg/m" },
          diameter: { kind: "derived", derive: { equation: "cylinder-diameter", inputs: { mu: "{}.density", rho: "constant:steel-density" } }, unit: "m", note: "the steel cylinder of the string's density, not a wound string's outer diameter: only E d^4 enters the model" },
          young: { kind: "derived", derive: { equation: "young-from-stiffness", inputs: { EI: "{}.stiffness", d: "{}.diameter" } }, unit: "Pa" }
        }
      }
    },
    "given-strings": {
      is: "strings-by-pitch",
      abstract: true,
      about: "A set of strings given as data, nobody's measured: each string's stiffness and losses like the measured string nearest its pitch.",
      values: {
        "*": {
          stiffness: { kind: "borrowed", like: { candidates: ["violin-strings.0", "viola-strings.0", "cello-strings.0"], keys: true, match: "{}.f0", take: "{}.stiffness" }, unit: "N m^2", note: "the measured string nearest its pitch (Artifastring's first sets), the same string at its own length and tension: its stiffness EI" },
          losses: { kind: "borrowed", like: { candidates: ["violin-strings.0", "viola-strings.0", "cello-strings.0"], keys: true, match: "{}.f0", take: { equation: "loss-table", inputs: { decays: "{}.decays", modes: "{}.modes", f0: "{}.f0", E: "{}.young", d: "{}.diameter", T: "{}.tension", L: "{}.length" } } }, unit: "[Hz, 1/s] pairs", note: "that string's measured decays by frequency, read between them at its own modes (the contrabass's law r0 + r2 f^2, fitted to them, had left the first mode decaying at 46 to 51 /s where the measured strings' decay at 0.4 to 2)" }
        }
      }
    },
    "contrabass-strings": {
      is: "strings-by-pitch",
      about: "The contrabass's strings, D'Addario Helicore orchestral 3/4 medium, as measured: their pitches, tensions and length from the maker's chart, their stiffness and losses fitted to another bass's recorded pizzicati -- and from those, by the equations, their density, inharmonicity, stiffness, the steel cylinder of their density and the modulus that gives that stiffness, and their losses' law r0 + r2 f^2.",
      values: {
        length: { value: 1.06, unit: "m", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "the chart's 3/4 playing length, 1060 mm" },
        "*": {
          tension: { kind: "derived", derive: { equation: "pounds-newtons", inputs: { pounds: "{}.tensionPounds", poundForce: "constant:pound-force" } }, unit: "N" },
          inharmonicity: { kind: "derived", derive: { equation: "inharmonicity-at-open", inputs: { takes: "{}.inharmonicityTakes.values", stopped: "{}.inharmonicityTakes.stopped" } }, unit: "1" },
          stiffness: { kind: "derived", derive: { equation: "stiffness-from-inharmonicity", inputs: { B: "{}.inharmonicity", T: "{}.tension", L: "{}.length" } }, unit: "N m^2" },
          lossR0: { kind: "derived", derive: { equation: "mean", inputs: { values: "{}.lossTakes.r0" } }, unit: "1/s" },
          lossR2: { kind: "derived", derive: { equation: "mean", inputs: { values: "{}.lossTakes.r2" } }, unit: "s" }
        },
        E1: {
          pitch: { value: 28, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, E1" },
          tensionPounds: { value: 70, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H614, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [572e-7, 955e-7], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 0, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the open E played", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [1.42, 0.479], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [277e-8, 603e-8], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        },
        A1: {
          pitch: { value: 33, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, A1" },
          tensionPounds: { value: 69, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H613, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [405e-6, 189e-7, 503e-6], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 1, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the A played a semitone up", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [0.877, 2.24], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [826e-8, 98e-7], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        },
        D2: {
          pitch: { value: 38, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, D2" },
          tensionPounds: { value: 65.9, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H612, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [308e-6], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 0, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the open D played", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [0.56], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: its one standing take fitted r0 below zero, -0.366, its first partial's own decay 0.62/s: r0 that decay less r2 f0^2", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [103e-7], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        },
        G2: {
          pitch: { value: 43, unit: "MIDI", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "orchestral tuning, G2" },
          tensionPounds: { value: 62, unit: "lbf", kind: "vernacular", source: "dadario-helicore-orchestral-bass", note: "H611, 3/4 medium" },
          inharmonicityTakes: {
            values: { value: [208e-6, 207e-6], unit: "1", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the contrabass's pizzicati, which ring free", date: "2026-10-17" } },
            stopped: { value: 1, unit: "semitones", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked", data: "vsco2-ce: the G played a semitone up", date: "2026-10-17" } }
          },
          lossTakes: {
            r0: { value: [1.41, 1.7], unit: "1/s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } },
            r2: { value: [603e-8, 66e-7], unit: "s", kind: "fit", fit: { method: "native/strings-model/string_tail.py --plucked: each partial's decay fitted as r0 + r2 f^2, the takes whose fit stood", data: "vsco2-ce", date: "2026-10-17" } }
          }
        }
      }
    },
    "bowed-body": {
      is: null,
      abstract: true,
      about: "A bowed instrument's body: its air as a Helmholtz resonator -- the air inside its outline and its two f-holes' conductance -- and where its fingerboard ends, from a luthier's measurements of it.",
      values: {
        volume: { kind: "derived", derive: { equation: "body-air-volume", inputs: { body: "body", upper: "upper", middle: "middle", lower: "lower", ribs: "ribs", archTop: "archTop", archBack: "archBack" } }, unit: "mm^3" },
        holes: { kind: "derived", derive: { equation: "f-holes-conductance", inputs: { fLength: "fLength", fWidth: "fWidth", fThickness: "fThickness" } }, unit: "mm" },
        fingerboardEnd: { kind: "derived", derive: { equation: "fingerboard-end-semitones", inputs: { string: "string", fingerboard: "fingerboard" } }, unit: "semitones" },
        airMode: { value: 280, unit: "Hz", kind: "literature", source: "bellows-nakayama-2024", note: "the violin's lowest air mode (A0), about 280 Hz; 270-290 Hz in J. Jackson's Strad3D survey (strad3d.org/st_5.html)", measuredOn: ["violin-body"], passes: { by: "helmholtz-ratio", inputs: { K: "holes", V: "volume" }, reference: "violin-body", searched: [{ where: "web search", query: "measured A0 air resonance frequency Hz viola cello double bass Helmholtz cavity mode measurement", date: "2026-10-29", found: "the violin's only (270-290 Hz); a patent places the bass's A0 below its B1 near 100 Hz, no number; leads in SOURCES_TO_FETCH.md" }] } }
      }
    },
    "violin-body": {
      is: "bowed-body",
      about: "The violin's body, 4/4, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 356, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 168, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 112, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 208, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 30.75, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 30-31.5, its middle" },
        archTop: { value: 16, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        archBack: { value: 15, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fLength: { value: 75, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 6.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 3, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 270, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 328, unit: "mm", kind: "vernacular", source: "goldblatt-specs" }
      }
    },
    "viola-body": {
      is: "bowed-body",
      about: "The viola's body, 16-16.5 in, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 415, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 193, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 130, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 238, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 39.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 38-41, its middle" },
        archTop: { value: 17.9, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 17.5-18.3, its middle" },
        archBack: { value: 17.15, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 16.5-17.8, its middle" },
        fLength: { value: 88, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 7, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 3.1, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 311, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 371.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 368-375, its middle" }
      }
    },
    "cello-body": {
      is: "bowed-body",
      about: "The cello's body, 4/4, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 745, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 340, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 240, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 440, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 117.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 115-120, its middle" },
        archTop: { value: 29, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        archBack: { value: 28, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fLength: { value: 140, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 11, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 5, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 580, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 690, unit: "mm", kind: "vernacular", source: "goldblatt-specs" }
      }
    },
    "contrabass-body": {
      is: "bowed-body",
      about: "The contrabass's body, 3/4, as Goldblatt's sheet gives it (mm; a range's middle where it gives a range).",
      values: {
        body: { value: 1110, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        upper: { value: 501, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        middle: { value: 384, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        lower: { value: 674, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        ribs: { value: 183.5, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "its ribs taller at the saddle than at the neck: 122-185 at the neck, 200-227 at the saddle, the middles' mean" },
        archTop: { value: 43, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: "the sheet's range 35-51, its middle" },
        archBack: { value: 0, unit: "mm", kind: "vernacular", source: "goldblatt-specs", note: 'its back flat ("very low")' },
        fLength: { value: 219, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fWidth: { value: 17, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fThickness: { value: 7, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        fingerboard: { value: 850, unit: "mm", kind: "vernacular", source: "goldblatt-specs" },
        string: { value: 1060, unit: "mm", kind: "vernacular", source: "goldblatt-specs" }
      }
    },
    "violello-body": {
      is: "bowed-body",
      fictional: true,
      about: "The violello's body, as its spec gives it (fictional).",
      values: {
        body: { value: 560, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        upper: { value: 256, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        middle: { value: 177, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        lower: { value: 324, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        ribs: { value: 68, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        archTop: { value: 23, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        archBack: { value: 22, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fLength: { value: 111, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fWidth: { value: 8.8, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fThickness: { value: 3.9, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        fingerboard: { value: 425, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" },
        string: { value: 506, unit: "mm", kind: "unmeasured", reason: "fictional: its spec (public/shared/performers/bowed-instruments.json)" }
      }
    },
    "violello-strings": {
      is: "given-strings",
      fictional: true,
      about: "The violello's strings, as its spec gives them (fictional).",
      values: {
        length: { value: 0.506, unit: "m", kind: "unmeasured", reason: "fictional: its spec" },
        F2: {
          pitch: { value: 41, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 90, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        },
        C3: {
          pitch: { value: 48, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 80, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        },
        G3: {
          pitch: { value: 55, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 72, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        },
        D4: {
          pitch: { value: 62, unit: "MIDI", kind: "unmeasured", reason: "fictional: its spec" },
          tension: { value: 85, unit: "N", kind: "unmeasured", reason: "fictional: its spec" }
        }
      }
    },
    "lampis-2024-g-strings": {
      is: null,
      about: "The bowing robot's cello G strings (Lampis, Mayer & Chatziioannou 2024; their bowed responses, Zenodo 2025, doi:10.5281/zenodo.17749110, CC BY 4.0; their attacks from rest, lampis-attacks-2024): each string type as they measured it on their monochord, 0.7 m long -- the real strings the model's Schelleng and Guettler diagrams are held to; string A's losses while bowed and the robot's bow's hair as Matusiak & Chatziioannou fitted them to its bridge force.",
      values: {
        length: { value: 0.7, unit: "m", kind: "literature", source: "lampis-2024", at: "2", note: '"a playing length of L = 70 cm", each string bowed 5.5 cm from the bridge (beta 0.0786)' },
        A: {
          impedance: { value: 1.09, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "D'Addario Prelude" },
          diameter: { value: 1092e-6, unit: "m", kind: "literature", source: "lampis-2024", at: "Table 1" },
          tension: { value: 149.6, unit: "N", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 1.3" },
          linearDensity: { value: 0.007940000000000001, unit: "kg/m", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.07 g/m" },
          bendingStiffness: { value: 685e-6, unit: "N m^2", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.14e-4" },
          quality: { value: 419, unit: "1", kind: "literature", source: "lampis-2024", at: "Table 1", note: "its Q averaged over its first 30 modes, plucked" },
          pluckLoss: {
            r0: { kind: "derived", derive: { equation: "scaled", inputs: { x: "object:lampis-2024-g-strings:C.pluckLoss.r0", a: "object:lampis-2024-g-strings:C.quality", b: "object:lampis-2024-g-strings:A.quality" } }, note: "string C's plucked losses (none of string A's measured mode by mode) by the two strings' Q, averaged over their modes", unit: "1/s" },
            r2: { kind: "derived", derive: { equation: "scaled", inputs: { x: "object:lampis-2024-g-strings:C.pluckLoss.r2", a: "object:lampis-2024-g-strings:C.quality", b: "object:lampis-2024-g-strings:A.quality" } }, note: "string C's plucked losses (none of string A's measured mode by mode) by the two strings' Q, averaged over their modes", unit: "s" }
          },
          bowedLoss: {
            r0: { value: 1.53714, unit: "1/s", kind: "literature", source: "matusiak-chatziioannou-2024", at: "Table I", note: "optimized against the robot's steady bridge force on string A with its transverse motion alone, no torsion, and static friction: the losses of the string while bowed, its torsion's and the hair's among them" },
            r1: { value: 87e-4, unit: "m^2/s", kind: "literature", source: "matusiak-chatziioannou-2024", at: "Table I", note: "as its r0: a loss per squared wavenumber" },
            r2: { kind: "derived", derive: { equation: "loss-per-frequency", inputs: { r1: "object:lampis-2024-g-strings:A.bowedLoss.r1", T: "object:lampis-2024-g-strings:A.tension", mu: "object:lampis-2024-g-strings:A.linearDensity" } }, unit: "s" }
          }
        },
        B: {
          impedance: { value: 1.12, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "Helicore" },
          diameter: { value: 877e-6, unit: "m", kind: "literature", source: "lampis-2024", at: "Table 1" },
          tension: { value: 153.2, unit: "N", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.8" },
          linearDensity: { value: 0.008140000000000001, unit: "kg/m", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.03 g/m" },
          bendingStiffness: { value: 43200000000000004e-20, unit: "N m^2", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.16e-4" },
          quality: { value: 503, unit: "1", kind: "literature", source: "lampis-2024", at: "Table 1", note: "its Q averaged over its first 30 modes, plucked" }
        },
        C: {
          impedance: { value: 0.85, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "Thomastik Dominant" },
          diameter: { value: 115e-5, unit: "m", kind: "literature", source: "lampis-2024", at: "Table 1" },
          tension: { value: 116.3, unit: "N", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.7" },
          linearDensity: { value: 62e-4, unit: "kg/m", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.06 g/m" },
          bendingStiffness: { value: 303e-6, unit: "N m^2", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.07e-4" },
          quality: { value: 1064, unit: "1", kind: "literature", source: "lampis-2024", at: "Table 1", note: "its Q averaged over its first 30 modes, plucked" },
          pluckLoss: {
            r0: { value: 0.12, unit: "1/s", kind: "literature", source: "lampis-acta-2024", at: "Fig. 4b", note: "ours, read from its plot: each of its 30 modes' decay pi f / Q, fitted r0 + r2 f^2 (string-loss-law), within 0.4/s of its modes to its 30th but its 10th (1.8 against 1.4)" },
            r2: { value: 177e-8, unit: "s", kind: "literature", source: "lampis-acta-2024", at: "Fig. 4b", note: "as its r0" }
          }
        },
        D: {
          impedance: { value: 1.13, unit: "kg/s", kind: "literature", source: "lampis-2024", at: "Table 1", note: "Kaplan" },
          diameter: { value: 8950000000000001e-19, unit: "m", kind: "literature", source: "lampis-2024", at: "Table 1" },
          tension: { value: 153.5, unit: "N", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.9" },
          linearDensity: { value: 0.008199999999999999, unit: "kg/m", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.04 g/m" },
          bendingStiffness: { value: 31e-5, unit: "N m^2", kind: "literature", source: "lampis-2024", at: "Table 1", note: "± 0.42e-4" },
          quality: { value: 521, unit: "1", kind: "literature", source: "lampis-2024", at: "Table 1", note: "its Q averaged over its first 30 modes, plucked" }
        }
      }
    }
  }
};

// registry/objects/artifastring-strings.json
var artifastring_strings_default = {
  schema: "musebots.registry-objects/1",
  about: "Artifastring's strings (G. Percival), every set of each instrument's, made by registry/import/artifastring.mjs from the engine's constants: do not edit them here.",
  nodes: {
    "violin-strings": {
      is: "bowed-string-set",
      about: "The violin's strings as Artifastring measured them: every quantity's range across its 5 sets.",
      values: {
        G3: {
          tension: { range: [31.5, 60.9], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.32, 0.326], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [628e-6, 97e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [195e-5, 386e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [2e9, 216e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.63, 0.706], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.21, 0.334], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.085, 0.305], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [0.01424, 0.01487], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [56, 72], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        },
        D4: {
          tension: { range: [41, 69.6], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.317, 0.325], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [668e-6, 88e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [118e-5, 193e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [437e7, 216e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.584, 0.718], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.202, 0.32], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.09, 0.299], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [1002e-6, 128e-5], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [48, 80], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        },
        A4: {
          tension: { range: [49.5, 73.8], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.317, 0.326], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [573e-6, 748e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [602e-6, 905e-6], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [678e7, 239e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.594, 0.711], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.208, 0.338], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.084, 0.298], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [5882e-7, 7051e-7], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [72, 80], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        },
        E5: {
          tension: { range: [64.8, 107.4], unit: "N", kind: "other", source: "artifastring", note: "across its 5 sets" },
          length: { range: [0.319, 0.327], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          diameter: { range: [252e-6, 33e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          density: { range: [36e-5, 6e-4], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 5 sets" },
          young: { range: [92e9, 199e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionStatic: { range: [0.636, 0.677], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionDynamic: { range: [0.214, 0.331], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          frictionSteepness: { range: [0.088, 0.293], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" },
          quiet: { range: [2659e-7, 3436e-7], unit: "m/s", kind: "other", source: "artifastring", note: "across its 5 sets" },
          modes: { range: [104, 104], unit: "1", kind: "other", source: "artifastring", note: "across its 5 sets" }
        }
      }
    },
    "violin-strings.0": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 0.",
      values: {
        G3: {
          tension: { value: 31.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.325, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 97e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 195e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 2e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.654, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.301, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.305, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01487, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.6849, 2.013, 2.047, 4.102, 6.38, 9.652, 10.02, 11.47, 16.27, 20.1, 24.39, 29.12, 34.3, 39.93, 46.02, 52.55, 59.54, 66.97, 74.86, 83.2, 91.98, 101.2, 110.9, 121.1, 131.6, 142.7, 154.2, 166.1, 178.5, 191.4, 204.7, 218.4, 232.6, 247.2, 262.3, 277.9, 293.9, 310.3, 327.2, 344.6, 362.4, 380.6, 399.3, 418.5, 438.1, 458.1, 478.7, 499.6, 521, 542.9, 565.2, 587.9, 611.1, 634.8, 658.9, 683.5, 708.5, 734, 759.9, 786.2, 813, 840.3, 868, 896.2, 924.8, 953.9, 983.4, 1013, 1044, 1075, 1106, 1138, 1170, 1203, 1236, 1269, 1303, 1338, 1373, 1408, 1444, 1480, 1517, 1554, 1592, 1630, 1668, 1707, 1747, 1787, 1827, 1868, 1909, 1951, 1993, 2035, 2079, 2122, 2166, 2210, 2255, 2300, 2346, 2392, 2439, 2486, 2534, 2582, 2630, 2679, 2728, 2778, 2828, 2879, 2930, 2982, 3034, 3086, 3139, 3193, 3247, 3301, 3356, 3411, 3467, 3523, 3579, 3636], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 56, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.319, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 88e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 161e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 437e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.707, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.317, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.299, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 128e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.687, 3.559, 6.104, 8.224, 10.32, 12.99, 13.99, 25.31, 18.52, 28.68, 34.38, 40.68, 47.58, 55.09, 63.19, 71.89, 81.19, 91.1, 101.6, 112.7, 124.4, 136.7, 149.6, 163.1, 177.2, 191.9, 207.2, 223.1, 239.6, 256.8, 274.5, 292.8, 311.7, 331.2, 351.3, 372, 393.3, 415.2, 437.7, 460.8, 484.5, 508.8, 533.7, 559.3, 585.4, 612.1, 639.4, 667.3, 695.8, 724.9, 754.6, 784.9, 815.8, 847.4, 879.5, 912.2, 945.5, 979.4, 1014, 1049, 1085, 1121, 1158, 1195, 1234, 1272, 1312, 1352, 1392, 1433, 1475, 1517, 1560, 1604, 1648, 1692, 1738, 1784, 1830, 1877, 1925, 1973, 2022, 2072, 2122, 2173, 2224, 2276, 2328, 2381, 2435, 2490, 2544, 2600, 2656, 2713, 2770, 2828, 2887, 2946, 3005, 3066, 3127, 3188, 3250, 3313, 3376, 3440, 3505, 3570, 3636, 3702, 3769, 3836, 3904, 3973, 4043, 4112, 4183, 4254, 4326, 4398, 4471, 4545, 4619, 4693, 4769, 4845], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 49.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.325, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 737e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 602e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 733e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.708, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.306, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.298, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 6753e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 80, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.486, 4.502, 6.051, 7.485, 11.15, 13.44, 17.62, 16.47, 24.16, 29.35, 35.15, 41.56, 48.58, 56.22, 64.46, 73.32, 82.78, 92.86, 103.5, 114.8, 126.8, 139.3, 152.4, 166.1, 180.5, 195.5, 211, 227.2, 244, 261.4, 279.4, 298.1, 317.3, 337.1, 357.6, 378.7, 400.4, 422.6, 445.5, 469.1, 493.2, 517.9, 543.3, 569.2, 595.8, 623, 650.7, 679.1, 708.1, 737.8, 768, 798.8, 830.3, 862.4, 895, 928.3, 962.2, 996.7, 1032, 1068, 1104, 1141, 1178, 1217, 1255, 1295, 1335, 1375, 1417, 1458, 1501, 1544, 1588, 1632, 1677, 1722, 1768, 1815, 1862, 1910, 1959, 2008, 2058, 2108, 2159, 2211, 2263, 2316, 2369, 2423, 2478, 2533, 2589, 2646, 2703, 2760, 2819, 2878, 2937, 2997, 3058, 3120, 3182, 3244, 3307, 3371, 3436, 3501, 3566, 3633, 3699, 3767, 3835, 3904, 3973, 4043, 4113, 4185, 4256, 4329, 4402, 4475, 4550, 4624, 4700, 4776, 4852, 4930], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 107.4, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.319, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 33e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 6e-4, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 92e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.663, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.31, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.287, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2887e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [3.022, 3.076, 7.431, 5.859, 6.114, 8.878, 8.555, 12.29, 9.023, 11.4, 10.89, 11.56, 12.84, 18.65, 15.03, 16.32, 17.22, 21.88, 24.03, 24.98, 27.04, 29.21, 31.48, 33.86, 36.34, 38.93, 41.63, 44.43, 47.33, 50.35, 53.46, 56.69, 60.02, 63.45, 66.99, 70.64, 74.39, 78.25, 82.21, 86.28, 90.46, 94.74, 99.12, 103.6, 108.2, 112.9, 117.7, 122.6, 127.7, 132.8, 138, 143.4, 148.8, 154.3, 160, 165.8, 171.6, 177.6, 183.7, 189.9, 196.1, 202.5, 209, 215.6, 222.4, 229.2, 236.1, 243.1, 250.3, 257.5, 264.8, 272.3, 279.9, 287.5, 295.3, 303.2, 311.1, 319.2, 327.4, 335.7, 344.1, 352.6, 361.2, 370, 378.8, 387.7, 396.8, 405.9, 415.1, 424.5, 434, 443.5, 453.2, 463, 472.8, 482.8, 492.9, 503.1, 513.4, 523.8, 534.4, 545, 555.7, 566.5, 577.5, 588.5, 599.7, 610.9, 622.3, 633.8, 645.3, 657, 668.8, 680.7, 692.7, 704.8, 717, 729.3, 741.7, 754.3, 766.9, 779.6, 792.5, 805.4, 818.5, 831.6, 844.9, 858.3], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.1": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 1.",
      values: {
        G3: {
          tension: { value: 60.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.321, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 764e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 386e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 735e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.63, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.238, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.286, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01441, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.6345, 0.9825, 2.794, 3.594, 4.288, 6.478, 8.492, 10.57, 13.06, 19.97, 22.3, 26.62, 31.48, 36.76, 42.47, 48.6, 55.15, 62.13, 69.53, 77.35, 85.59, 94.26, 103.3, 112.9, 122.8, 133.1, 143.9, 155.1, 166.8, 178.8, 191.3, 204.2, 217.5, 231.2, 245.4, 260, 275, 290.4, 306.3, 322.5, 339.2, 356.4, 373.9, 391.9, 410.2, 429.1, 448.3, 468, 488, 508.5, 529.5, 550.8, 572.6, 594.8, 617.4, 640.4, 663.9, 687.8, 712.1, 736.8, 762, 787.5, 813.5, 840, 866.8, 894.1, 921.8, 949.9, 978.4, 1007, 1037, 1067, 1097, 1127, 1158, 1190, 1222, 1254, 1287, 1320, 1354, 1388, 1422, 1457, 1492, 1528, 1564, 1601, 1638, 1675, 1713, 1751, 1790, 1829, 1869, 1909, 1949, 1990, 2031, 2073, 2115, 2157, 2200, 2243, 2287, 2331, 2376, 2421, 2466, 2512, 2559, 2605, 2652, 2700, 2748, 2796, 2845, 2894, 2944, 2994, 3045, 3096, 3147, 3199, 3251, 3304, 3357, 3410], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 69.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 781e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 193e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 145e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.584, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.292, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1002e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.189, 4.055, 3.506, 8.458, 8.761, 13.01, 11.47, 17.65, 22, 26.94, 32.45, 38.54, 45.22, 52.47, 60.3, 68.72, 77.71, 87.28, 97.44, 108.2, 119.5, 131.4, 143.9, 156.9, 170.6, 184.8, 199.6, 214.9, 230.9, 247.4, 264.6, 282.3, 300.5, 319.4, 338.8, 358.8, 379.4, 400.6, 422.4, 444.7, 467.6, 491.1, 515.2, 539.9, 565.1, 591, 617.4, 644.3, 671.9, 700, 728.8, 758.1, 788, 818.4, 849.5, 881.1, 913.3, 946.1, 979.4, 1013, 1048, 1083, 1119, 1155, 1192, 1229, 1267, 1306, 1345, 1385, 1425, 1466, 1507, 1550, 1592, 1635, 1679, 1724, 1769, 1814, 1860, 1907, 1954, 2002, 2051, 2100, 2149, 2199, 2250, 2302, 2354, 2406, 2459, 2513, 2567, 2622, 2677, 2733, 2790, 2847, 2905, 2963, 3022, 3081, 3142, 3202, 3263, 3325, 3388, 3451, 3514, 3578, 3643, 3708, 3774, 3840, 3907, 3975, 4043, 4112, 4181, 4251, 4322, 4393, 4465, 4537, 4610, 4683], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 52.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 573e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 661e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 22e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.594, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.231, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.298, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 7051e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.684, 4.791, 5.55, 8.577, 11.02, 8.052, 15.59, 20.81, 24.53, 30.04, 36.2, 43, 50.45, 58.55, 67.3, 76.69, 86.74, 97.43, 108.8, 120.8, 133.4, 146.7, 160.6, 175.2, 190.4, 206.3, 222.8, 240, 257.8, 276.3, 295.4, 315.1, 335.6, 356.6, 378.3, 400.7, 423.7, 447.3, 471.6, 496.6, 522.2, 548.4, 575.3, 602.8, 631, 659.9, 689.3, 719.5, 750.3, 781.7, 813.8, 846.5, 879.8, 913.9, 948.5, 983.8, 1020, 1056, 1094, 1132, 1170, 1209, 1249, 1290, 1331, 1373, 1415, 1458, 1502, 1546, 1591, 1637, 1683, 1730, 1778, 1826, 1875, 1925, 1975, 2026, 2077, 2129, 2182, 2236, 2290, 2345, 2400, 2456, 2513, 2570, 2628, 2687, 2746, 2806, 2866, 2928, 2990, 3052, 3115, 3179, 3244, 3309, 3374, 3441, 3508, 3576, 3644, 3713, 3783, 3853, 3924, 3996, 4068, 4141, 4214, 4288, 4363, 4439, 4515, 4592, 4669, 4747, 4826, 4905, 4985, 5066, 5147, 5229], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 75.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 252e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 418e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 199e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.636, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.293, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 3436e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.885, 3.903, 7.781, 6.143, 8.589, 11.88, 15, 13.63, 15.49, 15.28, 18.14, 17.92, 18.58, 28.67, 19.95, 25.04, 28.2, 30.87, 33.69, 36.66, 39.8, 43.1, 46.56, 50.18, 53.96, 57.9, 62, 66.27, 70.69, 75.28, 80.02, 84.93, 90, 95.23, 100.6, 106.2, 111.9, 117.7, 123.8, 130, 136.3, 142.8, 149.5, 156.4, 163.4, 170.5, 177.8, 185.3, 193, 200.8, 208.7, 216.9, 225.1, 233.6, 242.2, 251, 259.9, 269, 278.2, 287.6, 297.2, 307, 316.8, 326.9, 337.1, 347.5, 358, 368.7, 379.6, 390.6, 401.8, 413.1, 424.6, 436.3, 448.1, 460.1, 472.3, 484.6, 497, 509.7, 522.5, 535.4, 548.5, 561.8, 575.2, 588.8, 602.6, 616.5, 630.6, 644.8, 659.2, 673.8, 688.5, 703.4, 718.4, 733.6, 749, 764.5, 780.2, 796.1, 812.1, 828.2, 844.6, 861.1, 877.7, 894.5, 911.5, 928.6, 945.9, 963.4, 981, 998.8, 1017, 1035, 1053, 1071, 1090, 1109, 1128, 1147, 1166, 1185, 1205, 1225, 1245, 1265, 1285, 1305], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.2": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 2.",
      values: {
        G3: {
          tension: { value: 58.8, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.326, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 628e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 364e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 216e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.65, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.334, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.239, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01444, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.9782, 2.548, 2.956, 4.803, 5.441, 9.333, 13.87, 14.47, 20.05, 24.89, 30.3, 36.28, 42.84, 49.96, 57.65, 65.91, 74.74, 84.14, 94.11, 104.7, 115.8, 127.4, 139.7, 152.5, 165.9, 179.9, 194.4, 209.5, 225.2, 241.4, 258.2, 275.6, 293.5, 312, 331.1, 350.8, 371, 391.8, 413.2, 435.1, 457.6, 480.7, 504.3, 528.5, 553.3, 578.7, 604.6, 631.1, 658.2, 685.8, 714, 742.8, 772.1, 802, 832.5, 863.6, 895.2, 927.4, 960.1, 993.5, 1027, 1062, 1097, 1132, 1169, 1205, 1243, 1281, 1319, 1358, 1398, 1438, 1479, 1520, 1562, 1604, 1647, 1691, 1735, 1780, 1825, 1871, 1917, 1964, 2012, 2060, 2109, 2158, 2208, 2258, 2309, 2361, 2413, 2466, 2519, 2573, 2627, 2682, 2738, 2794, 2851, 2908, 2966, 3024, 3083, 3143, 3203, 3263, 3325, 3386, 3449, 3512, 3575, 3639, 3704, 3769, 3835, 3901, 3968, 4036, 4104, 4173, 4242, 4312, 4382, 4453, 4524, 4597], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 56.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.325, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 668e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 155e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 216e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.635, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.32, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1095e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.546, 3.423, 3.903, 4.561, 8.534, 11.2, 14.96, 22.76, 19.37, 28.34, 34.33, 40.95, 48.2, 56.08, 64.59, 73.73, 83.5, 93.9, 104.9, 116.6, 128.9, 141.8, 155.4, 169.5, 184.4, 199.8, 215.9, 232.6, 249.9, 267.9, 286.5, 305.7, 325.6, 346, 367.2, 388.9, 411.3, 434.3, 457.9, 482.2, 507.1, 532.6, 558.8, 585.6, 613, 641.1, 669.7, 699, 729, 759.6, 790.8, 822.6, 855.1, 888.2, 921.9, 956.2, 991.2, 1027, 1063, 1100, 1137, 1176, 1214, 1254, 1294, 1334, 1376, 1418, 1460, 1503, 1547, 1592, 1637, 1682, 1729, 1776, 1823, 1872, 1920, 1970, 2020, 2071, 2122, 2174, 2227, 2280, 2334, 2388, 2444, 2499, 2556, 2613, 2670, 2729, 2788, 2847, 2908, 2968, 3030, 3092, 3155, 3218, 3282, 3347, 3412, 3478, 3544, 3611, 3679, 3747, 3816, 3886, 3956, 4027, 4099, 4171, 4244, 4317, 4391, 4466, 4541, 4617, 4694, 4771, 4849, 4927, 5007, 5086], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 61.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.326, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 748e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 745e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 678e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.648, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.338, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.242, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 6562e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.687, 3.803, 3.83, 6.116, 8.562, 10.34, 12.99, 15.81, 20.57, 25.21, 30.39, 12.61, 42.39, 49.21, 56.57, 64.48, 72.93, 81.93, 91.48, 101.6, 112.2, 123.4, 135.1, 147.4, 160.2, 173.6, 187.5, 201.9, 216.9, 232.5, 248.6, 265.2, 282.4, 300.1, 318.4, 337.2, 356.5, 376.4, 396.9, 417.9, 439.4, 461.5, 484.2, 507.3, 531.1, 555.3, 580.2, 605.5, 631.4, 657.9, 684.9, 712.4, 740.5, 769.1, 798.3, 828, 858.3, 889.1, 920.5, 952.4, 984.8, 1018, 1051, 1085, 1120, 1155, 1191, 1227, 1264, 1301, 1339, 1378, 1417, 1456, 1496, 1537, 1578, 1620, 1662, 1705, 1748, 1792, 1837, 1882, 1927, 1973, 2020, 2067, 2115, 2163, 2212, 2261, 2311, 2362, 2413, 2464, 2516, 2569, 2622, 2676, 2730, 2785, 2840, 2896, 2953, 3010, 3067, 3125, 3184, 3243, 3303, 3363, 3424, 3485, 3547, 3610, 3673, 3736, 3800, 3865, 3930, 3996, 4062, 4129, 4196, 4264, 4333, 4402], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 64.8, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 286e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 36e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 103e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.671, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.331, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 3094e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.873, 2.197, 6.681, 7.334, 6.024, 8.816, 11.58, 11.52, 10.65, 9.464, 8.924, 8.308, 7.252, 8.229, 8.838, 9.259, 10.22, 10.14, 12.61, 12.96, 12.74, 14.03, 13.71, 15.75, 14.99, 16.43, 19.62, 20.36, 19.32, 20.74, 21.73, 22.75, 23.81, 24.9, 26.02, 27.18, 28.37, 29.59, 30.85, 32.14, 33.47, 34.82, 36.22, 37.64, 39.1, 40.59, 42.12, 43.68, 45.27, 46.9, 48.56, 50.25, 51.98, 53.74, 55.53, 57.36, 59.22, 61.12, 63.04, 65.01, 67, 69.03, 71.09, 73.19, 75.32, 77.48, 79.68, 81.91, 84.17, 86.47, 88.8, 91.16, 93.56, 95.99, 98.46, 101, 103.5, 106.1, 108.7, 111.3, 114, 116.7, 119.4, 122.2, 125, 127.8, 130.7, 133.6, 136.5, 139.5, 142.5, 145.5, 148.6, 151.7, 154.8, 158, 161.2, 164.4, 167.7, 171, 174.3, 177.7, 181.1, 184.5, 188, 191.5, 195, 198.6, 202.2, 205.9, 209.5, 213.2, 217, 220.7, 224.6, 228.4, 232.3, 236.2, 240.1, 244.1, 248.1, 252.1, 256.2, 260.3, 264.5, 268.6, 272.8, 277.1], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.3": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 3.",
      values: {
        G3: {
          tension: { value: 36.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 824e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 228e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 371e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.706, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.21, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.239, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.0146, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.404, 2.075, 1.89, 2.459, 3.496, 4.931, 6.095, 7.994, 9.34, 9.149, 12.69, 15.02, 17.56, 20.33, 23.31, 26.52, 29.95, 33.6, 37.47, 41.57, 45.88, 50.42, 55.17, 60.15, 65.35, 70.77, 76.42, 82.28, 88.36, 94.67, 101.2, 107.9, 114.9, 122.1, 129.5, 137.2, 145, 153.1, 161.4, 169.9, 178.6, 187.6, 196.8, 206.2, 215.8, 225.7, 235.7, 246, 256.5, 267.3, 278.2, 289.4, 300.8, 312.4, 324.2, 336.3, 348.6, 361.1, 373.8, 386.7, 399.9, 413.3, 426.9, 440.7, 454.8, 469, 483.5, 498.2, 513.2, 528.3, 543.7, 559.3, 575.1, 591.2, 607.4, 623.9, 640.6, 657.5, 674.7, 692.1, 709.7, 727.5, 745.5, 763.8, 782.2, 800.9, 819.8, 839, 858.3, 877.9, 897.7, 917.7, 938, 958.5, 979.1, 1e3, 1021, 1043, 1064, 1086, 1108, 1130, 1153, 1175, 1198, 1221, 1245, 1268, 1292, 1316, 1340, 1365, 1389, 1414, 1439, 1465, 1490, 1516, 1542, 1568, 1595, 1621, 1648, 1675, 1703, 1730, 1758, 1786], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 41, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.317, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 69e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 118e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 139e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.718, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.202, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.248, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1177e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 80, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.253, 1.783, 4.113, 4.125, 7.918, 8.894, 16.72, 20.09, 15.35, 18.26, 15.77, 25.11, 29.05, 33.33, 37.95, 42.91, 48.22, 53.87, 59.86, 66.19, 72.87, 79.89, 87.25, 94.95, 103, 111.4, 120.1, 129.2, 138.6, 148.4, 158.5, 168.9, 179.7, 190.8, 202.3, 214.1, 226.2, 238.7, 251.6, 264.8, 278.3, 292.2, 306.4, 320.9, 335.8, 351, 366.6, 382.5, 398.8, 415.4, 432.3, 449.6, 467.3, 485.2, 503.6, 522.2, 541.2, 560.6, 580.2, 600.3, 620.6, 641.4, 662.4, 683.8, 705.6, 727.6, 750.1, 772.8, 795.9, 819.4, 843.2, 867.3, 891.8, 916.6, 941.8, 967.3, 993.1, 1019, 1046, 1073, 1100, 1128, 1155, 1184, 1212, 1241, 1270, 1300, 1330, 1360, 1391, 1422, 1453, 1485, 1517, 1549, 1582, 1615, 1648, 1682, 1716, 1751, 1785, 1820, 1856, 1892, 1928, 1964, 2001, 2038, 2076, 2114, 2152, 2190, 2229, 2268, 2308, 2348, 2388, 2428, 2469, 2511, 2552, 2594, 2636, 2679, 2722, 2765], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 50.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.317, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 627e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 645e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 171e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.711, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.208, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.243, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 6648e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.511, 4.717, 5.046, 6.778, 8.088, 11.77, 13.81, 22.24, 27.47, 32.07, 39.51, 47.16, 55.54, 64.65, 74.48, 85.05, 96.34, 108.4, 121.1, 134.6, 148.8, 163.7, 179.4, 195.8, 212.9, 230.8, 249.3, 268.7, 288.7, 309.5, 330.9, 353.2, 376.1, 399.8, 424.2, 449.3, 475.2, 501.8, 529.1, 557.2, 585.9, 615.5, 645.7, 676.7, 708.4, 740.8, 773.9, 807.8, 842.4, 877.7, 913.8, 950.6, 988.1, 1026, 1065, 1105, 1146, 1187, 1229, 1271, 1315, 1359, 1403, 1449, 1495, 1542, 1590, 1638, 1688, 1737, 1788, 1839, 1892, 1944, 1998, 2052, 2107, 2163, 2219, 2277, 2335, 2393, 2453, 2513, 2574, 2635, 2697, 2760, 2824, 2889, 2954, 3020, 3086, 3154, 3222, 3291, 3360, 3431, 3502, 3574, 3646, 3719, 3793, 3868, 3943, 4019, 4096, 4174, 4252, 4331, 4411, 4492, 4573, 4655, 4737, 4821, 4905, 4990, 5075, 5162, 5249, 5337, 5425, 5514, 5604, 5695, 5787, 5879], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 89.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 319e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 485e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 938e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.677, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.214, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.229, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 341e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [3.666, 4.289, 5.901, 6.365, 7.94, 11.37, 8.586, 12.97, 11.36, 12.56, 14.57, 13.29, 14.53, 15.51, 15.95, 17.55, 19.45, 21.58, 25.39, 22.84, 28.04, 30.2, 32.48, 34.85, 37.34, 39.92, 42.62, 45.42, 48.32, 51.34, 54.45, 57.68, 61, 64.44, 67.98, 71.62, 75.37, 79.23, 83.19, 87.26, 91.44, 95.71, 100.1, 104.6, 109.2, 113.9, 118.7, 123.6, 128.6, 133.8, 139, 144.3, 149.8, 155.3, 161, 166.7, 172.6, 178.6, 184.6, 190.8, 197.1, 203.5, 210, 216.6, 223.3, 230.1, 237, 244.1, 251.2, 258.4, 265.8, 273.2, 280.8, 288.4, 296.2, 304.1, 312.1, 320.1, 328.3, 336.6, 345, 353.5, 362.1, 370.9, 379.7, 388.6, 397.6, 406.8, 416, 425.4, 434.8, 444.4, 454.1, 463.8, 473.7, 483.7, 493.8, 504, 514.3, 524.7, 535.2, 545.8, 556.6, 567.4, 578.3, 589.4, 600.5, 611.8, 623.1, 634.6, 646.2, 657.8, 669.6, 681.5, 693.5, 705.6, 717.8, 730.1, 742.5, 755.1, 767.7, 780.4, 793.3, 806.2, 819.2, 832.4, 845.7, 859], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "violin-strings.4": {
      is: "violin-strings",
      about: "Artifastring's violin strings, its set 4.",
      values: {
        G3: {
          tension: { value: 35.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.32, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 676e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 226e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 133e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.659, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.226, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.085, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01424, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 56, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5548, 1.469, 1.644, 3.766, 5.85, 9.451, 12.4, 12.21, 17.35, 22.1, 26.96, 32.33, 38.21, 44.61, 51.51, 58.92, 66.85, 75.29, 84.24, 93.7, 103.7, 114.2, 125.1, 136.7, 148.7, 161.2, 174.2, 187.8, 201.9, 216.4, 231.5, 247.1, 263.2, 279.8, 297, 314.6, 332.8, 351.4, 370.6, 390.3, 410.5, 431.2, 452.4, 474.2, 496.4, 519.2, 542.4, 566.2, 590.5, 615.3, 640.6, 666.5, 692.8, 719.6, 747, 774.9, 803.2, 832.1, 861.5, 891.5, 921.9, 952.8, 984.3, 1016, 1049, 1082, 1115, 1149, 1184, 1219, 1254, 1290, 1327, 1364, 1402, 1440, 1478, 1517, 1557, 1597, 1638, 1679, 1721, 1763, 1806, 1849, 1893, 1937, 1981, 2027, 2073, 2119, 2166, 2213, 2261, 2309, 2358, 2407, 2457, 2507, 2558, 2610, 2662, 2714, 2767, 2820, 2874, 2929, 2984, 3039, 3095, 3152, 3209, 3266, 3324, 3383, 3442, 3502, 3562, 3622, 3683, 3745, 3807, 3870, 3933, 3997, 4061, 4125], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 46.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 762e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 128e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 136e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.636, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.227, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.09, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 1224e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 48, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.049, 2.066, 3.62, 4.496, 9.116, 14.8, 20.2, 27.9, 36.67, 45.62, 56.13, 67.76, 80.49, 94.33, 109.3, 125.3, 142.5, 160.8, 180.1, 200.6, 222.2, 244.9, 268.7, 293.6, 319.6, 346.7, 375, 404.3, 434.8, 466.3, 499, 532.7, 567.6, 603.6, 640.7, 678.9, 718.2, 758.6, 800.1, 842.7, 886.5, 931.3, 977.2, 1024, 1072, 1122, 1172, 1224, 1276, 1330, 1385, 1441, 1498, 1556, 1615, 1675, 1737, 1799, 1863, 1928, 1994, 2061, 2129, 2198, 2268, 2340, 2412, 2486, 2560, 2636, 2713, 2791, 2870, 2951, 3032, 3115, 3198, 3283, 3369, 3455, 3544, 3633, 3723, 3814, 3907, 4e3, 4095, 4191, 4287, 4385, 4485, 4585, 4686, 4788, 4892, 4997, 5102, 5209, 5317, 5426, 5536, 5648, 5760, 5873, 5988, 6104, 6220, 6338, 6457, 6578, 6699, 6821, 6945, 7069, 7195, 7321, 7449, 7578, 7708, 7840, 7972, 8105, 8240, 8375, 8512, 8650, 8789, 8929], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 73.8, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.324, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 623e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 905e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 239e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.653, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.23, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.084, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 5882e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.065, 4.795, 4.751, 8.035, 10.53, 12.29, 19.78, 24.54, 31.06, 38.45, 46.71, 55.84, 65.84, 76.71, 88.45, 101.1, 114.5, 128.9, 144.1, 160.2, 177.1, 195, 213.7, 233.2, 253.6, 274.9, 297.1, 320.2, 344.1, 368.9, 394.5, 421, 448.4, 476.7, 505.8, 535.8, 566.7, 598.4, 631, 664.5, 698.8, 734, 770.1, 807.1, 844.9, 883.6, 923.1, 963.6, 1005, 1047, 1090, 1134, 1179, 1224, 1271, 1318, 1367, 1416, 1466, 1517, 1568, 1621, 1674, 1729, 1784, 1840, 1897, 1955, 2013, 2073, 2133, 2195, 2257, 2320, 2384, 2449, 2514, 2581, 2648, 2716, 2786, 2856, 2926, 2998, 3071, 3144, 3219, 3294, 3370, 3447, 3525, 3603, 3683, 3763, 3845, 3927, 4010, 4094, 4178, 4264, 4351, 4438, 4526, 4615, 4705, 4796, 4888, 4980, 5074, 5168, 5264, 5360, 5457, 5554, 5653, 5753, 5853, 5954, 6056, 6159, 6263, 6368, 6474, 6580, 6688, 6796, 6905, 7015], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        E5: {
          tension: { value: 82.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.327, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 297e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 431e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 101e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.65, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.244, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.088, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2659e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 104, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.787, 2.56, 6.59, 4.055, 7.734, 10.79, 9.329, 7.968, 9.623, 11.74, 12.14, 12.23, 14.31, 14.21, 16.33, 19.02, 23.97, 23.57, 25.78, 28.12, 30.58, 33.17, 35.89, 38.73, 41.7, 44.8, 48.02, 51.37, 54.85, 58.45, 62.18, 66.04, 70.02, 74.12, 78.36, 82.72, 87.21, 91.82, 96.56, 101.4, 106.4, 111.5, 116.8, 122.2, 127.7, 133.3, 139, 144.9, 150.9, 157, 163.3, 169.7, 176.2, 182.8, 189.6, 196.5, 203.5, 210.6, 217.9, 225.3, 232.8, 240.5, 248.2, 256.1, 264.2, 272.3, 280.6, 289, 297.5, 306.2, 315, 323.9, 332.9, 342.1, 351.4, 360.8, 370.3, 380, 389.8, 399.7, 409.8, 419.9, 430.2, 440.7, 451.2, 461.9, 472.7, 483.6, 494.7, 505.9, 517.2, 528.6, 540.2, 551.9, 563.7, 575.7, 587.7, 599.9, 612.2, 624.7, 637.3, 650, 662.8, 675.8, 688.8, 702.1, 715.4, 728.8, 742.4, 756.1, 770, 784, 798, 812.3, 826.6, 841.1, 855.7, 870.4, 885.3, 900.2, 915.3, 930.6, 945.9, 961.4, 977, 992.8, 1009, 1025], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "viola-strings": {
      is: "bowed-string-set",
      about: "The viola's strings as Artifastring measured them: every quantity's range across its 2 sets.",
      values: {
        C3: {
          tension: { range: [46.2, 63.3], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.367, 0.369], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [715e-6, 902e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [502e-5, 693e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [462e7, 187e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.73, 0.96], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.213, 0.228], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.226, 0.273], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [0.02417, 0.02424], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [84, 84], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        },
        G3: {
          tension: { range: [43.7, 64.6], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.364, 0.369], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [644e-6, 671e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [211e-5, 321e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [119e8, 123e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.718, 0.945], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.212, 0.231], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.224, 0.26], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [0.01184, 0.01407], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [64, 72], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        },
        D4: {
          tension: { range: [42.6, 49.3], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.363, 0.373], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [288e-6, 438e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [935e-6, 103e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [414e8, 127e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.741, 0.924], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.215, 0.229], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.232, 0.285], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [2727e-6, 2842e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [80, 92], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        },
        A4: {
          tension: { range: [100.2, 118.9], unit: "N", kind: "other", source: "artifastring", note: "across its 2 sets" },
          length: { range: [0.363, 0.373], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          diameter: { range: [313e-6, 352e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          density: { range: [977e-6, 11e-4], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 2 sets" },
          young: { range: [167e9, 219e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionStatic: { range: [0.762, 0.963], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionDynamic: { range: [0.205, 0.225], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          frictionSteepness: { range: [0.222, 0.277], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" },
          quiet: { range: [2016e-7, 2623e-7], unit: "m/s", kind: "other", source: "artifastring", note: "across its 2 sets" },
          modes: { range: [92, 100], unit: "1", kind: "other", source: "artifastring", note: "across its 2 sets" }
        }
      }
    },
    "viola-strings.0": {
      is: "viola-strings",
      about: "Artifastring's viola strings, its set 0.",
      values: {
        C3: {
          tension: { value: 46.2, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.369, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 715e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 502e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 187e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.73, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.228, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.273, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.02417, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 84, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.6495, 1.771, 3.434, 4.209, 6.285, 8.386, 10.88, 10.11, 11.77, 11.49, 7.699, 14.37, 16.35, 18.5, 20.83, 23.32, 25.99, 28.83, 31.84, 35.03, 38.38, 41.91, 45.61, 49.48, 53.53, 57.75, 62.14, 66.7, 71.43, 76.34, 81.41, 86.66, 92.09, 97.68, 103.4, 109.4, 115.5, 121.8, 128.2, 134.9, 141.7, 148.6, 155.8, 163.1, 170.6, 178.2, 186.1, 194.1, 202.2, 210.6, 219.1, 227.8, 236.7, 245.7, 254.9, 264.3, 273.8, 283.6, 293.5, 303.5, 313.8, 324.2, 334.8, 345.5, 356.5, 367.6, 378.8, 390.3, 401.9, 413.7, 425.7, 437.8, 450.1, 462.6, 475.2, 488.1, 501, 514.2, 527.6, 541.1, 554.7, 568.6, 582.6, 596.8, 611.2, 625.7, 640.5, 655.4, 670.4, 685.6, 701.1, 716.6, 732.4, 748.3, 764.4, 780.7, 797.1, 813.7, 830.5, 847.4, 864.6, 881.9, 899.3, 917, 934.8, 952.8, 970.9, 989.3, 1008, 1026, 1045, 1064, 1084, 1103, 1122, 1142, 1162, 1182, 1202, 1223, 1243, 1264, 1285, 1306, 1327, 1349, 1370, 1392], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G3: {
          tension: { value: 64.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.364, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 671e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 321e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 123e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.718, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.231, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.26, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01184, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 72, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.412, 1.11, 3.256, 3.212, 3.891, 6.572, 7.844, 8.524, 10.5, 18.17, 14.56, 8.567, 23.76, 27.56, 31.66, 36.07, 40.78, 45.8, 51.12, 56.75, 62.68, 68.91, 75.45, 82.29, 89.43, 96.88, 104.6, 112.7, 121.1, 129.7, 138.7, 148, 157.5, 167.4, 177.6, 188.1, 198.9, 210, 221.4, 233.1, 245.1, 257.4, 270, 283, 296.2, 309.7, 323.6, 337.7, 352.1, 366.9, 381.9, 397.3, 412.9, 428.9, 445.2, 461.7, 478.6, 495.8, 513.3, 531.1, 549.2, 567.6, 586.3, 605.3, 624.6, 644.2, 664.1, 684.3, 704.8, 725.7, 746.8, 768.2, 790, 812, 834.4, 857, 880, 903.2, 926.8, 950.7, 974.8, 999.3, 1024, 1049, 1075, 1100, 1126, 1153, 1179, 1206, 1233, 1261, 1289, 1317, 1345, 1374, 1403, 1432, 1462, 1492, 1522, 1553, 1584, 1615, 1646, 1678, 1710, 1742, 1775, 1808, 1841, 1875, 1909, 1943, 1978, 2012, 2048, 2083, 2119, 2155, 2191, 2228, 2265, 2302, 2339, 2377, 2415, 2454], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 42.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.363, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 438e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 935e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 414e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.741, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.229, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.285, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2727e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 80, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.295, 4.237, 2.913, 4.48, 5.99, 9.201, 7.977, 12.31, 13.94, 17.5, 20.94, 24.75, 28.91, 33.44, 38.34, 43.59, 49.21, 55.19, 61.53, 68.23, 75.3, 82.73, 90.52, 98.68, 107.2, 116.1, 125.3, 134.9, 144.9, 155.2, 165.9, 177, 188.4, 200.1, 212.3, 224.8, 237.7, 250.9, 264.5, 278.4, 292.7, 307.4, 322.5, 337.9, 353.6, 369.8, 386.2, 403.1, 420.3, 437.9, 455.8, 474.1, 492.8, 511.8, 531.2, 551, 571.1, 591.5, 612.4, 633.6, 655.1, 677.1, 699.4, 722, 745, 768.4, 792.1, 816.2, 840.7, 865.5, 890.7, 916.3, 942.2, 968.4, 995.1, 1022, 1049, 1077, 1105, 1134, 1163, 1192, 1221, 1251, 1281, 1312, 1343, 1374, 1406, 1438, 1471, 1503, 1537, 1570, 1604, 1638, 1673, 1708, 1743, 1779, 1815, 1851, 1888, 1925, 1963, 2001, 2039, 2077, 2116, 2156, 2195, 2235, 2276, 2317, 2358, 2399, 2441, 2483, 2526, 2569, 2612, 2656, 2700, 2744, 2789, 2834, 2880, 2925], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 100.2, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.363, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 313e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 977e-6, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 167e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.762, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.225, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.277, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2016e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 100, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.934, 3.088, 6.086, 8.279, 7.242, 8.148, 12.53, 12.31, 16.05, 21.64, 14.91, 17.73, 20.46, 21.89, 27.41, 28.36, 31.25, 35.72, 39.3, 43.07, 47.05, 51.24, 55.62, 60.22, 65.01, 70.01, 75.22, 80.63, 86.24, 92.06, 98.08, 104.3, 110.7, 117.4, 124.2, 131.2, 138.5, 145.9, 153.6, 161.5, 169.5, 177.8, 186.3, 194.9, 203.8, 212.9, 222.2, 231.7, 241.4, 251.3, 261.4, 271.7, 282.2, 292.9, 303.8, 314.9, 326.3, 337.8, 349.5, 361.5, 373.6, 386, 398.5, 411.3, 424.2, 437.4, 450.8, 464.3, 478.1, 492.1, 506.3, 520.7, 535.3, 550.1, 565.1, 580.3, 595.7, 611.3, 627.1, 643.1, 659.4, 675.8, 692.4, 709.3, 726.3, 743.6, 761, 778.7, 796.5, 814.6, 832.9, 851.3, 870, 888.9, 908, 927.3, 946.8, 966.4, 986.3, 1006, 1027, 1047, 1068, 1089, 1110, 1131, 1153, 1175, 1197, 1219, 1241, 1264, 1286, 1309, 1333, 1356, 1379, 1403, 1427, 1451, 1476, 1500, 1525, 1550, 1575, 1601, 1626, 1652], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "viola-strings.1": {
      is: "viola-strings",
      about: "Artifastring's viola strings, its set 1.",
      values: {
        C3: {
          tension: { value: 63.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.367, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 902e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 693e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 462e7, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.96, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.213, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.226, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.02424, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 84, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5617, 2.11, 1.256, 3.106, 3.474, 4.383, 5.912, 6.002, 7.16, 8.057, 9.817, 11.44, 13.56, 15.59, 17.78, 6.526, 22.66, 25.35, 28.19, 31.2, 34.38, 37.71, 41.21, 44.87, 48.69, 52.67, 56.82, 61.13, 65.61, 70.24, 75.04, 80, 85.12, 90.41, 95.86, 101.5, 107.2, 113.2, 119.3, 125.5, 132, 138.6, 145.3, 152.2, 159.3, 166.5, 173.9, 181.5, 189.2, 197.1, 205.2, 213.4, 221.8, 230.3, 239, 247.9, 256.9, 266.1, 275.4, 284.9, 294.6, 304.5, 314.5, 324.6, 335, 345.5, 356.1, 366.9, 377.9, 389, 400.4, 411.8, 423.5, 435.2, 447.2, 459.3, 471.6, 484, 496.6, 509.4, 522.3, 535.4, 548.7, 562.1, 575.7, 589.4, 603.3, 617.4, 631.7, 646, 660.6, 675.3, 690.2, 705.3, 720.5, 735.8, 751.4, 767.1, 782.9, 798.9, 815.1, 831.5, 848, 864.7, 881.5, 898.5, 915.7, 933, 950.5, 968.1, 985.9, 1004, 1022, 1040, 1059, 1077, 1096, 1115, 1134, 1154, 1173, 1193, 1212, 1232, 1252, 1273, 1293, 1314], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G3: {
          tension: { value: 43.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.369, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 644e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 211e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 119e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.945, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.212, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.224, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.01407, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 64, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.8636, 0.7092, 1.408, 1.73, 3.162, 4.563, 5.447, 6.292, 8.316, 10.39, 17.49, 21.15, 21.65, 27.34, 30.86, 35.4, 40.26, 45.43, 50.91, 56.7, 62.81, 69.23, 75.97, 83.02, 90.38, 98.05, 106, 114.3, 123, 131.9, 141.1, 150.7, 160.5, 170.7, 181.2, 192, 203.1, 214.6, 226.3, 238.4, 250.8, 263.4, 276.4, 289.8, 303.4, 317.3, 331.6, 346.1, 361, 376.2, 391.7, 407.5, 423.7, 440.1, 456.9, 473.9, 491.3, 509, 527, 545.4, 564, 583, 602.2, 621.8, 641.7, 661.9, 682.4, 703.2, 724.4, 745.8, 767.6, 789.7, 812.1, 834.8, 857.8, 881.2, 904.8, 928.8, 953.1, 977.6, 1003, 1028, 1053, 1079, 1105, 1132, 1159, 1186, 1213, 1241, 1269, 1297, 1326, 1355, 1384, 1414, 1444, 1474, 1504, 1535, 1566, 1598, 1630, 1662, 1694, 1727, 1760, 1793, 1827, 1861, 1895, 1930, 1965, 2e3, 2036, 2071, 2108, 2144, 2181, 2218, 2256, 2293, 2331, 2370, 2408, 2447, 2487, 2526], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D4: {
          tension: { value: 49.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.373, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 288e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 103e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 127e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.924, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.215, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.232, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2842e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.9367, 2.883, 5.089, 4.529, 6.694, 7.078, 8.835, 10.05, 9.632, 12.09, 11.96, 26.44, 16.1, 19.29, 21.73, 24.35, 27.15, 30.13, 33.3, 36.64, 40.17, 43.87, 47.76, 51.82, 56.07, 60.5, 65.11, 69.9, 74.87, 80.02, 85.35, 90.86, 96.56, 102.4, 108.5, 114.7, 121.1, 127.7, 134.5, 141.5, 148.6, 155.9, 163.4, 171.1, 179, 187, 195.2, 203.6, 212.2, 221, 229.9, 239.1, 248.4, 257.9, 267.5, 277.4, 287.4, 297.6, 308, 318.6, 329.4, 340.3, 351.4, 362.7, 374.2, 385.8, 397.7, 409.7, 421.9, 434.3, 446.8, 459.6, 472.5, 485.6, 498.9, 512.4, 526, 539.8, 553.8, 568, 582.4, 596.9, 611.7, 626.6, 641.7, 656.9, 672.4, 688, 703.8, 719.8, 736, 752.4, 768.9, 785.6, 802.5, 819.6, 836.9, 854.3, 871.9, 889.7, 907.7, 925.9, 944.2, 962.8, 981.5, 1e3, 1019, 1039, 1058, 1078, 1098, 1117, 1138, 1158, 1178, 1199, 1220, 1241, 1262, 1284, 1305, 1327, 1349, 1371, 1394, 1416, 1439, 1462], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A4: {
          tension: { value: 118.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.373, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 352e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 11e-4, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 219e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.963, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.205, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.222, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2623e-7, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.28, 2.336, 5.31, 4.746, 5.398, 10.06, 11.16, 11.81, 13.67, 15.66, 17.6, 19.69, 24.3, 27.82, 31.62, 35.7, 40.06, 44.7, 49.63, 54.83, 60.32, 66.09, 72.14, 78.47, 85.08, 91.98, 99.15, 106.6, 114.3, 122.4, 130.7, 139.2, 148.1, 157.3, 166.7, 176.4, 186.4, 196.7, 207.2, 218, 229.2, 240.5, 252.2, 264.2, 276.4, 288.9, 301.7, 314.8, 328.2, 341.8, 355.8, 370, 384.5, 399.2, 414.3, 429.6, 445.3, 461.2, 477.3, 493.8, 510.5, 527.6, 544.9, 562.5, 580.3, 598.5, 616.9, 635.6, 654.6, 673.9, 693.4, 713.3, 733.4, 753.8, 774.5, 795.4, 816.7, 838.2, 860, 882.1, 904.5, 927.1, 950.1, 973.3, 996.8, 1021, 1045, 1069, 1094, 1118, 1144, 1169, 1195, 1221, 1247, 1274, 1301, 1328, 1355, 1383, 1411, 1439, 1468, 1497, 1526, 1555, 1585, 1615, 1645, 1676, 1706, 1738, 1769, 1801, 1832, 1865, 1897, 1930, 1963, 1996, 2030, 2064, 2098, 2133, 2167, 2202, 2238, 2273], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "cello-strings": {
      is: "bowed-string-set",
      about: "The cello's strings as Artifastring measured them: every quantity's range across its 3 sets.",
      values: {
        C2: {
          tension: { range: [123.5, 161.5], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.673, 0.689], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [146e-5, 154e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [0.0156, 0.0212], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [12e9, 206e8], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.823, 1.103], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.406, 0.427], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.133, 0.29], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [0.05783, 0.06328], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [96, 100], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        },
        G2: {
          tension: { range: [116.6, 155.1], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.669, 0.686], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [103e-5, 11e-4], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [685e-5, 867e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [187e8, 24e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.836, 1.06], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.396, 0.421], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.133, 0.279], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [2597e-6, 2706e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [92, 96], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        },
        D3: {
          tension: { range: [99.7, 137.3], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.66, 0.694], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [88e-5, 102e-5], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [268e-5, 333e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [25e9, 25e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.827, 1.119], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.422, 0.433], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.139, 0.284], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [2688e-6, 2713e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [76, 88], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        },
        A3: {
          tension: { range: [123.1, 147.6], unit: "N", kind: "other", source: "artifastring", note: "across its 3 sets" },
          length: { range: [0.658, 0.694], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          diameter: { range: [747e-6, 781e-6], unit: "m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          density: { range: [135e-5, 167e-5], unit: "kg/m", kind: "other", source: "artifastring", note: "across its 3 sets" },
          young: { range: [194e8, 25e9], unit: "Pa", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionStatic: { range: [0.873, 1.124], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionDynamic: { range: [0.396, 0.428], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          frictionSteepness: { range: [0.126, 0.275], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" },
          quiet: { range: [235e-5, 2525e-6], unit: "m/s", kind: "other", source: "artifastring", note: "across its 3 sets" },
          modes: { range: [92, 96], unit: "1", kind: "other", source: "artifastring", note: "across its 3 sets" }
        }
      }
    },
    "cello-strings.0": {
      is: "cello-strings",
      about: "Artifastring's cello strings, its set 0.",
      values: {
        C2: {
          tension: { value: 161.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.673, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 146e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 0.0212, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 206e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.823, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.427, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.29, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.06041, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3959, 2.221, 2.834, 2.681, 3.967, 6.563, 6.368, 9.47, 12.34, 15.31, 10.04, 17.44, 20.31, 23.44, 26.81, 30.43, 34.3, 38.42, 42.79, 47.42, 52.29, 57.41, 62.78, 68.4, 74.27, 80.39, 86.76, 93.38, 100.2, 107.4, 114.7, 122.4, 130.2, 138.3, 146.7, 155.3, 164.2, 173.3, 182.7, 192.3, 202.2, 212.3, 222.6, 233.3, 244.1, 255.2, 266.6, 278.2, 290.1, 302.2, 314.6, 327.2, 340, 353.2, 366.5, 380.1, 394, 408.1, 422.5, 437.1, 452, 467.1, 482.4, 498, 513.9, 530, 546.4, 563, 579.8, 597, 614.3, 631.9, 649.8, 667.9, 686.3, 704.9, 723.7, 742.8, 762.2, 781.8, 801.7, 821.8, 842.1, 862.7, 883.6, 904.7, 926.1, 947.7, 969.5, 991.6, 1014, 1037, 1059, 1083, 1106, 1130, 1153, 1177, 1202, 1226, 1251, 1276, 1302, 1327, 1353, 1379, 1406, 1432, 1459, 1486, 1514, 1541, 1569, 1597, 1625, 1654, 1683, 1712, 1741, 1771, 1801, 1831, 1861, 1892, 1923, 1954, 1985, 2017], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G2: {
          tension: { value: 116.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.669, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 103e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 685e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 187e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.836, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.415, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.279, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2706e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3421, 1.051, 1.521, 2.009, 1.26, 3.25, 4.144, 4.566, 5.29, 6.565, 8.002, 8.42, 7.944, 14.04, 19.47, 17.83, 20.2, 22.72, 25.39, 28.21, 31.19, 34.32, 37.6, 41.04, 44.63, 48.37, 52.26, 56.3, 60.5, 64.85, 69.36, 74.01, 78.82, 83.79, 88.9, 94.17, 99.59, 105.2, 110.9, 116.8, 122.8, 129, 135.3, 141.8, 148.4, 155.2, 162.2, 169.3, 176.5, 183.9, 191.5, 199.2, 207.1, 215.1, 223.3, 231.6, 240, 248.7, 257.4, 266.4, 275.5, 284.7, 294.1, 303.6, 313.3, 323.2, 333.2, 343.3, 353.6, 364.1, 374.7, 385.5, 396.4, 407.4, 418.7, 430, 441.6, 453.3, 465.1, 477.1, 489.2, 501.5, 513.9, 526.5, 539.3, 552.2, 565.2, 578.4, 591.8, 605.3, 619, 632.8, 646.8, 660.9, 675.2, 689.6, 704.2, 718.9, 733.8, 748.8, 764, 779.4, 794.9, 810.5, 826.3, 842.3, 858.4, 874.6, 891, 907.6, 924.3, 941.2, 958.2, 975.4, 992.7, 1010, 1028, 1046, 1064, 1082, 1100, 1118, 1137, 1156, 1174, 1193, 1213, 1232], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D3: {
          tension: { value: 99.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.66, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 88e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 268e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.827, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.423, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.284, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2713e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 76, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.8156, 1.836, 3.812, 4.117, 4.889, 5.872, 8.164, 12.8, 15.01, 17.84, 20.33, 25.99, 30.13, 35.04, 40.34, 46.04, 52.13, 58.61, 65.48, 72.75, 80.41, 88.47, 96.91, 105.8, 115, 124.6, 134.6, 145, 155.8, 167, 178.6, 190.6, 203, 215.8, 228.9, 242.5, 256.4, 270.8, 285.5, 300.6, 316.1, 332, 348.3, 365, 382.1, 399.6, 417.5, 435.8, 454.4, 473.5, 492.9, 512.8, 533, 553.6, 574.6, 596.1, 617.9, 640.1, 662.6, 685.6, 709, 732.8, 756.9, 781.5, 806.4, 831.8, 857.5, 883.6, 910.2, 937.1, 964.4, 992.1, 1020, 1049, 1078, 1107, 1136, 1166, 1197, 1228, 1259, 1291, 1323, 1355, 1388, 1421, 1455, 1489, 1523, 1558, 1593, 1629, 1664, 1701, 1738, 1775, 1812, 1850, 1888, 1927, 1966, 2006, 2046, 2086, 2126, 2168, 2209, 2251, 2293, 2336, 2379, 2422, 2466, 2510, 2555, 2600, 2645, 2691, 2737, 2784, 2830, 2878, 2926, 2974, 3022, 3071, 3120, 3170], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A3: {
          tension: { value: 139.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.658, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 747e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 167e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 0.873, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.428, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.275, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 235e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [2.481, 2.487, 4.71, 3.964, 6.756, 7.696, 9.814, 10.86, 13.02, 15.72, 20.05, 19.87, 20.36, 23.04, 28.85, 32.5, 36.41, 40.57, 44.98, 49.65, 54.56, 59.73, 65.15, 70.82, 76.75, 82.93, 89.36, 96.04, 103, 110.2, 117.6, 125.3, 133.2, 141.4, 149.9, 158.6, 167.5, 176.7, 186.2, 195.9, 205.8, 216, 226.5, 237.2, 248.2, 259.4, 270.9, 282.6, 294.6, 306.8, 319.3, 332, 345, 358.2, 371.7, 385.5, 399.5, 413.7, 428.2, 443, 458, 473.2, 488.7, 504.5, 520.5, 536.8, 553.3, 570, 587.1, 604.3, 621.8, 639.6, 657.6, 675.9, 694.5, 713.2, 732.3, 751.6, 771.1, 790.9, 810.9, 831.2, 851.8, 872.6, 893.6, 914.9, 936.5, 958.3, 980.4, 1003, 1025, 1048, 1071, 1094, 1118, 1142, 1166, 1190, 1215, 1240, 1265, 1290, 1316, 1342, 1368, 1394, 1421, 1447, 1475, 1502, 1529, 1557, 1585, 1614, 1642, 1671, 1700, 1730, 1759, 1789, 1819, 1850, 1880, 1911, 1942, 1974, 2006, 2037], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "cello-strings.1": {
      is: "cello-strings",
      about: "Artifastring's cello strings, its set 1.",
      values: {
        C2: {
          tension: { value: 148.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.689, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 154e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 0.0186, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 152e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.103, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.406, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.133, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.05783, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3708, 1.256, 1.635, 2.688, 3.265, 4.88, 6.268, 7.56, 10.33, 16.23, 18.56, 21.71, 21.3, 30.11, 34.84, 39.92, 45.35, 51.14, 57.27, 63.75, 70.58, 77.76, 85.3, 93.18, 101.4, 110, 118.9, 128.2, 137.9, 147.8, 158.2, 168.9, 179.9, 191.3, 203, 215.1, 227.5, 240.3, 253.5, 267, 280.8, 295, 309.5, 324.4, 339.7, 355.2, 371.2, 387.5, 404.1, 421.1, 438.5, 456.2, 474.2, 492.6, 511.3, 530.4, 549.9, 569.7, 589.8, 610.3, 631.2, 652.4, 673.9, 695.8, 718, 740.6, 763.6, 786.9, 810.5, 834.5, 858.9, 883.6, 908.6, 934, 959.8, 985.9, 1012, 1039, 1066, 1094, 1122, 1150, 1178, 1207, 1237, 1266, 1296, 1326, 1357, 1388, 1419, 1451, 1483, 1516, 1548, 1582, 1615, 1649, 1683, 1717, 1752, 1788, 1823, 1859, 1895, 1932, 1969, 2006, 2044, 2082, 2120, 2159, 2198, 2237, 2277, 2317, 2358, 2399, 2440, 2481, 2523, 2565, 2608, 2651, 2694, 2738, 2782, 2826], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G2: {
          tension: { value: 155.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.686, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 11e-4, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 867e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 24e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.058, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.421, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.133, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 267e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 92, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5527, 2.439, 1.238, 1.801, 2.584, 2.923, 4.733, 4.94, 7.037, 7.619, 9.309, 11.88, 13.33, 15.56, 20.27, 25.3, 20.42, 26.96, 30.1, 33.41, 36.91, 40.58, 44.44, 48.47, 52.69, 57.08, 61.65, 66.4, 71.33, 76.44, 81.73, 87.2, 92.85, 98.68, 104.7, 110.9, 117.2, 123.8, 130.5, 137.4, 144.5, 151.8, 159.2, 166.8, 174.6, 182.6, 190.8, 199.1, 207.6, 216.3, 225.2, 234.2, 243.5, 252.9, 262.5, 272.2, 282.2, 292.3, 302.6, 313.1, 323.8, 334.6, 345.7, 356.9, 368.3, 379.8, 391.6, 403.5, 415.6, 427.9, 440.3, 453, 465.8, 478.8, 492, 505.3, 518.9, 532.6, 546.5, 560.6, 574.8, 589.2, 603.9, 618.7, 633.6, 648.8, 664.1, 679.6, 695.3, 711.2, 727.2, 743.4, 759.9, 776.4, 793.2, 810.1, 827.3, 844.6, 862.1, 879.7, 897.6, 915.6, 933.8, 952.2, 970.7, 989.5, 1008, 1027, 1047, 1066, 1086, 1106, 1126, 1146, 1166, 1187, 1207, 1228, 1249, 1271, 1292, 1314, 1335, 1357, 1380, 1402, 1424, 1447], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D3: {
          tension: { value: 115.7, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.677, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 102e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 295e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.119, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.422, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.139, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2688e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 88, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.299, 2.921, 4.22, 5, 7.733, 7.589, 10.12, 11.78, 12.34, 17.6, 12.93, 20.53, 23.72, 27.18, 30.92, 34.93, 39.22, 43.79, 48.64, 53.76, 59.16, 64.84, 70.79, 77.02, 83.53, 90.31, 97.38, 104.7, 112.3, 120.2, 128.4, 136.8, 145.6, 154.6, 163.8, 173.4, 183.2, 193.3, 203.7, 214.4, 225.3, 236.5, 248, 259.8, 271.8, 284.2, 296.8, 309.6, 322.8, 336.2, 349.9, 363.9, 378.2, 392.7, 407.5, 422.6, 438, 453.6, 469.5, 485.7, 502.2, 519, 536, 553.3, 570.9, 588.8, 606.9, 625.3, 644, 663, 682.2, 701.7, 721.5, 741.6, 762, 782.6, 803.5, 824.7, 846.2, 867.9, 889.9, 912.2, 934.8, 957.6, 980.7, 1004, 1028, 1052, 1076, 1100, 1125, 1150, 1176, 1201, 1227, 1253, 1280, 1307, 1334, 1361, 1388, 1416, 1444, 1473, 1501, 1530, 1559, 1589, 1619, 1649, 1679, 1710, 1741, 1772, 1803, 1835, 1867, 1899, 1932, 1964, 1998, 2031, 2065, 2098, 2133, 2167, 2202, 2237], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A3: {
          tension: { value: 123.1, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.687, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 77e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 135e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 194e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.124, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.396, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.126, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2525e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.618, 3.321, 2.822, 2.933, 3.106, 3.648, 4.439, 5.02, 6.789, 6.726, 8.701, 10.45, 11.01, 12.83, 13.96, 16.63, 17.77, 19.66, 22.11, 24.36, 26.74, 29.23, 31.85, 34.59, 37.46, 40.44, 43.55, 46.77, 50.12, 53.59, 57.19, 60.9, 64.74, 68.7, 72.78, 76.98, 81.3, 85.75, 90.32, 95.01, 99.82, 104.8, 109.8, 115, 120.3, 125.7, 131.2, 136.9, 142.7, 148.6, 154.6, 160.8, 167.1, 173.4, 180, 186.6, 193.4, 200.2, 207.2, 214.4, 221.6, 229, 236.5, 244.1, 251.8, 259.7, 267.7, 275.8, 284, 292.3, 300.8, 309.4, 318.1, 326.9, 335.9, 344.9, 354.1, 363.5, 372.9, 382.5, 392.1, 401.9, 411.9, 421.9, 432.1, 442.4, 452.8, 463.3, 474, 484.8, 495.7, 506.7, 517.8, 529.1, 540.5, 552, 563.6, 575.4, 587.3, 599.3, 611.4, 623.6, 636, 648.5, 661.1, 673.8, 686.7, 699.6, 712.7, 725.9, 739.3, 752.7, 766.3, 780, 793.8, 807.8, 821.9, 836, 850.4, 864.8, 879.3, 894, 908.8, 923.7, 938.8, 953.9, 969.2, 984.6], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    },
    "cello-strings.2": {
      is: "cello-strings",
      about: "Artifastring's cello strings, its set 2.",
      values: {
        C2: {
          tension: { value: 123.5, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.687, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 152e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 0.0156, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 12e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.042, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.415, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.178, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 0.06328, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 100, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.3541, 1.447, 1.343, 2.086, 3.091, 4.277, 4.652, 8.339, 7.746, 11.3, 9.523, 12.53, 13.15, 16.85, 19.29, 21.9, 24.69, 27.66, 30.81, 34.14, 37.65, 41.34, 45.21, 49.26, 53.49, 57.91, 62.5, 67.27, 72.22, 77.35, 82.66, 88.15, 93.82, 99.68, 105.7, 111.9, 118.3, 124.9, 131.6, 138.6, 145.7, 153, 160.4, 168.1, 175.9, 183.9, 192.1, 200.5, 209.1, 217.8, 226.7, 235.8, 245.1, 254.5, 264.1, 274, 284, 294.1, 304.5, 315, 325.7, 336.6, 347.7, 358.9, 370.4, 382, 393.8, 405.8, 417.9, 430.2, 442.8, 455.5, 468.3, 481.4, 494.6, 508, 521.6, 535.4, 549.3, 563.5, 577.8, 592.3, 607, 621.8, 636.8, 652.1, 667.5, 683, 698.8, 714.7, 730.8, 747.1, 763.6, 780.3, 797.1, 814.1, 831.3, 848.7, 866.2, 884, 901.9, 920, 938.2, 956.7, 975.3, 994.2, 1013, 1032, 1052, 1071, 1091, 1111, 1131, 1151, 1172, 1192, 1213, 1234, 1255, 1276, 1298, 1320, 1342, 1364, 1386, 1408, 1431, 1454], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        G2: {
          tension: { value: 140.9, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.683, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 108e-5, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 794e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 218e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.06, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.396, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.171, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2597e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [0.5419, 2.061, 1.397, 2.238, 2.824, 4.662, 4.559, 6.249, 9.146, 7.518, 11.76, 15.44, 15.5, 18.84, 21.65, 24.66, 27.89, 31.32, 34.97, 38.82, 42.88, 47.14, 51.62, 56.3, 61.19, 66.29, 71.6, 77.11, 82.84, 88.77, 94.91, 101.3, 107.8, 114.6, 121.5, 128.7, 136.1, 143.7, 151.5, 159.5, 167.8, 176.2, 184.8, 193.7, 202.7, 212, 221.4, 231.1, 241, 251.1, 261.4, 271.9, 282.6, 293.6, 304.7, 316, 327.6, 339.4, 351.3, 363.5, 375.9, 388.5, 401.3, 414.3, 427.5, 440.9, 454.6, 468.4, 482.4, 496.7, 511.2, 525.8, 540.7, 555.8, 571.1, 586.6, 602.3, 618.2, 634.4, 650.7, 667.3, 684, 701, 718.1, 735.5, 753.1, 770.9, 788.9, 807.1, 825.5, 844.2, 863, 882, 901.3, 920.8, 940.4, 960.3, 980.4, 1001, 1021, 1042, 1063, 1084, 1105, 1127, 1149, 1171, 1193, 1215, 1238, 1260, 1283, 1307, 1330, 1354, 1377, 1402, 1426, 1450, 1475, 1500, 1525, 1550, 1576, 1601, 1627, 1653, 1680], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        D3: {
          tension: { value: 137.3, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.694, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 913e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 333e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 25e9, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.034, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.433, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.17, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 269e-5, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 88, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.806, 1.533, 3.357, 2.43, 2.866, 3.355, 4.746, 6.538, 6.758, 10.19, 10.16, 17.02, 12.49, 17.48, 20, 24.24, 25.58, 28.66, 31.92, 35.36, 38.99, 42.81, 46.81, 51, 55.38, 59.94, 64.69, 69.63, 74.75, 80.05, 85.55, 91.23, 97.09, 103.1, 109.4, 115.8, 122.4, 129.2, 136.2, 143.4, 150.7, 158.3, 166, 173.9, 182, 190.3, 198.8, 207.4, 216.3, 225.3, 234.5, 243.9, 253.5, 263.3, 273.3, 283.4, 293.7, 304.3, 315, 325.9, 336.9, 348.2, 359.7, 371.3, 383.1, 395.1, 407.3, 419.7, 432.3, 445.1, 458, 471.1, 484.4, 497.9, 511.6, 525.5, 539.6, 553.8, 568.2, 582.9, 597.7, 612.7, 627.8, 643.2, 658.7, 674.5, 690.4, 706.5, 722.8, 739.3, 755.9, 772.8, 789.8, 807.1, 824.5, 842.1, 859.9, 877.8, 896, 914.3, 932.9, 951.6, 970.5, 989.6, 1009, 1028, 1048, 1068, 1088, 1108, 1128, 1149, 1170, 1191, 1212, 1233, 1255, 1276, 1298, 1320, 1343, 1365, 1388, 1410, 1433, 1457, 1480, 1504], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        },
        A3: {
          tension: { value: 147.6, unit: "N", kind: "other", source: "artifastring" },
          length: { value: 0.694, unit: "m", kind: "other", source: "artifastring" },
          diameter: { value: 781e-6, unit: "m", kind: "other", source: "artifastring" },
          density: { value: 159e-5, unit: "kg/m", kind: "other", source: "artifastring" },
          young: { value: 235e8, unit: "Pa", kind: "other", source: "artifastring" },
          frictionStatic: { value: 1.076, unit: "1", kind: "other", source: "artifastring" },
          frictionDynamic: { value: 0.397, unit: "1", kind: "other", source: "artifastring" },
          frictionSteepness: { value: 0.179, unit: "1", kind: "other", source: "artifastring" },
          quiet: { value: 2379e-6, unit: "m/s", kind: "other", source: "artifastring" },
          modes: { value: 96, unit: "1", kind: "other", source: "artifastring" },
          decays: { value: [1.731, 2.427, 3.537, 3.893, 3.95, 5.767, 8.763, 7.577, 10.27, 8.258, 11.58, 14.45, 14.19, 19.72, 19.28, 23.65, 24.73, 28.67, 31.77, 35.05, 38.51, 42.15, 45.96, 49.95, 54.11, 58.46, 62.98, 67.67, 72.55, 77.6, 82.83, 88.24, 93.82, 99.59, 105.5, 111.6, 117.9, 124.4, 131.1, 137.9, 144.9, 152.1, 159.4, 167, 174.7, 182.6, 190.6, 198.9, 207.3, 215.9, 224.7, 233.6, 242.7, 252.1, 261.5, 271.2, 281, 291.1, 301.3, 311.6, 322.2, 332.9, 343.8, 354.9, 366.1, 377.6, 389.2, 401, 412.9, 425.1, 437.4, 449.9, 462.6, 475.4, 488.5, 501.7, 515.1, 528.6, 542.4, 556.3, 570.4, 584.6, 599.1, 613.7, 628.5, 643.5, 658.7, 674, 689.5, 705.2, 721.1, 737.1, 753.3, 769.7, 786.3, 803.1, 820, 837.1, 854.4, 871.9, 889.5, 907.3, 925.3, 943.5, 961.8, 980.4, 999.1, 1018, 1037, 1056, 1076, 1095, 1115, 1135, 1155, 1175, 1196, 1217, 1237, 1258, 1280, 1301, 1322, 1344, 1366, 1388, 1410, 1433], unit: "1/s", kind: "other", source: "artifastring", note: "each mode's decay, lowest first" }
        }
      }
    }
  }
};

// registry/players/bowed.json
var bowed_default2 = {
  schema: "musebots.registry-players/1",
  about: "What the players of the bowed strings do, on the objects' tree (registry/README.md): a node's values are its players'; one a node does not give, its parent's.",
  nodes: {
    instrument: {
      values: {
        legato: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note slurred to on recordings, or a change of bow, goes on from past the next recording's own measured attack, crossfaded over this, the pitch stepping, never sliding (a finger's change; a slide is a glissando's, asked for) -- every seat's, a string's as a wind's", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }] },
        vibrato: {
          spread: {
            rate: { value: 0.35, unit: "Hz, a normal deviate's scale", kind: "unmeasured", reason: "ours: how far a player's rate lies from their instrument's, between players (each seat drawn once): within the measured spreads, cellists' 0.28-0.42 Hz, singers' 0.4", searched: [{ where: "arXiv", query: "hu-2025: cellists' vibrato by string register", date: "2026-10-29", found: "cellists' depth (half the peak-to-peak) rising with the stopped note's place toward the bridge, fitted 63.8 (x - 0.054)^2 + 3.31 cents over x, its place as a share of the string from the nut (R^2 0.51, 94 excerpts); rates 5.26 Hz (s.d. 0.28, TinySOL's players) and 6.48 Hz (s.d. 0.42, three soloists' concerto recordings); no one width an instrument's" }, { where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }, { where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }] },
            width: { value: 0.2, unit: "share of the width, a normal deviate's scale in its logarithm", kind: "unmeasured", reason: "ours: how far a player's width lies from their instrument's, between players: near singers' 0.13 between them and one violinist's 0.18 between notes", searched: [{ where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }, { where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }, { where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }] }
          },
          ending: {
            seconds: { value: 0.8, unit: "s", kind: "unmeasured", reason: "ours: a note's rate rising over its last seconds this long, as singers' and a string player's rise toward a note's end", searched: [{ where: "web search", query: 'Prame 1994 "Measurements of the vibrato rate of ten singers" rate increases toward end of tone', date: "2026-10-29", found: "singers' rate rising over a long note's last few cycles (Prame 1994, by secondary accounts: 'a couple of Hz', 15%), not string players'; Desain, Honing, Aarts & Timmers 1999 show a string player's rate rising toward a note's end, its slope not tabulated" }] },
            share: { value: 0.05, unit: "share of its rate", kind: "unmeasured", reason: "ours: its rate this share faster at the note's end, under singers' 15%", searched: [{ where: "web search", query: 'Prame 1994 "Measurements of the vibrato rate of ten singers" rate increases toward end of tone', date: "2026-10-29", found: "singers' rate rising over a long note's last few cycles (Prame 1994, by secondary accounts: 'a couple of Hz', 15%), not string players'; Desain, Honing, Aarts & Timmers 1999 show a string player's rate rising toward a note's end, its slope not tabulated" }] }
          },
          drift: {
            rate: { value: 0.03, unit: "share of its rate", kind: "unmeasured", reason: "ours: a note's rate wandering slowly by this share", searched: [{ where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }, { where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }] },
            width: { value: 0.1, unit: "share of its width", kind: "unmeasured", reason: "ours: its width wandering slowly by this share, under singers' 0.18 within a tone", searched: [{ where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }, { where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }] },
            hertz: { value: 0.7, unit: "Hz", kind: "unmeasured", reason: "ours: how fast its rate and width wander", searched: [{ where: "registry sources", query: "mellody-wakefield-2000: one violinist's vibrato across ten notes", date: "2026-10-29", found: "5.9 Hz (s.d. 0.2 Hz between the notes), an excursion of 15.2 cents each way (s.d. 2.8, about 0.18 of it), each note near one sinusoid, its slow changes 'the natural evolution of a note' from onset to offset, not tabulated: one player" }, { where: "registry sources", query: "prame-1997: how far singers' vibrato differs, between them and within a tone", date: "2026-10-29", found: "ten singers' mean rates 5.4-6.7 Hz (s.d. 0.4 Hz between them, Prame 1994's), their extents a mean 71 cents (s.d. 9 between singers, about 0.13 of it; 13 within a tone, about 0.18): singers, not string players" }] }
          },
          onset: { value: 0.25, unit: "s", kind: "unmeasured", reason: "ours: its width growing over this once its vibrato begins, as singers' extent grows over a tone's beginning", searched: [{ where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }, { where: "registry sources", query: "geringer-allen-macleod-2005, allen-geringer-macleod-2009: vibrato's start", date: "2026-10-29", found: "a stretch without vibrato where a note changes, 0.42 s for university players, 0.33 s for an artist, and no consistent first direction; how fast its width grows once it starts not given" }] },
          scope: { value: 0.3333333333333333, unit: "share of the players' measured widths", kind: "unmeasured", reason: "ours: the scope of vibrato a piece gives an instrument, where its spec names none, drawn once a piece this wide about a centre anywhere from none to all -- the style a conductor brings to a piece", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }] },
          arc: {
            apex: { value: 0.4, unit: "weight", kind: "unmeasured", reason: "ours: a note's vibrato intensity in its phrase, this much for its nearness to the phrase's apex", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            length: { value: 0.35, unit: "weight", kind: "unmeasured", reason: "ours: this much for its length past its delay", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            accent: { value: 0.15, unit: "weight", kind: "unmeasured", reason: "ours: this much for its accent", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            base: { value: 0.25, unit: "1", kind: "unmeasured", reason: "ours: the intensity's floor", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            fullSeconds: { value: 1.2, unit: "s", kind: "unmeasured", reason: "ours: a note this long past its delay counts as long", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            sooner: { value: 0.5, unit: "share of its delay", kind: "unmeasured", reason: "ours: its delay shortened by this share at full intensity", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            deepen: {
              share: { value: 0.25, unit: "share of its width", kind: "unmeasured", reason: "ours: its width growing by this share through a long note", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
              seconds: { value: 1.5, unit: "s", kind: "unmeasured", reason: "ours: over these seconds", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] }
            },
            taper: {
              seconds: { value: 0.15, unit: "s", kind: "unmeasured", reason: "ours: its width narrowing over these last seconds into a change or an end", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
              share: { value: 0.2, unit: "share of the note", kind: "unmeasured", reason: "ours: at most this share of the note", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] }
            },
            quicker: { value: 0.06, unit: "share of its rate", kind: "unmeasured", reason: "ours: its rate this share faster at full intensity than at none", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            peak: { value: 0.6, unit: "share of its phrase", kind: "unmeasured", reason: "ours: where a caller names no apex, its phrase's taken this far through it", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] },
            delay: { value: 0.35, unit: "s", kind: "unmeasured", reason: "ours: where a caller names no delay, this, within the measured 0.33-0.42 s", searched: [{ where: "registry sources", query: "geringer-allen-macleod-2005, allen-geringer-macleod-2009: vibrato's start", date: "2026-10-29", found: "a stretch without vibrato where a note changes, 0.42 s for university players, 0.33 s for an artist, and no consistent first direction; how fast its width grows once it starts not given" }] },
            fullAccent: { value: 6, unit: "dB", kind: "unmeasured", reason: "ours: an attack this many dB above its phrase's curve fully accented, for its vibrato's intensity", searched: [{ where: "web search", query: "violin vibrato width rate variation across a musical phrase measured performers expressive vibrato study", date: "2026-10-29", found: "players' rates and widths compared between players and contexts (Calitz 2009, four virtuosi; a WVU dissertation, forty violinists' Bach), none measured through a phrase against its apex, a note's length or its accent" }, { where: "registry sources", query: "prame-1997: a vibrato's arc within a tone", date: "2026-10-29", found: "singers' extent normally growing over a tone's beginning and shrinking over its end (its Fig. 5), not tabulated" }] }
          }
        },
        phraseAttack: {
          metre: { value: 1.5, unit: "dB", kind: "unmeasured", reason: "ours: a note on the bar's strongest position this many dB louder than on its weakest (KTH's metrical accents, sized by us)", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          crisper: { value: 0.3, unit: "share of its tonguing time", kind: "unmeasured", reason: "ours: tongued this share the quicker on the strongest position, gentler on the weakest", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          high: { value: 1, unit: "dB an octave", kind: "unmeasured", reason: "ours: an octave above its part's centre this many dB louder, below it softer -- a third of Friberg 1991's High Loud at k = 1 (3 dB an octave)", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          cents: { value: 4, unit: "cents an octave, and at most", kind: "literature", source: "friberg-1991", note: "High Sharp: 'pitch is sharpened by 4 cents/octave relative to equal temperament' at k = 1; held to an octave's worth at most, ours" },
          softer: { value: 3, unit: "dB", kind: "unmeasured", reason: "ours: a wind's re-entry after a catch breath this many dB softer", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          gentler: { value: 2.5, unit: "times its tonguing time", kind: "unmeasured", reason: "ours: and tongued this many times as slowly", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          carry: { value: 0.6, unit: "share", kind: "unmeasured", reason: "ours: a new phrase's first attacks begun from its last phrase's last, this share of the difference (the owner, 2 October 2026: a hysteresis of attacks after a phrase's ending)", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] },
          settle: { value: 1, unit: "beats", kind: "unmeasured", reason: "ours: that share halving every this many beats into the new phrase", searched: [{ where: "web search", query: 'KTH performance rules Director Musices "High-loud" dB per octave "High-sharp" cents per octave rule quantity k=1 Friberg', date: "2026-10-29", found: "Friberg 1991's High Loud, the level raised 3 dB an octave at k = 1, and High Sharp, 4 cents an octave in one-voice music (read in the paper itself); the rule quantity k a player's or a style's, Director Musices' examples k = 2.5 medium, 5 exaggerated; no metrical accent in dB, no re-entry's, no memory of a phrase's ending" }, { where: "registry sources", query: "friberg-1991, friberg-bresin-sundberg-2006: the rules and their sizes", date: "2026-10-29", found: "the phrase arch, metrical accents, high-loud and high-sharp as rules, their sizes by k; Friberg 1991 gives High Loud's and High Sharp's at k = 1 and none for an attack's place in its bar" }] }
        },
        noise: {
          timing: {
            sd: { value: 0.012, unit: "s", kind: "literature", source: "hennig-2011", note: "the lowest standard deviation of a beat from a metronome, experienced musicians' ('s ≈ 12 ms'; the average 21 ms): a competent player's, at temperature 1" },
            beta: { value: 1, unit: "its power falling as 1/f^beta, f in cycles an event", kind: "literature", source: "hennig-2011", note: "drummers' deviations, in two songs' recordings (1.1, 0.8) and tapping with a stick (0.9, 1.0) (Table 1); voices' 0.2-0.5; across every task 0.2-1.3, no one exponent" },
            low: { value: 1e-3, unit: "cycles an event", kind: "unmeasured", reason: "ours: the deviations correlated over a piece's thousand notes, flat beyond", searched: [{ where: "registry sources", query: "hennig-2011: over what span of beats a player's deviations stay correlated", date: "2026-11-01", found: "power laws over each whole recording (its fluctuation functions, Fig. 2C), no corner found either way; exponents 0.2 to 1.3" }] },
            high: { value: 0.45, unit: "cycles an event", kind: "unmeasured", reason: "ours: to just under half the rate of notes, from one note to the next", searched: [{ where: "registry sources", query: "hennig-2011: over what span of beats a player's deviations stay correlated", date: "2026-11-01", found: "power laws over each whole recording (its fluctuation functions, Fig. 2C), no corner found either way; exponents 0.2 to 1.3" }] }
          },
          tremor: {
            hz: { value: 10, unit: "Hz", kind: "literature", source: "mcauley-marsden-2000", note: "physiological tremor's central part, the CNS's '10-Hz range oscillatory activity' (its abstract), one of its several origins" },
            q: { value: 2, unit: "its frequency over its bandwidth", kind: "unmeasured", reason: "ours: a resonance as broad as the 10-Hz range's, several origins' sum", searched: [{ where: "PubMed", query: "McAuley & Marsden 2000, its abstract (PMID 10908186)", date: "2026-11-01", found: "physiological tremor 'multifactorial in origin': the CNS's '10-Hz range oscillatory activity', motor units' firing, mechanical and reflex-loop resonances, each dominating under other conditions; no bandwidth, nor a share of a musician's action" }] },
            share: { value: 0.2, unit: "of a continuous action's variance", kind: "unmeasured", reason: "ours: a part of the hand's and breath's fluctuation, heard as a slight shimmer, never a vibrato", searched: [{ where: "PubMed", query: "McAuley & Marsden 2000, its abstract (PMID 10908186)", date: "2026-11-01", found: "physiological tremor 'multifactorial in origin': the CNS's '10-Hz range oscillatory activity', motor units' firing, mechanical and reflex-loop resonances, each dominating under other conditions; no bandwidth, nor a share of a musician's action" }] }
          },
          action: {
            beta: { value: 1, unit: "its power falling as 1/f^beta", kind: "unmeasured", reason: "ours: a continuous action's fluctuation taken as the timing's, a hand's or breath's as a beat's", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }, { where: "web search", query: "wind instrument player blowing pressure fluctuation steady tone measured variability percent clarinet saxophone", date: "2026-11-01", found: "Fuks & Sundberg: blowing pressure systematic with loudness and pitch in professional oboe, bassoon, clarinet and alto saxophone players; no fluctuation within a steady tone in what was found" }] },
            low: { value: 0.05, unit: "Hz", kind: "unmeasured", reason: "ours: drifts slower than a long note's twenty seconds flat", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] },
            high: { value: 20, unit: "Hz", kind: "unmeasured", reason: "ours: a hand's or breath's control, to past its tremor", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }, { where: "PubMed", query: "McAuley & Marsden 2000, its abstract (PMID 10908186)", date: "2026-11-01", found: "physiological tremor 'multifactorial in origin': the CNS's '10-Hz range oscillatory activity', motor units' firing, mechanical and reflex-loop resonances, each dominating under other conditions; no bandwidth, nor a share of a musician's action" }] }
          },
          bow: {
            force: { value: 0.03, unit: "a share of the force asked", kind: "unmeasured", reason: "ours: slight, a bow's weight held steady to a few per cent", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] },
            speed: { value: 0.03, unit: "a share of the speed asked", kind: "unmeasured", reason: "ours: slight, as its force", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] },
            contact: { value: 2e-3, unit: "a share of the string's length", kind: "unmeasured", reason: "ours: well under a millimetre on a violin's string, the bow's drift across it", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] }
          },
          finger: {
            pitch: { value: 1.5, unit: "cents", kind: "unmeasured", reason: "ours: under a steady tone's difference limen (2.5-2.8 cents), the stopping finger's roll", searched: [{ where: "web search", query: "violin intonation pitch fluctuation within sustained note without vibrato cents standard deviation measured", date: "2026-11-01", found: "no deviation in cents of a note held without vibrato; a steady tone's pitch difference limen 2.5-2.8 cents (Brown & Vaughn 1996); Ando & Yamaguchi (1993) measured C5's fluctuations on several instruments with and without vibrato, not read" }] }
          },
          breath: {
            pressure: { value: 0.015, unit: "a share of the pressure asked", kind: "unmeasured", reason: "ours: slight, a breath's support held to a per cent or two", searched: [{ where: "web search", query: "wind instrument player blowing pressure fluctuation steady tone measured variability percent clarinet saxophone", date: "2026-11-01", found: "Fuks & Sundberg: blowing pressure systematic with loudness and pitch in professional oboe, bassoon, clarinet and alto saxophone players; no fluctuation within a steady tone in what was found" }, { where: "KTH, L. Fuks's thesis page (speech.kth.se/music/publications/leofuks/thesis/summaries.html)", query: "Paper I, Blowing pressures in bassoon, clarinet, oboe and saxophone: its summary", date: "2026-11-01", found: "some players' vibrato, its pressure 1.5-3.0 cmH2O peak to peak; no fluctuation of a tone held without it" }] }
          },
          lips: {
            tension: { value: 0.01, unit: "a share of the tension asked", kind: "unmeasured", reason: "ours: slight, the embouchure held", searched: [{ where: "web search", query: "brass player lip tension embouchure fluctuation steady note pitch jitter measured trumpet", date: "2026-11-01", found: "embouchure muscles' activity rising with pitch and loudness (Watson & Price 2020, trumpeters' EMG; Hirano, horn players); jitter and shimmer larger with embouchure dystonia (Morris et al., an abstract); mouthpiece force against pitch, loudness and mouth pressure in 31 players (Amann et al., Forum Acusticum 2025, not read); no fluctuation of the lips' tension within a steady note" }] }
          },
          dither: {
            tuning: { value: 0.5, unit: "cents, a seat's for the piece", kind: "unmeasured", reason: "ours: enough that no two seats' partials stand exactly aligned, too little to be heard as out of tune", searched: [{ where: "web search", query: "violin intonation pitch fluctuation within sustained note without vibrato cents standard deviation measured", date: "2026-11-01", found: "no deviation in cents of a note held without vibrato; a steady tone's pitch difference limen 2.5-2.8 cents (Brown & Vaughn 1996); Ando & Yamaguchi (1993) measured C5's fluctuations on several instruments with and without vibrato, not read" }] },
            contact: { value: 1e-3, unit: "a share of the string's length, a seat's for the piece", kind: "unmeasured", reason: "ours: no two seats bowing at exactly one place", searched: [{ where: "web search", query: "violin bow force fluctuation sustained note standard deviation measured Schoonderwaldt bowing parameters variability", date: "2026-11-01", found: "Chudy, Dixon & Perez (ICA 2013, six cellists, 240 Hz motion capture): each parameter's mean and deviation across a scale's notes, not within one; Stein (Boston University thesis, 2016, not read): the variances of bow force, velocity and bow-bridge distance rising with a tone's duration and loudness; Schoonderwaldt's KTH thesis (2009), which measured all three on six players, not read (SOURCES_TO_FETCH)" }] }
          }
        }
      }
    },
    "violin-family": {
      values: {
        contactSoft: { range: [0.15, 0.35], unit: "the bow's contact point, a share of the string's length from the bridge, at ppp", kind: "literature", source: "schoonderwaldt-2009", note: "the measured players' contact about 0.3 at pp" },
        contactLoud: { range: [0.02, 0.06], unit: "the bow's contact point at fff", kind: "literature", source: "schoonderwaldt-2009", note: "the measured players' contact about 0.03 at f" },
        contacts: { range: [0.03, 0.3], unit: "the bow's contact point, a share of the string's length from the bridge", kind: "literature", source: "schoonderwaldt-2009", note: "the measured players' contacts as they bow ordinario, from near the bridge to over the fingerboard: 0.03-0.3 in all" },
        place: { range: [0.15, 0.85], unit: "a force's place in its note's window of Helmholtz motion, at ppp and at fff (0 its least edge, 1 its most)", kind: "unmeasured", reason: "a choice, not a measurement: anywhere in the window but its edges, where a seed's noise would leave it", searched: [{ where: "the bowing literature read for the strings' fits (research/STRINGS_FITTED_BOWING.md)", date: "2026-10-19", found: "players' forces measured against their windows nowhere" }] },
        stoppingFinger: {
          damping: { value: 0.7, unit: "N s/m", kind: "literature", source: "wiertlewski-hayward-2012", note: "a fingertip's mechanical impedance, its real part 0.6-0.8 N s/m from 100 to 500 Hz (read from its Fig. 11: one finger pressing 0.6 N, probed normal to the skin): the stopping finger's damping of the string under it, the engine's R_FINGER (Artifastring's own 30 kg/s, unmeasured, damped stopped notes dead in 0.2 s and made the high notes' sidebands, MODELING_GAPS.md). Not measured: a string moving along the fingerboard under the pad (a shear, not this push), at a player's force, past 500 Hz", measuredOn: ["fingertip"] },
          padStiffness: { value: 600, unit: "N/m", kind: "literature", source: "wiertlewski-hayward-2012", note: "the same fingertip's stiffness, from its impedance's imaginary part (its Fig. 11, k = -omega Im Z with its 0.2 g mass): about 500 N/m at 20 Hz and 640-660 at 50-100 Hz, where it acts as a spring, one finger pressing 0.6 N, probed normal to the skin. A light touch (a harmonic's, a multiphonic's) is this spring and `damping` together, a Kelvin element as measured; a touch lighter than this one, its stiffness and damping in proportion (ours: a smaller contact of the same pad, unmeasured); one pressing harder, its damping held at `damping` while the string is pressed to the fingerboard (how a pad's damping grows with force unmeasured, MODELING_GAPS.md)", measuredOn: ["fingertip"] },
          dampingArtifastring: { value: 30, unit: "N s/m", kind: "other", source: "artifastring", note: "Artifastring's own R_FINGER (its artifastring_constants.h), set by its author, not measured: the engine's finger before the measured one, kept so that a setting kept before is heard as it was then" }
        },
        mostForce: { value: 2.5, unit: "N", kind: "literature", source: "schoonderwaldt-2009", note: "observed maxima bow force 2.5 N, of violinists and violists", measuredOn: ["violin", "viola"], passes: { by: "scale-ratio", inputs: { a: "forceScale" }, reference: "violin", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] } },
        forceScale: { kind: "borrowed", derive: { equation: "least-force-scale", inputs: { scale: "player:cello:forceScale", Z: "object:strings.*.impedance", c0: "object:cello.0:strings.C2.impedance", c1: "object:cello.1:strings.C2.impedance", c2: "object:cello.2:strings.C2.impedance" } }, unit: "1", note: "an instrument with strings of its own: the cello's scale by its lowest string's impedance squared over the cello's C strings' (rounded to hundredths until 29 October 2026)", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        force: {
          ppp: { value: 0.16, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at ppp where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          pp: { value: 0.25, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at pp where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          p: { value: 0.4, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at p where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          mp: { value: 0.6, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at mp where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          mf: { value: 0.8, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at mf where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          f: { value: 1.1, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at f where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          ff: { value: 1.4, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at ff where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] },
          fff: { value: 1.8, unit: "N", kind: "unmeasured", reason: "ours: a violin's bow force at fff where the calibration has none (the other instruments' times their force scale)", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }] }
        },
        places: {
          ponticello: { value: 0.02, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: where a player bows sul ponticello, at the bridge, its bow moved toward it from ordinario as far as its contact asks (a stroke's contact -1)", searched: [{ where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013); no sul ponticello's or sul tasto's measured" }] },
          tasto: { value: 0.2, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: where a player bows sul tasto, over the fingerboard's end (a stroke's contact 1)", searched: [{ where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013); no sul ponticello's or sul tasto's measured" }] }
        },
        attack: {
          seconds: { value: 0.07, unit: "s", kind: "unmeasured", reason: "ours: a stroke's attack where its stroke names none, never more than `share` of its note", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] },
          from: { value: 0.25, unit: "share of its force", kind: "unmeasured", reason: "ours: the force its bow is set on the string at, a share of its own, raised to its own over its attack, where neither its variant's attack model nor the calibration gives one", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] },
          share: { value: 0.5, unit: "share of its note", kind: "unmeasured", reason: "ours: an attack no longer than this share of its note (a pianissimo's quarter-second swell over a note of a tenth never reached its bow)", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] }
        },
        change: {
          reversal: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a change of bow's reversal, the bow through zero at the change's time", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] },
          tremoloReversal: { value: 0.3, unit: "share of its stroke", kind: "unmeasured", reason: "ours: a tremolo's strokes reverse at most over this share of each, none bitten (each stroke's accent had made its tremolo a rattle)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] },
          bite: {
            change: { value: 1.35, unit: "times its force", kind: "unmeasured", reason: "ours: the force raised by this as the bow takes the string again at a change of bow at a new note (a detache's)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] },
            held: { value: 1.12, unit: "times its force", kind: "unmeasured", reason: "ours: and by this at a change of bow inside a held note", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] }
          },
          planned: { value: 0.04, unit: "s", kind: "unmeasured", reason: "ours: how long a change of bow's direction takes as its bow is planned (bow.js BOW.changeSeconds), a change inside a held note included -- the compiler draws it over `reversal`, 0.05 s: two values for one change (MODELING_GAPS)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bow change's or retake's duration" }] },
          biteFor: { value: 0.03, unit: "s", kind: "unmeasured", reason: "ours: the force back to its own this long after the reversal", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); bow inclination leading bow velocity by about 15 degrees in fast patterns (Schoonderwaldt & Altenmueller 2014); no bow change's duration (Askenfelt 1986, doi:10.1121/1.393841, walled: SOURCES_TO_FETCH)" }] }
        },
        release: { value: [0.12, 0.32], unit: "s", kind: "unmeasured", reason: "ours: a release's force eased to nothing over a span between these, each note's its player's own, the bow still moving, the string left to ring (a section's sixty bows leaving the string at one instant had clicked, Op. 3.5)", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "spiccato's tails (Guettler & Askenfelt); a violin offset detector's envelopes (ISMIR 2015); no player's release measured" }] },
        onset: {
          force: { value: 0.7, unit: "times its noise", kind: "unmeasured", reason: "ours: a stroke with an articulation's point pressed heavier by this times its noise, past what its speed takes cleanly (the pre-Helmholtz transient's prolonged periods, Guettler 2002): half the change of bow's bite at a noise of half; to be replaced by the strings' articulation fit", searched: [{ where: "web search", query: "violin players bow attack measured bow force build-up time onset acceleration Guettler Askenfelt attack parameters", date: "2026-10-29", found: "the Guettler diagram's playable attacks in bow force and acceleration (Guettler; a robot's, Acta Acustica 2024); listeners' acceptance limits (Guettler & Askenfelt 1997); no player's attack time nor the share of its force it begins at" }] }
        },
        lifted: { value: 0.03, unit: "s", kind: "unmeasured", reason: "ours: a stroke ended with its bow stopped on the string lifted this long before the next stroke at the latest", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "spiccato's tails (Guettler & Askenfelt); a violin offset detector's envelopes (ISMIR 2015); no player's release measured" }] },
        slur: { value: 0.012, unit: "s", kind: "unmeasured", reason: "ours: a slur's finger change", searched: [{ where: "web search", query: "string players damping pizzicato with finger decay time measured; legato finger change transition time violin ms", date: "2026-10-29", found: "plucked cello strings' damping measured and modelled (Mansour & Scavone), not a finger's; sample libraries' legato transitions (100-333 ms), not players'; no finger's damping nor finger change measured" }] },
        crossing: {
          share: { value: 0.207, unit: "share of the note it crosses to", kind: "literature", source: "schoonderwaldt-altenmuller-2014", at: "Results, the string crossing's width", note: "a slur across strings rolled from one string to the next over this, the bow on both at once, the one it leaves lifted as the one it takes is set down: the bow on both strings over the middle 0.32 of its inclination's peak-to-peak swing (median over the players' repeated crossings, 80% within 0.18 to 0.54, the bow hair's and strings' compliance), the inclination near sinusoidal and one crossing a note, 2 asin(0.32) / pi of a note; the crossing's duration affected by tempo", measuredOn: ["violin"] },
          seconds: { value: [0.028, 0.053], unit: "s", kind: "literature", source: "schoonderwaldt-altenmuller-2014", at: "Methods (3.9 to 7.5 notes/s); Results", note: "that share at the note rates measured, 7.5 to 3.9 notes a second (its 80% at the fastest 15 to 48 ms): a crossing held within them, unmeasured beyond", measuredOn: ["violin"] }
        },
        loure: {
          within: { value: 0.1, unit: "semitones", kind: "unmeasured", reason: "ours: a pitch slurred to again within this of the one before is loure, one bow, each note marked by the bow slowed on the string", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] },
          seconds: { value: 0.08, unit: "s", kind: "unmeasured", reason: "ours: its slowing over this round the note's time (the bow's following at least)", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] },
          speed: { value: 0.2, unit: "share of its speed", kind: "unmeasured", reason: "ours: the bow slowed to this share of its speed (at 0.35 at its full weight a cello's string ground on, its dip 1.7 dB)", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] },
          force: { value: 0.35, unit: "share of its force", kind: "unmeasured", reason: "ours: and lightened to this share of its weight (Schelleng's most force falls with the bow's speed): the legato test's phrases dipping 12-13 dB on the violin, 5-6.5 the viola, 4.5-6.4 the cello, 8-15 the contrabass, each under its change of bow's", searched: [{ where: "web search", query: "portato loure bowing measured bow velocity force violin motion capture", date: "2026-10-29", found: "bow velocity's profile from rectangular to sinusoidal as strokes quicken (Schoonderwaldt); no portato or loure measured" }] }
        },
        follow: {
          periods: { value: 10, unit: "periods", kind: "unmeasured", reason: "ours: a bow slowed over this many of its note's periods at least -- a string's motion follows its bow's speed only as fast as its corner goes round, once a period (a bow slowed in 25 ms had left a cello's D string ringing)", searched: [{ where: "web search", query: "Helmholtz motion response to bow velocity change number of periods transient Guettler Woodhouse bowed string", date: "2026-10-29", found: "attack transients' durations by bow force and acceleration (the Guettler diagram); no count of the periods a string's motion takes to follow its bow's change of speed" }] },
          share: { value: 0.3, unit: "share of its note", kind: "unmeasured", reason: "ours: and over no more than this share of the note it slows in", searched: [{ where: "web search", query: "Helmholtz motion response to bow velocity change number of periods transient Guettler Woodhouse bowed string", date: "2026-10-29", found: "attack transients' durations by bow force and acceleration (the Guettler diagram); no count of the periods a string's motion takes to follow its bow's change of speed" }] }
        },
        draw: {
          start: { value: 0.12, unit: "share of the bow from the frog", kind: "unmeasured", reason: "ours: a stroke from silence begun down-bow this far from the frog, up-bow as far from the tip", searched: [{ where: "web search", query: "violinists bow force at frog versus tip measured bow position along hair force profile", date: "2026-10-29", found: "experienced players' down-bows heavier at the frog than in the middle, the middle and the tip alike (arXiv 2411.05126; Mizuho & Sugiura 2025, arXiv 2505.04446): how much not given; where a stroke from silence begins not measured" }] },
          frog: { value: 0.1, unit: "share of its force", kind: "unmeasured", reason: "ours: its weight this much heavier at the frog, where the bow's own bears on the string, eased to nothing by the middle (Mizuho & Sugiura 2025: experienced violinists' down-bows heavier at the frog than in the middle)", searched: [{ where: "web search", query: "violinists bow force at frog versus tip measured bow position along hair force profile", date: "2026-10-29", found: "experienced players' down-bows heavier at the frog than in the middle, the middle and the tip alike (arXiv 2411.05126; Mizuho & Sugiura 2025, arXiv 2505.04446): how much not given; where a stroke from silence begins not measured" }] },
          middle: { value: 0.5, unit: "share of the bow from the frog", kind: "unmeasured", reason: "ours: the bow's middle, from which on its own weight adds nothing; its weight on the whole about its own", searched: [{ where: "web search", query: "violinists bow force at frog versus tip measured bow position along hair force profile", date: "2026-10-29", found: "experienced players' down-bows heavier at the frog than in the middle, the middle and the tip alike (arXiv 2411.05126; Mizuho & Sugiura 2025, arXiv 2505.04446): how much not given; where a stroke from silence begins not measured" }] },
          coupled: { value: 0.5, unit: "1", kind: "unmeasured", reason: "ours: its speed wandering this share of the way with its weight -- players draw faster as they press harder, to keep from roughness (Blanco et al. 2021, as Mizuho and Sugiura cite it); wandering apart, a contrabass's and a cello's re-bowed notes left Helmholtz motion", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          drift: {
            pressure: { value: 0.05, unit: "share of its force", kind: "unmeasured", reason: "ours: its weight wandering slowly by this share", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
            speed: { value: 0.02, unit: "share of its speed", kind: "unmeasured", reason: "ours: its speed by this share on its own", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
            contact: { value: 0.04, unit: "share of its contact", kind: "unmeasured", reason: "ours: its place by this share on its own", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] }
          },
          slow: { value: [2.3, 0.9, 0.45], unit: "s", kind: "unmeasured", reason: "ours: the periods of the slow sines its wandering sums", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          tremor: { value: 0.01, unit: "share", kind: "unmeasured", reason: "ours: its hand's small tremor, a share of each", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          tremorHz: { value: [5.5, 8.5], unit: "Hz", kind: "unmeasured", reason: "ours: its tremor's rate, each player's own between these", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] },
          settle: { value: 0.2, unit: "s", kind: "unmeasured", reason: "ours: its wandering grown in over this once its attack has taken the string (begun at once, a violin's first note spoke 95 ms later for being begun 36 ms earlier)", searched: [{ where: "web search", query: "bow force fluctuation within sustained stroke violinists measured variability physiological tremor frequency bowing arm", date: "2026-10-29", found: "bow force's variability shaped by loudness and duration (Stein 2016 thesis, five violinists: no magnitude in its abstract; SOURCES_TO_FETCH); primary bowing tremor, a disorder's, 4.7-6.7 Hz (Lee, Chadde & Altenmueller 2014, doi:10.5334/tohm.187); no healthy player's wandering bow or tremor measured" }] }
        },
        pluck: {
          position: { value: 0.2, unit: "share of the string", kind: "unmeasured", reason: "ours: where a string is plucked where the calibration has no place for it", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
          pull: {
            ppp: { value: 0.03, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at ppp where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            pp: { value: 0.05, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at pp where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            p: { value: 0.1, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at p where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            mp: { value: 0.15, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at mp where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            mf: { value: 0.3, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at mf where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            f: { value: 0.5, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at f where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            ff: { value: 0.6, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at ff where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] },
            fff: { value: 0.75, unit: "share", kind: "unmeasured", reason: "ours: a pluck's pull at fff where the calibration has none", searched: [{ where: "web search", query: "pizzicato plucking point position measured violin cello pluck force displacement finger study", date: "2026-10-29", found: "pedagogy (plucked near the fingerboard's end; harder for louder); no pluck's place or pull measured" }] }
          }
        },
        damp: {
          stopped: { value: 0.12, unit: "s", kind: "unmeasured", reason: `ours: a pluck stopped at its note's end, its fundamental down 60 dB in this, a stopped note's finger eased off the string it holds (the owner, 5 October 2026: "The default is that pizz is damped")`, searched: [{ where: "web search", query: "string players damping pizzicato with finger decay time measured; legato finger change transition time violin ms", date: "2026-10-29", found: "plucked cello strings' damping measured and modelled (Mansour & Scavone), not a finger's; sample libraries' legato transitions (100-333 ms), not players'; no finger's damping nor finger change measured" }] },
          open: { value: 0.3, unit: "s", kind: "unmeasured", reason: "ours: an open string's later and less at once, a free finger of either hand brought to it", searched: [{ where: "web search", query: "string players damping pizzicato with finger decay time measured; legato finger change transition time violin ms", date: "2026-10-29", found: "plucked cello strings' damping measured and modelled (Mansour & Scavone), not a finger's; sample libraries' legato transitions (100-333 ms), not players'; no finger's damping nor finger change measured" }] }
        },
        pressure: {
          flautando: {
            speed: { value: 1.6, unit: "times its speed", kind: "unmeasured", reason: "ours: at flautando the bow drawn this many times faster", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            contact: { value: 0.2, unit: "share of the string", kind: "unmeasured", reason: "ours: its place no nearer the bridge than this", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            force: { value: 0.35, unit: "times its force", kind: "unmeasured", reason: "ours: and lightened to this, the string still in Helmholtz motion; each instrument's replaced by its measured (CALIBRATION.pressure)", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] }
          },
          overpressure: {
            speed: { value: 0.6, unit: "times its speed", kind: "unmeasured", reason: "ours: at overpressure the bow drawn this much slower", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            force: { value: 4, unit: "times its force", kind: "unmeasured", reason: "ours: and this much heavier, past Schelleng's most at its place", searched: [{ where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] }
          }
        },
        beyond: {
          quiet: { value: [0.6, 0.4, 0.28, 0.2, 0.15], unit: "times its force", kind: "unmeasured", reason: "ours: each mark beyond ppp its ppp bow's force times these, lighter and lighter toward a string that hardly speaks (the owner's uncomfortable range), where its instrument's fitted multiples are not known", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
          loud: { value: [1.6, 2.4, 3.2, 4, 4.8], unit: "times its force", kind: "unmeasured", reason: "ours: each mark beyond fff its fff bow's force times these, heavier and heavier past Schelleng's most", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
          speed: {
            quiet: { value: [1, 1, 1, 1, 1], unit: "times its speed", kind: "unmeasured", reason: "ours: its speed unchanged beyond ppp where its instrument's fitted multiples are not known", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] },
            loud: { value: [1, 1, 1, 1, 1], unit: "times its speed", kind: "unmeasured", reason: "ours: and beyond fff", searched: [{ where: "web search", query: "Askenfelt 1989 bowing parameters violin bow force dynamic range limits newtons pp ff measured", date: "2026-10-29", found: "a typical bow force of 0.5 to 1.5 N in normal playing (Askenfelt 1989, doi:10.1121/1.398230, as Demoucron et al.'s bow-force sensor paper cites it), not by dynamic; the paper itself walled (SOURCES_TO_FETCH)" }, { where: "web search", query: "flautando bowing parameters bow speed contact point measured; overpressure bow force extended technique measurement", date: "2026-10-29", found: "bowing sensors and ordinary playing's parameters; no flautando or overpressure measured" }] }
          }
        },
        speed: {
          ppp: { value: 5, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at ppp, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          pp: { value: 6, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at pp, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          p: { value: 10, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at p, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          mp: { value: 14, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at mp, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          mf: { value: 20, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at mf, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          f: { value: 30, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at f, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          ff: { value: 40, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at ff, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] },
          fff: { value: 50, unit: "cm/s", kind: "unmeasured", reason: "ours: how fast the bow moves at fff, a starting profile (bow.js BOW.speed): softer slower, as a sustained soft tone is usually drawn -- a player may as well draw a soft tone fast near the fingerboard (Schelleng's diagram, no universal table)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no speed by dynamic (Schoonderwaldt 2009's, Askenfelt 1986's walled: SOURCES_TO_FETCH)" }] }
        },
        retake: { value: 0.25, unit: "s", kind: "unmeasured", reason: "ours: a retake -- the bow lifted and set back at the frog or the tip -- takes this, a silence of its own", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another; finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bow change's or retake's duration" }] },
        stroke: {
          entry: {
            ppp: { value: 0.3, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at ppp, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            pp: { value: 0.25, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at pp, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            p: { value: 0.15, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at p, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            mp: { value: 0.1, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at mp, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            mf: { value: 0.07, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at mf, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            f: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at f, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            ff: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at ff, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] },
            fff: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: a note begun from silence swells over this at fff, never quicker than the 50 ms a bowed attack's transient takes at most to be heard clean (Guettler & Askenfelt 1997); the longer soft ones authored -- the attack time the strings' neutral note is compiled with (neutral.py)", searched: [{ where: "web search", query: "Luce Clark 1965 durations of attack transients of nonpercussive orchestral instruments violin cello milliseconds", date: "2026-10-29", found: "attacks of 14 to 85 ms to 3 dB under the steady level across the orchestra, the strings between the brass and the flute (Luce & Clark 1965, JAES 13(3) 194-199, walled: SOURCES_TO_FETCH); no attack time by dynamic" }, { where: "registry sources", query: "guettler-askenfelt-1997", date: "2026-10-29", found: "listeners accept a pre-Helmholtz transient of at most 50 ms (raucous) or 90 ms (multiple flyback): a ceiling for a clean attack, not a player's swell" }] }
          },
          lift: {
            least: { value: 0.2, unit: "s", kind: "unmeasured", reason: "ours: a note let go as a bow lifted from a ringing string over this at its loudest, where a new phrase's formation begins while it still sounds (articulation.js's bowed release, the same)", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "no player's release measured" }] },
            soft: { value: 0.18, unit: "s", kind: "unmeasured", reason: "ours: and this much longer at the softest", searched: [{ where: "web search", query: "bowed note release bow lift off string timing measured violin players decay after bow", date: "2026-10-29", found: "no player's release measured" }] }
          },
          bite: {
            ppp: { value: 0, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at ppp, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            pp: { value: 0, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at pp, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            p: { value: 0.01, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at p, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            mp: { value: 0.02, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at mp, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            mf: { value: 0.035, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at mf, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            f: { value: 0.05, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at f, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            ff: { value: 0.07, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at ff, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
            fff: { value: 0.09, unit: "s", kind: "unmeasured", reason: "ours: at a change of bow onto a new note at fff, the bow off the string this long to bite it again (none at pp, the longest at ff), most of it taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] }
          },
          biteSpread: { value: 0.4, unit: "share of its bite", kind: "unmeasured", reason: "ours: each player's bite drawn its own within this share either side, so a section's re-attacks are a spread of its players', not one instant (the owner, 2 October 2026, of Op. 3.5)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
          biteLate: { value: [0.2, 0.5], unit: "share of its bite", kind: "unmeasured", reason: "ours: the share of each bite that is the new note's own lateness, drawn between these, the rest taken from the note before", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] },
          biteShare: { value: 0.25, unit: "share of the note it ends", kind: "unmeasured", reason: "ours: a bite never more than this share of the note it ends -- a stopped bow ends a note, it is not the note (a 95 ms note at ff had been bitten to 2 ms, a click)", searched: [{ where: "web search", query: "bow change duration measured violinists milliseconds bow reversal acceleration study", date: "2026-10-29", found: "an orchestra's bow changes within some 60 ms of one another (a section's spread); finger and bow reversal synchronised within -12 to 60 ms (Kazennikov & Wiesendanger); no bite measured" }] }
        },
        section: {
          deskApart: { value: 0.15, unit: "share of phrases", kind: "unmeasured", reason: "ours: how often a desk's two players take a technique apart, each by its own draw, a phrase -- a conductor seating its techniques by desk most of the time", searched: [{ where: "web search", query: "orchestra string section desk partners divisi how often split by stand inside outside player practice", date: "2026-10-29", found: "divisi by desk the usual practice, the outside player the upper line, the section leader deciding (Wikipedia, String section; violinschool.com; Duke string school); no frequency of a desk taking a technique apart" }] },
          sizes: {
            chamber: { value: [6, 5, 4, 3, 2], unit: "players: violins I, II, violas, cellos, basses", kind: "unmeasured", reason: "ours: a chamber orchestra's strings, authored from common practice", searched: [{ where: "web search", query: "string section sizes orchestra 16-14-12-10-8 10-8-6-5-4 6-5-4-3-2 typical numbers of players", date: "2026-10-29", found: "Brick's orchestration notes: 16-14-12-10-8, two fewer each section, a small orchestra 8-12 first violins so, two-player sections avoided; Wikipedia's String section: sizes vary widely (Die Walküre 16-16-12-12-8); no source for 10-8-6-5-4 or 6-5-4-3-2" }] },
            classical: { value: [10, 8, 6, 5, 4], unit: "players: violins I, II, violas, cellos, basses", kind: "unmeasured", reason: "ours: a classical orchestra's strings, authored from common practice", searched: [{ where: "web search", query: "string section sizes orchestra 16-14-12-10-8 10-8-6-5-4 6-5-4-3-2 typical numbers of players", date: "2026-10-29", found: "Brick's orchestration notes: 16-14-12-10-8, two fewer each section, a small orchestra 8-12 first violins so, two-player sections avoided; Wikipedia's String section: sizes vary widely (Die Walküre 16-16-12-12-8); no source for 10-8-6-5-4 or 6-5-4-3-2" }] },
            full: { value: [16, 14, 12, 10, 8], unit: "players: violins I, II, violas, cellos, basses", kind: "vernacular", source: "brick-orchestration-notes", note: '"if an orchestra has 16 1st Violins it will likely have 14 2nd violins, 12 Violas, 10 Celli, and 8 Basses"' },
            atmospheres: { value: [14, 14, 10, 10, 8], unit: "players: violins I, II, violas, cellos, basses", kind: "vernacular", source: "musicaustria-atmospheres", note: `Ligeti's Atmosphères (1961): "Orchestercode: 4 (4 Picc)/4/4 (Es)/3, KFag - 6/4 (C)/4/1 - Pf - 14/14/10/10/8", every player a part` },
            pithoprakta: { value: [12, 12, 8, 8, 6], unit: "players: violins I, II, violas, cellos, basses", kind: "vernacular", source: "boosey-pithoprakta", note: `Xenakis's Pithoprakta (1955-56): "2trbn-perc:xyl/wdbl-strings(12.12.8.8.6)", every player a part` }
          },
          specification: {
            moves: {
              stay: { value: 0.2, unit: "share of phrases", kind: "unmeasured", reason: "ours: from phrase to phrase, the same formation again this share of the time", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              between: { value: 0.35, unit: "share of phrases", kind: "unmeasured", reason: "ours: part of the way to a new one (a tenth drawn) this share; the rest a new one", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            groupings: {
              sections: { value: 5, unit: "weight", kind: "unmeasured", reason: "ours: each instrument its own pool, weighed so among the groupings", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              choirs: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: the choirs (violins, violas with cellos, basses), weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              all: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: the whole section one pool, weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            splits: {
              tutti: {
                range: { value: [0, 0], unit: "split", kind: "unmeasured", reason: "ours: tutti: one part a pool", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: tutti weighed so among the splits", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              divisi: {
                range: { value: [0.1, 0.5], unit: "split", kind: "unmeasured", reason: "ours: divisi, drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 3.5, unit: "weight", kind: "unmeasured", reason: "ours: divisi weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              most: {
                range: { value: [0.6, 0.95], unit: "split", kind: "unmeasured", reason: "ours: most players their own part, drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: most players their own weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              each: {
                range: { value: [1, 1], unit: "split", kind: "unmeasured", reason: "ours: every player their own part, as Atmosphères'", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weight: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: every player their own weighed so", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              }
            },
            textures: {
              one: {
                parts: { value: [1, 1], unit: "parts", kind: "unmeasured", reason: "ours: a pool of one part", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weights: {
                  line: { value: 3, unit: "weight", kind: "unmeasured", reason: "ours: one part a line above all", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  chord: { value: 1, unit: "weight", kind: "unmeasured", reason: "ours: or a chord", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  figuration: { value: 1, unit: "weight", kind: "unmeasured", reason: "ours: or a figuration", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
                }
              },
              few: {
                parts: { value: [2, 6], unit: "parts", kind: "unmeasured", reason: "ours: a pool of a few parts", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weights: {
                  counterpoint: { value: 4, unit: "weight", kind: "unmeasured", reason: "ours: a few parts voices in counterpoint above all (the owner, 3 October 2026: textures primarily as counterpoint)", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  chord: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: then chords", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  figuration: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: figurations", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  micropolyphony: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: a canon", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  cluster: { value: 1, unit: "weight", kind: "unmeasured", reason: "ours: a cluster", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  line: { value: 0.5, unit: "weight", kind: "unmeasured", reason: "ours: seldom a line", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  points: { value: 0.5, unit: "weight", kind: "unmeasured", reason: "ours: seldom points", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
                }
              },
              many: {
                parts: { value: [7, null], unit: "parts, most any", kind: "unmeasured", reason: "ours: a pool of many parts", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                weights: {
                  micropolyphony: { value: 3, unit: "weight", kind: "unmeasured", reason: "ours: many parts the masses: micropolyphony", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  cluster: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: clusters", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  glides: { value: 2.5, unit: "weight", kind: "unmeasured", reason: "ours: glides", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  points: { value: 2, unit: "weight", kind: "unmeasured", reason: "ours: clouds of points", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  counterpoint: { value: 1.5, unit: "weight", kind: "unmeasured", reason: "ours: counterpoint still", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                  chord: { value: 0.5, unit: "weight", kind: "unmeasured", reason: "ours: seldom chords", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
                }
              }
            },
            pool: {
              centre: { value: [0.3, 0.7], unit: "share of its seats' compass", kind: "unmeasured", reason: "ours: a pool's centre drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              width: { value: [4, 12], unit: "semitones", kind: "unmeasured", reason: "ours: a pool's band drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              cluster: {
                base: { value: 1, unit: "semitones", kind: "unmeasured", reason: "ours: a cluster's band at least this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                perPart: { value: [0.25, 0.75], unit: "semitones a part", kind: "unmeasured", reason: "ours: and so much wider a part", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                mostParts: { value: 24, unit: "parts", kind: "unmeasured", reason: "ours: over this many parts at most", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              density: { value: [0.3, 1.5], unit: "onsets a second a part", kind: "unmeasured", reason: "ours: a cloud's density drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              level: { value: [0, 1], unit: "level, pp to ff", kind: "unmeasured", reason: "ours: a pool's level anywhere from pp to ff: the conductor's constraints say where a section is", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              tremolo: { value: [0, 0], unit: "share of tremolo", kind: "unmeasured", reason: "ours: none drawn (the owner, 3 October 2026: no tremolos inserted at random): a tremolo only where a spec or a conductor asks", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              contact: {
                share: { value: 0.3, unit: "share of phrases", kind: "unmeasured", reason: "ours: a phrase's contact away from ordinario this share, a colour meant (the owner, 3 October 2026: sul tasto and sul ponticello to be heard)", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.4, unit: "of the way to the bridge or the fingerboard", kind: "unmeasured", reason: "ours: each that far at least, several just-noticeable differences", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                loud: { value: 0.4, unit: "of its reach", kind: "unmeasured", reason: "ours: its reach at its loudest this much of all the way, a loud phrase bowing near ordinario (the owner, 4 October 2026: too much extreme ponticello and tasto)", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 2, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              pressure: {
                share: { value: 0.2, unit: "share of phrases", kind: "unmeasured", reason: "ours: a phrase pressed or lightened this share, flautando toward its softest, overpressure toward its loudest", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.35, unit: "of its reach", kind: "unmeasured", reason: "ours: each from this far", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 1.5, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              articulation: {
                share: { value: 0.4, unit: "share of phrases", kind: "unmeasured", reason: "ours: a phrase given one articulation together this share; the rest its players' own attacks", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.15, unit: "along the named attacks", kind: "unmeasured", reason: "ours: as marked as this at least", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 1.5, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              technique: {
                share: { value: 0, unit: "share of phrases", kind: "unmeasured", reason: "ours: a wind's extended technique: none for strings, a wind section's spec gives its share", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                least: { value: 0.4, unit: "of its reach", kind: "unmeasured", reason: "ours: where a wind's spec gives a share, from this far", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                skew: { value: 1.5, unit: "power of its draw", kind: "unmeasured", reason: "ours: the far end seldom", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              mute: {
                share: { value: 0, unit: "share of phrases", kind: "unmeasured", reason: "ours: a mute: none for strings, their mutes not modelled", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              harmonic: {
                share: { value: 0.12, unit: "share of phrases", kind: "unmeasured", reason: "ours: natural harmonics, a soft colour, this share of phrases", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] },
                most: { value: 0.3, unit: "level", kind: "unmeasured", reason: "ours: only where its level is under this", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              multiphonic: {
                share: { value: 0.06, unit: "share of phrases", kind: "unmeasured", reason: "ours: the measured multiphonics that fit its harmony, a rarer colour at any level", searched: [{ where: "web search", query: "corpus study frequency of sul ponticello sul tasto col legno harmonics markings orchestral string parts", date: "2026-10-29", found: "none counted: Read's Thesaurus of Orchestral Devices catalogues uses from some thousand study scores, qualitatively; orchestration notes and guides" }] }
              },
              players: { value: [1, 1], unit: "share of its players", kind: "unmeasured", reason: "ours: all play where no conductor above narrows it: the orchestra's conductor plans its breadth", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            rest: {
              from: { value: 0, unit: "share of the band's draw", kind: "unmeasured", reason: "ours: rests by the band's shared draw none, where no spec says", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              to: { value: 0, unit: "share of the band's draw", kind: "unmeasured", reason: "ours: and to none", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
              ask: { value: 0.1, unit: "chance a phrase", kind: "unmeasured", reason: "ours: it asks its conductor to rest a phrase this seldom: strings rest seldom", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            solo: {
              ask: { value: 0.08, unit: "chance a phrase", kind: "unmeasured", reason: "ours: it asks to solo this seldom: a concertmaster's or a principal cellist's", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
            },
            parameters: {
              micropolyphony: {
                cantusNotes: { value: [12, 20], unit: "notes", kind: "unmeasured", reason: "ours: the cantus's length", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              points: {
                seconds: { value: [0.12, 0.2], unit: "s", kind: "unmeasured", reason: "ours: a point sounding this long (s), as a player plays its shortest sound: a bowed string's pluck ringing as a sampled bank's recordings ring", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              counterpoint: {
                prolation: { value: [0, 1], unit: "share", kind: "unmeasured", reason: "ours: how often its imitation is a converging tempo canon", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              line: {
                rubato: { value: [0, 2e-3], unit: "share of its phrase", kind: "unmeasured", reason: "ours: a line's own lean over its conductor's beat at most this (the owner, 5 October 2026: no part wanting to drift; a 3% share had led an oboe a third of a second ahead)", searched: [{ where: "web search", query: "measured soloist melody leads or lags accompaniment ensemble asynchrony milliseconds expressive rubato melody over steady accompaniment", date: "2026-10-29", found: "a piano melody's lead, 20-50 ms (Goebl 2001, about 30 ms, mostly its louder attack's); professional ensembles' onsets tens of ms apart; no orchestral line's own rubato over its conductor's beat" }] },
                density: { value: [0, 1], unit: "share of the planner's range", kind: "unmeasured", reason: "ours: every density a line may take", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                planing: { value: [0, 0.5], unit: "share of entries", kind: "unmeasured", reason: "ours: a line shared by sections entering at an interval not an octave", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                canon: { value: [0, 0.25], unit: "share of entries", kind: "unmeasured", reason: "ours: and entering late, a canon", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              },
              figuration: {
                direction: { value: [-1, 1], unit: "down to up", kind: "unmeasured", reason: "ours: which way", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                turn: { value: [0, 1], unit: "share", kind: "unmeasured", reason: "ours: how often it turns", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
                anchor: { value: [0, 1], unit: "share", kind: "unmeasured", reason: "ours: how surely its lowest tone takes the strong positions", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
              }
            },
            players: {
              cents: { value: 6, unit: "cents at most", kind: "unmeasured", reason: "ours: each player's own inflection of their part's pitch, drawn once from their seat: a section, not a copy", searched: [{ where: "web search", query: "measured onset asynchrony intonation spread among players of an orchestral string section unison study", date: "2026-10-29", found: "none within a section: 20-50 ms between an ensemble's players, about 30 ms either way for a string ensemble's bowing onsets (a ViennaTalk 2015 paper's citation, its source not read); quartets' phase correction (Wing et al. 2014); violin duets' intonation adjusting to each other (DAFx 2011); no scatter in cents" }] },
              seconds: { value: 5e-3, unit: "s at most", kind: "unmeasured", reason: "ours: each player this late at most, a few ms, never heard as raggedness (the owner, 10 October 2026, of Op. 3.37: 18 ms too ragged, reined in)", searched: [{ where: "web search", query: "measured onset asynchrony intonation spread among players of an orchestral string section unison study", date: "2026-10-29", found: "none within a section: 20-50 ms between an ensemble's players, about 30 ms either way for a string ensemble's bowing onsets (a ViennaTalk 2015 paper's citation, its source not read); quartets' phase correction (Wing et al. 2014); violin duets' intonation adjusting to each other (DAFx 2011); no scatter in cents" }] }
            }
          },
          desks: {
            from: { value: 0.5, unit: "level", kind: "unmeasured", reason: "ours: every desk plays from this level up (the tutti from mf); a player's own pp to ff some 11 dB (Clark & Luce 1965), an orchestra's range as much from how many play", searched: [{ where: "web search", query: 'orchestral dynamics number of string players desks playing pianissimo "half section" doubling players loudness 3 dB measured', date: "2026-10-29", found: "none measured: a section's size changing its tone as well as its loudness (orchestration writing); whole orchestras' sound power 3-4 dB apart in halls (Kahle 1995); equal uncorrelated sources adding 3 dB a doubling, the physics" }] },
            doublings: { value: 3, unit: "halvings", kind: "unmeasured", reason: "ours: below it the desks playing halved this many times toward silence, each doubling of players some 3 dB", searched: [{ where: "web search", query: 'orchestral dynamics number of string players desks playing pianissimo "half section" doubling players loudness 3 dB measured', date: "2026-10-29", found: "none measured: a section's size changing its tone as well as its loudness (orchestration writing); whole orchestras' sound power 3-4 dB apart in halls (Kahle 1995); equal uncorrelated sources adding 3 dB a doubling, the physics" }] }
          },
          glissando: {
            spread: { value: 3, unit: "semitones a second", kind: "unmeasured", reason: "ours: a part's glissandi's speeds normal about none with this spread (Xenakis's Gaussian law, Pithoprakta), its size ours", searched: [{ where: "web search", query: "Pithoprakta glissandi speeds Gaussian distribution standard deviation Formalized Music Xenakis semitones per second", date: "2026-10-29", found: "Xenakis's own account (Formalized Music, ch. 1): bars 52-60's 1,148 speeds over 58 values by Gauss's law; no spread in semitones a second nor a glissando's length given in what was found" }] },
            seconds: { value: [0.8, 3.5], unit: "s", kind: "unmeasured", reason: "ours: a glissando's length, the archived strings_clodbot's (its glissandi drawn so); the section's glides now by the texture space's chance, their lengths a cloud's density's", searched: [{ where: "web search", query: "Pithoprakta glissandi speeds Gaussian distribution standard deviation Formalized Music Xenakis semitones per second", date: "2026-10-29", found: "Xenakis's own account (Formalized Music, ch. 1): bars 52-60's 1,148 speeds over 58 values by Gauss's law; no spread in semitones a second nor a glissando's length given in what was found" }, { where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
          },
          lineBand: { value: 7, unit: "semitones", kind: "unmeasured", reason: "ours: a line shared by sections planed within its centre's band at least this either way", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
          tremoloSkew: { value: 3, unit: "power of its draw", kind: "unmeasured", reason: "ours: a pool's tremolo the cube of a uniform draw over its range, most pools near its low end", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
        },
        line: {
          contact: {
            ppp: { value: 0.35, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at ppp, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            pp: { value: 0.3, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at pp, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            p: { value: 0.18, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at p, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            mp: { value: 0.1, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at mp, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            mf: { value: 0.06, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at mf, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            f: { value: 0.03, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at f, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            ff: { value: 0.025, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at ff, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
            fff: { value: 0.02, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: a bowed line's contact at fff, authored within the measured players' ranges (Schoonderwaldt 2009: about 0.3 at pp to 0.03 at f)", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] }
          },
          nearestContact: { value: 0.02, unit: "share of the string from the bridge", kind: "unmeasured", reason: "ours: the nearest the bridge a line's contact comes, by which its slowest bow at a dynamic is its speed times this over its usual contact", searched: [{ where: "registry sources", query: "schoonderwaldt-2009: the measured players' contact by dynamic", date: "2026-10-29", found: "about 0.3 of the string at pp to 0.03 at f (the players' contactSoft, contactLoud, contacts, literature): ranges, not one contact a dynamic" }, { where: "web search", query: "sul ponticello sul tasto bow-bridge distance measured violinists relative bow position beta", date: "2026-10-29", found: "the normal bow-bridge distance 1/30 to 1/6 of the string (Askenfelt 1988, STL-QPSR); players' beta by player (Schoonderwaldt; Chudy, Dixon & Perez 2013)" }] },
          slowestBow: { value: 5, unit: "cm/s", kind: "unmeasured", reason: "ours: never slower than a tone holds at (each instrument's fitted slowest supersedes it in the strings model: physical-strings.js slowestBowOf)", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no slowest bow that holds a tone, nor a fastest share over a dynamic's speed" }] },
          fastestShare: { value: 1.6, unit: "times its dynamic's speed", kind: "unmeasured", reason: "ours: how much faster than its dynamic's speed a note may be drawn, toward the fingerboard", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no slowest bow that holds a tone, nor a fastest share over a dynamic's speed" }] },
          easeMost: { value: 1, unit: "dynamics", kind: "unmeasured", reason: "ours: the most a single note too long for its bow is eased before it changes bow inside itself -- one, so that a loud note stays loud, its bow changed where one bow cannot hold it", searched: [{ where: "web search", query: "violin players bow velocity range measured minimum bow speed cm/s Schoonderwaldt 2009 bow velocity by dynamic", date: "2026-10-29", found: "cellists' scales drawn at 5.89 cm/s on average, 2.43 at the slowest, 11.24 at the fastest (Chudy, Dixon & Perez 2013, ICA, from Schoonderwaldt's motion capture); a bowing machine's 5-20 cm/s; no slowest bow that holds a tone, nor a fastest share over a dynamic's speed" }] }
        },
        attackLimits: {
          raucous: { value: 50, unit: "ms", kind: "literature", source: "guettler-askenfelt-1997", note: "the longest a note's prolonged periods (schelleng.py 'raucous') before Helmholtz motion that listeners accepted" },
          multiple: { value: 90, unit: "ms", kind: "literature", source: "guettler-askenfelt-1997", note: "the longest its multiple flyback ('multiple') that listeners accepted" }
        },
        vibrato: {
          register: {
            rate: { value: 0.32, unit: "Hz faster, from an instrument's lowest pitch to its highest", kind: "literature", source: "macleod-2008", note: "high pitches 0.32 Hz faster than low ones (violinists and violists)" },
            width: { value: 26, unit: "cents wider, peak to peak, from an instrument's lowest pitch to its highest", kind: "literature", source: "macleod-2008", note: "high pitches about 26 cents wider than low ones (violinists and violists)" }
          },
          forte: { value: 4, unit: "cents wider at forte than at piano, peak to peak", kind: "literature", source: "macleod-2008", note: "forte about 4 cents wider than piano (violinists and violists)" },
          delay: {
            least: { value: 0.33, unit: "s without vibrato as a note begins", kind: "literature", source: "allen-geringer-macleod-2009", note: "an artist's stretch without vibrato where a note changes" },
            most: { value: 0.42, unit: "s without vibrato as a note begins", kind: "literature", source: "geringer-allen-macleod-2005", note: "university players' stretch without vibrato where a note changes" }
          }
        },
        slide: {
          holdMost: { value: 0.95, unit: "share of its note", kind: "unmeasured", reason: "ours: a glissando's held first pitch at most this share of its note, so it always slides", searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] },
          least: { value: 0.05, unit: "semitones", kind: "unmeasured", reason: "ours: a slide narrower than this (5 cents) none, taken as near the least change of pitch heard", searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }, { where: "web search", query: "frequency difference limen pure tone 1 kHz percent cents just noticeable difference pitch musicians Wier Jesteadt Green 1977", date: "2026-10-29", found: "Wier, Jesteadt & Green 1977 (JASA 61, 178-184) measured pure tones' frequency difference limens by frequency and level, their values not reached in what was read; no slide's least width measured" }] }
        },
        hand: {
          shift: { value: 0.3, unit: "s, the hand moved from one position to another", kind: "literature", source: "visentin-2015", at: "Table 2", note: "six highly trained violinists' durations of shift, first to third position and third to fifth, on one string and two: averages of 294 to 404 ms for four of them at 60 to 100 beats a minute, another's about 450 ms; begun notes before its arrival where the tempo asks it. The least of them taken. Measured on violinists alone: a cello's or bass's longer shifts unmeasured", measuredOn: ["violin"] },
          least: { value: 0.5, unit: "semitones above its open string, the nearest its nut a finger stops it", kind: "unmeasured", reason: "ours: a quarter tone -- a low first finger, a semitone over its open string, stops it at the nut as players are taught (1L), a quarter tone pressed back from there; nearer, the finger's own width stops the string further from the nut than asked, and a player takes the note on the string below (the model's finger, physical-strings.js MODEL.leastFinger, is its own limit, not a player's)", searched: [{ where: "web search", query: "quarter tone above open string violin first finger close to the nut playable", date: "2026-11-07", found: "none measured: a low first finger a semitone over the open string, at the nut, taught (violinlounge.com, how to play a low first finger); fingers press over a width, stopping the string some way back from the nut (fiddlerman.com forum, notes placement problem)" }] },
          foresee: { value: 1, unit: "s, how far ahead of the note it plays its hand plans its notes", kind: "literature", source: "furneaux-1999", at: "abstract; Results", note: "the eye-hand span in time while sight-reading, about 1 s for professional and amateur pianists alike (0.7 s at fast tempos, 1.3 s at slow); four notes ahead for professionals, two for amateurs. Measured on pianists: a string player's unmeasured", measuredOn: ["piano"] }
        }
      }
    },
    violin: {
      values: {
        forceScale: { value: 1, unit: "1", kind: "unmeasured", reason: "ours: the bow's force by dynamic is written for a violin (physical-strings.js MODEL.force), the larger instruments' heavier strings taking more by this", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        slide: {
          most: { value: 40, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.5, unit: "Hz", kind: "literature", source: "geringer-allen-2004", note: "violinists' and cellists' about 5.5 Hz, neither instrument nor experience differing (high school and university players)" },
          width: { value: 40, unit: "cents, peak to peak", kind: "literature", source: "allen-geringer-macleod-2009", note: "an artist's about 40 cents in first position" }
        },
        hand: {
          frame: { value: 5, unit: "semitones, first finger to fourth, in the lowest position", kind: "vernacular", source: "cellofun-extensions", note: `"A perfect fourth is the usual comfortable span for violinists and violists" from the first finger to the fourth: Galamian's frame, the octave across two strings` },
          extended: { value: 6, unit: "semitones, first finger to fourth, extended, in the lowest position", kind: "unmeasured", reason: "ours: the fourth finger extended a semitone past its frame", searched: [{ where: "web search", query: "Galamian frame of the hand violin first finger fourth finger perfect fourth octave adjacent strings", date: "2026-11-06", found: "the frame a fourth from the first finger to the fourth (the octave across two strings: Galamian); no extension's span given" }] }
        }
      }
    },
    viola: {
      values: {
        forceScale: { value: 1.2, unit: "1", kind: "unmeasured", reason: "ours: the bow's force by dynamic is written for a violin (physical-strings.js MODEL.force), the larger instruments' heavier strings taking more by this", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        slide: {
          most: { value: 36, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.5, unit: "Hz", kind: "unmeasured", reason: "ours: the violinists' and cellists' rate, measured alike (Geringer & Allen 2004), taken for the viola between them", searched: [{ where: "web search", query: "MacLeod 2008 vibrato rates widths violin viola players dynamic level pitch register results viola width cents", date: "2026-10-29", found: "MacLeod 2008 (walled: SOURCES_TO_FETCH) measured violists with violinists, its tables not reached; no account gives a viola's rate or width" }, { where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }] },
          width: { value: 36, unit: "cents, peak to peak", kind: "unmeasured", reason: "ours: between the violin's and the cello's", searched: [{ where: "web search", query: "MacLeod 2008 vibrato rates widths violin viola players dynamic level pitch register results viola width cents", date: "2026-10-29", found: "MacLeod 2008 (walled: SOURCES_TO_FETCH) measured violists with violinists, its tables not reached; no account gives a viola's rate or width" }, { where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }] }
        },
        hand: {
          frame: { value: 5, unit: "semitones, first finger to fourth, in the lowest position", kind: "vernacular", source: "cellofun-extensions", note: '"A perfect fourth is the usual comfortable span for violinists and violists" from the first finger to the fourth' },
          extended: { value: 6, unit: "semitones, first finger to fourth, extended, in the lowest position", kind: "unmeasured", reason: "ours: the fourth finger extended a semitone past its frame", searched: [{ where: "web search", query: "Galamian frame of the hand violin first finger fourth finger perfect fourth octave adjacent strings", date: "2026-11-06", found: "the frame a fourth from the first finger to the fourth (the octave across two strings: Galamian); no extension's span given" }] }
        }
      }
    },
    cello: {
      values: {
        forceScale: { value: 1.6, unit: "1", kind: "unmeasured", reason: "ours: the bow's force by dynamic is written for a violin (physical-strings.js MODEL.force), the larger instruments' heavier strings taking more by this", searched: [{ where: "web search", query: "measured bow force cello double bass players Newtons bowing parameters study", date: "2026-10-29", found: "no player's bow force measured on the cello or double bass: a cello bowing pendulum (Mores, Vienna Talk 2015; the string's limits, not players'), a robot's cello bridge forces (Zenodo 2024), violin players under a load cell (arXiv 2411.05126)" }] },
        slide: {
          most: { value: 30, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.5, unit: "Hz", kind: "literature", source: "geringer-allen-2004", note: "violinists' and cellists' about 5.5 Hz, neither instrument nor experience differing (high school and university players)" },
          width: { value: 30, unit: "cents, peak to peak", kind: "unmeasured", reason: "ours: narrower than the violin's, as Geringer & Allen 2004 measured, how much authored", searched: [{ where: "web search", query: "Geringer Allen 2004 vibrato violin cello students rate width cents results cellists narrower", date: "2026-10-29", found: "Geringer & Allen 2004 (walled: SOURCES_TO_FETCH): by its abstract's account, rates about 5.5 Hz, neither instrument nor experience differing, and violinists' widths wider than cellists'; the widths themselves in its tables, not reached" }, { where: "arXiv", query: "hu-2025: cellists' vibrato by string register", date: "2026-10-29", found: "cellists' depth (half the peak-to-peak) rising with the stopped note's place toward the bridge, fitted 63.8 (x - 0.054)^2 + 3.31 cents over x, its place as a share of the string from the nut (R^2 0.51, 94 excerpts); rates 5.26 Hz (s.d. 0.28, TinySOL's players) and 6.48 Hz (s.d. 0.42, three soloists' concerto recordings); no one width an instrument's" }] }
        },
        hand: {
          frame: { value: 3, unit: "semitones, first finger to fourth, in the lowest position", kind: "vernacular", source: "cellofun-extensions", note: '"the first and fourth fingers cover only a minor third" in the neck region, without extension' },
          extended: { value: 4, unit: "semitones, first finger to fourth, extended, in the lowest position", kind: "vernacular", source: "cellofun-extensions", note: 'the 1-4 major third, an extension "frequent enough ... to count as a basic part of left-hand technique" in the neck region (its 1-4 perfect fourth a double extension)' }
        }
      }
    },
    contrabass: {
      values: {
        slide: {
          most: { value: 24, unit: "semitones/s", kind: "unmeasured", reason: 'ours, from orchestration practice: how fast a finger slides along its string at most, a faster glissando no slide but a shift (the owner, 4 October 2026: "clamp the max speed at which glissando can occur for each instrument"); the longer the string, the slower', searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] }
        },
        vibrato: {
          rate: { value: 5.17, unit: "Hz", kind: "literature", source: "mick-2024", note: "double bassists' mean, 40 players" },
          width: { value: 19, unit: "cents, peak to peak", kind: "literature", source: "mick-2024", note: "double bassists' mean, 40 players" }
        },
        hand: {
          frame: { value: 2, unit: "semitones, first finger to fourth, in the lowest position", kind: "vernacular", source: "gale-triangulation", note: "the closed hand (Simandl's 1-2-4), each of its fingers a semitone from the next: a whole tone, first to fourth" },
          extended: { value: 3, unit: "semitones, first finger to fourth, extended, in the lowest position", kind: "vernacular", source: "gale-triangulation", note: 'the open hand, "extension fingering 1-2-3-4", a finger a semitone: a minor third' }
        }
      }
    }
  }
};

// registry/objects/winds.json
var winds_default = {
  schema: "musebots.registry-objects/1",
  about: "The winds, woodwinds and brass, as a tree of types (registry/README.md), begun with what their players share: a vocal tract upstream of the reed (players/winds.json), one model whose values are its players' -- measured of clarinettists, every reed player's until their own are measured. Their bodies are still render/synthesis/geometry's (research/REGISTRY_PLAN.md, the woodwinds' step).",
  nodes: {
    "reed-woodwind": {
      is: "instrument",
      abstract: true,
      about: "A woodwind sounded by a reed in the player's mouth: what the reed is driven by is the mouth's pressure less the tract's answer to the flow through it (native/openwind src/tract.rs)."
    },
    clarinet: {
      is: "reed-woodwind",
      about: "The B-flat clarinet, whose players' tracts were measured as they played (Fritz & Wolfe 2005; Chen, Smith & Wolfe 2009)."
    },
    "e-flat-clarinet": {
      is: "reed-woodwind",
      about: "The E-flat clarinet: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    "bass-clarinet": {
      is: "reed-woodwind",
      about: "The bass clarinet: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    oboe: {
      is: "reed-woodwind",
      about: "The oboe, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    "english-horn": {
      is: "reed-woodwind",
      about: "The English horn, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    bassoon: {
      is: "reed-woodwind",
      about: "The bassoon, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    contrabassoon: {
      is: "reed-woodwind",
      about: "The contrabassoon, a double reed: its players' tract the reed woodwinds' (the clarinettists' measured) until its own are measured."
    },
    saxophone: {
      is: "reed-woodwind",
      abstract: true,
      about: "A saxophone, whose players' tracts were measured as they played the tenor (Chen, Smith & Wolfe 2008, 2011): every saxophonist's until each size's own are measured."
    },
    "soprano-saxophone": {
      is: "saxophone",
      about: "The soprano saxophone: its players' tract the saxophonists' (measured on the tenor) until its own are measured."
    },
    "alto-saxophone": {
      is: "saxophone",
      about: "The alto saxophone: its players' tract the saxophonists' (measured on the tenor) until its own are measured."
    },
    "tenor-saxophone": {
      is: "saxophone",
      about: "The tenor saxophone, whose players' tracts were measured as they played (Chen, Smith & Wolfe 2008, 2011)."
    },
    "baritone-saxophone": {
      is: "saxophone",
      about: "The baritone saxophone: its players' tract the saxophonists' (measured on the tenor) until its own are measured."
    },
    "jet-woodwind": {
      is: "instrument",
      abstract: true,
      about: "A woodwind sounded by its player's jet across an edge: its blowing pressure follows the note's frequency as flutists were measured blowing it (players/winds.json; Fletcher 1975)."
    },
    flute: {
      is: "jet-woodwind",
      about: "The concert flute in C."
    },
    "alto-flute": {
      is: "jet-woodwind",
      about: "The alto flute in G, the flute scaled to its bore (tools/design_openwind_woodwind.py flute_like): its players' law the flutists' until its own is measured."
    },
    piccolo: {
      is: "jet-woodwind",
      about: "The piccolo in C, the flute scaled to its bore: its players' law the flutists' until its own is measured."
    },
    "lip-reed": {
      is: "instrument",
      abstract: true,
      about: "A brass instrument, sounded by its player's lips buzzing into its mouthpiece: the flow between them the reed's, its lips opening outward (native/openwind src/kernel.rs T_REED, T_LIPS). Its bodies are render/synthesis/geometry's (tools/save_brass_body.py)."
    },
    trumpet: {
      is: "lip-reed",
      about: "The B-flat trumpet."
    },
    trombone: {
      is: "lip-reed",
      about: "The tenor trombone, its slide moving."
    },
    horn: {
      is: "lip-reed",
      about: "The French horn, its bore a horn in F (Kemp 2002)."
    },
    tuba: {
      is: "lip-reed",
      about: "The tuba in C (an Alexander CC, Campbell et al. 2021)."
    }
  }
};

// registry/players/winds.json
var winds_default2 = {
  schema: "musebots.registry-players/1",
  about: "What the players of the winds do, the woodwinds' and the brass's, on the objects' tree (registry/README.md): a node's values are its players'; one a node does not give, its parent's.",
  nodes: {
    "reed-woodwind": {
      values: {
        tract: {
          resonances: { value: [300, 1300, 2300], unit: "Hz", kind: "literature", source: "fritz-wolfe-2005", at: "II.D", note: "usually three resonances of the tract from 0.1 to 3 kHz, typically at 0.3, 1.3 and 2.3 kHz, varying among players and playing conditions" },
          first: {
            frequency: { range: [200, 300], unit: "Hz", kind: "literature", source: "fritz-wolfe-2005", at: "III; Table I", note: "its first peak present for every player, hardly varied with how they played: 200-300 Hz (220-280 in Table I)" },
            peak: { range: [18e5, 56e5], unit: "Pa s/m^3", kind: "literature", source: "fritz-wolfe-2005", at: "III; Table I", note: "1.8-5.6 MPa s/m^3 for most players (to 18 in Table I), a tenth of the bore's" }
          },
          normal: {
            held: { value: 600, unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.C", note: "under notes of about 450 Hz the resonance in the mouth held at a constant frequency, near 600 Hz for these players; over them, it follows the note (offset)" },
            offset: { value: 150, unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.C", note: "the resonance in the mouth about 150 Hz (100-200) above the sounding pitch, on average, in normal playing from notes of about 450 Hz to at least 1400" },
            peak: { value: 9e6, unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.C", note: "about 9 MPa s/m^3 on average in normal playing, against the operating bore peak's 40-90: little effect on the sounding frequency" }
          },
          bend: {
            peak: { range: [2e7, 6e7], unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2009", at: "III.B", note: "pitch bending and glissandi in the second register and above: as high as 60 MPa s/m^3, comparable with the bore's; 32 at 705 Hz bent a note 190 cents" }
          }
        },
        tongue: {
          portato: {
            contact: { value: 0.037, sd: 0.014, unit: "s", kind: "literature", source: "pamies-vila-hofmann-chatziioannou-2018", at: "3.1.1; Table 1", note: "the tongue's contact with the reed between portato notes, clarinettists playing eighths at 60 and 120 bpm, piano and forte: invariant with tempo and dynamic (37 ms, sd 14)" }
          },
          staccato: {
            contact: { value: [[0.25, 0.115], [0.5, 0.347]], unit: "s", kind: "literature", source: "pamies-vila-hofmann-chatziioannou-2018", at: "3.1.2; Table 1", note: "[the notes' inter-onset interval, the tongue's contact with the reed]: clarinettists' staccato eighths at 120 and 60 bpm, the note stopped by the tongue (their technique I); sd 31 and 27 ms" },
            silence: { value: [[0.25, 0.084], [0.5, 0.302]], unit: "s", kind: "literature", source: "pamies-vila-hofmann-chatziioannou-2018", at: "3.1.2; Table 1", note: "[the notes' inter-onset interval, the silence between notes]: the same staccato eighths at 120 and 60 bpm, stopped by the tongue (technique I); sd 37 and 43 ms" }
          }
        },
        flow: {
          turbulence: { value: 0, unit: "1/sqrt(Hz)", kind: "unmeasured", reason: `ours, to be fitted: the flow through the reed's channel turbulent, its fluctuation a share of the flow per root hertz, white to the engine's own rate (native/openwind src/stream.rs turbulence, the slit's coefficient moved by it each step, and the offline renders' openwind_compiled.py alike; public/shared/performers/turbulence.js turbulenceOf); none until fitted to players' held notes, the noise between their harmonics on the anechoic recordings (Weinzierl et al. 2017; research/MODELING_GAPS.md, "No turbulent noise in the reed's or the lips' flow")`, searched: [{ where: "the web", query: "turbulent noise in a clarinet's reed channel's flow, its level measured", date: "2026-11-03", found: "none measured: J. O. Smith, Physical Audio Signal Processing, 'Single-Reed Theory' -- synthesis models' noise modulated by the reed 'despite a lack of firm basis in acoustic measurements to date', turbulence near the reed's closing the basic model's chief omission; a reed channel's flow laminar-like below a Reynolds number of about 4000, seldom reached in saxophones and clarinets (TU Delft repository); a synthesis patent's noise following the breath, its level unmeasured" }] }
        },
        idiom: {
          leap: { value: 0.03, unit: "s an octave", kind: "unmeasured", reason: "ours: the time a leap within one register takes its fingers, an octave of it; to be measured on the engine, a slur from note to note held shorter until its second note no longer speaks (research/IDIOM_AS_RELATIONS.md)", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] },
          up: { value: 0.04, unit: "s a register crossed, at a leap of an octave or more (in proportion below it)", kind: "unmeasured", reason: "ours: the time a slur upward into a resonance (a register: overblown with its register key) above takes, each crossed, its whole at a leap of an octave and more, a step across barely any; to be measured on the engine as `leap`", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] },
          down: { value: 0.12, unit: "s a register crossed, at a leap of an octave or more (in proportion below it)", kind: "unmeasured", reason: "ours: the time a slur downward into a resonance (a register: overblown with its register key) below takes, each crossed, its whole at a leap of an octave and more, a step across barely any, the lower regime established again; to be measured on the engine as `leap`", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] }
        }
      }
    },
    saxophone: {
      values: {
        tract: {
          resonances: { value: [200, 1e3], unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2011", at: "III.A", note: "a modest first peak consistently around 150-250 Hz, and the next, of primary interest, typically around 1 kHz; measured on the tenor, five expert and three amateur saxophonists" },
          first: {
            frequency: { range: [150, 250], unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2011", at: "III.A", note: "a modest peak in the mouth consistently observed around 150-250 Hz, not tuned in any playing condition studied (III.C: 253 and 242 Hz under a standard and an altissimo note)" },
            peak: { range: [25e5, 8e6], unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2011", at: "III.A, III.C, III.E", note: "not more than several MPa s/m^3: 2.5 (240 Hz, a soft note), 3.3 and 2.9 (253 and 242 Hz), 8 under one multiphonic's tract" }
          },
          normal: {
            held: { value: 650, range: [500, 1100], unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2011", at: "III.D.1; Fig. 7", note: "over the standard range the second resonance from about 500 to 1100 Hz with no simple relation to the note, experts' broadly spread, amateurs' in two bands at about 650 and 1100 Hz; the lower band where it is held" },
            offset: { value: 60, range: [0, 100], unit: "Hz", kind: "literature", source: "chen-smith-wolfe-2011", at: "III.C, III.D.1; Fig. 7", note: "in the altissimo (on the tenor from sounding 659-698 Hz) experts tune a strong resonance near the note, typically not more than 100 Hz apart, on or above it rather than below: the note 921 Hz, 60 Hz below its peak at 980; toward the upper standard range experts already adjust it" },
            peak: { value: 3e6, range: [4e5, 1e7], unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2011", at: "III.D.3, III.F", note: "over the standard range amateurs' 0.4-6 MPa s/m^3, experts' rising from about 1 to about 10 near the top of the second register; 3 in normal playing at C#5 against the bore's operating 62" }
          },
          altissimo: {
            peak: { range: [1e7, 4e7], unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2011", at: "IV; III.C", note: "to play the weaker bore resonances (typically below 30 MPa s/m^3) experienced saxophonists make a strong resonance with impedance maxima ranging from 10 to 40 MPa s/m^3, comparable with the bore's: 33 at 980 Hz against the bore's 9.8 at 949; amateurs, who did not, could not play the altissimo (Chen, Smith & Wolfe 2008)" }
          },
          bend: {
            peak: { range: [1e7, 4e7], unit: "Pa s/m^3", kind: "literature", source: "chen-smith-wolfe-2011", at: "IV; III.B; III.F", note: "bugling, 22-28 MPa s/m^3 near the 7th to 12th bore peaks; a pitch bend raising the mouth's peak almost sixfold from 3, the note 91 Hz (300 cents) below its fingering's; 10-40 in bugling and the altissimo" }
          }
        }
      }
    },
    "lip-reed": {
      values: {
        flow: {
          turbulence: { value: 0, unit: "1/sqrt(Hz)", kind: "unmeasured", reason: `ours, to be fitted: the flow between the lips turbulent, its fluctuation a share of the flow per root hertz, white to the engine's own rate (native/openwind src/stream.rs turbulence, the lips' slit's coefficient moved by it each step, and the offline renders' openwind_compiled.py alike; public/shared/performers/turbulence.js turbulenceOf); none until fitted to players' held notes, the noise between their harmonics on the anechoic recordings (Weinzierl et al. 2017's trumpet; research/MODELING_GAPS.md, "No turbulent noise in the reed's or the lips' flow")`, searched: [{ where: "the web", query: "turbulent noise in a brass player's lips' flow, its level measured or modelled", date: "2026-11-03", found: "none measured: C. Vergez & X. Rodet's trumpet model (ICMC 2001), the jet out of the lips losing its energy to turbulence in the mouthpiece's cup, no noise level; Adachi & Sato's lips, and Giordano's (ISMA 2017) Navier-Stokes flow over them, no level given" }] }
        },
        idiom: {
          leap: { value: 0.03, unit: "s an octave", kind: "unmeasured", reason: "ours: the time a leap within one register takes its fingers, an octave of it; to be measured on the engine, a slur from note to note held shorter until its second note no longer speaks (research/IDIOM_AS_RELATIONS.md)", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] },
          up: { value: 0.02, unit: "s a register crossed, at a leap of an octave or more (in proportion below it)", kind: "unmeasured", reason: "ours: the time a slur upward into a partial above takes, each crossed, its whole at a leap of an octave and more, a step across barely any; to be measured on the engine as `leap`", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] },
          down: { value: 0.02, unit: "s a register crossed, at a leap of an octave or more (in proportion below it)", kind: "unmeasured", reason: "ours: the time a slur downward into a partial below takes, each crossed, its whole at a leap of an octave and more, a step across barely any, the lower regime established again; to be measured on the engine as `leap`", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] }
        }
      }
    },
    "jet-woodwind": {
      values: {
        breath: {
          perHz: { value: 0.8, unit: "Pa/Hz", kind: "literature", source: "fletcher-1975", at: '"p = 0.008 v" mbar at a note of v Hz', note: "four flutists' blowing pressure rising with the note's frequency, its jet's speed sqrt(2p/rho): 20 m/s at D4, 40 at D6 (the same number as render/synthesis/workers/openwind_worker.py WOODWINDS jet pressure, the worker's own until it reads the registry)" },
          ffOverPp: { range: [1, 2], unit: "", kind: "literature", source: "fletcher-1975", note: "two of his four flutists raising their pressure about twice from pp to ff, two holding it" }
        },
        idiom: {
          leap: { value: 0.03, unit: "s an octave", kind: "unmeasured", reason: "ours: the time a leap within one register takes its fingers, an octave of it; to be measured on the engine, a slur from note to note held shorter until its second note no longer speaks (research/IDIOM_AS_RELATIONS.md)", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] },
          up: { value: 0.05, unit: "s a register crossed, at a leap of an octave or more (in proportion below it)", kind: "unmeasured", reason: "ours: the time a slur upward into a resonance (a register: overblown by its jet) above takes, each crossed, its whole at a leap of an octave and more, a step across barely any; to be measured on the engine as `leap`", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] },
          down: { value: 0.1, unit: "s a register crossed, at a leap of an octave or more (in proportion below it)", kind: "unmeasured", reason: "ours: the time a slur downward into a resonance (a register: overblown by its jet) below takes, each crossed, its whole at a leap of an octave and more, a step across barely any, the lower regime established again; to be measured on the engine as `leap`", searched: [{ where: "web search", query: "woodwind slur interval ascending descending register break difficulty speed measured players", date: "2026-11-06", found: "rules of thumb only (a clarinet's slur down a tenth or more over the break nearly impossible, up easy); no player's or instrument's playable interval by direction and speed measured" }] }
        }
      }
    }
  }
};

// registry/stimuli/stimuli.json
var stimuli_default = {
  schema: "musebots.registry-stimuli/1",
  about: "The MIDI 2.0 files tests and trials play (registry/README.md): each with what it plays and tests, how it was made (a script and its seed, a bot, or by hand), its checksum, and the tests and trials that play it.",
  stimuli: {}
};

// registry/method/strings.json
var strings_default = {
  schema: "musebots.registry-methods/1",
  about: "The bowed strings' methods (registry/README.md): what each does, and its settings, each with why that value and what it answers to.",
  methods: {
    "strings-neutral": {
      about: "The strings' neutral note at each string and stop, the first stage of the player's fit by decomposition (native/strings-model/neutral.py; the owner, 27 October 2026): each string at ordinario, at each stop and dynamic, every force of a grid from silence with no attack curve on every seed, its window the longest run that holds Helmholtz motion, its neutral note that window's middle among the forces players bow; then held from it at mf, the levels against the measured instruments', the dynamics' rounds by speed and force until they hold, the law and its check through the compiler, and adoption where every note was heard.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3f)",
      settings: {
        ratio: { value: 1.189207115002721, unit: "1", kind: "setting", reason: "the force grid's step: a quarter of an octave of force, finer than the windows' own structure (the viola's run at 1.05 N between 0.75 and 1.48), 27 forces on the viola from 0.12 N to 10" },
        stopStep: { value: 1.5, unit: "semitones", kind: "setting", reason: "its stops from the law's lowest to its highest about this many semitones apart, none of them twelve-tone, so that a law read between them is checked between them" },
        near: { value: 3, unit: "grid steps", kind: "setting", reason: "a round after the first maps each note's forces this many grid steps either side of the one its law predicts" },
        reach: { value: 4, unit: "1", kind: "setting", reason: "the grid extended past its top, a step at a time, while a note's window from silence still holds there, at most to this many times its top: the viola's map of 27 October had 58 of its 384 notes' windows cut by its top, their neutral notes the middle of a window that went on" },
        holds: { value: 1, unit: "dB", kind: "setting", reason: "the dynamics' rounds are done where no note's correction is over this" },
        rounds: { value: 4, unit: "rounds", kind: "setting", reason: "the dynamics' rounds at most" },
        listenGap: { value: 0.25, unit: "s", kind: "setting", reason: "the silence between the neutral notes rendered to hear" },
        check: { value: 1, unit: "s", kind: "setting", reason: "how long each note the check compiles is held, at the violin's lowest pitch and above (a lower one as many periods: notePeriods)" },
        notePeriods: { kind: "setting", derive: { equation: "periods-in", inputs: { seconds: "setting:strings-regions:note", hz: "object:violin:lowestHz" } }, unit: "periods", reason: "each test note held as many periods as the violin's lowest note gets in regions.py's note (0.6 s at 196 Hz, about 118): a low string's start measured as long, in its own periods, as a high one's -- some contrabass notes settle past 0.6 s (the owner, 28 October 2026: 'it's possible that some double-bass notes will need it'); its settling still judged against Guettler & Askenfelt's limits, so a slow note is measured, never passed", answersTo: "players: violin-family attackLimits" },
        offsetRead: { value: 0.04, unit: "s", kind: "setting", reason: "a heard note's offset read over its render's first this long, before its bow" },
        listenPeakDb: { value: -3, unit: "dBFS", kind: "setting", reason: "the neutral notes rendered to hear brought together to this peak" },
        peakFloor: { value: 1e-12, unit: "1", kind: "setting", reason: "a silent render's peak taken as this, so it is never divided by zero" },
        levelFloor: { value: 1e-24, unit: "1, of power", kind: "setting", reason: "a note's mean square floored here, so a silent note's level is finite" },
        lineNotes: { value: 3, unit: "notes", kind: "setting", reason: "a string's level errors corrected by a line through its stops where it has this many notes at a dynamic, else by their mean" }
      }
    },
    "strings-regions": {
      about: "Each string's windows of Helmholtz motion over contact and force, from silence and held (native/strings-model/regions.py), and the attacks measured on them: the reference notes every bowed fit plays.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md)",
      settings: {
        forces: { value: 10, unit: "forces", kind: "setting", reason: "each window's coarse grid: this many forces log-spaced from the robot's least force to WIDEN past the players' most" },
        contacts: { value: 12, unit: "contacts", kind: "setting", reason: "this many contacts log-spaced from the bridge's mechanical limit to the midpoint" },
        edgeRatio: { value: 1.05, unit: "1", kind: "setting", reason: "each window's edge found to within this ratio of force" },
        widen: { value: 2, unit: "1", kind: "setting", reason: "the grid's top this many times the players' most" },
        widenings: { value: 12, unit: "widenings", kind: "setting", reason: "a bracket widened at most this many times" },
        robotLeast: { kind: "setting", derive: { equation: "least", inputs: { values: "setting:schelleng-map:forces" } }, unit: "N", reason: "the grid's bottom: the bowing robot's least force (its grid's, schelleng-map forces), times the instrument's force scale" },
        midpoint: { value: 0.5, unit: "share of the string", kind: "setting", reason: "the contact axis's tasto end, the vibrating length's midpoint (the owner, 19 October 2026: extreme sul tasto is 0.5 of the string)" },
        ramp: { value: 0.05, unit: "s", kind: "setting", reason: "a reference note's bow brought up to speed in this (noise_profile.actions')" },
        note: { value: 0.6, unit: "s", kind: "setting", reason: "a reference note held this long and classified on its last half, at the violin's lowest pitch (a lower one longer: strings-neutral notePeriods)" },
        gap: { value: 0.2, unit: "s", kind: "setting", reason: "its string damped over this before the next note" },
        slide: { value: 0.6, unit: "s", kind: "setting", reason: "a sustained note's finger slid and its bow brought to its speed over this (glide.py's, which held)" },
        glide: { value: 0.3, unit: "s", kind: "setting", reason: "then glided to its contact and force over this" },
        attackSeconds: { value: [0.02, 0.05, 0.12, 0.3, 0.75], unit: "s", kind: "setting", reason: "each attack measured at these attack times (a stroke's, MIDI 2.0 RPNC #73; under 0.02 s the compiler sets its bow down at its whole force at once, and past the last an attack takes the last's)" },
        froms: { value: 10, unit: "shares", kind: "setting", reason: "its starting force a share of its held force on a grid of this many" },
        fromRange: { value: [0.02, 4], unit: "shares", kind: "setting", reason: "from this range" },
        reaches: { value: [0.5, 1, 2, 4], unit: "attack times", kind: "setting", reason: "its force brought to its own over each of these times its attack time" },
        held: { value: 0.8, unit: "s", kind: "setting", reason: "each attack's note twice its attack and this much more long (the compiler's attack at most half its note, its release after)" },
        attackTimes: { value: 2, unit: "times its attack", kind: "setting", reason: "each attack's note this many times its attack long, and HELD more: the compiler's attack at most half its note" },
        nearFastest: { value: 0.1, unit: "share of the fastest", kind: "setting", reason: "an endpoint's curves near its fastest: settling within a period or this share of the fastest of it" },
        perUnknown: { value: 2, unit: "endpoints", kind: "setting", reason: "the attack model's features fewer where its endpoints are under this many an unknown, the last dropped first" },
        agreeAbsolute: { value: 15e-4, unit: "as compiled", kind: "setting", reason: "the compiler and the model agreeing within this and agreeRelative: a force to the gram, a time to a tenth of a millisecond, as the compiler rounds them" },
        agreeRelative: { value: 1e-4, unit: "share", kind: "setting", reason: "and within this share of the value" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two stops or contacts the same within this: a float's rounding" },
        keyDigits: { value: 16, unit: "hex digits", kind: "setting", reason: "a render's key, its actions' hash, this long" },
        engineDigits: { value: 16, unit: "hex digits", kind: "setting", reason: "an engine build's stamp, its binary's hash, this long" },
        classifierDigits: { value: 12, unit: "hex digits", kind: "setting", reason: "the classifier's stamp, its source's and its settings' hash, this long" },
        jobs: { value: 3, unit: "processes", kind: "setting", reason: "renders at once: three, the trunk's share for a strings fit" }
      }
    },
    "strings-compiler": {
      about: "The bowed strings' compiler (public/shared/performers/physical-strings.js): how it writes a part's notes as the strings engine's actions, which every fit, render and the band play.",
      source: "ours",
      settings: {
        versions: { value: 3, unit: "versions", kind: "setting", reason: "how many versions of each instrument the engine holds, a seat taking one by its chair (physical-strings.js MODEL.variants): a section's seats not all one instrument -- the violin's, viola's and cello's each one of Artifastring's string sets (objects: violin.0 to cello.2)" },
        forceWritten: { value: 1e-3, unit: "N", kind: "setting", reason: "the least step of force the compiler writes (physical-strings.js toFixed(3)): a bracket never under it, a cost's noise measured at least this far apart" },
        contactWritten: { value: 1e-5, unit: "share of the string", kind: "setting", reason: "the least step of contact the compiler writes (physical-strings.js share, to five places): a span's far end where no measurement bounds it" },
        tuneWritten: { value: 1e-7, unit: "1", kind: "setting", reason: "a string's tension ratio written to seven places: a change under this not written" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two values the same within this: a float's rounding, never a choice of the music's" },
        instant: { value: 1e-4, unit: "s", kind: "setting", reason: "a time under this is none: a bite or a stop shorter is no stop, and a stroke's bows end this inside its limit" },
        leastAccelerating: { value: 2e-3, unit: "s", kind: "setting", reason: "a bow's acceleration figured over this at least: a speed reached over less, taken as reached over this" },
        leastAttack: { value: 0.01, unit: "s", kind: "setting", reason: "a stroke's attack never shorter than this" },
        readyBefore: { value: 5e-3, unit: "s", kind: "setting", reason: "a stroke's or a pluck's finger readied to be there this long before it" },
        dampBefore: { value: 6e-3, unit: "s", kind: "setting", reason: "a string's losses set back this long before its stroke, before its finger is readied" },
        releaseAfter: { value: 0.02, unit: "s", kind: "setting", reason: "a release begun no sooner than this after its stroke begins (or half its note, the shorter)" },
        tail: { value: 3, unit: "s", kind: "setting", reason: "a part's end this long after its last change, where its driver does not ring it down: its strings turned off where they fell quiet" },
        pitchWithin: { value: 0.05, unit: "semitones", kind: "setting", reason: "a pitch sounds as asked within this: a stroke whose path begins further off its pitch glides into it, a multiphonic asked further from its own is said to sound at its own" },
        strings: { value: 4, unit: "strings", kind: "setting", reason: "every instrument the engine plays has four strings (Artifastring's)" },
        fingerPasses: { value: 4, unit: "passes", kind: "setting", reason: "a finger placed again for the cents its geometry sounds off (the calibration's) at most this many times" },
        fingerOutlier: { value: 60, unit: "cents", kind: "setting", reason: "a finger's measured correction further than this from its string's reliable centre taken for one that failed (a note that did not speak, or read at another partial: violin variant 2's E string read -198 and +677 cents where its others read +27, Op. 3.9's first render), read between its reliable neighbours instead -- a finger the model places by geometry is never a semitone out; its reliable corrections lie within some 30 cents of each other" },
        moved: { value: { f: 2, h: 3, b: 4, a: 5, t: 2, d: 3, u: 4, p: 3 }, unit: "values", kind: "setting", reason: "the driver's lines whose change is moved over time (native/strings-model/musebots-strings.cpp), by kind, and how many values each takes before its span: the driver's protocol" },
        contactHeld: { value: [0.06, 0.2], unit: "share of the string", kind: "setting", reason: "a contact neither given nor measured -- the measured players' by dynamic (bowed-line.js BOWED_LINE.contact) -- held within this: beyond it the model leaves Helmholtz motion and squeaks or whistles" },
        leastFinger: { value: 0.045, unit: "share of the string", kind: "setting", reason: "the least a finger stops a string: nearer the nut the model's finger, a stiff spring on a piece of string that hardly moves, overshoots until its numbers overflow (Op. 3.5's second violins at 0.006; violin variant 2's E string at 0.03, Op. 3.9's first renders); at 0.045, its next stop measured, it plays. A pitch nearer its open string keeps its finger there, its string's tension lowered so the two sound it" },
        openWithin: { value: 0.01, unit: "semitones", kind: "setting", reason: "a note within this of its open string is the open string" },
        retuneSemitones: { value: 1, unit: "semitones", kind: "setting", reason: "a string's tension never raised past this, which only a failed correction could ask: a finger that reaches the pitch by its geometry stops it there instead" },
        mostRetune: { kind: "setting", derive: { equation: "semitones-ratio", inputs: { semitones: "setting:strings-compiler:retuneSemitones" } }, unit: "1", reason: "retuneSemitones as a ratio of the string's tension's pitch" },
        pluckLead: { value: 0.1, unit: "s", kind: "setting", reason: "the model pulls a plucked string this long before it lets go (its driver's PLUCK_SECONDS), so a pluck is asked that much early" },
        step: { value: 0.01, unit: "s", kind: "setting", reason: "a finger's path -- a vibrato, a slide -- written a straight segment this long at a time" },
        joined: { value: 0.06, unit: "s", kind: "setting", reason: "a stroke joined to the one before where it begins within this of that one's end (a change of bow's bite counted in)" },
        drawStep: { value: 0.02, unit: "s", kind: "setting", reason: "a drawn bow's wandering written a straight segment this long at a time" },
        drawnLeast: { value: 0.15, unit: "s", kind: "setting", reason: "a stroke drawn with its bow's wandering where it is held this long or longer -- never a multiphonic's, bowed as it was measured, nor a tremolo's" }
      }
    },
    "strings-bowing-law": {
      about: "The bowed strings' bowing law fitted (native/strings-model/fit_bowing.py; research/STRINGS_FITTED_BOWING.md): each instrument's windows of Helmholtz motion mapped over contact and force as a seat plays them, then the law's four values -- its contact at ppp and fff, its place in each window at ppp and fff -- fitted by descent through the physics, never by draws: least squares by a trust region tolerant of the cost's noise (trust_region.py: Sun & Nocedal 2023), the cost's noise measured at its start (ECnoise: More & Wild 2011) and each value's difference step from the cost's curvature (More & Wild 2012); its residuals each note's levels against the measured instruments', how its spectrum changes from pp to ff against the recordings', and each value's distance from its measured range's middle.",
      source: "ours (research/STRINGS_FITTED_BOWING.md)",
      settings: {
        betaRange: { value: [0.02, 0.35], unit: "share of the string", kind: "setting", reason: "the windows' grid of bow-bridge distances, log-spaced over this: from near the bridge to over the fingerboard's end, the measured players' 0.03-0.3 and beyond" },
        forceRange: { value: [0.02, 4], unit: "N", kind: "setting", reason: "the windows' grid of forces, log-spaced over this, the violin's (an instrument's times its force scale): from a light touch to past the heaviest measured, 2.5 N" },
        seeds: { value: 5, unit: "seeds", kind: "setting", reason: "each point's and note's attack played under the driver's seeds 1 to this, stopping at the first that leaves Helmholtz motion: a bow is in its window only where every attack of it settles there. At the calibration's mezzo-forte on a violin's E string (vn1.2, note 81), 15 of 32 attacks on the ramped driver settled 6 dB softer, their fundamental 1 dB over their octave against 13 dB (claude-scratch/strings-ramps/logs/reattack-seeds-1.log), and the classifier finds each of those 16 notes' 8 soft ones in multiple slip, two slips a period, the 8 others in Helmholtz motion (classify-reattack-3.log): one seed had judged that bow by chance. A bow whose attacks fail one time in two is found failing under five seeds 31 times in 32" },
        scored: { value: ["pp", "mf", "ff"], unit: "dynamics", kind: "setting", reason: "the law's notes played at these dynamics: each note's pp and mf level judged under its ff, its spectrum's change from pp to ff" },
        steps: { value: [0.27, 5.13, 12.41], unit: "semitones", kind: "setting", reason: "each string's notes a quarter tone over its open pitch, a fourth up and an octave up, microtonal: none on a twelve-tone step" },
        noteSeconds: { value: 1.2, unit: "s", kind: "setting", reason: "each note the compiler plays for the windows and the law held this long, its attack's held part (half its note to its release) classified" },
        compared: { value: 12, unit: "harmonics", kind: "setting", reason: "each note's spectrum's change from pp to ff compared over its first this many harmonics, dB under its loudest" },
        most: { value: 40, unit: "evaluations", kind: "setting", reason: "the descent's evaluations at most (fit_string.py's)" },
        points: { value: 8, unit: "steps", kind: "setting", reason: "the cost's noise measured from this many plus one laws (More & Wild's own driver's m, ECNdriver.m), first one written step of the lightest force apart (strings-compiler forceWritten)" },
        margin: { value: 1e-6, unit: "share of the string", kind: "setting", reason: "a law's contacts kept this far inside their windows' edges: the bound solver's tolerance" },
        betas: { value: 12, unit: "distances", kind: "setting", reason: "the windows' grid this many bow-bridge distances where none are asked (--betas), log-spaced over betaRange: neighbours 30% apart" },
        forces: { value: 20, unit: "forces", kind: "setting", reason: "the windows' grid this many forces where none are asked (--forces), log-spaced over forceRange: neighbours 32% apart" },
        lawDigits: { value: 8, unit: "hex digits", kind: "setting", reason: "a law's folder named by this many hex digits of its values' hash, so a run resumed reuses only the same law's notes" },
        changeWithin: { value: 2, unit: "semitones", kind: "setting", reason: "a note's change from pp to ff compared with the recorded note nearest its pitch only where that one lies within this: the recordings' notes are a semitone apart (render/synthesis/harmonic-spectra), so this admits a note at most two semitones past their compass" },
        ordinarioPoints: { value: 400, unit: "contacts", kind: "setting", reason: "ordinario sought among this many contacts log-spaced over the measured players' (0.03-0.3: a step of 0.6% of contact)" }
      }
    },
    "strings-player": {
      about: "The strings' player fitted to whatever instrument the engine builds, every playing value in one descent (native/strings-model/fit_player.py): its contacts and places in each string's windows by dynamic, the force's and the bow speed's multiples at the marks past ppp and fff, the onset curve, the change of bow -- the instrument held as built, the player fitted to it.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md)",
      settings: {
        upsample: { value: 8, unit: "1", kind: "setting", reason: "a bridge force interpolated, band-limited, to this many times its rate before its flybacks are timed (its jitter)" },
        jitterPeriods: { value: 3, unit: "periods", kind: "setting", reason: "a jitter read only where this many flyback-to-flyback periods or more were timed: ours, a spread of fewer says little" },
        centroidHarmonics: { value: 20, unit: "harmonics", kind: "setting", reason: "a held part's brightness its first this many harmonics' centroid: ours" },
        centroidBand: { value: 8, unit: "1", kind: "setting", reason: "each harmonic's magnitude its spectrum's peak within f0 over this of it: ours, an eighth of the spacing between harmonics" },
        startWithin: { value: 1e-12, unit: "as its values", kind: "setting", reason: "a start's value taken as within its range, and its bounds, to this: a logarithm's and its exponential's rounding, never moved for it" },
        compilerDigits: { value: 16, unit: "hex digits", kind: "setting", reason: "the compiler's stamp, its sources' hash, this long" },
        compileDigits: { value: 20, unit: "hex digits", kind: "setting", reason: "a compile kept by its job's and the compiler's hash, this long" },
        most: { value: 200, unit: "evaluations", kind: "setting", reason: "the descent's evaluations at most, a guard: it ends where its steps promise no more than the noise or change no note" }
      }
    },
    "strings-loop": {
      about: "The strings' fit as one loop that runs to its end unattended (native/strings-model/fit_loop.py): its stages in order, each kept by what it measured, and the band its adoption is heard in before and after.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md, requirement 8 and stage 3e)",
      settings: {
        band: { value: "string-quintet", unit: "band", kind: "setting", reason: "the band an instrument's adoption is heard in, rendered as it plays before and after, every note against its stem: ours, the strings' realtime objective (17 October 2026)" },
        bandSeconds: { value: 30, unit: "s", kind: "setting", reason: "the band rendered this long: ours" },
        bandSeed: { value: 20261019, unit: "seed", kind: "setting", reason: "the band rendered at this seed, fixed so before and after play the same piece (the owner, 1 October 2026: a fixed default seed is ok): the date the loop was written" },
        calibrationDigits: { value: 12, unit: "hex digits", kind: "setting", reason: "the band's check kept by its calibration's and onsets' files' hash, this long" }
      }
    },
    "strings-onsets": {
      about: "An attack's onset read from its sound (native/strings-model/fit_onsets.py accent, the player's fit's too): its level frame by frame from its stroke to its release, the loudest frame of its onset against the median of its held part's.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3c)",
      settings: {
        accentFrame: { value: 0.01, unit: "s", kind: "setting", reason: "its level read in frames this long: ours" },
        accentAttack: { value: 0.07, unit: "s", kind: "setting", reason: "its onset read from its stroke over this, then its articulation's decay (bowed-articulation.js), then accentAfter: ours, written with the onsets' fit (19 October 2026) with no reason recorded" },
        accentAfter: { value: 0.03, unit: "s", kind: "setting", reason: "and this past its decay: ours, written with the onsets' fit with no reason recorded" },
        changeBefore: { value: 0.6, unit: "s", kind: "setting", reason: "an attack at a change of bow follows a note held this long on the same string: ours" },
        note: { value: 1, unit: "s", kind: "setting", reason: "each attack's note held this long, its held part the later half of its frames: ours" },
        periodsScale: { value: 2, unit: "periods", kind: "setting", reason: "the onsets' fit's transient residual in this many periods: about the reading's own step (one period, a window a period apart, over four): ours" },
        accentScale: { value: 1, unit: "dB", kind: "setting", reason: "its accent residual in this many dB: about a level's just-noticeable difference: ours" },
        ranges: { value: { speed: [0.05, 6], force: [0.05, 4] }, unit: "times the held bow's", kind: "setting", reason: "the onset's speed and force multiples (physical-strings.js onsetOf) sought within these: ours, no measurement bounding them" },
        noiseSpacing: { value: 1.01, unit: "1", kind: "setting", reason: "the onsets' fit's cost's noise first measured over steps of this ratio in each value (ECnoise's spacing, moved as it advises): ours" },
        noiseTries: { value: 8, unit: "spacings", kind: "setting", reason: "its spacing moved at most this many times before the noise is said not found" },
        most: { value: 30, unit: "evaluations", kind: "setting", reason: "the onsets' fit's evaluations at most" }
      }
    },
    "strings-engine": {
      about: "The one bowed-string engine as Musebots build it (native/strings-model/engine.mjs): Artifastring patched, with one body for every program -- its tables baked from the measured bodies' corrections and their radiation, the contrabass's the cello's stretched to its size.",
      source: "ours",
      settings: {
        dcBlockHz: { value: 10, unit: "Hz", kind: "setting", reason: "the offset from zero the bow's friction leaves in Artifastring's sound blocked under this, first order, from silence" },
        kaiserBeta: { value: 8, unit: "1", kind: "setting", reason: "a body's impulse response stretched in time read between its samples by a Kaiser-windowed sinc of this beta: a stretch only narrows the band, so nothing folds back" },
        sincHalf: { value: 32, unit: "samples", kind: "setting", reason: "that sinc this many samples either side" },
        scaledBins: { value: 32768, unit: "bins", kind: "setting", reason: "a minimum-phase body filter scaled to a body's size read and remade at this many frequency bins" },
        bowContact: { value: false, unit: "switch", kind: "setting", reason: "the bow's contact as measured: its hair's give in series with each cell of the ribbon, the string's losses while bowed beyond its own, and rosin's friction on every string (registry/objects/bowed.json violin-family bow.hairStiffness, hairDamping, stringLoss, friction; Matusiak & Chatziioannou 2024, Lampis et al. 2024): the attacks from rest on Lampis' string A within 20 periods as often as the robot's, 236 of its 859 to its 188, where Artifastring's made 27 (native/strings-model/lampis_guettler.py), each part alone short of it; off, Artifastring's rigid contact, its strings' own losses and its tables' friction. Off until the laws are fitted under it (neutral.py fit, its maps stamped with it): a force measured under the one is played under the other moved by their frictions (friction-drop-scale), which keeps it under Schelleng's most force but not over his least, the bowed losses and the hair raising the least force more than the friction lowers it (a contrabass's mf bow moved from 5.06 N to 2.11 N double-slipped where 3 N held Helmholtz motion, 7 November 2026). The bodies' corrections, levels and pizzicati are measured through the engine, and are measured again when it changes (native/strings-model/README.md)" }
      }
    },
    "bow-planner": {
      about: "A bowed string's bow planned through the performer contract's solver (public/shared/performers/bow.js planBowing): where the bow is, which way it moves, how much of it each note spends, where it may change direction -- the reference the tests hold a bowed line to, never called while playing.",
      source: "ours (the general performer-instrument report, sections 5.4 and C03)",
      settings: {
        together: { value: 5e-3, unit: "s", kind: "setting", reason: "notes starting within this of each other one group" },
        positionGrain: { value: 0.5, unit: "cm", kind: "setting", reason: "bow positions within this one state" },
        setDown: { value: [0, 0.25, 0.5, 0.75, 1], unit: "shares of the bow from the frog", kind: "setting", reason: "where a stroke may be set down to begin, a phrase's first or after a retake" },
        costChange: { value: 0.1, unit: "1", kind: "setting", reason: "a direction change's cost" },
        costRetake: { value: 1, unit: "1", kind: "setting", reason: "a retake's" },
        costHidden: { value: 3, unit: "1", kind: "setting", reason: "a change inside a held note's: an articulation changed" },
        maxStates: { value: 4096, unit: "states", kind: "setting", reason: "the search's states at most" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two pitches or places the same within this: a float's rounding" }
      }
    },
    "bowed-line": {
      about: "A bowed string's phrase planned with its bow (public/shared/performers/bowed-line.js planPhrase): the shared line (line.js) carried to the instrument, its bowing, and its bow distributed stroke by stroke by construction -- each stroke at its dynamic's speed where the bow has room, slower where it hasn't, set back in a silence long enough for a retake, a slur the slowest bow cannot draw divided.",
      source: "ours",
      settings: {
        density: { value: 0.4, unit: "0 to 1", kind: "setting", reason: "a phrase planned without its arc's density given plays at this (its caller's own given otherwise)" },
        loudness: { value: 0.5, unit: "0 to 1", kind: "setting", reason: "and without its loudness given, at this" },
        joinWithin: { value: 1e-6, unit: "s", kind: "setting", reason: "a slurred note sounding into the next within this joins its stroke" },
        same: { value: 1e-9, unit: "as compared", kind: "setting", reason: "two places or times the same within this: a float's rounding" },
        marginGrains: { value: 2, unit: "grains", kind: "setting", reason: "the bow kept this many grains of its position (bow.js positionGrain) from either end" },
        bisections: { value: 48, unit: "halvings", kind: "setting", reason: "a stroke's one share of its notes' speeds found by halving its interval this many times: to a double's precision" },
        repairsPerNote: { value: 4, unit: "repairs", kind: "setting", reason: "a phrase whose stroke can't be drawn repaired at most this many times a note" },
        repairsMore: { value: 8, unit: "repairs", kind: "setting", reason: "and this many more" }
      }
    },
    "strings-harmonics": {
      about: "The strings' natural harmonics as the model was qualified to sound them (public/shared/performers/physical-harmonics-calibration.json: one probe per instrument, variant, string and partial at mf, accepted where its partial holds; research/physical-neural-synthesis): a light contact at a node, and the bow it was probed with.",
      source: "ours (research/physical-neural-synthesis/harmonics-qualified.json)",
      settings: {
        partials: { value: [2, 3], unit: "partials", kind: "setting", reason: "the harmonics qualified: the first two above the fundamental, light contact keeping the full string; higher partials and a second stopping finger not yet qualified" },
        firmness: { value: 1e-3, unit: "1", kind: "setting", reason: "the light contact's firmness, Artifastring's Kf multiplier, as probed (its method: Kf=0.001)" },
        contact: { value: 0.07, unit: "share of the string", kind: "setting", reason: "the bow's contact, on the whole string, as probed" },
        force: { value: 0.15, unit: "N", kind: "setting", reason: "its force at mf's speed, as probed (scaled with its speed)" },
        speed: { value: 0.1, unit: "m/s", kind: "setting", reason: "its speed at mf, as probed (scaled with the dynamic's)" },
        velocityWithin: { value: 0.02, unit: "velocity", kind: "setting", reason: "a harmonic played further than this from the probe's velocity (mf) is said to lie outside what was measured" }
      }
    },
    "regions-selftest": {
      about: "regions.py's selftest: the edge search on windows known in advance, no engine -- Schelleng's shape (the least force growing faster than the most as the bow nears the bridge), a window wider than the grid each way, one none of the grid's forces is in, one narrower than a grid step.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md)",
      settings: {
        shape: { value: [0.02, 0.2], unit: "N times the contact", kind: "setting", reason: "Schelleng's shape: a window's least and most force each this over its contact" },
        contacts: { value: [0.03, 0.06, 0.12, 0.25], unit: "share of the string", kind: "setting", reason: "at these contacts" },
        wide: { value: [1e-4, 1e3], unit: "N", kind: "setting", reason: "a window wider than the grid each way" },
        beyond: { value: [40, 50], unit: "N", kind: "setting", reason: "a window above every grid force" },
        narrow: { value: [0.5, 0.55], unit: "N", kind: "setting", reason: "a window narrower than a grid step" },
        grid: { value: [0.1, 5], unit: "N", kind: "setting", reason: "the grid's least and most force, log-spaced over strings-regions' forces" }
      }
    },
    "strings-noise-profile": {
      about: "A bowed note's regime read from its sound alone (native/strings-model/noise_profile.py; STRINGS_ARTICULATION_FIT_PLAN 3a): the model's notes over a coarse grid of contact, force and speed, each rendered as its bridge force and its sound, the force's regime labelling the sound's features; two judgements, each a logistic regression of the standardized features fitted by Newton's method on its convex likelihood (deterministic, no draws), per instrument -- scratch (too heavy for its bow) and clean (Helmholtz motion) -- accepted only where it agrees with the bridge force at bow places it was not fitted on and where recorded players' clean notes read clean.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3a)",
      settings: {
        betas: { value: [0.02, 0.04, 0.07, 0.1, 0.14, 0.2], unit: "share of the vibrating string", kind: "setting", reason: "the coarse grid's bow-bridge distances, across the robot's 0.02 to 0.2 (schelleng-map betas)" },
        leastForce: { value: 0.05, unit: "N", kind: "setting", reason: "the grid's least force, the violin's (an instrument's times its force scale): under the robot's least (0.1 N)" },
        forceSpan: { value: 250, unit: "1", kind: "setting", reason: "the grid's forces up to this many times its least (12.5 N for the violin), past the players' most (2.5 N)" },
        forceCount: { value: 14, unit: "forces", kind: "setting", reason: "this many forces, log-spaced (physics: log-grid)" },
        forceDigits: { value: 4, unit: "decimal places", kind: "setting", reason: "each force written to a tenth of a millinewton, as the driver's actions carry it" },
        speeds: { value: [0.1, 0.25], unit: "m/s", kind: "setting", reason: "the grid's bow speeds" },
        highestStop: { value: 7, unit: "semitones", kind: "setting", reason: "each instrument's lowest string bowed open and its highest stopped a fifth up: both ends of its strings and a stopped string's shorter length" },
        note: { value: 0.8, unit: "s", kind: "setting", reason: "each grid note held this long, its features read over its last half" },
        gap: { value: 0.3, unit: "s", kind: "setting", reason: "then lifted and its string damped over this before the next" },
        seed: { value: 7, unit: "1", kind: "setting", reason: "the engine's seed for every grid render: its bridge force and its sound the same motion" },
        window: { value: 4, unit: "periods", kind: "setting", reason: "each window of a note's sound read for its features this many periods long (its jitter how far its period wanders from one window to the next)" },
        types: { value: [0, 1, 2, 3], unit: "engine instruments", kind: "setting", reason: "the grid's instruments where none are asked: the violin, viola, cello and contrabass (bowed-instruments.js BOWED's order), the violello apart" },
        jobs: { value: 3, unit: "processes", kind: "setting", reason: "renders at once: three, the trunk's share for a strings fit" },
        shownEvery: { value: 12, unit: "files", kind: "setting", reason: "its progress shown every this many files" },
        lead: { value: 0.05, unit: "s", kind: "setting", reason: "a grid file's first note this long in" },
        dampBefore: { value: 0.06, unit: "s", kind: "setting", reason: "each note's string given back its own losses this long before its stroke" },
        fingerBefore: { value: 0.04, unit: "s", kind: "setting", reason: "its finger set this long before its stroke" },
        ramp: { value: 0.01, unit: "s", kind: "setting", reason: "its finger, its bow's start and each change of its losses made over this, a finger's least: a finger set at once on a ringing string had clicked" },
        accelerating: { value: 0.05, unit: "s", kind: "setting", reason: "its bow's speed reached over this from rest" },
        lift: { value: 0.02, unit: "s", kind: "setting", reason: "its bow lifted over this at its note's end" },
        dampAfter: { value: 0.03, unit: "s", kind: "setting", reason: "its string damped this long after its bow's lift" },
        damped: { value: 30, unit: "times its losses", kind: "setting", reason: "its string's losses this many times its own between notes, so each note begins from silence" },
        leastLag: { value: 2, unit: "samples", kind: "setting", reason: "a period sought no shorter than this: the shortest a sampled sound holds (the Nyquist frequency's)" },
        lagSpan: { value: [0.97, 1.03], unit: "share of the period", kind: "setting", reason: "its period sought within 3% of f0's" },
        lagMargin: { value: 1, unit: "samples", kind: "setting", reason: "and to a sample past the span's top, its truncation" },
        leastPeriods: { value: 4, unit: "periods", kind: "setting", reason: "a window read only where it holds this many periods past its longest lag" },
        lagSteps: { value: 24, unit: "steps", kind: "setting", reason: "its fractional lag found by this many golden-section steps, deterministic: to 0.618^24, about 1e-5, of a sample's search" },
        repeats: { value: [2, 3], unit: "periods", kind: "setting", reason: "a motion repeating every two or three periods (raucous): how alike it is there, and its energy at its harmonics' halves and thirds" },
        flown: { value: [2, 3], unit: "harmonics", kind: "setting", reason: "a string flown to its octave or its twelfth (multiple slipping) sounds only its even harmonics or its thirds" },
        mostHarmonics: { value: 40, unit: "harmonics", kind: "setting", reason: "its harmonics read up to the fortieth" },
        nyquistShare: { value: 0.9, unit: "share of the Nyquist frequency", kind: "setting", reason: "and below this share of the highest frequency its rate holds" },
        harmonicBand: { value: 10, unit: "1, f0 over it", kind: "setting", reason: "each harmonic read within f0 over this either side of it" },
        noiseFrom: { value: 0.2, unit: "share of f0", kind: "setting", reason: "its noise and subharmonics read from this share of f0 up" },
        dividedHarmonics: { value: 12, unit: "harmonics", kind: "setting", reason: "how divided its harmonics are read on its first twelve" },
        fundamentalHarmonics: { value: 8, unit: "harmonics", kind: "setting", reason: "its fundamental's share read of its first eight harmonics' energy" },
        jitterWindows: { value: 3, unit: "windows", kind: "setting", reason: "its jitter read only where this many windows' periods were found" },
        jitterFloor: { value: 1e-4, unit: "share of the period", kind: "setting", reason: "its jitter's logarithm floored here: a period steadier than a ten-thousandth of itself reads as that" },
        ridge: { value: 1e-3, unit: "1", kind: "setting", reason: "each judgement's logistic regression penalized this much (ridge, its bias apart), so separable notes still give finite weights" },
        tolerance: { value: 1e-10, unit: "1", kind: "setting", reason: "Newton's method stopped where no weight moves more than this" },
        most: { value: 100, unit: "steps", kind: "setting", reason: "or after this many steps" },
        scaleFloor: { value: 1e-12, unit: "1", kind: "setting", reason: "a feature's spread floored here, so a feature that never changes standardizes to zero" },
        decision: { value: 0.5, unit: "share", kind: "setting", reason: "a judgement says yes at even odds or over" },
        banks: { value: ["iowa-mis-still", "vsco2-ce"], unit: "banks", kind: "setting", reason: "the recorded players' notes read where none are asked: the vendored banks with bowed sustains (Iowa MIS, VSCO 2 CE)" },
        attackUnmeasured: { value: 0.1, unit: "s", kind: "setting", reason: "a recording whose attack was not measured taken as attacking over this" },
        pastAttack: { value: 0.15, unit: "s", kind: "setting", reason: "a recording's steady part read from this long past its attack" },
        beforeRelease: { value: 0.1, unit: "s", kind: "setting", reason: "to this long before its release" },
        leastSteady: { value: 0.3, unit: "s", kind: "setting", reason: "a recording read only where its steady part is this long" },
        mostSteady: { value: 1, unit: "s", kind: "setting", reason: "and read for this long at most" }
      }
    },
    "noise-profile-selftest": {
      about: "noise_profile.py's selftest: the features of made sounds -- a sawtooth like a bowed string's, periodic, clean, its fundamental strong; the same with a subharmonic, repeating every second period; noise -- each told apart.",
      source: "ours (research/STRINGS_ARTICULATION_FIT_PLAN.md 3a)",
      settings: {
        rate: { value: 44100, unit: "Hz", kind: "setting", reason: "its sounds made at this rate, the banks'" },
        f0: { value: 196, unit: "Hz", kind: "setting", reason: "at the violin's G" },
        seconds: { value: 0.5, unit: "s", kind: "setting", reason: "each this long" },
        subharmonic: { value: 0.4, unit: "share of the sawtooth's peak", kind: "setting", reason: "the subharmonic a half-period motion adds this large" },
        seed: { value: 1, unit: "1", kind: "setting", reason: "its noise's seed" },
        periodic: { value: 0.98, unit: "1", kind: "setting", reason: "the sawtooth read periodic over this" },
        quietDb: { value: -30, unit: "dB", kind: "setting", reason: "its noise and subharmonics under this" },
        apartDb: { value: 20, unit: "dB", kind: "setting", reason: "the subharmonic's and the noise's own levels this much over the sawtooth's" },
        unperiodic: { value: 0.5, unit: "1", kind: "setting", reason: "noise read periodic under this" }
      }
    },
    "schelleng-regime": {
      about: "Which regime a steady bowed bridge force is in -- Helmholtz, multiple, raucous, slipping or silent -- by P. M. Galluzzo's waveform identification (2004, section 4.2.3, after Woodhouse; the algorithm the robot's own authors used): the bridge force scaled by 1/v_b, the rise a sticking string makes taken from it, averaged over beta T, and its levels' histogram read, each stair a peak, the spacing between peaks a flyback (native/strings-model/schelleng.py). Galluzzo gives the criterion, not its numbers: they are set where its selftest classifies synthetic bridge forces of each regime every one as made.",
      source: "galluzzo-2004",
      settings: {
        periodic: { value: 0.9, unit: "1", kind: "setting", reason: "a sound is heard as a note where its periodicity at the period its finger stops is at least this (the strings' check's 'heard')" },
        slip: { value: 0.5, unit: "1", kind: "setting", reason: "a fall in the force: a run of steps over this share of the period's steepest, dropping the force at least this share of its largest fall" },
        quiet: { value: 0.05, unit: "1", kind: "setting", reason: "silent under this share of the string's Helmholtz amplitude at that bow (no motion kept)" },
        stair: { value: 0.3, unit: "1", kind: "setting", reason: "its peaks' spacings within this of 2 Z / beta, and its stairs' share within this: Galluzzo's tolerance, set where the selftest classifies every synthetic regime as made" },
        peak: { value: 0.25, unit: "1", kind: "setting", reason: "a stair's peak stands over this share of the histogram's tallest bin: set where the selftest classifies every synthetic regime as made" },
        steady: { value: 0.05, unit: "1", kind: "setting", reason: "a robot measurement's steady part: its bow's speed within this of its plateau's, the later half of that" },
        robotRate: { value: 5e4, unit: "Hz", kind: "setting", reason: "the robot's recordings' rate (Lampis et al.'s whole_N.csv at 50 kHz)" },
        speedFloor: { value: 1e-6, unit: "m/s", kind: "setting", reason: "a bow's speed never under this as the force is read against it: a stopped bow divides nothing" },
        stairWidth: { value: 20, unit: "stairs", kind: "setting", reason: "a level on a stair within a step over this of a peak's" },
        leastBins: { value: 8, unit: "bins", kind: "setting", reason: "the staircase's histogram at least this many bins" },
        slippingSlips: { value: 2, unit: "slips", kind: "setting", reason: "a staircase flat for less than all but this many slips' share of a period (each beta T), less its tolerance, is no staircase: the string slipping" },
        lagSpan: { value: [0.9, 1.1], unit: "periods", kind: "setting", reason: "its periodicity read at lags across this span of the period its finger stops" },
        subharmonicBand: { value: [0.15, 0.85], unit: "shares of f0", kind: "setting", reason: "its subharmonic: the loudest component in this band under its fundamental" },
        noSubharmonicDb: { value: -120, unit: "dB", kind: "setting", reason: "its subharmonic where the band holds no component" },
        floor: { value: 1e-30, unit: "1", kind: "setting", reason: "a ratio's least before its logarithm: nothing, where it is none" },
        robotHeld: { value: 0.25, unit: "s", kind: "setting", reason: "a robot measurement taken only where its bow held its plateau's speed this long or longer" },
        robotTop: { value: 90, unit: "percentile", kind: "setting", reason: "its plateau's speed: this percentile of its bow's speeds" },
        robotBand: { value: [60, 140], unit: "Hz", kind: "setting", reason: "the robot's G2 strings' fundamental found in this band" }
      }
    },
    "schelleng-map": {
      about: "A string's Schelleng diagram mapped on the model as the robot's was on real strings (schelleng.py model): every force and bow-bridge distance of the robot's grid classified.",
      source: "lampis-2024",
      settings: {
        betas: { value: [0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.14, 0.17, 0.2], unit: "share of the string", kind: "setting", reason: "the robot's grid, Schoonderwaldt et al.'s before it: relative bow-bridge distances 0.02 to 0.2" },
        type: { value: 2, unit: "Artifastring instrument", kind: "setting", reason: "a model map where no instrument is asked: the cello, the robot's instrument (Lampis, Mayer & Chatziioannou 2024)" },
        string: { value: 1, unit: "string", kind: "setting", reason: "its G string, the robot's" },
        seconds: { value: 1, unit: "s", kind: "setting", reason: "each point held this long, read over its second half" },
        speeds: { value: [0.05, 0.1, 0.2], unit: "m/s", kind: "setting", reason: "a model map's bow speeds where none are asked: three a factor of two apart from 0.05 m/s, a speed the robot bowed (27 October 2026, claude-scratch/strings-neutral/robot-both.json)" },
        forces: { value: [0.1, 0.117, 0.138, 0.162, 0.19, 0.223, 0.262, 0.307, 0.361, 0.424, 0.497, 0.584, 0.685, 0.804, 0.944, 1.109, 1.302, 1.528, 1.794, 2.106, 2.472, 2.902, 3.407, 4], unit: "N", kind: "setting", reason: "the robot's forces, 0.1 to 4 N, 24 log-spaced, to the millinewton" }
      }
    },
    "schelleng-selftest": {
      about: "The classifier's selftest (native/strings-model/schelleng.py selftest): synthetic bridge forces of each regime, made as the physics makes them -- a sawtooth rising 2 Z v / beta a period with Schelleng's ripples and noise, two flybacks a period, flybacks only every few periods, a small sinusoid, noise -- across bow-bridge distances, both bow directions and seeds; each must be classified as made.",
      source: "galluzzo-2004",
      settings: {
        f0: { value: 98, unit: "Hz", kind: "setting", reason: "the synthetic string's fundamental: the robot's G2" },
        impedance: { kind: "setting", derive: { equation: "same", inputs: { value: "object:lampis-2024-g-strings:A.impedance" } }, unit: "kg/s", reason: "its impedance: the robot's A-type G string's measured" },
        beta: { value: 0.1, unit: "share of the string", kind: "setting", reason: "its bow-bridge distance where none is given" },
        speed: { value: 0.1, unit: "m/s", kind: "setting", reason: "its bow's speed where none is given" },
        seconds: { value: 1, unit: "s", kind: "setting", reason: "each signal this long" },
        ripple: { value: 0.08, unit: "share of the drop", kind: "setting", reason: "Schelleng's ripples, period beta T, this large" },
        noise: { value: 0.02, unit: "share of the drop", kind: "setting", reason: "its noise this large" },
        slippingSize: { value: 0.3, unit: "share of the drop", kind: "setting", reason: "a slipping string's sinusoid this large" },
        secondFlyback: { value: 0.45, unit: "share of a period", kind: "setting", reason: "a multiple flyback's second slip this far into each period" },
        raucousEvery: { value: [2, 5], unit: "periods", kind: "setting", reason: "a raucous string's flybacks every 2 to 4 periods, drawn (the upper end exclusive)" },
        betas: { value: [0.03, 0.06, 0.1, 0.2], unit: "share of the string", kind: "setting", reason: "the selftest's bow-bridge distances" },
        speeds: { value: [0.1, -0.1], unit: "m/s", kind: "setting", reason: "its bow's speeds, both directions" },
        seeds: { value: 3, unit: "seeds", kind: "setting", reason: "its seeds for each" }
      }
    },
    "attack-transient": {
      about: "How long a bowed note takes to reach Helmholtz motion, and what it does meanwhile (native/strings-model/attack_transient.py): each note found in the bridge force, then the regime read on a window of periods stepped a period at a time, judged against the limits listeners accept.",
      source: "guettler-askenfelt-1997",
      settings: {
        window: { value: 4, unit: "periods", kind: "setting", reason: "a window of periods each regime is read on" },
        onset: { value: 0.02, unit: "1", kind: "setting", reason: "a note begins where its envelope (a period's mean |x|) stands over this share of the file's greatest" },
        leastPeriods: { value: 10, unit: "periods", kind: "setting", reason: "a note found only where its envelope stands over its onset for more than this many periods" },
        shownRuns: { value: 12, unit: "runs", kind: "setting", reason: "each note's first this many runs of regimes printed" }
      }
    },
    "strings-probe": {
      about: "The strings engine's driver as the fits play it (native/strings-model/probe.py): its rate, and how a note heard is ended.",
      source: null,
      settings: {
        rate: { value: 44100, unit: "Hz", kind: "setting", reason: "the engine's rate: Artifastring's instrument sample rate (public/shared/float-wav.js's, where a file names none)" },
        lift: { value: 0.2, unit: "s", kind: "setting", reason: "the bow lifted over this after a note heard" },
        silent: { value: 11920928955078125e-23, unit: "1", kind: "setting", reason: "the string rung down by the driver to under a 24-bit file's smallest step at its own level: a render kept for the owner ends in silence, never cut" },
        wavHeader: { value: 44, unit: "bytes", kind: "setting", reason: "the driver's output a 32-bit float mono WAV after a 44-byte header (calibrate-strings-model.mjs readFloatWav)" },
        fullScale: { value: 4, unit: "1", kind: "setting", reason: "a driver's sample past this (or not finite) is one the model could not compute, silenced as a render's stem silences it (public/shared/float-wav.js floatWav reads it too): one such sample poisons a mix's every return after it" },
        reach: { value: 0.08, unit: "s", kind: "setting", reason: "the probe's note: its bow brought to its speed over this from silence (the actions calibrate-strings-model.mjs note writes)" },
        seconds: { value: 2, unit: "s", kind: "setting", reason: "a probe's note held this long where none is asked" },
        heard: { value: 0.4, unit: "s", kind: "setting", reason: "a note heard over this much of its steady part, from the middle of its second half" },
        bins: { value: 131072, unit: "bins", kind: "setting", reason: "its spectrum read at this many points" },
        search: { value: 1.5, unit: "semitones", kind: "setting", reason: "its fundamental found within this of the pitch it is near" },
        bottom: { value: 40, unit: "Hz", kind: "setting", reason: "its band from this" },
        top: { value: 2e4, unit: "Hz", kind: "setting", reason: "to this, its harmonics counted to here" },
        harmonicHz: { value: 6, unit: "Hz", kind: "setting", reason: "a component counts as a harmonic within this of one" },
        harmonicShare: { value: 6e-3, unit: "share of its frequency", kind: "setting", reason: "or within this share of it, the wider" },
        fractions: { value: [0.2, 0.25, 0.3333333333333333, 0.4, 0.5, 0.6, 0.6666666666666666, 0.75, 0.8], unit: "shares of f0", kind: "setting", reason: "a motion repeating every few periods looked for at these fractions of its fundamental" },
        fractionHz: { value: 3, unit: "Hz", kind: "setting", reason: "each fraction read within this" },
        highs: { value: [8e3, 18e3], unit: "Hz", kind: "setting", reason: "its highs: this band against the whole" },
        shownDb: { value: 60, unit: "dB", kind: "setting", reason: "a fraction printed where it stands within this of the loudest" },
        floor: { value: 1e-30, unit: "1", kind: "setting", reason: "a ratio's least before its logarithm: nothing, where it is none" }
      }
    },
    "strings-seat": {
      about: "A bowed string's seat in a section (public/bots/lib/modules/section-seat.js): its draws' streams, how far ahead it looks, and the tolerances it compares times and pitches within.",
      settings: {
        arrivalMost: { value: 0.1, unit: "s", kind: "setting", reason: "a seat's sound reaching the listener later than its section's nearest by under this is its seating's (seating.js), a later one refused as no seat's: about 34 m of air, past any stage's depth" },
        saltBow: { value: 2826, unit: "1", kind: "setting", reason: "its bow's draws one stream of its seat's (0xb0a): a name, any other distinct from its other streams' as good" },
        saltTake: { value: 31310, unit: "1", kind: "setting", reason: "its take's draw another stream (0x7a4e): a name" },
        saltBite: { value: 45438, unit: "1", kind: "setting", reason: "each note's bite another stream (0xb17e): a name" },
        saltPace: { value: 2019, unit: "1", kind: "setting", reason: "its tremolo's pace another stream (0x7e3): a name" },
        takes: { value: 1024, unit: "takes", kind: "setting", reason: "a seat's first take of a pitch drawn among this many, far more than any bank records of one pitch, each change of bow the next (audio.js reads it modulo the bank's own)" },
        least: { value: 1e-6, unit: "as divided", kind: "setting", reason: "a phrase's share left or its length in s never taken under this as a divisor: at its end, or of no length, divided by this, not by zero" },
        ahead: { value: 8, unit: "ticks", kind: "setting", reason: "a line told rubato by its conductor (part-rubato.js) looked into this many ticks ahead, as far as its arch is taken to move a note earlier: ours, the told arch bounded nowhere" },
        same: { value: 1e-9, unit: "s", kind: "setting", reason: "two times the same instant within this: a float's rounding" },
        quickWithin: { value: 1e-6, unit: "s", kind: "setting", reason: "a note quicker than its beat by more than this a quick one, slurred in a line's groups: a float's rounding of a written length" },
        endWithin: { value: 1e-3, unit: "s", kind: "setting", reason: "a note reaching the piece's end within this held open to the cutoff: a millisecond, under any written length" },
        leastSlide: { value: 1e-3, unit: "s", kind: "setting", reason: "a glissando's slide never shorter than this, a divisor: a millisecond" },
        samePitch: { value: 0.25, unit: "semitones", kind: "setting", reason: "a pitch within this of the one held the same, repeated (never slurred to): a quarter of a semitone, wider than any player's own few cents or a microtonal tuning's retuning of one note" },
        onGrid: { value: 0.125, unit: "beats", kind: "setting", reason: "a note within this of a position of its metre's grid on it, weighed as it (else the grid's least): an eighth of a beat" }
      }
    },
    "strings-section": {
      about: "A bowed string section's seats, sizes and draws (public/shared/performers/string-section.js): the bounds it checks a size within, its seeds' span, a player's own stream, and its tolerance.",
      settings: {
        mostSeats: { value: 64, unit: "players a section", kind: "setting", reason: "a section's size refused past this many players: past any orchestra's (the full one's 16 first violins four times over), a typing slip's guard" },
        seedSpan: { value: 2147483648, unit: "seeds", kind: "setting", reason: "a pool's seed a whole number under this (2^31), a non-negative 32-bit integer as every seeded source takes it" },
        saltPlayer: { value: 20983, unit: "1", kind: "setting", reason: "a player's own inflection one stream of its seat's (0x51f7): a name, any other distinct from its other streams' as good" },
        same: { value: 1e-9, unit: "share", kind: "setting", reason: "a share of desks rounded up but for a float's rounding within this" },
        seatsPerBot: { value: 8, unit: "seats", kind: "setting", reason: "the most seats one bot plays: the kit's Surge XT patches voice eight notes at once (mass_clodbot MASS.lines, Surge's polylimit in the kit's patches)" }
      }
    }
  }
};

// registry/method/levels.json
var levels_default = {
  schema: "musebots.registry-methods/1",
  about: "How loud each part is rendered (registry/README.md): every modelled instrument's audio set from its measured sound power, so that the parts stand to one another as the instruments do.",
  methods: {
    "stem-level": {
      about: "A modelled part's audio level from its instrument's sound power (public/shared/performers/sound-power.js stemLevelDb; sound-power.json, TU Berlin's anechoic database, Weinzierl et al. 2017): its held notes' RMS, dBFS, as it enters its player's channel, its sound power level in dB re 1 pW plus the reference.",
      source: "ours",
      settings: {
        reference: { value: -130, unit: "dB", kind: "setting", reason: "the loudest instrument measured, the tuba, at its ff (112.3 dB at its median pitch) 18 dB under full scale, so that a section of brass at ff stays under each player's limiter (audio.js BOT_LIMITER, past its channel's +3.7 dB) and its fff high in its compass reaches it; the bowed strings' violin at ff then 5 dB under where its model stood before (8 October 2026: -37.54 dBFS, its stem gain matched to its recordings)" }
      }
    },
    "velocity-law": {
      about: "How a velocity, 0 to 1, is heard as an amplitude within a family's dynamic range (audio.js familyVelocityGain, planned-dynamics.js velocityAtDb): its amplitude a power of a line from the range's floor to full scale.",
      settings: {
        exponent: { value: 2, unit: "1", kind: "setting", reason: "a velocity's amplitude rising as the square of a line through the family's range where its family names no other (Dannenberg 2006's square law, which matches commercial synthesizers' velocity curves within a chosen range in dB)" }
      }
    }
  }
};

// registry/method/personality.json
var personality_default = {
  schema: "musebots.registry-methods/1",
  about: "A player's personality (public/shared/performers/personality.js; docs/PLAYER_PERSONALITY.md): how far it pushes its instrument's idiom and what lines it prefers, each lever a draw from its seed within the range here, or given (a spec's, an LLM's later). Every range holds the line planner's own value (line.js LINE, wind-line.js WIND_LINE, flute_clodbot.js FLUTE), so that a personality is a place among the planner's settings, never outside them.",
  methods: {
    personality: {
      about: "The levers, each a share 0 to 1 drawn from the player's seed (its ensemble's seed, its identity and its instrument), read across its range here; daring is the one that reaches toward the instrument's limits (its facts, instrument-facts.js), tone the one from a clean tone to its extremes -- its techniques, its rhythmic grammars and its ranges in its tone's parameters -- the rest its style.",
      source: "ours",
      settings: {
        dynamicSteps: { value: 2, unit: "marks", kind: "setting", reason: "how many dynamic marks the most daring player goes past the dynamics comfortable in a register (wind-line.js WIND_LINE lowMost f and highLeast p): to fff low and ppp high, the scale's ends (dynamics.js)" },
        shortest: { range: [0.08, 0.12], unit: "s", kind: "setting", reason: "its quickest note, the most daring's the planner's own (line.js LINE.shortest: a wind's double tonguing near it), the least daring's a single-tongued note's at some 8 notes a second (Bertsch & Hoole 2014, players-ranges.mjs repeatRate)" },
        phraseRange: { range: [10, 30], unit: "semitones", kind: "setting", reason: "a phrase's widest range, from a tenth to two octaves and a half as it dares, about the planner's 14 (line.js LINE.phraseRange)" },
        density: { range: [0, 1], unit: "share", kind: "setting", reason: `its density: from its motif's main notes alone, 0, to every held note divided at its quickest, 1 -- the line planner's whole span (line.js planLine: a phrase sparser than the motif it was made at simplified, a denser one divided), its motif made at its density among equals (flute_clodbot.js FLUTE, 0.35; bowedstring_clodbot.js BOWEDSTRING) and that among them (the owner, 5 November 2026: "changing the personality parameters doesn't seem to be able to result in any real extremes"; CLAUDE.md, range before personality)` },
        loudness: { range: [0.05, 0.95], unit: "share", kind: "setting", reason: "its loudness, from a line kept to ppp's edge to one at fff's, about the flute's 0.5" },
        fioriture: { range: [0, 1], unit: "share", kind: "setting", reason: "its fioriture as a soloist, from none to a run on every long note that has room for one, about the flute's 0.35" },
        leap: { range: [0, 0.7], unit: "share", kind: "setting", reason: "a leap's chance in its motif, from a motif all steps to one mostly leaps, about the planner's 0.18 (line.js LINE.leap)" },
        slurs: { range: [1, 16], unit: "notes", kind: "setting", reason: "its longest slur of quick notes, from every one tongued, 1, to sixteen under one slur, about the planner's 4 (LINE.slurMost)" },
        slurSegments: { range: [0, 1], unit: "share", kind: "setting", reason: "the share of its phrase's segments slurred whole, long notes and all (line.js LINE.slurSegments), on the slurs' draw: from long notes always separate -- the planner's own, none -- to a legato player's every segment one slur, tongued where each begins" },
        motifFewest: { range: [2, 4], unit: "notes", kind: "setting", reason: "its motif's fewest notes, with motifMost on the one draw motifLength: the planner's 3 to 6 (LINE.motifNotes) among them" },
        motifMost: { range: [4, 12], unit: "notes", kind: "setting", reason: "its motif's most notes, on motifLength's draw with motifFewest, from a motif of a few notes to a long one" },
        runs: { range: [2, 12], unit: "steps", kind: "setting", reason: "a run's most steps one way outside an ornament, from a line that turns at every third note to one that runs an octave and more, about the planner's 4 (LINE.runMost)" },
        rests: { range: [0.1, 1], unit: "share", kind: "setting", reason: "the silence after its cadence, a share of the bar's last group, about the planner's 0.5 (LINE.restShare)" },
        commas: { range: [0, 0.6], unit: "share", kind: "setting", reason: "the comma after its idea, a share of its last note, from none to most of it, about the planner's 0.2 (LINE.commaShare)" },
        landing: { range: [0.4, 1], unit: "share", kind: "setting", reason: "how high above its floor a cadence may land, a share of its span, about the planner's 0.75 (LINE.landing's upper end)" },
        grammarLeast: { value: 0.15, unit: "share", kind: "setting", reason: "the least weight a motif's grammar is given, against the most preferred's 1, so that every grammar stays open to it (line.js chooseMotif)" },
        quoting: { range: [0, 1], unit: "share", kind: "setting", reason: "how often, where it was given motifs, its motif is one of them rather than its own: from never to always" },
        techniques: { range: [0, 1], unit: "share of its phrases", kind: "setting", reason: "its tone: how often a phrase of its takes an extended technique its instrument sounds (techniques.js: a hum, a growl, a flutter, a harmonic, a multiphonic; a mute as often), from the cleanest tone's none -- the planner's own, a soloist having played none -- to the most extreme's every phrase, each still the instrument's own" },
        toneWidth: { range: [0.1, 1], unit: "share of a parameter's span", kind: "setting", reason: "its tone: how wide its range in each of its tone's parameters (personality.js TONE_RANGES) -- its vibrato's width, a technique's depth, its bow's pressure and contact -- from the cleanest tone's tenth of the span about the ordinary to the most extreme's whole span, at its tone times a share each range draws its own (personality.js drawPersonality: of two extreme characters, one may range over every vibrato and the other keep to one)" },
        figureWidth: { range: [0.15, 0.6], unit: "share of a dimension", kind: "setting", reason: "its taste in figures (figure-space.js drawTaste): how wide its range in each dimension of the figure space, from a cautious player's, near the one figure it favours, to a daring one's, over much of the space, at its daring times a share each range draws its own (ours)" },
        vibratoMost: { value: 3, unit: "times its players' measured width", kind: "setting", reason: `its tone: the widest vibrato a character's range reaches (the owner, 3 November 2026: "some performer characters might allow huge vibrato ranges; others not"), three times its players' measured width (vibrato.js): on the violin's 40 c, 120 c peak to peak, as wide as professional lyric singers' mean extent of +-71 c (Prame 1997, doi:10.1121/1.419735); its share 1/3 its players' own, the ordinary a clean tone keeps about` },
        harmonicPartials: { range: [2, 3], unit: "partial", kind: "setting", reason: "its tone: the natural harmonic a phrase of a bowed string takes, its partial by its technique's depth -- the octave at a shallow one, the twelfth at a deep one: the string touched at its half or its third, the two natural harmonics a string player most plays and the surest to speak" },
        tuplets: { range: [-0.5, 0.5], unit: "share of the way", kind: "setting", reason: "its lean on the piece's rhythm on the rhythm engine (opening-time.js rhythm, line-rhythm.js, where its player is switched to it): how far it draws the piece's share of divisions other than the meter space's own two and three (meter-space.js METER_SPACE.layers: a five, seven or thirteen in the time of one, wherever the span holds it at its quickest note) toward 1, or toward 0 below the middle -- from halfway to none to halfway to as much as a three, the piece's own at its middle: a weight on the piece's, never its own in its place (the owner, 6 November 2026: a player's personality never holds the piece's surface rhythm)" },
        syncopation: { range: [-0.5, 0.5], unit: "share of the way", kind: "setting", reason: `its lean on the piece's rhythm on the engine: how far it draws the piece's share of spans syncopated (euclidean.js syncopate, opening-time.js rhythm) toward wherever one fits, or toward never below the middle, the piece's own at its middle; a syncopation's length, meter, repeats and the syncopation within it are the piece's alone (the owner, 6 November 2026: "make sure the player-personality doesn't have some specific surface-texture or rhythm items (e.g., re: specific syncopations) confused with personality items")` },
        rhythmicGrammars: { range: [-0.5, 0.5], unit: "share of the way", kind: "setting", reason: "its tone: how far its motifs' rhythmic grammars' shares are drawn toward 1 -- a rhythm on a repeated tone, unequal durations, a rest inside it (line.js LINE.grammars) -- and the others' toward 0, from the cleanest tone's -1/2 (the rhythmic ones halfway to 0, the others halfway to 1) to the most extreme's 1/2: the planner's own, none, at the middle" },
        themes: { range: [0, 1], unit: "share of its phrases", kind: "setting", reason: "its lean toward restating its themes: how often a phrase of a section that states its theme restates it, from its first note (themes.js), rather than developing it -- from a line that states its theme only where its form brings it, 0, to one restating it in every phrase its form lets it, 1, about the planner's own 0.5 (line.js LINE.restate); a section that develops its theme restates it a share of that (registry/method/melody.json themes developing)" }
      }
    }
  }
};

// registry/method/rhythm.json
var rhythm_default = {
  schema: "musebots.registry-methods/1",
  about: "The rhythm engine (docs/RHYTHM_TO_FORM.md, the owner's specification, 4 November 2026; public/shared/euclidean.js): its rhythmic layers, an isochronous chain, each M events of the one below per event of its own, from the shortest a listener hears as rhythm up to the piece.",
  methods: {
    "rhythm-layers": {
      about: "Where the layers stand in time: the beat's band, in which the layer X(0) lies, and the shortest period any layer has (euclidean.js RHYTHM, layerChain, divisions).",
      source: "ours",
      settings: {
        slowestBeat: { value: 60, unit: "BPM", kind: "setting", reason: "the owner, 4 November 2026: X(0) is 'an isochronous continuing series of events ... in the tempo range of about 60–180 BPM (1–3 Hz)'; 'The tempo is based approximately on human heart rates'" },
        fastestBeat: { value: 180, unit: "BPM", kind: "setting", reason: "the owner's band's fastest, as slowestBeat" },
        shortestPeriod: { value: 0.05, unit: "s", kind: "setting", reason: "the owner, 4 November 2026: 'Layer X(n) is the minimum layer if its period is less than 50ms (or its tempo is less than 20Hz). This minimum results from the phenomenal threshold at which tempo becomes pitch': read as the shortest period a layer may have, a layer under it being pitch, not rhythm" }
      }
    }
  }
};

// registry/method/texture.json
var texture_default = {
  schema: "musebots.registry-methods/1",
  about: `The texture space (public/shared/texture-space.js; docs/TEXTURE_SPACE.md): the named textures as locations among dimensions that name no instrument and no technique, so that every texture is an extension of the others and every point between them is one. The owner, 5 November 2026: "we need a layer of abstraction apart from instrument-specific textures but that can lead to them"; "to the extent possible, we want to avoid binding underlying musebot algorithms to specific instrumental techniques until they get close to the instrument". Each location's ranges the strings' textures' own, now said once; what a location does not read set so that a blend through it stays a texture.`,
  methods: {
    "texture-space": {
      about: "The texture space (public/shared/texture-space.js; docs/TEXTURE_SPACE.md): every texture a point among sixteen dimensions that name no instrument and no technique, each a share 0 to 1, each named texture a location of ranges [low, high] within them (the methods texture-<name> below). A pool draws its point within its location's ranges -- or a blend's, every range moved alike -- from its seed, each dimension evenly but those skewed here. Its two axes Huron's (1989): onset synchronization and semblant motion; the rest what the strings' ten textures had each done apart, said once.",
      source: "ours",
      settings: {
        pulseSkew: { value: 2, unit: "power of its draw", kind: "setting", reason: "a pool's pulse is its draw squared across its range, so most pools near its low end: a chord held more often than struck again, a cloud freer than pulsed (string-section.js, as the strings' chords and pizzicati were drawn)" },
        semblanceSkew: { value: 0.5, unit: "power of its draw", kind: "setting", reason: `a pool's semblance is its draw's square root across its range, so most pools near its top: a counterpoint's lower parts imitating its top often (the owner, 3 October 2026: canons and fugues "more important"), as its imitation was drawn` },
        glideSkew: { value: 2, unit: "power of its draw", kind: "setting", reason: `a pool's glide is its draw squared across its range, so most pools near its least: a note holding its pitch before it slides more often than sliding from its attack (the owner, 2 October 2026: bots "attack directly into glissandos in ways that I think should occur less often for their instruments")` },
        figureTones: { range: [1, 5], unit: "tones", kind: "setting", reason: "a compound melody's walk over one to five of the harmony's tones, its compound a share across them: a trill's two, an Alberti bass's three, an arpeggio's more", was: "the strings' specification's figuration.tones, [1,5] tones" },
        divisions: { range: [0, 1], unit: "share of its playable divisions", kind: "setting", reason: `a part whose time is its own (its entry delayed, its pace drifting) is written on a lattice of its own: the beat divided from two to as many times as its player plays notes in it, the parts' shares spread evenly over this range from a drawn offset (no fixed set of tuplets: the owner, 2 October 2026, "the real limits are possible playing ... speed of the shortest notes")`, was: "the strings' specification's micropolyphony.divisions, [0,1] share of its playable divisions: each part's grid a share of this, spread over its parts", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] }
      }
    },
    "texture-line": {
      about: "One line, every part in unison or at the octave: monophony, Huron's synchrony and semblance both whole (its parts' rhythms and pitches planned once for all: line.js planLine).",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "one tone at a time, no figure" },
        synchrony: { value: 1, unit: "share", kind: "setting", reason: "every part sounds each onset: monophony at the top of Huron's synchrony", sources: ["huron-1989-textures"] },
        semblance: { value: 1, unit: "share", kind: "setting", reason: "every part moves as the others: monophony at the end of Huron's semblant motion", sources: ["huron-1989-textures"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "one voice, no voices to rule between" },
        binding: { value: 1, unit: "share", kind: "setting", reason: "one voice: no part to bind it to" },
        between: { value: 0, unit: "share", kind: "setting", reason: "not read: a line is planned against the line pools above it by its own planner (section-voices.js sectionLines)" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "not read: a line's fioriture are its player's (personality.js fioriture: line.js planLine)" },
        pulse: { range: [0.35, 0.95], unit: "share", kind: "setting", reason: "not read by a line, which its planner rhythms; a melody's, as a counterpoint's parts move, where a blend draws the process family" },
        chance: { value: 0, unit: "share", kind: "setting", reason: "its onsets planned, none by chance" },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "its notes sustained" },
        sustain: { value: 0.97, unit: "share", kind: "setting", reason: "each note sounds this share of its written length (section-voices.js ARTICULATION): its notes joined, never run together" },
        glide: { value: 0, unit: "share", kind: "setting", reason: "no note slides" },
        motion: { value: 0.1, unit: "share", kind: "setting", reason: "not read by a line, which its planner moves; a melody's steps and leaps where a blend draws the process family" },
        continuum: { value: 0, unit: "share", kind: "setting", reason: "on the harmony's lattice" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "every part entering together (a line shared by sections enters as its conductor's entries say: entries.js)" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "no part follows another's material in its own rhythm: a line's parts are one" },
        places: { value: 0, unit: "share", kind: "setting", reason: "one place: every part the line" },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn" }
      }
    },
    "texture-counterpoint": {
      about: "Voices of their own: polyphony, low in Huron's synchrony and semblance (conducting/counterpoint.js counterLine under drawnRules).",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "one tone at a time in each voice" },
        synchrony: { value: 0, unit: "share", kind: "setting", reason: "each voice its own rhythm, none taking the top's: Bach's fugues and sinfonias low in Huron's onset synchronization; toward 1, the share of its voices on the top's rhythm, first species's note against note", sources: ["huron-1989-textures"] },
        semblance: { range: [0, 1], unit: "share", kind: "setting", reason: "the share of its lower voices imitating its top, a canon among them, most pools often (texture-space semblanceSkew); the voices free, non-semblant, where none does", sources: ["huron-1989-textures"], was: "the strings' specification's counterpoint.imitation, [0,1] share: how often its lower parts imitate its top", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        rules: { range: [0.4, 1], unit: "share", kind: "setting", reason: "its rule sets' rigour: how strictly its drawn blend binds (counterpoint.js drawnRules)", sources: ["huron-2001", "ebcioglu-1990"], was: "the strings' specification's counterpoint.rigor, [0.4,1] share: its rule sets' rigour", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        binding: { value: 1, unit: "share", kind: "setting", reason: "res facta: every voice planned against every voice above it (counterLine against every line planned), each part bound to every other, as Tinctoris's res facta is in Bent's reading", sources: ["bent-1983"] },
        between: { range: [0, 1], unit: "share", kind: "setting", reason: `its parts bound to the pools above it as to one another, a score written whole, or each pool's idiom its own (the owner, 5 November 2026: "the types of textures Charles Ives and Alfred Schnittke employed where several different idioms co-occurred"); read where its blends draw the process, the planned counterpoint planning its pool alone` },
        ornament: { value: 0, unit: "share", kind: "setting", reason: `res facta sung as it is written, its notes none diminished; a performer's diminutions over it, its counterpoint unchanged beneath them, a point toward a share of them (the owner, 5 November 2026: "scores follow counterpoint rules but performance ornaments sometimes deviate")`, sources: ["brown-1976"] },
        pulse: { range: [0.35, 0.95], unit: "share", kind: "setting", reason: "its voices' pulses, spread over this range from a drawn offset so they move at their own rates, one holding as another moves (section-voices.js pulsed)", was: "the strings' specification's counterpoint.pulse, [0.35,0.95] 0 held, 1 every subdivision: its parts' pulses spread over this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        chance: { value: 0, unit: "share", kind: "setting", reason: "its rhythms on the meter's positions" },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "its notes sustained" },
        sustain: { value: 0.97, unit: "share", kind: "setting", reason: "as a line's (ARTICULATION)" },
        glide: { value: 0, unit: "share", kind: "setting", reason: "no note slides" },
        motion: { value: 0.1, unit: "share", kind: "setting", reason: "not read by counterpoint, which its rules move; a melody's steps where a blend draws the process family" },
        continuum: { value: 0, unit: "share", kind: "setting", reason: "on the harmony's lattice" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time (its imitation's converging tempo canon its own choice, its prolation)" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "not read by counterpoint, whose imitators enter a felt group apart" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "not read by counterpoint, whose voices are planned" },
        places: { value: 1, unit: "share", kind: "setting", reason: "each voice its own place in the band, the top highest" },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn" }
      }
    },
    "texture-figuration": {
      about: "A compound melody: every part one walk over the harmony's tones, each in its own place (figuration.js, compound-melody.js).",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { range: [0, 1], unit: "share", kind: "setting", reason: "its walk over any of the space's figure tones (texture-space figureTones, one to five: a trill's two, an Alberti bass's three, an arpeggio's more), this share across them", was: "the strings' specification's figuration.tones, [1,5] tones: its walk over so many of the harmony's tones", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        synchrony: { value: 1, unit: "share", kind: "setting", reason: "every part the same walk at once" },
        semblance: { value: 1, unit: "share", kind: "setting", reason: "every part the same figure, each in its own place: parallel, semblant motion", sources: ["huron-1989-textures"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "its voices led by the least motion, not by a counterpoint's rules" },
        binding: { value: 1, unit: "share", kind: "setting", reason: "not read: one figure's walk, planned" },
        between: { value: 0, unit: "share", kind: "setting", reason: "not read: planned by its figuration" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "not read: planned by its figuration" },
        pulse: { range: [0.25, 0.8], unit: "share", kind: "setting", reason: "its rate: this share of as many notes a second as its players' quickest allow", was: "the strings' specification's figuration.rate, [0.25,0.8] share of its players' quickest: its rate", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        chance: { value: 0, unit: "share", kind: "setting", reason: "on the meter's positions" },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "its notes sustained" },
        sustain: { value: 0.97, unit: "share", kind: "setting", reason: "as a line's" },
        glide: { value: 0, unit: "share", kind: "setting", reason: "no note slides" },
        motion: { value: 0.1, unit: "share", kind: "setting", reason: "not read by a figuration, which its walk moves; a melody's steps where a blend draws the process family" },
        continuum: { value: 0, unit: "share", kind: "setting", reason: "on the harmony's lattice" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "every part together" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "not read by a figuration, whose parts are planned" },
        places: { value: 1, unit: "share", kind: "setting", reason: "each part its own place in the band" },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn" }
      }
    },
    "texture-chord": {
      about: "A tone a part, struck together: homophony, high in Huron's synchrony and low in his semblance.",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "no figure" },
        synchrony: { value: 1, unit: "share", kind: "setting", reason: "every part strikes the pool's onsets: homophony high in Huron's onset synchronization (hymns)", sources: ["huron-1989-textures"] },
        semblance: { value: 0, unit: "share", kind: "setting", reason: "each part its own tone, voice-led apart: hymns some third semblant in Huron's measure, as voice-leading by the nearest tone leaves them", sources: ["huron-1989-textures"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "its parts led by the nearest tone, not a counterpoint's rules" },
        binding: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose (a point toward a counterpoint), each part bound to its pool's first part alone: improvised, as a singer over the book is bound to the tenor (Tinctoris's cantare super librum as Bent reads him)", sources: ["bent-1983"] },
        between: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose, its pool's idiom its own, unbound to the pools sounding above it" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "its notes as its process makes them, none diminished" },
        pulse: { range: [0, 1], unit: "share", kind: "setting", reason: "0 each tone held until the harmony moves it; 1 struck again on every subdivision; between, the meter's levels in turn; most pools near its low end (texture-space pulseSkew)", was: "the strings' specification's chord.pulse, [0,1] 0 held, 1 every subdivision: a chord's pulse drawn within this, most near its low end", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        chance: { value: 0, unit: "share", kind: "setting", reason: "on the meter's positions" },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "its tones sustained" },
        sustain: { range: [0.35, 1], unit: "share", kind: "setting", reason: "a struck chord sounding this share of the time to its next stroke", was: "the strings' specification's chord.gate, [0.35,1] share of the time to its next stroke: a pulsed chord sounding this much", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        glide: { value: 0, unit: "share", kind: "setting", reason: "no tone slides" },
        motion: { value: 0.02, unit: "share", kind: "setting", reason: "a step at a time: struck again, each part moves to the chord's next tone within its reach, never striking one pitch over and over (the owner, 5 October 2026, of Op. 3.30)" },
        continuum: { value: 0, unit: "share", kind: "setting", reason: "the harmony's tones" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "every part together" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "every part on the harmony's onsets: none following in a rhythm of its own" },
        places: { value: 1, unit: "share", kind: "setting", reason: "each part its own place in the band, from the top" },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn, at least an octave where its parts sound the harmony's tones" }
      }
    },
    "texture-cluster": {
      about: "The parts spread evenly over a band narrower than the lattice, held: a chord off the lattice, packed.",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "no figure" },
        synchrony: { value: 1, unit: "share", kind: "setting", reason: "every part together", sources: ["huron-1989-textures"] },
        semblance: { value: 0, unit: "share", kind: "setting", reason: "each part its own pitch", sources: ["huron-1989-textures"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "no rules between its parts" },
        binding: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose (a point toward a counterpoint), each part bound to its pool's first part alone: improvised, as a singer over the book is bound to the tenor (Tinctoris's cantare super librum as Bent reads him)", sources: ["bent-1983"] },
        between: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose, its pool's idiom its own, unbound to the pools sounding above it" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "its notes as its process makes them, none diminished" },
        pulse: { value: 0, unit: "share", kind: "setting", reason: "held to the phrase's end" },
        chance: { value: 0, unit: "share", kind: "setting", reason: "no onset by chance" },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "sustained" },
        sustain: { value: 1, unit: "share", kind: "setting", reason: "held through" },
        glide: { value: 0, unit: "share", kind: "setting", reason: "no slide" },
        motion: { value: 0, unit: "share", kind: "setting", reason: "held where it is: a mass's stasis (Atmospheres)", sources: ["douglas-noble-mcadams-2016"] },
        continuum: { value: 1, unit: "share", kind: "setting", reason: "each pitch where it falls, between the keys too" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "every part together" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "every part on the pool's onsets: none following in a rhythm of its own" },
        places: { value: 1, unit: "share", kind: "setting", reason: "each part its own place, evenly over the band" },
        packing: { value: 1, unit: "share", kind: "setting", reason: "packed: its band a part to a fraction of a semitone, as the section's specification draws a cluster's (string-section.js pool.cluster)" }
      }
    },
    "texture-micropolyphony": {
      about: "Ligeti's canon of one cantus, each part entering in turn, a little slower than the one before: a counterpoint whose voices are one line, heard as a mass.",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "no figure" },
        synchrony: { value: 0, unit: "share", kind: "setting", reason: "each part its own time: low in Huron's onset synchronization", sources: ["huron-1989-textures"] },
        semblance: { value: 1, unit: "share", kind: "setting", reason: "every part the same cantus, read in its own time (Ligeti's canons under rules as strict as Palestrina's)", sources: ["levy-2013"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "its cantus a walk by steps, no voices ruled between" },
        binding: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose (a point toward a counterpoint), each part bound to its pool's first part alone: improvised, as a singer over the book is bound to the tenor (Tinctoris's cantare super librum as Bent reads him)", sources: ["bent-1983"] },
        between: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose, its pool's idiom its own, unbound to the pools sounding above it" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "its notes as its process makes them, none diminished" },
        pulse: { value: 0.5, unit: "share", kind: "setting", reason: "a note a group of the meter, the cantus's" },
        chance: { value: 0, unit: "share", kind: "setting", reason: "no onset by chance" },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "sustained" },
        sustain: { value: 0.98, unit: "share", kind: "setting", reason: "each note sounding nearly its whole step" },
        glide: { value: 0, unit: "share", kind: "setting", reason: "no slide" },
        motion: { value: 0.02, unit: "share", kind: "setting", reason: "a step at a time: the cantus a walk on the ladder, a moving note never repeated" },
        continuum: { value: 0, unit: "share", kind: "setting", reason: "on the harmony's ladder" },
        drift: { range: [0.03, 0.09], unit: "share", kind: "setting", reason: "each part this share slower than the one before, the canon thickening", was: "the strings' specification's micropolyphony.drift, [0.03,0.09] share slower a part: each part this much slower than the last, the canon thickening", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        delay: { value: 1, unit: "share", kind: "setting", reason: "the parts' entries spread over the cantus's first group, every part entered within it" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "its parts in canon, each the cantus in its own time: none following the band's" },
        places: { value: 0, unit: "share", kind: "setting", reason: "every part over the band whole, a voice leading that fills its space", sources: ["bernard-1994"] },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn" }
      }
    },
    "texture-heterophony": {
      about: "One melody played by every part at once, each in its own rhythm: Huron's fourth quadrant, semblant but not synchronous (the Chinese, Siamese and Korean works his figure measures).",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "no figure" },
        synchrony: { value: 0, unit: "share", kind: "setting", reason: "fitted: no part on the melody's rhythm alone: every part strikes where the melody moves and in a rhythm of its own besides", fit: { method: "MUSEBOTS_METER_SEED=2026-11-05 node scripts/fit-texture-location.mjs heterophony", data: "Huron 1989, Figure 1: his heterophonic works (Chinese, Siamese, Korean) some 0.3 to 0.45 in onset synchronization and 0.5 to 0.75 in semblant motion; a chamber section's every part playing it, over four meters and four seeds, measured as he measured (texture-space.js textureMeasures): 0.41 (0.29 to 0.50) and 0.65 (0.53 to 0.76), the grid's nearest its middle", date: "2026-11-05" }, sources: ["huron-1989-textures"] },
        semblance: { value: 1, unit: "share", kind: "setting", reason: "every part the one melody, moving where it moves (its anticipations Huron's semblant motion the less)", sources: ["huron-1989-textures"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "one melody, no voices ruled between" },
        binding: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose (a point toward a counterpoint), each part bound to its pool's first part alone: improvised, as a singer over the book is bound to the tenor (Tinctoris's cantare super librum as Bent reads him)", sources: ["bent-1983"] },
        between: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose, its pool's idiom its own, unbound to the pools sounding above it" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "its notes as its process makes them, none diminished" },
        pulse: { value: 0.25, unit: "share", kind: "setting", reason: "fitted: the melody's onsets and each part's own drawn a quarter of the time to the meter's strongest positions", fit: { method: "MUSEBOTS_METER_SEED=2026-11-05 node scripts/fit-texture-location.mjs heterophony", data: "Huron 1989, Figure 1: his heterophonic works (Chinese, Siamese, Korean) some 0.3 to 0.45 in onset synchronization and 0.5 to 0.75 in semblant motion; a chamber section's every part playing it, over four meters and four seeds, measured as he measured (texture-space.js textureMeasures): 0.41 (0.29 to 0.50) and 0.65 (0.53 to 0.76), the grid's nearest its middle", date: "2026-11-05" }, sources: ["huron-1989-textures"] },
        chance: { value: 1, unit: "share", kind: "setting", reason: "fitted: every onset a Poisson arrival, so each part's own fall apart from the melody's and the others'", fit: { method: "MUSEBOTS_METER_SEED=2026-11-05 node scripts/fit-texture-location.mjs heterophony", data: "Huron 1989, Figure 1: his heterophonic works (Chinese, Siamese, Korean) some 0.3 to 0.45 in onset synchronization and 0.5 to 0.75 in semblant motion; a chamber section's every part playing it, over four meters and four seeds, measured as he measured (texture-space.js textureMeasures): 0.41 (0.29 to 0.50) and 0.65 (0.53 to 0.76), the grid's nearest its middle", date: "2026-11-05" }, sources: ["huron-1989-textures"] },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "sustained" },
        sustain: { value: 0.97, unit: "share", kind: "setting", reason: "as a line's" },
        glide: { range: [0, 0.2], unit: "share", kind: "setting", reason: "a part sliding into its note, a heterophony's inflection, little" },
        motion: { value: 0.02, unit: "share", kind: "setting", reason: "its melody a walk by steps" },
        continuum: { value: 0, unit: "share", kind: "setting", reason: "on the harmony's ladder" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "every part at the melody's moment, no canon" },
        anticipation: { value: 0.2, unit: "share", kind: "setting", reason: "fitted: a fifth of each part's own onsets between the melody's moves taking its next note early", fit: { method: "MUSEBOTS_METER_SEED=2026-11-05 node scripts/fit-texture-location.mjs heterophony", data: "Huron 1989, Figure 1: his heterophonic works (Chinese, Siamese, Korean) some 0.3 to 0.45 in onset synchronization and 0.5 to 0.75 in semblant motion; a chamber section's every part playing it, over four meters and four seeds, measured as he measured (texture-space.js textureMeasures): 0.41 (0.29 to 0.50) and 0.65 (0.53 to 0.76), the grid's nearest its middle", date: "2026-11-05" }, sources: ["huron-1989-textures"] },
        places: { value: 0, unit: "share", kind: "setting", reason: "every part in the melody's register" },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn" }
      }
    },
    "texture-glides": {
      about: "Each part sliding from pitch to pitch, its onsets by chance: Xenakis's glissandi (Pithoprakta).",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "no figure" },
        synchrony: { value: 0, unit: "share", kind: "setting", reason: "each part its own onsets", sources: ["huron-1989-textures"] },
        semblance: { value: 0, unit: "share", kind: "setting", reason: "each part its own path", sources: ["huron-1989-textures"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "no rules: a mass's mean state in their place", sources: ["xenakis-1955"] },
        binding: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose (a point toward a counterpoint), each part bound to its pool's first part alone: improvised, as a singer over the book is bound to the tenor (Tinctoris's cantare super librum as Bent reads him)", sources: ["bent-1983"] },
        between: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose, its pool's idiom its own, unbound to the pools sounding above it" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "its notes as its process makes them, none diminished" },
        pulse: { value: 0, unit: "share", kind: "setting", reason: "free of the meter" },
        chance: { value: 1, unit: "share", kind: "setting", reason: "its onsets Poisson arrivals, the intervals between them by the exponential law", sources: ["xenakis-1992", "gibson-2022"] },
        impulse: { value: 0, unit: "share", kind: "setting", reason: "sustained" },
        sustain: { range: [0.7, 1], unit: "share", kind: "setting", reason: "each slide sounding to its next, a rest now and then as a cloud thins" },
        glide: { range: [0.2, 1], unit: "share", kind: "setting", reason: "the share of each note spent sliding, the rest holding its first pitch; most pools near its least (texture-space glideSkew)", was: "the strings' specification's glissandi.hold, [0,0.8] share of its note: how much holds its first pitch before it slides, a pool's own, most nearer the top (the owner, 2 October 2026: fewer attacks straight into glissandi)", searched: [{ where: "web search", query: "measured portamento glissando slide speed violin performance semitones per second study", date: "2026-10-29", found: "none in semitones a second: slides measured as durations (Leech-Wilkinson), as Hz/s gradients on cello recordings (arXiv 2604.22037, 2026), detected on violin (Yang's AVA); leads in SOURCES_TO_FETCH.md" }] },
        motion: { range: [0.1, 0.3], unit: "share", kind: "setting", reason: "its steps' spread a share of its region per mean interval, its speeds normal about none (Pithoprakta's Gauss's law: the strings' 2 to 4 semitones a second over a band of some 16 at an onset a second)", sources: ["xenakis-1992"], was: "the strings' specification's glissandi.spread, [2,4] semitones a second: the speeds' spread, Xenakis's normal law (Pithoprakta), its size ours", searched: [{ where: "web search", query: "Pithoprakta glissandi speeds Gaussian distribution standard deviation Formalized Music Xenakis semitones per second", date: "2026-10-29", found: "Xenakis's own account (Formalized Music, ch. 1): bars 52-60's 1,148 speeds over 58 values by Gauss's law; no spread in semitones a second nor a glissando's length given in what was found" }] },
        continuum: { value: 1, unit: "share", kind: "setting", reason: "anywhere between the keys" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "its entries by chance" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "a glide's part following another's material takes its moves as they come" },
        places: { value: 0, unit: "share", kind: "setting", reason: "every part over the band whole" },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn" }
      }
    },
    "texture-points": {
      about: "A cloud of impulses, each part's by chance anywhere in the band: Xenakis's pizzicato clouds, as any instrument plays a point.",
      source: "ours, its sources by key on each setting",
      settings: {
        compound: { value: 0, unit: "share", kind: "setting", reason: "no figure" },
        synchrony: { value: 0, unit: "share", kind: "setting", reason: "each part its own onsets", sources: ["huron-1989-textures"] },
        semblance: { value: 0, unit: "share", kind: "setting", reason: "each part its own pitches", sources: ["huron-1989-textures"] },
        rules: { value: 0, unit: "share", kind: "setting", reason: "no rules", sources: ["xenakis-1955"] },
        binding: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose (a point toward a counterpoint), each part bound to its pool's first part alone: improvised, as a singer over the book is bound to the tenor (Tinctoris's cantare super librum as Bent reads him)", sources: ["bent-1983"] },
        between: { value: 0, unit: "share", kind: "setting", reason: "where its rules choose, its pool's idiom its own, unbound to the pools sounding above it" },
        ornament: { value: 0, unit: "share", kind: "setting", reason: "its notes as its process makes them, none diminished" },
        pulse: { range: [0, 1], unit: "share", kind: "setting", reason: "how often an onset is drawn to the meter's next position, most clouds free (texture-space pulseSkew)", was: "the strings' specification's pizzicati.pulse, [0,1] 0 free, 1 on the meter's positions: a cloud's pulse drawn within this", searched: [{ where: "web search", query: "corpus orchestral texture annotation classical symphonies first movements", date: "2026-10-29", found: "Le, Giraud, Levé & Maccarini 2022 (DLfM, doi:10.1145/3543882.3543884, checked against Crossref): 7,900 bar-by-bar annotations of 24 first movements of Haydn, Mozart and Beethoven, each part's layer melodic, rhythmic or harmonic (its abstract read); no rates of a section's formations, divisi or these textures, which a count over its annotations could begin to give for that style" }] },
        chance: { value: 1, unit: "share", kind: "setting", reason: "Poisson arrivals (Achorripsis's law)", sources: ["xenakis-1992", "gibson-2022"] },
        impulse: { value: 1, unit: "share", kind: "setting", reason: "every note an impulse: each player's shortest sound, a bowed string's plucked", sources: ["schaeffer-1966"] },
        sustain: { value: 0, unit: "share", kind: "setting", reason: "none held" },
        glide: { value: 0, unit: "share", kind: "setting", reason: "no slide" },
        motion: { value: 1, unit: "share", kind: "setting", reason: "each pitch anywhere in its region, the last no guide" },
        continuum: { value: 1, unit: "share", kind: "setting", reason: "anywhere between the keys" },
        drift: { value: 0, unit: "share", kind: "setting", reason: "one time" },
        delay: { value: 0, unit: "share", kind: "setting", reason: "its entries by chance" },
        anticipation: { value: 0, unit: "share", kind: "setting", reason: "a point's part following another's material takes its moves as they come" },
        places: { value: 0, unit: "share", kind: "setting", reason: "every part over the band whole" },
        packing: { value: 0, unit: "share", kind: "setting", reason: "its band as drawn" }
      }
    }
  }
};

// registry/method/melody.json
var melody_default = {
  schema: "musebots.registry-methods/1",
  about: "The melody's rules, the streaming that judges where a line splits into voices, and the figure space (public/shared/performers/melody-rules.js, streams.js, figure-space.js; docs/FIGURE_SPACE.md): one set of rules for every planner of a line, and every figure a point among dimensions, its named figures locations within them.",
  methods: {
    melody: {
      about: `The melody's rules, said once (public/shared/performers/melody-rules.js; docs/FIGURE_SPACE.md): what a line of pool steps may do, for every planner of one -- a motif's shape, a phrase's contour, a run, a figure, a cadence (line.js, figure-space.js). The owner, 5 November 2026: "where multiple scattered rules have been written that actually accomplish the same result, refactoring those rules into a smaller number will mean that fixing erroneous cases will lead to better generative behaviour more quickly." A leap's least and greatest size and a run's most moves are the line's (line.js LINE, a player's own: personality.js).`,
      source: "ours",
      settings: {
        recoverMost: { value: 2, unit: "pool steps", kind: "setting", reason: "a leap's answer: a step back the other way, of one or two of its voice's pitches (a second, or in a pool of close pitches a third) -- the recovery the lines' motifs, contours and runs had each asked (line.js recovered, shapeCells, simplifyMotif, contour, runContour)" },
        alikeMost: { value: 2, unit: "notes", kind: "setting", reason: "a note struck at most twice running, and so never three alike (the line's rule since its motifs were first made: line.js), unless a line asks for none struck again at once" }
      }
    },
    streaming: {
      about: `Auditory streaming (public/shared/performers/streams.js; docs/FIGURE_SPACE.md): where a figure's notes hold together as one line and where they split into voices, a compound melody. The owner, 5 November 2026: "the 'musically correct' way to conceptualize two alternating notes far apart from each other (really, this intuition applies the more the further the notes are from each other and the faster they move/alternate) is as a compound melody"; "there is a threshold past which ornamentation transitions to compound melody". The boundaries it judges between are measured of listeners: registry/perception/streaming.json. A room's reverberation, which lengthens what sounds of each note, is not heard here (research/MODELING_GAPS.md).`,
      source: "van-noorden-1975",
      settings: {
        threshold: { value: 1, unit: "share from the fission boundary to the coherence boundary", kind: "setting", reason: "where a note is judged apart, a voice of its own, as a share from the fission boundary to the temporal coherence boundary (registry/perception/streaming.json): at the coherence boundary, as a listener in general tries to hear the tones as one line (van Noorden 1975, section 4.6), and between the boundaries hears them so but for attending to one string alone. There too Miller and Heise's trill threshold stands at its gap (perception trill-threshold). A legato whole tone so stays a trill up to about 13 notes a second, a semitone past 25", sources: ["miller-heise-1950", "van-noorden-1975"] }
      }
    },
    "figure-space": {
      about: `The figure space (public/shared/performers/figure-space.js; docs/FIGURE_SPACE.md): every figure that divides a held note, a cadence's approach or a fioritura -- a run, an arc, an arpeggio, a trill, a turn, a mordent, a climb, a zigzag, a ribattuta, a compound melody, and every figure between or beyond them -- a point among dimensions, each a share 0 to 1, each named figure a location of ranges [low, high] within them (the methods figure-<name> below). A figure's path is made from its point, and its notes are the walk nearest that path that keeps the melody's rules (melody-rules.js), a trill only where its point asks for one. The owner, 5 November 2026: "(1) generalization of logic without losing cases ... (2) extensibility to arbitrary and invented ornaments beyond the specific figures listed".`,
      source: "ours",
      settings: {
        third: { value: 2, unit: "pool steps", kind: "setting", reason: "a third: two of its voice's pitches (a skip, the stride of an arpeggio and the width of a wide circling pair)" },
        beam: { value: 48, unit: "settings", kind: "setting", reason: "how many of its walk's settings are kept at each note, those with the same future kept once (as runContour's beam, line.js)" },
        jitter: { value: 0.01, unit: "pool steps", kind: "setting", reason: "a walk's ties broken at random by at most this, far less than a step from its path: the figure is its point's, the draw only choosing among walks as near" },
        skew: { value: 2, unit: "power of its draw", kind: "setting", reason: 'a skewed dimension\'s share drawn squared across its range (`skewed`): most figures circle little, turn as they circle rather than trill, strike few notes again and keep to one voice -- a trill, a turn, a ribattuta or a compound melody now and then, every figure still drawn (ours; the owner, 5 November 2026: figures "that simply alternate between two notes" were to stop)' },
        skewed: { value: ["circling", "trilling", "repeat", "voices"], unit: "dimensions", kind: "setting", reason: "the dimensions whose draws are skewed toward their least (`skew`): circling, its pairs kept to one side (a trill), notes struck again, and voices" },
        pair: { value: 2, unit: "moves", kind: "setting", reason: "a circling pair and each step of an excursion: out and back, two moves" },
        voiceNotes: { value: 2, unit: "notes", kind: "setting", reason: "the fewest notes each voice of a compound figure has: two, so that it goes on as a line (one alone is a note heard apart, not a voice)" }
      }
    },
    "figure-arc": {
      about: "An arc: out from the held note the other way, then past the next note and back to it, by step (a fioritura, as Chopin's run past the note it lands on: fioritura.js).",
      source: "ours",
      settings: {
        lead: { range: [0, 1], unit: "share", kind: "setting", reason: "its turn below and its arc above in any share" },
        circling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        trilling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        order: { value: 0, unit: "share", kind: "setting", reason: "none" },
        progress: { value: 0, unit: "share", kind: "setting", reason: "none" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { range: [0, 1], unit: "share", kind: "setting", reason: "not read: it does not circle" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-arpeggio": {
      about: "An arpeggio: its path by thirds.",
      source: "ours",
      settings: {
        lead: { range: [0, 1], unit: "share", kind: "setting", reason: "its turn and arc in any share" },
        circling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        trilling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        order: { value: 0, unit: "share", kind: "setting", reason: "none" },
        progress: { value: 0, unit: "share", kind: "setting", reason: "none" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { range: [0, 1], unit: "share", kind: "setting", reason: "not read: it does not circle" },
        stride: { value: 1, unit: "share", kind: "setting", reason: "every move a third" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-trill": {
      about: "A trill: its spare notes alternating with a neighbour, toward the end (a cadential trill) or throughout.",
      source: "ours",
      settings: {
        lead: { value: 0, unit: "share", kind: "setting", reason: "none" },
        circling: { value: 1, unit: "share", kind: "setting", reason: "every spare note circling" },
        trilling: { value: 1, unit: "share", kind: "setting", reason: "every pair to the side of the pair before" },
        order: { range: [0, 1], unit: "share", kind: "setting", reason: "from the upper note or the lower" },
        progress: { value: 0, unit: "share", kind: "setting", reason: "none" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { range: [0.5, 1], unit: "share", kind: "setting", reason: "toward its landing" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-turn": {
      about: "A turn: its spare notes circling the held note on either side in turn, near its start.",
      source: "ours",
      settings: {
        lead: { value: 0, unit: "share", kind: "setting", reason: "none" },
        circling: { range: [0.5, 1], unit: "share", kind: "setting", reason: "most spare notes circling" },
        trilling: { value: 0, unit: "share", kind: "setting", reason: "each pair the other side" },
        order: { range: [0, 1], unit: "share", kind: "setting", reason: "above first or below" },
        progress: { value: 0, unit: "share", kind: "setting", reason: "none" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { range: [0, 0.3], unit: "share", kind: "setting", reason: "near its start" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-mordent": {
      about: "A mordent: a quick alternation with a neighbour at its start, the rest a walk.",
      source: "ours",
      settings: {
        lead: { value: 0, unit: "share", kind: "setting", reason: "none" },
        circling: { range: [0.1, 0.4], unit: "share", kind: "setting", reason: "a few spare notes circling" },
        trilling: { value: 1, unit: "share", kind: "setting", reason: "its pairs, where it has more than one, to one side: a short trill (a Pralltriller)" },
        order: { range: [0, 1], unit: "share", kind: "setting", reason: "upper or lower" },
        progress: { value: 0, unit: "share", kind: "setting", reason: "none" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { value: 0, unit: "share", kind: "setting", reason: "at its start" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-climb": {
      about: "A climb: up two steps and back one as it goes, a pair at a time (a run turning back as it moves on).",
      source: "ours",
      settings: {
        lead: { value: 0, unit: "share", kind: "setting", reason: "none" },
        circling: { value: 1, unit: "share", kind: "setting", reason: "every spare note circling" },
        trilling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        order: { value: 0, unit: "share", kind: "setting", reason: "none" },
        progress: { value: 1, unit: "share", kind: "setting", reason: "each pair moving on a step" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { range: [0, 1], unit: "share", kind: "setting", reason: "anywhere" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-zigzag": {
      about: "A zigzag: a wider climb, each pair a third wide -- up three steps and back two as it goes.",
      source: "ours",
      settings: {
        lead: { value: 0, unit: "share", kind: "setting", reason: "none" },
        circling: { value: 1, unit: "share", kind: "setting", reason: "every spare note circling" },
        trilling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        order: { value: 0, unit: "share", kind: "setting", reason: "none" },
        progress: { value: 1, unit: "share", kind: "setting", reason: "each pair moving on" },
        width: { value: 1, unit: "share", kind: "setting", reason: "each pair a third wide" },
        placement: { range: [0, 1], unit: "share", kind: "setting", reason: "anywhere" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-ribattuta": {
      about: "A ribattuta: its notes struck again, each twice at most.",
      source: "ours",
      settings: {
        lead: { range: [0, 1], unit: "share", kind: "setting", reason: "any" },
        circling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        trilling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        order: { value: 0, unit: "share", kind: "setting", reason: "none" },
        progress: { value: 0, unit: "share", kind: "setting", reason: "none" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { range: [0, 1], unit: "share", kind: "setting", reason: "not read: it does not circle" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 1, unit: "share", kind: "setting", reason: "every spare note struck again" },
        voices: { value: 0, unit: "share", kind: "setting", reason: "none" }
      }
    },
    "figure-compound": {
      about: "A compound melody: the figure walking among voices far enough apart, at its rate, to be heard as voices (streams.js) -- a broken chord, a saxophone's chord played as a very fast arpeggio -- each voice moving evenly from the held note's chord to the next note's, the held note's voice the one that leaves them least to move.",
      source: "ours",
      settings: {
        lead: { value: 0, unit: "share", kind: "setting", reason: "none" },
        circling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        trilling: { value: 0, unit: "share", kind: "setting", reason: "none" },
        order: { range: [0, 1], unit: "share", kind: "setting", reason: "up first or down" },
        progress: { value: 0, unit: "share", kind: "setting", reason: "none" },
        width: { value: 0, unit: "share", kind: "setting", reason: "none" },
        placement: { range: [0, 1], unit: "share", kind: "setting", reason: "not read" },
        stride: { value: 0, unit: "share", kind: "setting", reason: "none" },
        repeat: { value: 0, unit: "share", kind: "setting", reason: "none" },
        voices: { value: 1, unit: "share", kind: "setting", reason: "as many voices as stream apart" }
      }
    },
    idiom: {
      about: "An instrument's idiom told its player as relations, each a region of its items' joint space (public/shared/performers/idiom.js; research/IDIOM_AS_RELATIONS.md): a move's cost on its instrument by its direction, register and time, the notes it plays together, the hand's states; a line's search charged them, a player's daring carrying it toward the idiom's edge.",
      source: "ours",
      settings: {
        weight: { value: [4, 0.5], unit: "a move's cost a unit of -log of the share of its time it leaves (none for a move needing no time, 0.69 at half its time, without bound toward all of it), against the line's other costs (a pool step from where it is wanted 1, a rule broken 60), at a daring of 0 and of 1", kind: "setting", reason: "ours: a cautious player's line keeping well within its instrument's idiom, a daring one's near its edge; beyond its edge a rule broken, whatever its daring" },
        beyond: { value: 60, unit: "a move's cost in a figure's walk where it needs more time than it has", kind: "setting", reason: "ours: as a rule the line breaks (line.js RULE), far dearer than any way from the figure's path, so that a figure makes a move its instrument cannot only where no walk keeps its rules without it" },
        share: { value: 0.25, unit: "share of the way toward the band's idioms, a round", kind: "setting", reason: `ours: how far a round of the piece's negotiation moves its weights toward what its instruments' idioms favour, so that the rounds settle (a contraction) and never reach the idioms alone: the seed's draw stays the prior (research/IDIOM_AS_RELATIONS.md, "Back through the player, over the piece")` }
      }
    },
    themes: {
      about: "A line's themes over its piece's form (public/shared/performers/themes.js; bots/lib/modules/line-themes.js; line.js): which theme a phrase states and how it varies it, from its section's formal role in the conductor's form (plex_clodbot, mh_PlexBOT's archetypes: stochastic-config.js plex) and its player's lean toward restating (personality.js `themes`). The owner, 6 November 2026: \"the soloist musebot's compositions tend not to be catchy and memorable because, even when the personality might want them, they lack most methods for recognizably repeating themes, I believe because the metrical structure keeps shifting throughout instead of taking shape according to a form.\" A theme keeps its rhythm and shape in any meter (line.js refitMotif), and what its notes divide into wherever it comes.",
      source: "ours",
      settings: {
        treatments: { value: { establish: "state", "complex-frame": "state", depart: "develop", contrast: "contrast", develop: "develop", climax: "develop", relax: "state", stabilize: "contrast", return: "return", "complex-return": "return" }, unit: "how a section in each formal role treats a line's theme", kind: "setting", reason: "ours, after the sections of a classical form (W. E. Caplin 1998, Classical Form): a section that states its theme (the opening, and the calm after a climax) begins with it as it was first stated, from its first note; one that develops it (a departure, a development, a climax) sequences and inverts it; one that contrasts (a contrasting middle, and the frame's stable middle) brings a theme of its own, as unlike the first as its slate holds (line.js chooseMotif); one that returns brings back the first, from its first note. A role it does not name develops." },
        developments: { value: ["sequence", "inversion"], unit: "the variations a phrase that develops its theme draws among, each as likely", kind: "setting", reason: "ours: the line's own (line.js LINE.variations): its idea sequenced, two steps higher, or inverted" },
        developing: { value: 0.25, unit: "share of its player's lean toward restating, in a section that develops its theme", kind: "setting", reason: "ours: a developing section restates its theme a quarter as often as a stating one, so that the theme is heard to return where the form returns" }
      }
    }
  }
};

// registry/perception/streaming.json
var streaming_default = {
  schema: "musebots.registry-perception/1",
  about: "Auditory streaming: when successive tones hold together as one line, when they split into streams (a compound melody's voices), and when they merge into one tone. Read by the streaming judgement (public/shared/performers/streams.js) and the figures it judges (figure-space.js).",
  measures: {
    "fission-boundary": { value: 1, unit: "semitones", kind: "literature", source: "van-noorden-1975", where: "section 2.4, Fig. 2.9; section 4.6", conditions: "two pure tones alternating (ABAB), 40 ms each, B at 1 kHz, 35 dB SL, by headphones; two observers, each told to hear the B tones alone; tone repetition times T of 0.1 to 0.4 s", note: "the least interval at which a listener attending to one string can hear the tones apart, two streams: below it they always hold together. Practically independent of T in that range; wider at shorter T (peripheral effects make selecting one string impossible) and at longer T (the string's tones too far apart in time)" },
    "temporal-coherence-boundary": { value: [[0, 0], [0.115, 3], [0.185, 6], [0.23, 7.5], [0.28, 10], [0.33, 13.5], [0.385, 19], [0.415, 24]], unit: "[s, semitones]", kind: "literature", source: "van-noorden-1975", where: "section 5.5, Fig. 5.11 (its circled means, read to about a semitone and 10 ms); the point at the origin his extrapolation", conditions: "random sequences of pure tones, each interval drawn about a mean, tone durations D of 40 to 400 ms, none overlapping, by headphones; observers trying to hear all the tones as one line", note: "the interval past which a tone can no longer be heard with its neighbours as one line, against the gap from the end of the tone before it to the start of the tone after it (2T - D): one curve for every tone duration, so a legato or overlapping tone's boundary is the narrower; at a gap of none, none (the tones before and after sound with it). Probably so for partly overlapping tones too, which his equipment could not make. Between this and the fission boundary a tone is heard either way, as the listener attends" },
    "trill-threshold": { range: [2, 3], unit: "semitones", kind: "literature", source: "miller-heise-1950", where: "as van Noorden 1975 reports it, sections 1.3 and 2.5", conditions: "two pure tones alternating ten times a second (T = 0.1 s), each filling the time to the next (a gap of 0.1 s)", note: "the interval past which a trill is heard as two tones, two streams. At its gap, where Fig. 5.11's temporal coherence boundary stands at 2.6 semitones; van Noorden found it the mean of his two boundaries at the same T with tones of 40 ms (a gap of 0.16 s)" },
    "fusion-repetition-time": { value: 0.08, unit: "s", kind: "literature", source: "van-noorden-1975", where: "section 7.3; section 5.1", conditions: "pure-tone sequences of small intervals (a semitone), random or ascending", note: "below about this tone repetition time a sequence of small intervals merges into one tone, modulated in frequency and amplitude: one line, its tones no longer each heard. So, he expects, the fastest runs (Bach's cello suites: 81 ms) and trills" }
  }
};

// registry/perception/polyphony.json
var polyphony_default = {
  schema: "musebots.registry-perception/1",
  about: `Polyphony heard: how many voices a listener follows at once. Read by counterpoint (public/shared/conducting/counterpoint.js), which keeps a line's rules against the voices heard with it. A limit of hearing, not of composing: the owner, 5 November 2026: "listeners' difficulty in DISTINGUISHING three voices does not invalidate COMPOSING many more voices, since sometimes compositions use excesses beyond distinction to generate nuanced differences in texture".`,
  measures: {
    "voices-followed": { value: 3, unit: "voices", kind: "literature", source: "huron-1989-denumerability", where: "the abstract and its experiments, as summarized (the full text not saved: research/SOURCES_TO_FETCH.md)", conditions: "musicians judging how many voices sound, and when one enters, in polyphony of homogeneous timbre (Bach)", note: "the voices a listener counts and follows: errors from about one in ten with three voices to about one in two with four. Past it a texture's voices are heard as the texture, not each -- which a composition may want (micropolyphony: counterpoint.js)" }
  }
};

// registry/perception/roughness.json
var roughness_default = {
  schema: "musebots.registry-perception/1",
  about: "Roughness: how two simultaneous partials beat against each other as heard, by their frequencies. Read by the spectral harmonic system's roughness (public/shared/harmonic-systems/spectral.js) and the harmony's spectral consonance (public/shared/estimation/spectral-consonance.js), each weighting a pair of partials by their amplitudes as it chooses. A measure of sensory roughness, not of musical quality.",
  measures: {
    "dissonance-curve": { value: { b1: 3.5, b2: 5.75, dStar: 0.24, s1: 0.0207, s2: 18.96 }, unit: "b1, b2: per unit of s times hertz; dStar: the curve's peak, in units of s times hertz; s1: per hertz; s2: hertz", kind: "literature", source: "sethares-1993", sources: ["plomp-levelt-1965"], where: "the dissonance curve d(x) = exp(-b1 s x) - exp(-b2 s x), s = dStar / (s1 f + s2), for two partials x hertz apart above the lower at f hertz, as harmonic-systems/spectral.js had its parameters from the paper (the full text not saved: research/SOURCES_TO_FETCH.md); spectral-consonance.js had s1 and s2 rounded (0.021, 19)", conditions: "fitted to Plomp and Levelt's (1965) judgements of the consonance of two simultaneous pure tones, by their frequency difference, at several mean frequencies", note: "the roughness of two pure tones: none in unison, rising to its most at about a quarter of a critical band apart and falling away past it, the band widening with frequency. Summed over the partials of two complex tones it is Sethares's extension to timbres, and over instruments' spectra ours" }
  }
};

// registry/perception/timing.json
var timing_default = {
  schema: "musebots.registry-perception/1",
  about: "Time as heard: the shortest and longest spans that listeners hear as beats and measures. Read by casting's measures of a part's rhythm (public/shared/casting/measure.js).",
  measures: {
    "beat-period-least": { value: 0.1, unit: "s", kind: "literature", source: "london-2012", where: "ch. 2, as casting/measure.js cites it (the book not saved: research/SOURCES_TO_FETCH.md)", conditions: "London's summary of studies of listeners hearing and tapping to isochronous series", note: "the shortest inter-onset interval heard as a series of separate events that can carry a beat, rather than a flutter or a buzz" }
  }
};

// registry/perception/bands.json
var bands_default = {
  schema: "musebots.registry-perception/1",
  about: "The ear's critical bands: where they lie, how a sound in one masks sounds in the others, and how loudness grows within one. Read by the palette's masking model (public/shared/palette-fit.js, a perceptual coder's threshold applied between a mix's parts) and the audio analyzer's descriptors (public/shared/estimation/audio-descriptors.js).",
  measures: {
    "critical-band-edges": { value: [100, 200, 300, 400, 510, 630, 770, 920, 1080, 1270, 1480, 1720, 2e3, 2320, 2700, 3150, 3700, 4400, 5300, 6400, 7700, 9500, 12e3, 15500], unit: "Hz, the upper edge of each band from the lowest (which begins at 0)", kind: "literature", source: "johnston-1988", sources: ["zwicker-1961"], where: "Table II, after Scharf (1970) and Zwicker (1961), as palette-fit.js and audio-descriptors.js each had them (Zsa's bark~ reports the same); the paper not saved: research/SOURCES_TO_FETCH.md", conditions: "the critical bands as Zwicker (1961) summarized them from several measures (the threshold of complex sounds, masking, loudness summation), for listeners with normal hearing", note: "the 24 bands, a Bark each, within which the ear integrates a sound's power: about 100 Hz wide below 500 Hz, about a fifth of the frequency above" },
    "spreading-function": { value: { a: 15.81, b: 7.5, c: 0.474, d: 17.5 }, unit: "dB against the masker's band, dz in Bark from masker to maskee: a + b (dz + c) - d sqrt(1 + (dz + c)^2)", kind: "literature", source: "schroeder-atal-hall-1979", where: "the spreading function's coefficients in the form perceptual coders reproduce it (Johnston 1988), not checked against the 1979 paper (research/SOURCES_TO_FETCH.md)", conditions: "fitted to masking patterns: how far a masker's excitation reaches into the bands above and below it, the upward spread the gentler", note: "how much of a sound's power in one band masks the bands around it" },
    "masking-offset": { value: { toneDb: 14.5, noiseDb: 5.5, pureToneFlatnessDb: -60 }, unit: "dB: a tone masks noise from 14.5 + z dB under it (z the band, in Bark), a noise masks a tone from 5.5 dB under it; a masker's tonality is its spectral flatness against a pure tone's", kind: "literature", source: "johnston-1988", where: "the equations for the spectral flatness measure, the tonality alpha and the offset O_i, as palette-fit.js had them (the paper not saved: research/SOURCES_TO_FETCH.md)", conditions: "a perceptual coder's threshold, from the masking literature of tone-masking-noise and noise-masking-tone", note: "how far under a masker's spread power the threshold it makes lies, by how tonal the masker is" },
    "loudness-exponent": { value: 0.23, unit: "the power of excitation that specific loudness grows as", kind: "literature", source: "zwicker-fastl-2007", where: "ch. 8 (Loudness), specific loudness against excitation, as palette-fit.js had it (the book not saved: research/SOURCES_TO_FETCH.md)", conditions: "loudness judged by listeners with normal hearing, above threshold, in a band", note: "a band's loudness grows as its power to about 0.23: what a masker's threshold hides is taken off it" }
  }
};

// registry/equations.js
var aperture = (a, b, t) => {
  let x = 1, y = b / a;
  for (let i = 0; i < 64 && Math.abs(x - y) > 1e-15 * x; i++) [x, y] = [(x + y) / 2, Math.sqrt(x * y)];
  return 1 / (1 / (2 * a * x) + t / (Math.PI * a * b));
};
var median = (values) => {
  const v = [...values].sort((a, b) => a - b), m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
var EQUATION = Object.freeze({
  "midi-hz": ({ midi, a4 }) => a4 * 2 ** ((midi - 69) / 12),
  "hz-midi": ({ hz, a4 }) => 69 + 12 * Math.log2(hz / a4),
  "pounds-newtons": ({ pounds, poundForce }) => pounds * poundForce,
  "string-density": ({ T, L, f0 }) => T / (2 * L * f0) ** 2,
  "string-impedance": ({ T, mu }) => Math.sqrt(T * mu),
  "inharmonicity-at-open": ({ takes, stopped }) => median(takes) / 2 ** (2 * stopped / 12),
  "stiffness-from-inharmonicity": ({ B, T, L }) => B * T * L * L / Math.PI ** 2,
  "cylinder-diameter": ({ mu, rho }) => Math.sqrt(4 * mu / (Math.PI * rho)),
  "young-from-stiffness": ({ EI, d }) => 64 * EI / (Math.PI * d ** 4),
  "mean": ({ values }) => values.reduce((a, b) => a + b, 0) / values.length,
  "same": ({ value: value3 }) => value3,
  "periods-in": ({ seconds, hz }) => seconds * hz,
  "seconds-for": ({ periods, hz, least: least2 }) => Math.max(least2, periods / hz),
  "scale-ratio": ({ a, a0 }) => a / a0,
  "least-force-scale": ({ scale, Z, c0, c1, c2 }) => scale * Z[0] ** 2 / ((c0 ** 2 + c1 ** 2 + c2 ** 2) / 3),
  "table-read": ({ table, x }) => {
    if (x <= table[0][0]) return table[0][1];
    for (let k = 1; k < table.length; k++) if (x <= table[k][0]) return table[k - 1][1] + (table[k][1] - table[k - 1][1]) * (x - table[k - 1][0]) / (table[k][0] - table[k - 1][0]);
    const [a, b] = table.slice(-2);
    return b[1] + (b[1] - a[1]) * (x - b[0]) / (b[0] - a[0]);
  },
  "string-loss-law": ({ r0, r2, f }) => r0 + r2 * f * f,
  "difference": ({ a, b }) => a - b,
  "scaled": ({ x, a, b }) => x * a / b,
  "friction-drop-scale": ({ s0, d0, s1, d1 }) => (s0 - d0) / (s1 - d1),
  "power-law": ({ a, x, b }) => a * x ** b,
  "loss-per-frequency": ({ r1, T, mu }) => r1 * (2 * Math.PI) ** 2 * mu / T,
  "least": ({ values }) => Math.min(...values),
  "ratio": ({ a, b }) => a / b,
  "lowest-hz": ({ tuning, a4 }) => a4 * 2 ** ((Math.min(...tuning) - 69) / 12),
  "loss-table": ({ decays, modes, f0, E, d, T, L }) => {
    const B = Math.PI ** 3 * E * d ** 4 / (64 * T * L * L);
    return decays.slice(0, modes).map((r, k) => [(k + 1) * f0 * Math.sqrt(1 + B * (k + 1) ** 2), r]);
  },
  "mersenne-f0": ({ T, mu, L }) => Math.sqrt(T / mu) / (2 * L),
  "cylinder-stiffness": ({ E, d }) => E * Math.PI * d ** 4 / 64,
  "elliptic-aperture-conductance": ({ a, b, t }) => aperture(a, b, t),
  "f-holes-conductance": ({ fLength, fWidth, fThickness }) => 2 * aperture(fLength / 2, fWidth / 2, fThickness),
  "body-air-volume": ({ body, upper, middle: middle2, lower, ribs, archTop, archBack }) => body * (upper + middle2 + lower) / 3 * (ribs + (archTop + archBack) / 2),
  "helmholtz-ratio": ({ K, V, K0, V0 }) => Math.sqrt(K / V / (K0 / V0)),
  "fingerboard-end-semitones": ({ string, fingerboard }) => 12 * Math.log2(string / (string - fingerboard)),
  "inharmonicity-of-stiffness": ({ EI, T, L }) => Math.PI ** 2 * EI / (T * L * L),
  "finger-place": ({ semitones }) => 1 - 2 ** (-semitones / 12),
  "log-grid": ({ least: least2, span: span2, count }) => Array.from({ length: count }, (_, k) => least2 * span2 ** (k / (count - 1))),
  "semitones-ratio": ({ semitones }) => 2 ** (semitones / 12),
  "ratio-semitones": ({ ratio }) => 12 * Math.log2(ratio),
  "place-semitones": ({ place }) => -12 * Math.log2(1 - place),
  "cents-semitones": ({ cents }) => cents / 100,
  "from-centi": ({ centi }) => centi / 100,
  "db-gain": ({ db }) => 10 ** (db / 20),
  "loss-ratio-for": ({ db, rate, seconds }) => Math.log(10 ** (db / 20)) / (rate * seconds),
  "helmholtz-force-scale": ({ force, contact, Z, speed }) => force * contact / (2 * Z * speed),
  "amplitude-db": ({ ratio }) => 20 * Math.log10(ratio),
  "likelihood-residual": ({ logp }) => Math.sqrt(Math.max(0, -2 * logp)),
  "power-db": ({ ratio }) => 10 * Math.log10(ratio),
  "helmholtz-rise": ({ Z, speed, beta, period, t }) => 2 * Z * speed * t / (beta * period),
  "semitones-octaves": ({ semitones }) => semitones / 12,
  "golden-section": () => (Math.sqrt(5) - 1) / 2,
  "parabola-peak": ({ left, middle: middle2, right }) => {
    const curve = left - 2 * middle2 + right;
    return curve < 0 ? 0.5 * (left - right) / curve : 0;
  },
  "sawtooth": ({ t, f0 }) => 2 * (t * f0 - Math.floor(t * f0)) - 1,
  "cents-ratio": ({ cents }) => 2 ** (cents / 1200),
  "normal-deviate": ({ u, v }) => Math.sqrt(-2 * Math.log(Math.max(1e-12, u))) * Math.cos(2 * Math.PI * v)
});

// registry/registry.js
var FILES = Object.freeze({
  "sources.json": sources_default,
  "physics/constants.json": constants_default,
  "physics/equations.json": equations_default,
  "modules.json": modules_default,
  "objects/bowed.json": bowed_default,
  "objects/artifastring-strings.json": artifastring_strings_default,
  "players/bowed.json": bowed_default2,
  "objects/winds.json": winds_default,
  "players/winds.json": winds_default2,
  "stimuli/stimuli.json": stimuli_default,
  "method/strings.json": strings_default,
  "method/levels.json": levels_default,
  "method/personality.json": personality_default,
  "method/rhythm.json": rhythm_default,
  "method/texture.json": texture_default,
  "method/melody.json": melody_default,
  "perception/streaming.json": streaming_default,
  "perception/polyphony.json": polyphony_default,
  "perception/roughness.json": roughness_default,
  "perception/timing.json": timing_default,
  "perception/bands.json": bands_default
});
var KINDS = Object.freeze(["literature", "vernacular", "other", "fit", "derived", "borrowed", "unmeasured", "setting"]);
var within = (folder, key) => Object.freeze(Object.assign({}, ...Object.entries(FILES).filter(([path]) => path.startsWith(`${folder}/`)).map(([, file]) => file[key] ?? {})));
var OBJECTS = within("objects", "nodes");
var PLAYERS = within("players", "nodes");
var METHODS = within("method", "methods");
var PERCEPTION = within("perception", "measures");
var isLeaf = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v) && typeof v.kind === "string";
var tableOf = (of2) => {
  if (of2 === "objects") return OBJECTS;
  if (of2 === "players") return PLAYERS;
  throw new Error(`registry: no tree ${of2}`);
};
function lineage(id) {
  const out = [];
  for (let at2 = id; at2 != null; at2 = OBJECTS[at2].is) {
    if (!Object.hasOwn(OBJECTS, at2)) throw new Error(`registry: no object ${at2}${at2 === id ? "" : ` (an ancestor of ${id})`}`);
    if (out.includes(at2)) throw new Error(`registry: ${id}'s tree runs in a circle at ${at2}`);
    out.push(at2);
  }
  return out;
}
var children = (id) => Object.keys(OBJECTS).filter((k) => OBJECTS[k].is === id);
function dig(values, path) {
  const go = (at2, keys, captures) => {
    if (!keys.length) return isLeaf(at2) ? { leaf: at2, captures } : null;
    if (!at2 || typeof at2 !== "object" || isLeaf(at2) || Array.isArray(at2)) return null;
    const [key, ...rest] = keys;
    return (Object.hasOwn(at2, key) ? go(at2[key], rest, captures) : null) ?? (Object.hasOwn(at2, "*") ? go(at2["*"], rest, [...captures, key]) : null);
  };
  return go(values, path.split("."), []);
}
var fill = (path, captures) => {
  let k = 0;
  return path.replace(/\{\}/g, () => captures[k++]);
};
function locate(of2, id, path) {
  const [first, ...rest] = path.split(".");
  for (const at2 of lineage(id)) {
    const node = tableOf(of2)[at2] ?? {}, hit = dig(node.values, path);
    if (hit) return { ...hit, at: at2, part: null };
    const part = of2 === "objects" ? OBJECTS[at2].parts?.[first] : null;
    if (part && rest.length) return { at: at2, part, rest: rest.join(".") };
  }
  return null;
}
function resolve(of2, id, path, stack) {
  const found = locate(of2, id, path);
  if (!found) throw new Error(`registry: ${id} has no ${of2 === "players" ? "player value" : "value"} ${path} (its tree: ${lineage(id).join(" < ")})`);
  if (found.part) {
    const inner = resolve(of2, found.part, found.rest, stack);
    return Object.freeze({ ...inner, id, path, inherited: found.at !== id || inner.inherited, part: found.part });
  }
  const { leaf, at: at2, captures } = found, key = `${of2}:${id}:${path}`, inherited = at2 !== id;
  if (stack.includes(key)) throw new Error(`registry: ${path} of ${id} is derived from itself (${stack.join(" <- ")})`);
  if (inherited && leaf.passes === false) throw new Error(`registry: ${path} is ${at2}'s own, and ${id} gives none`);
  let ranged = leaf.value === void 0 && Array.isArray(leaf.range) && !leaf.derive && !leaf.like;
  const read = (node, p, caps, tree = of2) => {
    if (p.startsWith("constant:")) return constant(p.slice("constant:".length));
    if (p.startsWith("setting:")) return settingEntry(...p.slice("setting:".length).split(":"), [...stack, key]).value;
    const cross = /^(object|player):(?:([^:]+):)?(.+)$/.exec(p);
    if (cross) {
      const [, t, n, rest] = cross;
      return readIn(t === "object" ? "objects" : "players", n ?? node, rest, caps);
    }
    if (tree !== of2) return readIn(tree, node, p, caps);
    const full = fill(p, caps);
    if (full.includes("*")) {
      const [before, after] = full.split("*");
      return keysOf(node, before.replace(/\.$/, ""), of2).map((k) => read(node, `${before}${k}${after}`, []));
    }
    const e = resolve(of2, node, full, [...stack, key]);
    if (e.ranged) ranged = true;
    return e.value;
  };
  const readIn = (tree, node, p, caps) => {
    const full = fill(p, caps);
    if (full.includes("*")) {
      const [before, after] = full.split("*");
      return keysOf(node, before.replace(/\.$/, ""), tree).map((k) => readIn(tree, node, `${before}${k}${after}`, []));
    }
    const e = resolve(tree, node, full, [...stack, key]);
    if (e.ranged) ranged = true;
    return e.value;
  };
  const compute = (node, spec, caps) => typeof spec === "string" ? read(node, spec, caps) : equation(spec.equation, {
    ...Object.fromEntries(Object.entries(spec.inputs ?? {}).map(([name, p]) => [name, read(node, p, caps)])),
    ...Object.fromEntries(Object.entries(spec.here ?? {}).map(([name, p]) => [name, read(id, p, captures)]))
  });
  let value3 = leaf.value ?? leaf.range ?? leaf.file ?? null, kind = leaf.kind, borrowedFrom = null;
  if ((leaf.derive || leaf.like) && OBJECTS[id]?.abstract) return Object.freeze({ ...leaf, id, path, at: at2, inherited, kind, value: null, template: true });
  if (leaf.derive) {
    const inputs = Object.fromEntries(Object.entries(leaf.derive.inputs).map(([name, p]) => [name, read(id, p, captures)]));
    value3 = ranged ? null : equation(leaf.derive.equation, inputs);
  }
  if (leaf.like) {
    const L = leaf.like, target = compute(id, L.here ?? L.match, captures);
    const options = L.keys ? L.candidates.flatMap((c) => keysOf(c, "", of2).map((k) => ({ node: c, caps: [k] }))) : L.candidates.map((c) => ({ node: c, caps: [] }));
    let best = null, score = Infinity;
    for (const o of options) {
      const d = Math.abs(Math.log(compute(o.node, L.match, o.caps) / target));
      if (d < score) {
        best = o;
        score = d;
      }
    }
    value3 = L.take === "@id" ? best.node : compute(best.node, L.take, best.caps);
    borrowedFrom = [best.node, ...best.caps].join(" ");
  }
  if (inherited && leaf.passes?.by && !(leaf.measuredOn ?? []).includes(id) && !ranged) {
    const at3 = (node, suffix) => Object.fromEntries(Object.entries(leaf.passes.inputs).map(([name, p]) => [name + suffix, read(node, p, [])]));
    value3 = value3 * equation(leaf.passes.by, { ...at3(id, ""), ...at3(leaf.passes.reference, "0") });
    kind = "borrowed";
    borrowedFrom = leaf.passes.reference;
  }
  return Object.freeze({ ...leaf, id, path, at: at2, inherited, kind, value: value3, ...ranged ? { ranged } : {}, ...borrowedFrom ? { borrowedFrom } : {} });
}
var entry = (id, path) => resolve("objects", id, path, []);
var value = (id, path) => entry(id, path).value;
var playerEntry = (id, path) => resolve("players", id, path, []);
var player = (id, path) => playerEntry(id, path).value;
function keysOf(id, path, of2 = "objects") {
  const out = [], parts = path === "" ? [] : path.split(".");
  const add = (keys) => {
    for (const k of keys) if (k !== "*" && !out.includes(k)) out.push(k);
  };
  for (const at2 of lineage(id)) {
    let group2 = tableOf(of2)[at2]?.values;
    for (const key of parts) group2 = group2 && typeof group2 === "object" && !isLeaf(group2) ? group2[key] : void 0;
    if (group2 && typeof group2 === "object" && !isLeaf(group2)) add(Object.keys(group2).filter((k) => !isLeaf(group2[k])));
    const part = parts.length && of2 === "objects" ? OBJECTS[at2].parts?.[parts[0]] : null;
    if (part) add(keysOf(part, parts.slice(1).join("."), of2));
    if (!parts.length && of2 === "objects") add(Object.keys(OBJECTS[at2].parts ?? {}));
  }
  return out;
}
function equationOf(name) {
  if (!Object.hasOwn(EQUATION, name) || !Object.hasOwn(equations_default.equations, name)) throw new Error(`registry: no equation ${name}`);
  return EQUATION[name];
}
var equation = (name, inputs) => equationOf(name)(inputs);
function constant(name) {
  if (!Object.hasOwn(constants_default.constants, name)) throw new Error(`registry: no constant ${name}`);
  return constants_default.constants[name].value;
}
function perceptionEntry(name) {
  if (!Object.hasOwn(PERCEPTION, name)) throw new Error(`registry: no perception measure ${name}`);
  const leaf = PERCEPTION[name];
  return Object.freeze({ ...leaf, name, value: leaf.value ?? leaf.range });
}
var perception = (name) => perceptionEntry(name).value;
function settingEntry(method, name, stack = []) {
  const m = METHODS[method];
  if (!m || !Object.hasOwn(m.settings ?? {}, name)) throw new Error(`registry: method ${method} has no setting ${name}`);
  const leaf = m.settings[name], key = `setting:${method}:${name}`;
  if (stack.includes(key)) throw new Error(`registry: setting ${method} ${name} is derived from itself`);
  const input = (p) => {
    const [kind, ...rest] = p.split(":");
    if (kind === "constant") return constant(rest.join(":"));
    if (kind === "setting") return settingEntry(rest[0], rest[1], [...stack, key]).value;
    if (kind === "object") return resolve("objects", rest[0], rest.slice(1).join(":"), [...stack, key]).value;
    if (kind === "player") return resolve("players", rest[0], rest.slice(1).join(":"), [...stack, key]).value;
    throw new Error(`registry: setting ${method} ${name}: no input ${p}`);
  };
  const value3 = leaf.derive ? equation(leaf.derive.equation, Object.fromEntries(Object.entries(leaf.derive.inputs).map(([k, p]) => [k, input(p)]))) : leaf.value ?? leaf.range ?? null;
  return Object.freeze({ ...leaf, method, name, value: value3 });
}
var setting = (method, name) => settingEntry(method, name).value;
function source(id) {
  if (!Object.hasOwn(sources_default.sources, id)) throw new Error(`registry: no source ${id}`);
  return sources_default.sources[id];
}
function pathsOf(id, of2 = "objects") {
  const out = [], seen = /* @__PURE__ */ new Set();
  const add = (p) => {
    if (!out.includes(p)) out.push(p);
  };
  const walk = (group2, prefix) => {
    for (const [key, inner] of Object.entries(group2)) {
      if (key === "*") {
        for (const k of keysOf(id, prefix.slice(0, -1), of2)) walk({ [k]: inner }, prefix);
        continue;
      }
      if (isLeaf(inner)) add(prefix + key);
      else if (inner && typeof inner === "object") walk(inner, `${prefix}${key}.`);
    }
  };
  for (const at2 of lineage(id)) {
    walk(tableOf(of2)[at2]?.values ?? {}, "");
    for (const [name, part] of Object.entries(of2 === "objects" ? OBJECTS[at2].parts ?? {} : {})) {
      if (seen.has(name)) continue;
      seen.add(name);
      for (const p of pathsOf(part, of2)) add(`${name}.${p}`);
    }
  }
  return out;
}
function group(id, path, of2 = "objects") {
  const read = of2 === "players" ? player : value, out = {}, freeze3 = (o) => {
    for (const v of Object.values(o)) if (v && typeof v === "object") freeze3(v);
    return Object.freeze(o);
  };
  for (const p of pathsOf(id, of2)) {
    if (!p.startsWith(`${path}.`)) continue;
    const keys = p.slice(path.length + 1).split(".");
    let at2 = out;
    for (const k of keys.slice(0, -1)) at2 = at2[k] ??= {};
    at2[keys.at(-1)] = read(id, p);
  }
  if (!Object.keys(out).length) throw new Error(`registry: ${id} has no group ${path}`);
  return freeze3(out);
}

// public/shared/performers/contrabass.js
var CONTRABASS = Object.freeze({
  strings: Object.freeze(keysOf("contrabass", "strings").map((name) => {
    const of2 = (key) => value("contrabass", `strings.${name}.${key}`);
    return Object.freeze({
      name,
      pitch: of2("pitch"),
      f0: of2("f0"),
      T: of2("tension"),
      L: of2("length"),
      pl: of2("density"),
      d: of2("diameter"),
      E: of2("young"),
      B: of2("inharmonicity"),
      r0: of2("lossR0"),
      r2: of2("lossR2")
    });
  })),
  // (The nearest measured body in its air mode, the cello's, stretched in time by this, its correction and corner with
  // it: interim -- the registry's engine choice, objects/bowed.json `engine`.)
  bodyScale: Object.freeze({ from: value("contrabass", "engine.bodyFrom"), ratio: value("contrabass", "engine.bodyRatio"), interim: true })
});

// public/shared/performers/string-bodies.js
var DIMENSIONS = ["body", "upper", "middle", "lower", "ribs", "archTop", "archBack", "fLength", "fWidth", "fThickness", "fingerboard", "string"];
var hasBody = (name) => Boolean(OBJECTS[name]) && (() => {
  try {
    entry(name, "body.string");
    return true;
  } catch {
    return false;
  }
})();
var sheetOf = (name) => {
  if (!hasBody(name)) throw new Error(`string-bodies.js: no sheet for ${name}`);
  return Object.freeze(Object.fromEntries(DIMENSIONS.map((k) => [k, value(name, `body.${k}`)])));
};
var SHEETS = Object.freeze(Object.fromEntries(["violin", "viola", "cello", "contrabass"].map((name) => [name, sheetOf(name)])));
var cite = (id) => {
  const s = source(id);
  return `${s.authors.split(",").map((a) => a.trim().split(" ").at(-1)).join(" & ")} ${s.year}, doi:${s.doi}`;
};
var measured = entry("violin", "body.airMode");
var MEASURED_AIR_MODES = Object.freeze({ violin: Object.freeze({ hz: measured.value, source: cite(measured.source) }) });
function airMode(name) {
  sheetOf(name);
  const e = entry(name, "body.airMode");
  if (e.kind === "literature") return { hz: e.value, measured: true, source: cite(e.source) };
  return { hz: e.value, measured: false, source: "calculated from Goldblatt's measurements of its body and f-holes as a Helmholtz resonator, scaled by the violin's measured A0" };
}

// public/shared/performers/bowed-instruments.js
var ARTIFASTRING = Object.freeze(["violin", "viola", "cello"]);
var GIVEN = children("violin-family").filter((name) => !ARTIFASTRING.includes(name) && name !== "contrabass");
var stringsOf = (name) => Object.freeze(keysOf(name, "strings").map((s) => {
  const of2 = (key) => value(name, `strings.${s}.${key}`);
  return Object.freeze({
    name: s,
    pitch: of2("pitch"),
    f0: of2("f0"),
    T: of2("tension"),
    L: of2("length"),
    pl: of2("density"),
    d: of2("diameter"),
    E: of2("young"),
    B: of2("inharmonicity"),
    losses: Object.freeze(of2("losses").map((p) => Object.freeze([...p])))
  });
}));
var given = GIVEN.map((name, k) => Object.freeze({
  name,
  type: ARTIFASTRING.length + 1 + k,
  solver: value(name, "engine.solver"),
  strings: stringsOf(name),
  bodyScale: Object.freeze({ from: value(name, "engine.bodyFrom"), ratio: value(name, "engine.bodyRatio"), interim: true }),
  opens: Object.freeze(value(name, "tuning")),
  fictional: Boolean(OBJECTS[name].fictional),
  given: true
}));
var BOWED = Object.freeze([
  ...ARTIFASTRING.map((name, type) => Object.freeze({ name, type, solver: name, strings: null, bodyScale: null, opens: Object.freeze(value(name, "tuning")), fictional: false, given: false })),
  Object.freeze({
    name: "contrabass",
    type: ARTIFASTRING.length,
    solver: value("contrabass", "engine.solver"),
    strings: CONTRABASS.strings,
    bodyScale: CONTRABASS.bodyScale,
    opens: Object.freeze(CONTRABASS.strings.map((s) => s.pitch)),
    fictional: false,
    given: false
  }),
  ...given
]);
var BOWED_TYPES = Object.freeze(Object.fromEntries(BOWED.map((i) => [i.name, i.type])));
var bowedOf = (name) => {
  const i = BOWED.find((b) => b.name === name);
  if (!i) throw new Error(`bowed-instruments.js: no bowed instrument ${name}`);
  return i;
};
var lowestHz = (name) => value(name, "lowestHz");
var airHz = (name) => airMode(name).hz;
function bySize(table, name, size = lowestHz, { linear = false } = {}) {
  if (Object.hasOwn(table, name)) return table[name];
  const x = Math.log(size(name)), known = Object.keys(table).map((n) => [Math.log(size(n)), table[n]]).sort((a, b) => a[0] - b[0]);
  if (!known.length) throw new Error(`bowed-instruments.js bySize: nothing measured to read ${name} from`);
  if (x <= known[0][0]) return known[0][1];
  for (let k = 1; k < known.length; k++) if (x <= known[k][0]) {
    const [x0, v0] = known[k - 1], [x1, v1] = known[k], w = (x - x0) / (x1 - x0);
    return !linear && v0 > 0 && v1 > 0 ? Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * w) : v0 + (v1 - v0) * w;
  }
  return known[known.length - 1][1];
}
var GIVEN_BOWED = Object.freeze(BOWED.filter((i) => i.given));

// public/shared/performers/sound-power.js
var MEASURED_BOWED = ["violin", "viola", "cello", "contrabass"];
function derivedEntry(name) {
  const lowest = (n) => bowedOf(n).opens[0], read = (dynamic, get) => bySize(Object.fromEntries(MEASURED_BOWED.map((n) => [n, get(sound_power_default.instruments[n][dynamic], n)])), name, airHz, { linear: true });
  const at2 = (dynamic) => Object.freeze({
    db: read(dynamic, (d) => d.db),
    dbPerSemitone: read(dynamic, (d) => d.dbPerSemitone),
    scatterDb: read(dynamic, (d) => d.scatterDb),
    pitch: lowest(name) + read(dynamic, (d, n) => d.pitch - lowest(n)),
    compass: Object.freeze([lowest(name) + read(dynamic, (d, n) => d.compass[0] - lowest(n)), lowest(name) + read(dynamic, (d, n) => d.compass[1] - lowest(n))])
  });
  return Object.freeze({ label: `${name} (derived from the measured bowed instruments by size)`, derived: true, pp: at2("pp"), ff: at2("ff") });
}
var DERIVED = Object.freeze(Object.fromEntries(GIVEN_BOWED.map((i) => [i.name, derivedEntry(i.name)])));
var middle = (mark) => {
  const k = DYNAMICS.findIndex(([name]) => name === mark);
  return ((k ? DYNAMICS[k - 1][1] : 0) + DYNAMICS[k][1]) / 2;
};
var MEASURED_AT = Object.freeze({ pp: middle("pp"), ff: middle("ff") });
var STEM_REFERENCE_DB = setting("stem-level", "reference");

// render/synthesis/src/brass-breath.mjs
function measured2() {
  const pp2 = [], ff2 = [], { trumpet, tuba } = brass_lips_targets_default;
  for (const n of trumpet.notes) {
    pp2.push([n.hz, n.least.mouthPressure]);
    ff2.push([n.hz, n.forte.mouthPressure]);
  }
  for (const n of tuba.measured.notes) {
    pp2.push([n.hz, n.pp.mouthPressure]);
    ff2.push([n.hz, n.ff.mouthPressure]);
  }
  const c = trumpet.cTrumpet;
  pp2.push([c.hz, c.pp.mouthPressure]);
  ff2.push([c.hz, c.ff.mouthPressure]);
  return { pp: pp2, ff: ff2 };
}
function line(points) {
  const x = points.map(([hz]) => Math.log(hz)), y = points.map(([, pa]) => Math.log(pa)), n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let k = 0; k < n; k++) {
    sxy += (x[k] - mx) * (y[k] - my);
    sxx += (x[k] - mx) ** 2;
  }
  const slope = sxy / sxx, at2 = my - slope * mx;
  const rms = Math.sqrt(x.reduce((s, v, k) => s + (y[k] - at2 - slope * v) ** 2, 0) / n);
  return Object.freeze({ at: at2, slope, scatter: Math.exp(rms), points: points.length });
}
var { pp, ff } = measured2();
var PLAYERS_BREATH = Object.freeze({ pp: line(pp), ff: line(ff) });
function span(ratios) {
  const l = ratios.map(Math.log), m = l.reduce((s, v) => s + v, 0) / l.length;
  return Object.freeze({ ratio: Math.exp(m), logSd: Math.sqrt(l.reduce((s, v) => s + (v - m) ** 2, 0) / (l.length - 1)), points: l.length });
}
var PLAYERS_SPAN = Object.freeze({
  pp: span(brass_lips_targets_default.trumpet.notes.map((n) => n.least.mouthPressure / n.threshold)),
  ff: span([
    ...brass_lips_targets_default.trumpet.notes.map((n) => n.forte.mouthPressure / n.threshold),
    ...brass_lips_targets_default.tuba.measured.notes.map((n) => n.ff.mouthPressure / n.pp.mouthPressure),
    brass_lips_targets_default.trumpet.cTrumpet.ff.mouthPressure / brass_lips_targets_default.trumpet.cTrumpet.pp.mouthPressure
  ])
});
var MOST = brass_lips_targets_default.trumpet.most.mouthPressure;
function playersBreath(hz, velocity) {
  const at2 = (d) => PLAYERS_BREATH[d].at + PLAYERS_BREATH[d].slope * Math.log(hz);
  const t = (velocity - MEASURED_AT.pp) / (MEASURED_AT.ff - MEASURED_AT.pp);
  return Math.min(MOST, Math.exp(at2("pp") + (at2("ff") - at2("pp")) * t));
}
var SPEAK_LIFT = 1.3;
function speakingBreath(hz, velocity, onset) {
  const own2 = playersBreath(hz, velocity);
  if (!(onset > 0)) return own2;
  const floor = SPEAK_LIFT * onset, top = playersBreath(hz, DYNAMIC_VELOCITY.fff), least2 = playersBreath(hz, DYNAMIC_VELOCITY.ppp);
  if (least2 >= floor) return own2;
  if (floor >= top) return Math.min(MOST, floor);
  return Math.min(MOST, top * (own2 / top) ** (Math.log(top / floor) / Math.log(top / least2)));
}

// public/shared/performers/contract.js
var STATUS = Object.freeze({
  witness: "witness-within-declared-model",
  violates: "violates-declared-constraint",
  outside: "outside-calibrated-domain",
  unknown: "unknown",
  budget: "search-budget-exhausted",
  noPath: "no-path-in-candidate-graph",
  invalid: "invalid-model"
});
var EVIDENCE_KINDS = Object.freeze(["player-confirmed", "measured", "mechanism-derived", "authored", "model-estimated", "simulated", "inferred", "unknown"]);
var RESOURCE_KINDS = Object.freeze(["effector", "body", "support", "controller", "actuator", "mechanism"]);
var PHASES = Object.freeze(["prepare", "excite", "hold", "transfer", "release", "recover"]);
var AVAILABILITY = Object.freeze(["available", "unavailable", "unknown"]);
var REASONS = Object.freeze({
  unavailable: "unavailable",
  prohibited: "prohibited",
  capacity: "capacity",
  configuration: "configuration",
  technique: "technique",
  unknownResource: "unknown-resource",
  noConfiguration: "no-configuration",
  outsideEnvelope: "outside-envelope",
  unmeasured: "unmeasured",
  otherContext: "other-context",
  noDemand: "no-demand"
});

// public/transcript/rational.js
var gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
};
var safe = (value3, what) => {
  if (!Number.isSafeInteger(value3)) throw new RangeError(`Rational ${what} ${value3} is outside the safe integer range`);
  return value3;
};
var MAX = BigInt(Number.MAX_SAFE_INTEGER);
var bigGcd = (a, b) => {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
};
var fromBig = (numerator, denominator, what) => {
  const divisor = bigGcd(numerator, denominator) || 1n, n = numerator / divisor, d = denominator / divisor;
  if (n > MAX || -n > MAX || d > MAX || -d > MAX) throw new RangeError(`Rational ${what} ${n}/${d} is outside the safe integer range`);
  return new Rational(Number(n), Number(d));
};
var Rational = class _Rational {
  constructor(numerator, denominator = 1) {
    safe(numerator, "numerator");
    safe(denominator, "denominator");
    if (denominator === 0) throw new RangeError("A rational cannot have a zero denominator");
    const divisor = gcd(numerator, denominator) || 1, sign = denominator < 0 ? -1 : 1;
    this.n = numerator === 0 ? 0 : sign * numerator / divisor;
    this.d = sign * denominator / divisor;
    Object.freeze(this);
  }
  static of(value3, denominator) {
    if (value3 instanceof _Rational) return value3;
    if (denominator !== void 0) return new _Rational(value3, denominator);
    if (Array.isArray(value3)) return new _Rational(value3[0], value3[1] ?? 1);
    if (typeof value3 === "string") {
      const match = value3.trim().match(/^(-?\d+)(?:\s*\/\s*(-?\d+))?$/);
      if (!match) throw new TypeError(`"${value3}" is not a rational (write it as n or n/d)`);
      return new _Rational(Number(match[1]), match[2] === void 0 ? 1 : Number(match[2]));
    }
    if (typeof value3 === "number") {
      if (Number.isInteger(value3)) return new _Rational(value3, 1);
      throw new TypeError(`${value3} is not an integer; supply an exact fraction or compose it with rational operations`);
    }
    if (value3 && typeof value3 === "object" && "n" in value3 && "d" in value3) return new _Rational(value3.n, value3.d);
    throw new TypeError(`Cannot make a rational from ${value3}`);
  }
  // An observational approximation by continued fractions: the first convergent within `tolerance` whose denominator
  // is at most `maxDenominator`, or null. It cannot establish a composer's intent and is not an authored-score input.
  static approximate(value3, { tolerance = 1e-9, maxDenominator = 1e7 } = {}) {
    if (!Number.isFinite(value3)) return null;
    const sign = value3 < 0 ? -1 : 1, x = Math.abs(value3);
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, rest = x;
    for (let step = 0; step < 64; step++) {
      const whole = Math.floor(rest), h2 = whole * h1 + h0, k2 = whole * k1 + k0;
      if (k2 > maxDenominator || !Number.isSafeInteger(h2)) break;
      h0 = h1;
      h1 = h2;
      k0 = k1;
      k1 = k2;
      if (Math.abs(x - h1 / k1) <= tolerance) return new _Rational(sign * h1, k1);
      const fraction = rest - whole;
      if (fraction < 1e-15) break;
      rest = 1 / fraction;
    }
    return k1 && Math.abs(x - h1 / k1) <= tolerance ? new _Rational(sign * h1, k1) : null;
  }
  static get ZERO() {
    return ZERO;
  }
  static get ONE() {
    return ONE;
  }
  // A product of safe integers is exact while it is a safe integer itself, and so is a sum of two; past that the
  // float arithmetic rounds, and the rounding can cancel back into range as a wrong answer (the mathematical audit's
  // I05: 9007199254740991/3 + -6004799503160661/2 is -1/6, and came back -1/3). So a sum past it is taken in big
  // integers and reduced before it is judged: one whose reduced form fits is exact, and one that does not throws.
  add(other) {
    const o = _Rational.of(other), divisor = gcd(this.d, o.d), left = this.n * (o.d / divisor), right = o.n * (this.d / divisor), denominator = this.d / divisor * o.d;
    if (Number.isSafeInteger(left) && Number.isSafeInteger(right) && Number.isSafeInteger(left + right) && Number.isSafeInteger(denominator))
      return new _Rational(left + right, denominator);
    return fromBig(BigInt(this.n) * BigInt(o.d / divisor) + BigInt(o.n) * BigInt(this.d / divisor), BigInt(this.d / divisor) * BigInt(o.d), "sum");
  }
  sub(other) {
    return this.add(_Rational.of(other).neg());
  }
  mul(other) {
    const o = _Rational.of(other), a = gcd(this.n, o.d) || 1, b = gcd(o.n, this.d) || 1;
    return new _Rational(safe(this.n / a * (o.n / b), "product"), safe(this.d / b * (o.d / a), "denominator"));
  }
  div(other) {
    const o = _Rational.of(other);
    if (o.n === 0) throw new RangeError("Division of a rational by zero");
    return this.mul(new _Rational(o.d, o.n));
  }
  neg() {
    return new _Rational(-this.n, this.d);
  }
  abs() {
    return this.n < 0 ? this.neg() : this;
  }
  // By cross-multiplication, in floats while both products are safe integers and in big integers past that, so
  // two values compare even where their difference could not be held (1/9007199254740991 against 1/9007199254740990).
  cmp(other) {
    const o = _Rational.of(other);
    if (this.d === o.d) return Math.sign(this.n - o.n);
    const left = this.n * o.d, right = o.n * this.d;
    if (Number.isSafeInteger(left) && Number.isSafeInteger(right)) return Math.sign(left - right);
    const a = BigInt(this.n) * BigInt(o.d), b = BigInt(o.n) * BigInt(this.d);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  eq(other) {
    const o = _Rational.of(other);
    return this.n === o.n && this.d === o.d;
  }
  lt(other) {
    return this.cmp(other) < 0;
  }
  le(other) {
    return this.cmp(other) <= 0;
  }
  gt(other) {
    return this.cmp(other) > 0;
  }
  ge(other) {
    return this.cmp(other) >= 0;
  }
  min(other) {
    const o = _Rational.of(other);
    return this.le(o) ? this : o;
  }
  max(other) {
    const o = _Rational.of(other);
    return this.ge(o) ? this : o;
  }
  isZero() {
    return this.n === 0;
  }
  isInteger() {
    return this.d === 1;
  }
  sign() {
    return Math.sign(this.n);
  }
  floor() {
    return Math.floor(this.n / this.d);
  }
  ceil() {
    return Math.ceil(this.n / this.d);
  }
  // The part within the unit: x - floor(x), always in [0, 1).
  fraction() {
    return this.sub(this.floor());
  }
  // How many whole `unit`s fit, and what is left: a position split into a count of spans and the place within one.
  divmod(unit) {
    const u = _Rational.of(unit), count = this.div(u).floor();
    return [count, this.sub(u.mul(count))];
  }
  toNumber() {
    return this.n / this.d;
  }
  toString() {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
  }
  toJSON() {
    return this.toString();
  }
  valueOf() {
    throw new TypeError("A Rational has no implicit number value; use toNumber() or the comparison methods");
  }
};
var ZERO = new Rational(0, 1);
var ONE = new Rational(1, 1);

// public/shared/note-values.js
var NOTE_TYPES = Object.freeze([
  ["maxima", 8],
  ["long", 4],
  ["breve", 2],
  ["whole", 1],
  ["half", 1 / 2],
  ["quarter", 1 / 4],
  ["eighth", 1 / 8],
  ["16th", 1 / 16],
  ["32nd", 1 / 32],
  ["64th", 1 / 64],
  ["128th", 1 / 128],
  ["256th", 1 / 256],
  ["512th", 1 / 512],
  ["1024th", 1 / 1024]
].map(Object.freeze));

// public/shared/performers/fill-phrase.js
var FILL_PHRASE = Object.freeze({
  // The most slots a phrase, a cell's tuplet, and a nesting's depth may reach, and the most contacts a phrase may expand
  // to, counted before any is placed (bounds on work, not on music: gestures.js holds a span to 4096 slots; RHY-002's
  // research query emitted at most 65,536).
  mostSlots: 4096,
  mostDepth: 8,
  mostContacts: 65536,
  // A dissonant group is heard as one up to about this long (ours: as metric-home/nested.js hears a group, seconds).
  longestGroupSeconds: 4,
  // The appetites a drummer brings to a fill of several beats (choosePhrase; ours, until listening says): ordinarily a
  // grouping against the meter now and then, a cell's own tuplet rarely, a nested one seldom; at the extremes (asked for
  // by a situation or a spec), each often, and fills up to sixteen bars.
  ordinary: Object.freeze({ dissonance: 0.25, tuplets: 0.1, nesting: 0.05 }),
  extremes: Object.freeze({ dissonance: 0.9, tuplets: 0.5, nesting: 0.3, mostBars: 16 })
});

// public/shared/style-space.js
var finite = (value3) => typeof value3 === "number" && Number.isFinite(value3);
var sameShape = (a, b) => finite(a) ? finite(b) : Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value3, i) => sameShape(value3, b[i]));
var frozen = (value3) => Array.isArray(value3) ? Object.freeze(value3.map(frozen)) : value3;
var mixed = (values, weights) => finite(values[0]) ? values.reduce((sum, value3, i) => sum + weights[i] * value3, 0) : Object.freeze(values[0].map((_, k) => mixed(values.map((value3) => value3[k]), weights)));
var mixtures = /* @__PURE__ */ new WeakMap();
function styleSpace({ name, dimensions, locations }) {
  const names = Object.freeze(Object.keys(dimensions)), named = Object.keys(locations);
  if (!named.length) throw new TypeError(`${name} style space names a location`);
  for (const key of names) if (locations[key]) throw new TypeError(`${name} style space: "${key}" names both a dimension and a location`);
  const first = locations[named[0]];
  for (const [place, location] of Object.entries(locations)) {
    for (const key of names) if (!(finite(location[key]) || Array.isArray(location[key])) || !sameShape(first[key], location[key])) throw new TypeError(`${name} style space: ${place}'s "${key}" is a number, or a list shaped as ${named[0]}'s`);
    for (const key of Object.keys(location)) if (!dimensions[key]) throw new TypeError(`${name} style space: ${place} gives "${key}", no dimension of it`);
  }
  const shaped = Object.freeze(Object.fromEntries(Object.entries(locations).map(([place, location]) => [place, Object.freeze(Object.fromEntries(names.map((key) => [key, frozen(location[key])])))])));
  function locate2(location) {
    if (typeof location === "string") {
      if (!shaped[location]) throw new TypeError(`A location in ${name} style space is one of ${named.join(", ")}, a blend of them, or a vector`);
      return shaped[location];
    }
    if (!location || typeof location !== "object" || Array.isArray(location)) throw new TypeError(`A location in ${name} style space is a name, a blend of named locations, or a vector`);
    const weights = {}, set = {};
    for (const [key, value3] of Object.entries(location)) {
      if (shaped[key]) {
        if (!finite(value3) || value3 < 0) throw new TypeError(`A named location's weight is a number, 0 or more ("${key}")`);
        weights[key] = value3;
      } else if (dimensions[key]) {
        if (!sameShape(first[key], value3)) throw new TypeError(`A location's "${key}" is shaped as ${named[0]}'s`);
        set[key] = frozen(value3);
      } else throw new TypeError(`"${key}" is neither a named location nor a dimension of ${name} style space`);
    }
    const blend = Object.keys(weights), total = blend.reduce((sum, key) => sum + weights[key], 0);
    if (!total && Object.keys(set).length < names.length) throw new TypeError(`A location in ${name} style space gives named locations to blend, or every dimension`);
    const base = total ? Object.fromEntries(names.map((key) => [key, mixed(blend.map((place) => shaped[place][key]), blend.map((place) => weights[place] / total))])) : {};
    const point = Object.freeze({ ...base, ...set });
    if (total) mixtures.set(point, Object.freeze(blend.filter((place) => weights[place] > 0).map((place) => Object.freeze({ weight: weights[place] / total, location: Object.keys(set).length ? Object.freeze({ ...shaped[place], ...set }) : shaped[place] }))));
    return point;
  }
  function between(a, b, t) {
    const amount = Math.max(0, Math.min(1, t)), point = Object.freeze(Object.fromEntries(names.map((key) => [key, mixed([a[key], b[key]], [1 - amount, amount])])));
    mixtures.set(point, Object.freeze([...mixtureOf(a).map((part) => ({ ...part, weight: part.weight * (1 - amount) })), ...mixtureOf(b).map((part) => ({ ...part, weight: part.weight * amount }))].filter((part) => part.weight > 0).map((part) => Object.freeze(part))));
    return point;
  }
  function mixtureOf(point) {
    return mixtures.get(point) ?? Object.freeze([Object.freeze({ weight: 1, location: point })]);
  }
  function drawn(point, draw) {
    const parts = mixtureOf(point);
    let from = 0;
    for (const part of parts) {
      if (draw < from + part.weight || part === parts.at(-1)) return { location: part.location, draw: Math.max(0, Math.min(1 - 1e-12, (draw - from) / part.weight)) };
      from += part.weight;
    }
  }
  return Object.freeze({ name, dimensions: Object.freeze({ ...dimensions }), names, locations: shaped, locate: locate2, between, mixtureOf, drawn });
}

// public/shared/performers/melody-rules.js
var RECOVER_MOST = setting("melody", "recoverMost");
var ALIKE_MOST = setting("melody", "alikeMost");
var RULES = Object.freeze(["widest", "leap", "last", "alike", "run", "trill"]);

// public/shared/performers/streams.js
var FISSION = perception("fission-boundary");
var COHERENCE = perception("temporal-coherence-boundary");
var THRESHOLD = setting("streaming", "threshold");

// public/shared/performers/idiom.js
var OPEN = setting("strings-compiler", "openWithin");

// public/shared/performers/figure-space.js
var THIRD = setting("figure-space", "third");
var BEAM = setting("figure-space", "beam");
var JITTER = setting("figure-space", "jitter");
var BEYOND2 = setting("idiom", "beyond");
var SKEW = setting("figure-space", "skew");
var SKEWED = new Set(setting("figure-space", "skewed"));
var PAIR = setting("figure-space", "pair");
var VOICE_NOTES = setting("figure-space", "voiceNotes");
var FIGURE_DIMENSIONS = Object.freeze({
  lead: "of its excursion beyond the way, the share turning back behind the held note; the rest arcs past the next note",
  circling: "of its notes to spare, the share spent circling a note in pairs, out and back",
  trilling: "how often a circling pair keeps to the side of the pair before (0: each the other side, a turn; 1: a trill)",
  order: "which side it circles first, and which way it cycles among its voices (below a half: up)",
  progress: "of its circling pairs, the share moving on along the way as they circle (a climb), the rest circling in place",
  width: "how wide a circling pair goes: 0 a step, 1 a third",
  placement: "where along its way its circling comes: 0 at its start, 1 at its end",
  stride: "of its path's moves, the share by thirds (an arpeggio)",
  repeat: "of its notes to spare, the share struck again (a ribattuta), each note twice at most",
  voices: "how many voices it walks among: 0 one (a line), 1 as many as its notes, its range and its rate allow (a compound melody)"
});
var NAMES = Object.freeze(Object.keys(FIGURE_DIMENSIONS));
var FIGURE_NAMES = Object.freeze(Object.keys(METHODS).filter((id) => id.startsWith("figure-") && id !== "figure-space").map((id) => id.slice("figure-".length)));
var asRange = (value3) => Array.isArray(value3) ? [...value3] : [value3, value3];
var FIGURE_SPACE = styleSpace({
  name: "figure",
  dimensions: FIGURE_DIMENSIONS,
  locations: Object.fromEntries(FIGURE_NAMES.map((name) => [name, Object.fromEntries(NAMES.map((key) => [key, asRange(setting(`figure-${name}`, key))]))]))
});
var EVERY = Object.freeze(Object.fromEntries(NAMES.map((key) => [key, Object.freeze([0, 1])])));

// public/shared/fnv1a.js
var FNV_SPAN = 2 ** 32;

// public/shared/performers/fioritura.js
var FIORITURA = Object.freeze({
  // The mean note rates an ornament takes, from the least amount to the most (notes a second, authored; slower than six
  // it is a line, not an ornament), and the quickest any of its notes may be, under its rubato: a pianist's run at
  // twenty a second (piano.js: a finger leaves one key for another in 0.04 s).
  rates: Object.freeze([6, 16]),
  quickest: 20,
  // The least notes, and the least span in seconds, worth ornamenting.
  leastNotes: 3,
  leastSeconds: 0.35,
  // The share of a held note kept before its ornament begins (the rest is the ornament's).
  held: 0.5,
  // The most rubato inside an ornament, at amount 1: its ends this much slower than its mean, its middle this much
  // quicker (a warp x + a sin(2 pi x) / 2 pi of the span).
  rubato: 0.35,
  // Loudness, as shares of the line's velocity: its body, the swell to its turn, a group head's accent.
  velocity: Object.freeze({ body: 0.7, swell: 0.12, head: 0.05 }),
  // A place nested as a turn, at amount 1 (fill-phrase.js nest's appetite; its count one whose notes the quickest allows).
  nesting: 0.3,
  // The widest move it lands on the next note by (the voice's pitches): a step, its last note a neighbour of the note it
  // leads to, whatever figure it walks.
  landing: 1
});
var ORNAMENT = Object.freeze({ leapSteps: Infinity, leapMost: Infinity, runMost: Infinity });

// public/shared/vocal/rational.js
var make = (n, d) => {
  if (d === 0n) throw new RangeError("A rational needs a non-zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  return Object.freeze({ n: n.toString(), d: d.toString() });
};
var ZERO2 = make(0n, 1n);
var ONE2 = make(1n, 1n);

// public/shared/metric-home/grouping.js
var REMAINDER_UNITS = Object.freeze([3, 2]);

// public/shared/meter-tactus.js
var FASTEST_BEAT_SECONDS = 60 / 160;
var OFFBEAT = Object.freeze({ ternary: 2 / 3, binary: 1 / 2 });

// public/random-source.js
var MULBERRY_STEP = 1831565813;
function hashSeed(value3) {
  const text = String(value3), numeric = Number(text);
  if (text.trim() !== "" && Number.isFinite(numeric)) return numeric >>> 0;
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function freshSeed() {
  return hashSeed(Date.now());
}
function mulberry(state) {
  let value3 = state;
  value3 = Math.imul(value3 ^ value3 >>> 15, value3 | 1);
  value3 ^= value3 + Math.imul(value3 ^ value3 >>> 7, value3 | 61);
  return ((value3 ^ value3 >>> 14) >>> 0) / 4294967296;
}
function createRandomStream(value3) {
  const seed2 = hashSeed(value3);
  let state = seed2;
  return {
    seed: seed2,
    next() {
      state = state + MULBERRY_STEP >>> 0;
      return mulberry(state);
    },
    snapshot() {
      return { algorithm: "mulberry32", seed: seed2, state };
    },
    restore(saved) {
      if (saved?.algorithm !== "mulberry32" || saved.seed !== seed2 || !Number.isInteger(saved.state) || saved.state < 0 || saved.state > 4294967295) throw new Error("Invalid random stream state");
      state = saved.state;
    }
  };
}
var seed = freshSeed();
var stream = createRandomStream(seed);

// public/shared/rhythm-vocabulary.js
var KRISHNASWAMY_WELLS = Object.freeze({
  citation: 'Jagdish A. Krishnaswamy and Robert Wells, "A Novel Generative Paradigm for Carnatic Rhythmic Composition", Analytical Approaches to Music of South Asia 1 (2023)',
  uri: "https://southasia.iftawm.org/wp-content/uploads/KrishnaswamyWells_Article.pdf",
  accessed: "2026-09-28"
});
var TOUSSAINT = Object.freeze({
  citation: 'Godfried T. Toussaint, The Geometry of Musical Rhythm: What Makes a "Good" Rhythm Good? (CRC Press, 2013), and "The Euclidean algorithm generates traditional musical rhythms", Bridges (2005)',
  uri: "https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf",
  accessed: "2026-09-28"
});
var VURKAC = Object.freeze({
  citation: 'Mehmet Vurkaç, "A Cross-Cultural Grammar for Temporal Harmony in Afro-Latin Musics: Clave, Partido-Alto and Other Timelines", Current Musicology 94 (2012)',
  uri: "https://doi.org/10.7916/cm.v0i94.5234",
  accessed: "2026-07-24"
});
var CLAYTON = Object.freeze({ citation: "Martin Clayton, Time in Indian Music: Rhythm, Metre, and Form in North Indian Rāg Performance (Oxford University Press, 2000)", uri: null, accessed: null });
var wikipedia = (title, accessed = "2026-09-28") => Object.freeze({ citation: `"${title}", Wikipedia`, uri: `https://en.wikipedia.org/wiki/${title}`, accessed });
var NADAI = Object.freeze({ caturasra: 1, tisra: 3, khanda: 5, misra: 7, sankirna: 9, "sampurna-khanda": 10 });
var THEKA_BAYAN = Object.freeze({ dha: true, dhin: true, dhi: true, ta: false, tin: false, ti: false, na: false });
var tala = (record2) => {
  const beats = record2.components.reduce((sum, component) => sum + component.beats, 0);
  if (record2.theka && (record2.theka.length !== beats || record2.theka.some((bol) => !(bol in THEKA_BAYAN)))) throw new RangeError(`${record2.id}: a theka is a known bol for each beat`);
  return Object.freeze({
    kind: "tala",
    license: "metadata-only",
    ...record2,
    ...record2.theka ? { theka: Object.freeze([...record2.theka]) } : {},
    components: Object.freeze(record2.components.map((component) => Object.freeze({ ...component, gestures: component.gestures ? Object.freeze([...component.gestures]) : null })))
  });
};
var clave = (record2) => Object.freeze({ kind: "clave", license: "metadata-only", ...record2, onsets: Object.freeze([...record2.onsets]) });
var RHYTHM_VOCABULARY = Object.freeze(Object.fromEntries([
  // Ādi tāḷa: "8 beats of equal duration ... grouped into three angas of 4, 2, and 2 beats" (¶15). A laghu's beats are a
  // clap and finger counts from the little finger, a drutam's a clap and a wave (Figure 1, shown there for tisra
  // triputa's laghu of three: clap, pinky, ring).
  tala({
    id: "carnatic.adi",
    tradition: "Carnatic",
    name: "Ādi tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "laghu", beats: 4, gestures: ["clap", "pinky", "ring", "middle"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }]
  }),
  // Tiśra tripuṭa tāḷa: "seven-beat cycles divided into angas of lengths 3, 2, and 2", each beat marked by its kriyā:
  // clap, pinky, ring; clap, wave; clap, wave (Figure 1).
  tala({
    id: "carnatic.tisra-triputa",
    tradition: "Carnatic",
    name: "Tiśra tripuṭa tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "laghu", beats: 3, gestures: ["clap", "pinky", "ring"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }, { kind: "drutam", beats: 2, gestures: ["clap", "wave"] }]
  }),
  // Rūpaka tāḷa as the source takes it: "3 beats of equal duration" (¶15), "a 3-beat rhythmic cycle with 4 subdivisions
  // per beat" (¶3). The source gives no kriyās for it, so none are claimed.
  tala({
    id: "carnatic.rupaka",
    tradition: "Carnatic",
    name: "Rūpaka tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "beats", beats: 3, gestures: null }]
  }),
  // Miśra cāpu tāḷa, a cāpu tāḷa, "whose beats vary in duration" (¶12), as the source takes it: "one long beat (three
  // subdivisions) followed by two shorter beats (two subdivisions)", seven subdivisions a cycle (note 3; "miṣra cāpu
  // tāḷa in tiṣra naḍai, totalling 21 subdivisions per cycle"). Other artists count it as seven equal beats (note 3).
  // No kriyās are claimed.
  tala({
    id: "carnatic.misra-capu",
    tradition: "Carnatic",
    name: "Miśra cāpu tāḷa",
    source: KRISHNASWAMY_WELLS,
    components: [{ kind: "long", beats: 1, units: 3, gestures: null }, { kind: "short", beats: 2, units: 2, gestures: null }]
  }),
  // Hindustani taals: vibhags, each begun with a clap (tali; the cycle's first, sam, marked X) or a wave (khali, "empty",
  // marked 0), the other matras ungestured; and the theka, the taal's stroke names (bols) a matra each. Where a bol
  // sounds the bayan, the left-hand bass drum (dha, dhin, dhi), and where it does not (ta, tin, ti, na) is the theka's
  // own (THEKA_BAYAN), so a part's bass can follow it: the khali vibhag is where it thins.
  // Teentaal: 16 matras, 4+4+4+4, marked X 2 0 3.
  tala({
    id: "hindustani.teentaal",
    tradition: "Hindustani",
    name: "Tīntāl",
    source: [CLAYTON, wikipedia("Teental")],
    components: [
      { kind: "vibhag", role: "tali", marker: "X", beats: 4, gestures: ["sam", null, null, null] },
      { kind: "vibhag", role: "tali", marker: "2", beats: 4, gestures: ["tali", null, null, null] },
      { kind: "vibhag", role: "khali", marker: "0", beats: 4, gestures: ["khali", null, null, null] },
      { kind: "vibhag", role: "tali", marker: "3", beats: 4, gestures: ["tali", null, null, null] }
    ],
    theka: ["dha", "dhin", "dhin", "dha", "dha", "dhin", "dhin", "dha", "dha", "tin", "tin", "ta", "ta", "dhin", "dhin", "dha"]
  }),
  // Jhaptaal: 10 matras, 2+3+2+3, marked X 2 0 3.
  tala({
    id: "hindustani.jhaptaal",
    tradition: "Hindustani",
    name: "Jhaptāl",
    source: [CLAYTON, wikipedia("Jhaptal")],
    components: [
      { kind: "vibhag", role: "tali", marker: "X", beats: 2, gestures: ["sam", null] },
      { kind: "vibhag", role: "tali", marker: "2", beats: 3, gestures: ["tali", null, null] },
      { kind: "vibhag", role: "khali", marker: "0", beats: 2, gestures: ["khali", null] },
      { kind: "vibhag", role: "tali", marker: "3", beats: 3, gestures: ["tali", null, null] }
    ],
    theka: ["dhi", "na", "dhi", "dhi", "na", "ti", "na", "dhi", "dhi", "na"]
  }),
  // Clave: an orienting timeline with a direction, not five marked slots (Vurkaç 2012). Onsets on sixteen pulses, as
  // Toussaint writes them: son x..x..x...x.x..., rumba x..x...x..x.x..., bossa nova x..x..x...x..x... The 2-3 side is
  // the same timeline begun at its other half.
  clave({ id: "afro-cuban.son-clave-3-2", tradition: "Afro-Cuban", name: "Son clave, 3-2", pulses: 16, onsets: [0, 3, 6, 10, 12], direction: "3-2", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "afro-cuban.son-clave-2-3", tradition: "Afro-Cuban", name: "Son clave, 2-3", pulses: 16, onsets: [2, 4, 8, 11, 14], direction: "2-3", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "afro-cuban.rumba-clave-3-2", tradition: "Afro-Cuban", name: "Rumba clave, 3-2", pulses: 16, onsets: [0, 3, 7, 10, 12], direction: "3-2", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "afro-cuban.rumba-clave-2-3", tradition: "Afro-Cuban", name: "Rumba clave, 2-3", pulses: 16, onsets: [2, 4, 8, 11, 15], direction: "2-3", source: [TOUSSAINT, VURKAC] }),
  clave({ id: "brazilian.bossa-nova-clave", tradition: "Brazilian", name: "Bossa nova clave", pulses: 16, onsets: [0, 3, 6, 10, 13], direction: null, source: [TOUSSAINT] })
].map((record2) => [record2.id, record2])));

// public/shared/felt-meter-catalog.js
var freeze = (value3) => {
  if (value3 && typeof value3 === "object") {
    Object.values(value3).forEach(freeze);
    Object.freeze(value3);
  }
  return value3;
};
var FELT_METER_POLICY = freeze({
  "id": "score-selection-v2",
  "evidence": "authored-policy-not-human-calibration",
  "favoredBeatSeconds": [
    "2/5",
    "4/5"
  ],
  "candidateBeatSeconds": [
    "3/10",
    "1"
  ],
  "cyclePreferenceMaxSeconds": "4",
  "cycleMinimumSeconds": null,
  "catalog": [
    { "id": "2/4-in-2", "numerator": 2, "denominator": 4, "beatWeights": [1, 1], "groups": [1, 1], "kind": "standard", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["60", "200"] },
    { "id": "3/4-in-3", "numerator": 3, "denominator": 4, "beatWeights": [1, 1, 1], "groups": [3], "kind": "standard", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["60", "200"] },
    { "id": "4/4-in-4", "numerator": 4, "denominator": 4, "beatWeights": [1, 1, 1, 1], "groups": [2, 2], "kind": "standard", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["60", "200"] },
    { "id": "2/2-in-2", "numerator": 2, "denominator": 2, "beatWeights": [1, 1], "groups": [1, 1], "kind": "standard", "reference": { "unit": 2, "dots": 0 }, "favoredQuarterBPM": ["150", "300"], "candidateQuarterBPM": ["120", "400"] },
    { "id": "3/2-in-3", "numerator": 3, "denominator": 2, "beatWeights": [1, 1, 1], "groups": [3], "kind": "standard", "reference": { "unit": 2, "dots": 0 }, "favoredQuarterBPM": ["150", "300"], "candidateQuarterBPM": ["120", "400"] },
    { "id": "6/8-in-2", "numerator": 6, "denominator": 8, "beatWeights": [3, 3], "groups": [3, 3], "kind": "standard", "reference": { "unit": 4, "dots": 1 }, "favoredQuarterBPM": ["225/2", "225"], "candidateQuarterBPM": ["90", "300"] },
    { "id": "9/8-in-3", "numerator": 9, "denominator": 8, "beatWeights": [3, 3, 3], "groups": [3, 3, 3], "kind": "standard", "reference": { "unit": 4, "dots": 1 }, "favoredQuarterBPM": ["225/2", "225"], "candidateQuarterBPM": ["90", "300"] },
    { "id": "12/8-in-4", "numerator": 12, "denominator": 8, "beatWeights": [3, 3, 3, 3], "groups": [3, 3, 3, 3], "kind": "standard", "reference": { "unit": 4, "dots": 1 }, "favoredQuarterBPM": ["225/2", "225"], "candidateQuarterBPM": ["90", "300"] },
    { "id": "5/4-in-5", "numerator": 5, "denominator": 4, "beatWeights": [1, 1, 1, 1, 1], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["75", "150"], "candidateQuarterBPM": ["75", "200"] },
    { "id": "7/4-in-7", "numerator": 7, "denominator": 4, "beatWeights": [1, 1, 1, 1, 1, 1, 1], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["105", "150"], "candidateQuarterBPM": ["105", "200"] },
    { "id": "5/4-in-2", "numerator": 5, "denominator": 4, "beatWeights": [2, 3], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225", "300"], "candidateQuarterBPM": ["180", "400"] },
    { "id": "7/4-in-3", "numerator": 7, "denominator": 4, "beatWeights": [2, 2, 3], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225", "300"], "candidateQuarterBPM": ["180", "400"] },
    { "id": "5/8-in-2", "numerator": 5, "denominator": 8, "beatWeights": [2, 3], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "7/8-in-3", "numerator": 7, "denominator": 8, "beatWeights": [2, 2, 3], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "8/8-in-3", "numerator": 8, "denominator": 8, "beatWeights": [3, 3, 2], "groups": [3, 3, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "9/8-in-4", "numerator": 9, "denominator": 8, "beatWeights": [2, 2, 2, 3], "groups": [2, 2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "11/8-in-5", "numerator": 11, "denominator": 8, "beatWeights": [2, 2, 3, 2, 2], "groups": [2, 2, 3, 2, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["90", "200"] },
    { "id": "13/8-in-5", "numerator": 13, "denominator": 8, "beatWeights": [3, 3, 3, 2, 2], "groups": [3, 3, 3, 2, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/2", "150"], "candidateQuarterBPM": ["195/2", "200"] },
    { "id": "17/8-in-6", "numerator": 17, "denominator": 8, "beatWeights": [3, 3, 3, 3, 3, 2], "groups": [3, 3, 3, 3, 3, 2], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["255/2", "150"], "candidateQuarterBPM": ["255/2", "200"] },
    { "id": "5/16-in-2", "numerator": 5, "denominator": 16, "beatWeights": [2, 3], "groups": [2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/4", "75"], "candidateQuarterBPM": ["45", "100"] },
    { "id": "7/16-in-3", "numerator": 7, "denominator": 16, "beatWeights": [2, 2, 3], "groups": [2, 2, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["225/4", "75"], "candidateQuarterBPM": ["45", "100"] },
    { "id": "17/16-in-7", "numerator": 17, "denominator": 16, "beatWeights": [2, 2, 3, 2, 2, 3, 3], "groups": [2, 2, 3, 2, 2, 3, 3], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["255/4", "75"], "candidateQuarterBPM": ["255/4", "100"] },
    { "id": "17/16-in-4", "numerator": 17, "denominator": 16, "beatWeights": [4, 4, 4, 5], "groups": [4, 4, 4, 5], "kind": "grouped", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["375/4", "150"], "candidateQuarterBPM": ["75", "200"] },
    { "id": "107/32-in-5", "numerator": 107, "denominator": 32, "beatWeights": [19, 19, 19, 25, 25], "groups": [57, 50], "kind": "specialist", "reference": { "unit": 4, "dots": 0 }, "favoredQuarterBPM": ["1875/8", "1425/4"], "candidateQuarterBPM": ["1605/8", "475"] },
    { "id": "107/32-in-2", "numerator": 107, "denominator": 32, "beatWeights": [57, 50], "groups": [57, 50], "kind": "specialist", "reference": { "unit": 1, "dots": 0 }, "favoredQuarterBPM": ["4275/8", "1875/2"], "candidateQuarterBPM": ["855/2", "1250"] }
  ]
});
var FELT_METER_CATALOG = FELT_METER_POLICY.catalog;

// public/shared/metric-home/nested.js
var NESTING = Object.freeze({
  // The longest group a listener hears as one (seconds; meterform_clodbot's and grouping-choice.js's longestGroupSeconds,
  // ours, within the few seconds a measure can last: London 2012, Hearing in Time, 2nd ed.,
  // doi:10.1093/acprof:oso/9780199744374.001.0001).
  longestSeconds: 5,
  // A split into sections is told apart by their lengths: the shorter section at least this share of the span and the
  // two sections' shares differing by at least `contrast` (37/107 against 70/107 differ by 0.31). Ours.
  shortestShare: 0.25,
  contrast: 0.12,
  // Candidate splits offered at most for one span, the best first. Ours.
  offered: 12,
  // Groups under one at most (grouping.js MAX_GROUPS_UNDER_ONE, Scansion Maker's: four or more are grouped again).
  maxParts: 3
});

// public/shared/tempo-range.js
var TEMPO_LIMITS = Object.freeze({ notated: Object.freeze([40, 220]), coordinate: Object.freeze([30, 720]) });

// public/shared/felt-tempo.js
var value2 = (text) => {
  const [n, d = "1"] = String(text).split("/");
  return Number(n) / Number(d);
};
var band = (list) => [value2(list[0]), value2(list[1])];
var FELT_TEMPO = Object.freeze({
  beat: Object.freeze(band(FELT_METER_POLICY.candidateBeatSeconds)),
  favoredBeat: Object.freeze(band(FELT_METER_POLICY.favoredBeatSeconds)),
  longestBarSeconds: NESTING.longestSeconds
});

// public/shared/euclidean.js
var RHYTHM = Object.freeze({
  beat: Object.freeze([60 / setting("rhythm-layers", "fastestBeat"), 60 / setting("rhythm-layers", "slowestBeat")]),
  shortestPeriod: setting("rhythm-layers", "shortestPeriod")
});

// public/shared/meter-space.js
var METER_SPACE = Object.freeze({
  numerators: Object.freeze([1, 40]),
  // Power-of-two denominators mostly; the irrational ones besides (docs/NOTATION.md writes those as the real meter nearest,
  // with a tempo).
  denominators: Object.freeze([[2, 1], [3, 1], [4, 4], [5, 1], [6, 1], [8, 4], [10, 1], [12, 2], [16, 3], [24, 1], [32, 1]].map(Object.freeze)),
  // The parts a span of a bar is split into at each level of its nesting, two or three (never more than three under
  // one: metric-home/grouping.js MAX_GROUPS_UNDER_ONE), down to its groups of two and three units (drawGrouping).
  layers: Object.freeze([[2, 1], [3, 1]].map(Object.freeze)),
  // Pulses a unit.
  subdivisions: Object.freeze([[1, 1], [2, 3], [3, 2], [4, 3], [5, 1], [6, 1]].map(Object.freeze)),
  // The share of draws that are a named cycle (the rhythm vocabulary's talas).
  talas: 0.12,
  // A bar the band plays, in seconds at its tempo (longer bars: meterform's sections).
  barSeconds: Object.freeze([0.5, 10])
});
var TALAS = Object.freeze(Object.keys(RHYTHM_VOCABULARY).filter((id) => RHYTHM_VOCABULARY[id].kind === "tala").sort());

// public/shared/meter-reading.js
var EDITORIAL_ACTIONS = Object.freeze([
  "PUBLISH_STANDARD",
  "PUBLISH_GROUPED",
  "PUBLISH_SPECIALIST_WITH_LEGEND",
  "KEEP_WITH_SUPPORT",
  "PREFER_LOCAL_BARS_WITH_CYCLE_BRACKET",
  "HOLD_FOR_REVIEW",
  "FREE_TIME_BY_INTENT"
]);

// public/shared/opening-time.js
var DEFAULT_SEED = 20260916;
var OPENING_TIME = Object.freeze({
  // A phrase's length, in seconds, drawn log-uniform between these (ours: about meterspace_clodbot's eight).
  phraseSeconds: Object.freeze([5, 13]),
  // A phrase's bars at most (ours: meterspace_clodbot's).
  phraseBarsAtMost: 8,
  // The band's density before any is heard, drawn between these (ours).
  density: Object.freeze([0.35, 0.85]),
  // Its rhythm's shares (line-rhythm.js RHYTHM_SHARES, in their order), each drawn between these: a syncopation's meter M
  // "usually weighted toward L" and the length within it "usually ... toward 0, but it's not the only possible one" (the
  // owner, 4 November 2026), so most pieces lean so and some away; the rest anywhere (ours).
  rhythm: Object.freeze({
    tuplets: Object.freeze([0, 1]),
    syncopation: Object.freeze([0, 1]),
    length: Object.freeze([0, 1]),
    meter: Object.freeze([0.3, 1]),
    repeats: Object.freeze([0, 1]),
    within: Object.freeze([0, 0.7])
  }),
  // The note a drawn meter's tempo counts (tempo-range.js tempoUnit): the quarter, as the research reports count every
  // tempo (research/meter/MUSEBOTS_METER_SELECTION_RESEARCH_REPORT.md: "All BPM values below mean quarter-note BPM").
  reference: 4
});

// public/shared/performers/line-rhythm.js
var RHYTHM_SHARES = Object.freeze(["tuplets", "syncopation", "length", "meter", "repeats", "within"]);
var LAYERS = new Map(METER_SPACE.layers);
var LEAST = Math.min(...LAYERS.values());

// public/shared/performers/line.js
var LINE = Object.freeze({
  // How finely a divided felt beat may be divided, from the least density to the most, and the dynamics a phrase spans:
  // the system's scored range, ppp to fff (dynamics.js; the owner, 10 October 2026).
  dynamics: Object.freeze(["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"]),
  // The quickest note a line's player takes (s): a bow's change twice (bow.js changeSeconds: section-voices.js
  // SECTION_VOICES.shortest), a wind's double tonguing near it (ours). How finely a span divides is as many notes as fit
  // in it at this (divisionOf): no list of divisions.
  shortest: 0.08,
  // Velocity by dynamic, for the voice: the scale's centres (dynamics.js), so that a dynamic's velocity is the mark the
  // score writes for it.
  velocity: DYNAMIC_VELOCITY,
  // The longest slur of quick notes, and a leap's chance in a motif.
  slurMost: 4,
  leap: 0.18,
  // The share of a phrase's segments (its idea, its repetition, its answer, ...) slurred whole, long notes and all,
  // tongued where each begins: a legato player's (personality.js, its slurs). None here: long notes separate.
  slurSegments: 0,
  // The share of a held note a soloist's run may take.
  ornamentShare: "2/3",
  // A motif's fewest and most notes, its widest drift (pool steps from its first note to its last), and the density it
  // is made at where the instrument names none (its character; each phrase's density then realizes it, sparser or denser).
  motifNotes: Object.freeze([3, 6]),
  driftMost: 3,
  motifDensity: 0.4,
  // A leap's least and greatest size (pool steps), and a run's most steps one way outside an ornament.
  leapSteps: 3,
  leapMost: 5,
  runMost: 4,
  // The figures it divides a held note into and approaches its cadence by (figure-space.js): its taste, a location in
  // the figure space (a named figure's, a blend's, or a range in each dimension: its player's, personality.js), or none --
  // every figure.
  figures: null,
  // A phrase's span from its floor to its apex (pool steps; a climax phrase's wider), and its widest range (semitones;
  // a climax phrase's a third more).
  span: Object.freeze([5, 8]),
  climaxSpan: Object.freeze([8, 11]),
  phraseRange: 14,
  // The silence after the cadence: a share of the bar's last group, at least a catch breath (s), at most a share of the
  // held tone, written on the group's half beats (the share among them nearest its own: a player's own share drawn,
  // personality.js). The comma after the idea and its repetition: a share of their last note, where it is long enough (s).
  restShare: 0.5,
  restDivisions: 2,
  restLeast: 0.4,
  restMostShare: 0.5,
  commaShare: 0.2,
  commaLeast: 0.3,
  // Where a phrase's cadence lands, a share of its span above its floor (the owner, 2 October 2026, of the endings
  // that always fall: "We must break the bots out of clichés while still allowing them to signify endings"): drawn each
  // phrase, the square of a uniform draw over this range, so most cadences still fall near the floor and some land high,
  // approached from below; the piece's last phrase closes on its tonic as before.
  landing: Object.freeze([0, 0.75]),
  // And how often a piece's last phrase is its motif's return, a share drawn from the motif within this range (ours);
  // and that return's cadence, its approach the motif's head as a cadence states it -- augmented (twice as slow) as
  // often as `augment`, and fragmented, cut to its first notes, by as much as `fragment` of it (a uniform draw: kept
  // whole to cut to a quarter) -- each drawn from the motif too (ours; the owner's "motivic signifiers of ending").
  recall: Object.freeze([0.3, 1]),
  recallCadence: Object.freeze({ augment: 0.5, fragment: 0.75 }),
  // How many settings of the phrase's segments the search keeps at each.
  beam: 12,
  // The motif's variations, phrase by phrase, in turn, where its player hears no form; and, where it does, how often a
  // phrase of a section that states its theme restates it (themes.js: its player's lean, personality.js `themes`).
  variations: Object.freeze(["statement", "sequence", "inversion", "return"]),
  restate: 0.5,
  // The motif's seed grammars (the memorable motifs report, §5.6: "deliberately varied seed classes"): free steps; an
  // arch to one peak; a shape circling its first note (anchor-centred); a rhythm on a repeated tone; a leap answered by
  // steps back; unequal (long-short) durations; a rest inside it as part of its signature. How many candidates a line's
  // slate holds.
  grammars: Object.freeze(["free", "arch", "anchor", "repeated", "leap", "asymmetric", "rest"]),
  slate: 4,
  // A phrase's swell (phraseSwell): its level from this share of its loudness at its ends to this at its apex, and where
  // in the phrase its apex may be.
  swell: Object.freeze([0.65, 1.25]),
  peak: Object.freeze([0.2, 0.9]),
  // Its rhythms on the rhythm engine (line-rhythm.js): its player's shares (personality.js playingOf: tuplets,
  // syncopation, length, meter, repeats, within), or none, its own rhythms as above.
  rhythm: null
});
var PHRASE_OFFSETS = Object.freeze([0, 1 / 2, 1 / 4, 3 / 4]);

// public/shared/performers/evidence.js
var EVIDENCE_STATUSES = Object.freeze(["measured", "mechanism-derived", "authored", "model-estimated", "simulated", "unknown"]);
var CERTIFYING = Object.freeze(["measured", "mechanism-derived"]);

// public/shared/performers/instrument-ranges.js
var freeze2 = (value3) => {
  if (value3 && typeof value3 === "object") {
    for (const child of Object.values(value3)) freeze2(child);
    Object.freeze(value3);
  }
  return value3;
};
var academy = (family, name) => `https://www.vsl.co.at/academy/${family}/${name}`;
var saxophones = "https://www.phys.unsw.edu.au/jw/reprints/ChenetalAA.pdf";
var timpaniManual = "https://usa.yamaha.com/files/download/other_assets/6/797756/TP8300R_TP7300R_TP6300R_TP4300R_owners_manual_EN_B0.pdf";
var record = (name, range, writtenToSounding, source2, extra = {}) => ({
  name,
  range,
  writtenToSounding,
  writtenRange: range?.map((p) => p - writtenToSounding) ?? null,
  basis: source2 ? "documented-compass" : "declared-configuration",
  sources: source2 ? [source2] : [],
  ...extra
});
var pitchRange = (pitches) => [Math.min(...pitches), Math.max(...pitches)];
var hzMidi = equationOf("hz-midi");
var midiOf = (hz) => +hzMidi({ hz, a4: constant("a4") }).toFixed(2);
var voicePart = (name, hz, register) => record(
  name,
  hz.map(midiOf),
  0,
  "https://doi.org/10.1590/S1516-80342007000100004",
  { basis: "measured", measuredExtremesHz: hz, register, note: "Measured extremes are choristers' phonetogram means; the register is authored." }
);
var BOWED_COMPASS = Object.freeze({ violin: "violin-standard", viola: "viola-standard", cello: "cello-standard", contrabass: "contrabass-four-string" });
var bowedRecord = (name, label2, page) => record(
  label2,
  value(name, "compass"),
  pathsOf(name).includes("writtenToSounding") ? value(name, "writtenToSounding") : 0,
  academy("strings", page),
  { strings: value(name, "tuning"), register: value(name, "register"), harmonicCeiling: value(name, "harmonicCeiling") }
);
var INSTRUMENT_RANGES = freeze2(withGivenBowed({
  "flute-b-foot": record(
    "Concert flute in C, B foot",
    [59, 98],
    0,
    academy("woodwinds", "concert-flute"),
    { register: [60, 96], extension: { high: [98, 101] }, configuration: { foot: "B" } }
  ),
  "flute-c-foot": record(
    "Concert flute in C, C foot",
    [60, 98],
    0,
    academy("woodwinds", "concert-flute"),
    { register: [60, 96], extension: { high: [98, 101] }, configuration: { foot: "C" } }
  ),
  "piccolo-c": record("Piccolo in C", [74, 108], 12, academy("woodwinds", "piccolo"), { register: [74, 108] }),
  "alto-flute-g": record(
    "Alto flute in G",
    [55, 91],
    -5,
    null,
    { register: [55, 91], note: "Declared three-octave model, written C4..C7; not a universal upper limit." }
  ),
  "oboe-conservatory": record(
    "Oboe with low B-flat",
    [58, 93],
    0,
    academy("woodwinds", "oboe"),
    { register: [60, 91], ordinaryRange: [58, 91], extension: { high: [91, 93] } }
  ),
  "clarinet-b-flat": record(
    "Clarinet in B-flat, written low E",
    [50, 94],
    -2,
    academy("woodwinds", "clarinet"),
    { register: [52, 89], orchestralRange: [50, 91] }
  ),
  "clarinet-a": record(
    "Clarinet in A, written low E",
    [49, 93],
    -3,
    academy("woodwinds", "clarinet"),
    { register: [51, 88], orchestralRange: [49, 90] }
  ),
  "clarinet-e-flat": record("Clarinet in E-flat, written low E", [55, 94], 3, academy("woodwinds", "e-flat-clarinet"), { register: [57, 89] }),
  "bass-clarinet-b-flat": record(
    "Bass clarinet in B-flat, to written E3",
    [38, 77],
    -14,
    academy("woodwinds", "bass-clarinet"),
    { register: [40, 72], note: "Its keys below written E3 (to low E-flat or C on many instruments) are not in this configuration." }
  ),
  "bassoon-standard": record(
    "Bassoon with low B-flat",
    [34, 77],
    0,
    academy("woodwinds", "bassoon"),
    { register: [36, 72], ordinaryRange: [34, 75], extension: { high: [75, 77] } }
  ),
  "english-horn-f": record(
    "English horn in F, with low B-flat",
    [51, 84],
    -7,
    academy("woodwinds", "english-horn"),
    { register: [53, 79], ordinaryRange: [52, 81], note: "Written B-flat 3 (sounding E-flat 3) on an instrument with the low B-flat key; written B3 without." }
  ),
  // (Written an octave over its sound, as VSL Academy's page has it, read 31 October 2026: "the sound is an octave lower
  // than written" -- its players' charts are written so: The Woodwind Fingering Guide's.)
  "contrabassoon-standard": record("Contrabassoon with low B-flat", [22, 58], -12, academy("woodwinds", "contrabassoon"), { register: [24, 53] }),
  // (The saxophones: written B-flat 3 to F6, F-sharp 6 on some -- "This range finishes (depending on the model) at written
  // F6 or F#6" -- their altissimo above it the player's, with the vocal tract (Chen, Smith & Wolfe 2009).)
  "soprano-saxophone-b-flat": record("Soprano saxophone in B-flat", [56, 87], -2, saxophones, { register: [58, 82], extension: { high: [87, 88] } }),
  "alto-saxophone-e-flat": record("Alto saxophone in E-flat", [49, 80], -9, saxophones, { register: [51, 75], extension: { high: [80, 81] } }),
  "tenor-saxophone-b-flat": record("Tenor saxophone in B-flat", [44, 75], -14, saxophones, { register: [46, 70], extension: { high: [75, 76] } }),
  "baritone-saxophone-e-flat": record("Baritone saxophone in E-flat, to written B-flat 3", [37, 68], -21, saxophones, { register: [39, 63], extension: { high: [68, 69] } }),
  "horn-f": record("Horn in F", [35, 77], -7, academy("brass", "horn-f"), { register: [43, 74] }),
  "trumpet-c": record(
    "Trumpet in C",
    [54, 89],
    0,
    academy("brass", "trumpet-c"),
    { register: [57, 82], ordinaryRange: [54, 84], extension: { high: [84, 89] } }
  ),
  "tenor-trombone": record(
    "Tenor trombone, without F attachment",
    [40, 77],
    0,
    academy("brass", "tenor-trombone"),
    { register: [42, 70], extension: { pedal: [28, 34] }, note: "Pedal E1..B-flat1 is separate: B1..E-flat2 is not filled in." }
  ),
  "bass-tuba-f": record(
    "Bass tuba in F",
    [26, 67],
    0,
    academy("brass", "bass-tuba"),
    { register: [30, 58], note: "Orchestral concert-pitch notation; lower pedals require a specified instrument/player." }
  ),
  "contrabass-tuba-b-flat": record(
    "Contrabass tuba in B-flat",
    [21, 59],
    0,
    academy("brass", "contrabass-tuba"),
    { register: [26, 55], note: "Orchestral concert-pitch notation, not brass-band transposition." }
  ),
  "violin-standard": bowedRecord("violin", "Violin, stopped notes", "violin"),
  "viola-standard": bowedRecord("viola", "Viola, stopped notes", "viola"),
  "cello-standard": bowedRecord("cello", "Cello, stopped notes", "cello"),
  "contrabass-four-string": bowedRecord("contrabass", "Contrabass, four strings, stopped notes", "double-bass"),
  "contrabass-five-string": bowedRecord("contrabass-five-string", "Contrabass, five strings, stopped notes", "double-bass"),
  "piano-88": record("Piano, 88 keys", [21, 108], 0, null, { keys: 88, note: "Declared A0..C8 keyboard; retuned manuals derive their sounding compass from the actual key map." }),
  "harpsichord-five-octave": record(
    "Harpsichord, five-octave 8-foot manual",
    [29, 89],
    0,
    null,
    { keys: 61, note: "Declared F1..F6 manual; historical compasses and 4-foot/16-foot stops need their own configuration." }
  ),
  "guitar-six-string-20-fret": record(
    "Guitar, six strings and 20 frets",
    [40, 84],
    -12,
    null,
    { strings: [40, 45, 50, 55, 59, 64], frets: 20, note: "Derived from this tuning and fret count. Other tunings, capos, frets and harmonics are separate configurations." }
  ),
  "harp-concert-47": record(
    "Double-action concert harp, 47 strings",
    [23, 104],
    0,
    academy("strings", "harp"),
    { lowest: { letter: "C", octave: 1 }, strings: 47, naturalRange: [24, 103], note: "C-flat1..G-sharp7 envelope. Actual pedal settings and string tuning determine availability." }
  ),
  "marimba-four-third": record("Marimba, 4 1/3 octaves", [45, 96], 0, academy("percussion", "marimba")),
  "marimba-five": record("Marimba, 5 octaves", [36, 96], 0, academy("percussion", "marimba")),
  "vibraphone-three": record("Vibraphone, 3 octaves", [53, 89], 0, academy("percussion", "vibraphone")),
  "vibraphone-three-half": record("Vibraphone, 3 1/2 octaves", [48, 89], 0, academy("percussion", "vibraphone")),
  "xylophone-three-half": record("Xylophone, 3 1/2 octaves", [65, 108], 12, academy("percussion", "xylophone")),
  "xylophone-four": record("Xylophone, 4 octaves", [60, 108], 12, academy("percussion", "xylophone")),
  "glockenspiel-g-c": record("Glockenspiel, G5..C8", [79, 108], 24, academy("percussion", "glockenspiel")),
  "glockenspiel-three": record("Glockenspiel, C5..C8", [72, 108], 24, academy("percussion", "glockenspiel")),
  "timpani-yamaha-32": record("Yamaha pedal timpani, 32 inches", [38, 46], 0, timpaniManual, { page: 22 }),
  "timpani-yamaha-29": record("Yamaha pedal timpani, 29 inches", [41, 49], 0, timpaniManual, { page: 22 }),
  "timpani-yamaha-26": record("Yamaha pedal timpani, 26 inches", [45, 53], 0, timpaniManual, { page: 22 }),
  "timpani-yamaha-23": record("Yamaha pedal timpani, 23 inches", [48, 56], 0, timpaniManual, { page: 22 }),
  "timpani-yamaha-20": record("Yamaha pedal timpani, 20 inches", [52, 60], 0, timpaniManual, { page: 22 }),
  "timpani-yamaha-four": record(
    "Yamaha pedal timpani, the common set of four (32, 29, 26 and 23 inches)",
    [38, 56],
    0,
    timpaniManual,
    {
      page: 22,
      drums: ["timpani-yamaha-32", "timpani-yamaha-29", "timpani-yamaha-26", "timpani-yamaha-23"],
      piccolo: "timpani-yamaha-20",
      note: "The envelope of its drums; each drum's own range is its record's."
    }
  ),
  "accordion-41-key": record(
    "Piano accordion, 41 keys, middle reed",
    [53, 93],
    0,
    "https://www.hohner.de/en/instruments/accordions/chromatic/bravo/bravo-iii-120",
    {
      note: "Treble keyboard compass. Its Stradella bass side has its own pitch maps (stradella, authored): each chord row's reeds within chordOctave, each bass button within bassOctave and the octave over it (bassOctaves).",
      stradella: { chordOctave: [51, 62], bassOctave: [40, 51], bassOctaves: [0, 12] }
    }
  ),
  // (Its pitches are its buttons': push the G chord's notes, pull the scale's others: the report's §11.5 fixture.)
  "accordion-bisonoric-g": record(
    "One-row diatonic button accordion in G (bisonoric)",
    pitchRange([[55, 57], [59, 60], [62, 64], [67, 66], [71, 69], [74, 72], [79, 76], [83, 78], [86, 81], [91, 84]].flat()),
    0,
    null,
    {
      buttons: [[55, 57], [59, 60], [62, 64], [67, 66], [71, 69], [74, 72], [79, 76], [83, 78], [86, 81], [91, 84]].map(([push, pull]) => ({ push, pull })),
      note: "An authored layout (the report's §11.5 fixture), its range its buttons' envelope; another button accordion is a configuration of its own."
    }
  ),
  "steelpan-tenor-29": record(
    "Tenor steelpan, 29 chromatic fields",
    [60, 88],
    0,
    null,
    { note: "Declared C4..E6 set, not a limit for all steelpans. A fixed or retuned field list controls actual pitches." }
  ),
  "kalimba-17-c": record(
    "Kalimba, 17 diatonic tines in C",
    [60, 88],
    0,
    null,
    { count: 17, base: 60, scale: [0, 2, 4, 5, 7, 9, 11], note: "Fixed model only. The default band-tuned instrument derives its range from its actual tines." }
  ),
  voice: record("Singing voice", null, 0, null, { basis: "performer-specific", note: "Use the individual singer configuration. Choral registers and population means are not universal physiological limits." }),
  // A choir's parts: each range what choristers of that voice measurably reach -- the means of the lowest and highest
  // notes in their phonetograms (Camargo, Barbosa & Teles 2007, "Características da fonetografia em coristas de
  // diferentes classificações vocais", Revista da Sociedade Brasileira de Fonoaudiologia 12(1),
  // doi:10.1590/S1516-80342007000100004; the alto's are the mezzo-sopranos' there) -- and each register the part's own,
  // chosen inside it as choral writing sets it (authored).
  "voice-soprano": voicePart("Choral soprano", [130, 1084], [60, 79]),
  "voice-alto": voicePart("Choral alto", [124, 878], [55, 74]),
  "voice-tenor": voicePart("Choral tenor", [85, 709], [48, 67]),
  "voice-bass": voicePart("Choral bass", [75, 513], [40, 60]),
  "voice-countertenor": record("Countertenor", null, 0, null, {
    basis: "performer-specific",
    register: [52, 72],
    note: "An authored usual register (E3..C5), used to choose formants between a tenor's and an alto's; no measured compass here."
  }),
  // A singer's breath model's voices: the range its registers are split in thirds over (voice.js singer; authored).
  "voice-high": record("High voice (sopranos, altos), for the breath model", null, 0, null, { basis: "performer-specific", register: [53, 81] }),
  "voice-low": record("Low voice (tenors, basses), for the breath model", null, 0, null, { basis: "performer-specific", register: [40, 67] }),
  // The dùndún: its pitch at rest the measured low tone (61.4 Hz), its squeeze's reach the measured high tone (17.9
  // semitones over the low), the mid tone 12.2 over it, on three drummers (Akinbo, S. 2019, "Representation of Yorùbá
  // tones by a talking drum: an acoustic analysis", Linguistique et langues africaines 5, doi:10.4000/lla.347).
  "talkingdrum-dundun": record(
    "Talking drum (dùndún), measured",
    [34.91, 52.81],
    0,
    "https://doi.org/10.4000/lla.347",
    {
      basis: "measured",
      relaxed: 34.91,
      span: 17.9,
      tones: { L: 0, M: 12.2, H: 17.9 },
      note: "Three drummers' measured tones. Another drum is a configuration of its own (its relaxed pitch and squeeze span)."
    }
  ),
  talkingdrum: record("Talking drum", null, 0, null, { basis: "configuration-dependent", note: "Use the configured relaxed pitch and squeeze span; the measured reference drum is not every talking drum." }),
  gong: record("Gong set", null, 0, null, { basis: "configuration-dependent", note: "Use each selected gong recording or model pitch, where definite; a tam-tam may have no definite pitch." }),
  percussion: record("Kit, battery, conga and shaker", null, 0, null, { basis: "unpitched", note: "Drum-map numbers are identities, not a chromatic sounding compass. Retunable drums use their configured acoustic/model limits." }),
  electronic: record("Electronic instrument", null, 0, null, { basis: "configuration-dependent", note: "Use the synth or sample-map configuration; MIDI address space is not a physical instrument range." })
}));
function withGivenBowed(ranges) {
  const of2 = (k) => Object.fromEntries(Object.entries(BOWED_COMPASS).map(([name, id]) => [name, k(ranges[id])]));
  const reach = of2((r) => r.range[1] - r.strings.at(-1)), low = of2((r) => r.register[0] - r.range[0]), high = of2((r) => r.range[1] - r.register[1]), ceiling = of2((r) => r.harmonicCeiling - r.range[1]);
  return { ...ranges, ...Object.fromEntries(GIVEN_BOWED.map((i) => {
    const top = i.opens.at(-1) + Math.round(bySize(reach, i.name, void 0, { linear: true })), range = [i.opens[0], top];
    return [i.name, record(`${i.name}, ${i.opens.length} strings, stopped notes`, range, 0, null, {
      basis: "derived",
      strings: [...i.opens],
      register: [range[0] + Math.round(bySize(low, i.name, void 0, { linear: true })), range[1] - Math.round(bySize(high, i.name, void 0, { linear: true }))],
      harmonicCeiling: range[1] + Math.round(bySize(ceiling, i.name, void 0, { linear: true })),
      note: `An instrument given as data (registry/objects/bowed.json${i.fictional ? ", fictional" : ""}): its compass, register and harmonics' ceiling read between the bowed instruments' by size.`
    })];
  })) };
}
var DEFAULT_INSTRUMENT_RANGES = freeze2({
  flute: "flute-b-foot",
  piccolo: "piccolo-c",
  alto: "alto-flute-g",
  "alto-flute": "alto-flute-g",
  oboe: "oboe-conservatory",
  clarinet: "clarinet-b-flat",
  bassoon: "bassoon-standard",
  "e-flat-clarinet": "clarinet-e-flat",
  "bass-clarinet": "bass-clarinet-b-flat",
  "english-horn": "english-horn-f",
  contrabassoon: "contrabassoon-standard",
  "soprano-saxophone": "soprano-saxophone-b-flat",
  "alto-saxophone": "alto-saxophone-e-flat",
  "tenor-saxophone": "tenor-saxophone-b-flat",
  "baritone-saxophone": "baritone-saxophone-e-flat",
  horn: "horn-f",
  trumpet: "trumpet-c",
  trombone: "tenor-trombone",
  tuba: "bass-tuba-f",
  violin: "violin-standard",
  viola: "viola-standard",
  cello: "cello-standard",
  contrabass: "contrabass-four-string",
  piano: "piano-88",
  harpsichord: "harpsichord-five-octave",
  guitar: "guitar-six-string-20-fret",
  harp: "harp-concert-47",
  marimba: "marimba-four-third",
  vibraphone: "vibraphone-three",
  xylophone: "xylophone-three-half",
  glockenspiel: "glockenspiel-g-c",
  accordion: "accordion-41-key",
  steelpan: "steelpan-tenor-29",
  kalimba: "kalimba-17-c",
  singer: "voice",
  talkingdrum: "talkingdrum-dundun",
  timpani: "timpani-yamaha-four",
  gong: "gong",
  kit: "percussion",
  battery: "percussion",
  conga: "percussion",
  shaker: "percussion",
  synth: "electronic"
});
var NAMED_BEFORE = freeze2({ bass: "contrabass", "double-bass": "contrabass" });
function instrumentRange(id) {
  const found = INSTRUMENT_RANGES[DEFAULT_INSTRUMENT_RANGES[id] ?? id];
  if (!found) throw new RangeError(`No instrument range configuration ${id}`);
  return found;
}

// public/shared/performers/voice.js
var VOICE = Object.freeze({
  // How long one breath lasts sung comfortably (mf, the middle of the voice), in seconds, by voice. Inferred: a sustained
  // vowel's maximum phonation time is 15-25 s for adult women and 25-35 s for men (Kent, Kent & Rosenbek 1987, "Maximum
  // performance tests of speech production", J. Speech Hear. Disord. 52), emptying the lungs; operatic singers phrase
  // from about 70-80% of vital capacity down to 30-50% (Thomasson & Sundberg 1997; 1999, J. Voice 13), about two fifths
  // of what a maximum phonation spends. Two fifths of those ranges: 6-10 s and 10-14 s; their middles here.
  phonationSeconds: Object.freeze({ high: 8, low: 12 }),
  // How far a phrase may run on into the reserve, as a share of a comfortable breath: demanding phrases go on down to
  // about 20% of vital capacity (Thomasson & Sundberg), some four sevenths again of the usual 35%. Inferred.
  reserve: 0.57,
  // How much faster a louder or a higher phrase spends its breath. Authored, to be measured for a singer: trained singers
  // vary loudness and airflow independently of each other (Sundberg's subglottal pressure studies), so no multiplier here
  // is anyone's but this profile's.
  dynamics: Object.freeze({ ppp: 0.6, pp: 0.7, p: 0.8, mp: 0.9, mf: 1, f: 1.3, ff: 1.6, fff: 1.9 }),
  registers: Object.freeze({ low: 1.1, middle: 1, high: 1.2 }),
  // The breaths a singer takes: a full one between phrases (0.7 s, the mean inspiration of seven professional classical
  // singers singing: Salomoni, van den Hoorn & Hodges 2016, PLOS ONE 11(5), e0155084; measured), refilling to a
  // comfortable breath; a catch breath in a phrase, shorter and shallower (authored).
  breaths: Object.freeze({ full: Object.freeze({ seconds: 0.7, refill: 1, evidence: "measured" }), catch: Object.freeze({ seconds: 0.35, refill: 0.5, evidence: "authored" }) }),
  // A breath may take at most this share of the note before it (authored).
  shortenShare: 0.5,
  // What a breath costs, by where it falls (authored): an action at all; in a rest nothing more; at a word's end a
  // little; inside a word more; inside a held vowel (a melisma) most; and a note shortened for it, by the share it loses.
  // Running on into the reserve costs by how deep.
  cost: Object.freeze({ breath: 0.1, rest: 0, word: 1, syllable: 4, melisma: 8, unmarked: 1, shorten: 2, reserve: 3 }),
  // Velocity bands for a note with no dynamic stated (the lower edges of mp..ff).
  velocityDynamics: Object.freeze([[0, "pp"], [0.25, "p"], [0.4, "mp"], [0.55, "mf"], [0.7, "f"], [0.85, "ff"]]),
  // Air levels closer than this are one state (the solver keeps the cheapest path to each).
  airGrain: 1e-3,
  maxStates: 8192
});

// public/shared/performers/wind-line.js
var wind = (instrument, family, phonationSeconds, [low, middle2, high]) => {
  const { register, range } = instrumentRange(instrument);
  return Object.freeze({ family, register, range, phonationSeconds, registers: Object.freeze({ low, middle: middle2, high }) });
};
var WIND_INSTRUMENTS = Object.freeze({
  flute: wind("flute", "flute", 6, [1.25, 1, 1.1]),
  piccolo: wind("piccolo", "flute", 7, [1.2, 1, 1.15]),
  alto: wind("alto", "flute", 4.5, [1.3, 1.05, 1.1]),
  oboe: wind("oboe", "reed", 9, [1.1, 1, 1.1]),
  clarinet: wind("clarinet", "reed", 10, [1, 1, 1.15]),
  bassoon: wind("bassoon", "reed", 8, [1.25, 1, 1.1]),
  // (The rest of the woodwinds, 11 October 2026: authored as the reeds' were, a larger bore's air spent sooner -- a
  // saxophone's wide cone sooner than a clarinet's cylinder -- each to be replaced by players' measured phrase lengths.)
  "e-flat-clarinet": wind("e-flat-clarinet", "reed", 10, [1, 1, 1.2]),
  "bass-clarinet": wind("bass-clarinet", "reed", 8, [1.2, 1, 1.15]),
  "english-horn": wind("english-horn", "reed", 8.5, [1.15, 1, 1.1]),
  contrabassoon: wind("contrabassoon", "reed", 6, [1.35, 1, 1.1]),
  "soprano-saxophone": wind("soprano-saxophone", "reed", 8, [1.15, 1, 1.2]),
  "alto-saxophone": wind("alto-saxophone", "reed", 8, [1.2, 1, 1.15]),
  "tenor-saxophone": wind("tenor-saxophone", "reed", 7, [1.25, 1, 1.15]),
  "baritone-saxophone": wind("baritone-saxophone", "reed", 6, [1.3, 1, 1.1]),
  horn: wind("horn", "brass", 8, [1.2, 1, 1.15]),
  trumpet: wind("trumpet", "brass", 9, [1.1, 1, 1.25]),
  trombone: wind("trombone", "brass", 7, [1.3, 1, 1.15]),
  tuba: wind("tuba", "brass", 5, [1.4, 1, 1.1])
});
var WIND_SLIDE = Object.freeze({
  flute: 3,
  piccolo: 2,
  alto: 3,
  oboe: 1,
  clarinet: 14,
  bassoon: 1,
  horn: 2,
  trumpet: 3,
  trombone: 6,
  tuba: 2,
  // (The rest of the woodwinds: an E-flat clarinet's lip glissando near its B-flat's, a bass clarinet's shorter; a
  // saxophone's lip bend about a whole tone; the English horn's and contrabassoon's the double reeds'. Ours, as above.)
  "e-flat-clarinet": 12,
  "bass-clarinet": 8,
  "english-horn": 1,
  contrabassoon: 1,
  "soprano-saxophone": 2,
  "alto-saxophone": 2,
  "tenor-saxophone": 2,
  "baritone-saxophone": 2
});
var WIND_SLIDE_SPEED = Object.freeze({
  flute: 10,
  piccolo: 10,
  alto: 10,
  oboe: 6,
  clarinet: 24,
  bassoon: 6,
  horn: 10,
  trumpet: 10,
  trombone: 30,
  tuba: 10,
  "e-flat-clarinet": 24,
  "bass-clarinet": 16,
  "english-horn": 6,
  contrabassoon: 6,
  "soprano-saxophone": 10,
  "alto-saxophone": 10,
  "tenor-saxophone": 10,
  "baritone-saxophone": 10
});
var MODEL_NAMES = Object.freeze({ alto: "alto-flute" });
var WIND_LINE = Object.freeze({
  ...LINE,
  // How much faster a dynamic spends the breath (authored), the loudest dynamic the low register plays and the softest
  // the high one does, and how far into the reserve a phrase may run.
  breathDynamics: Object.freeze({ ppp: 0.5, pp: 0.6, p: 0.75, mp: 0.88, mf: 1, f: 1.3, ff: 1.6, fff: 1.9 }),
  lowMost: "f",
  highLeast: "p",
  reserve: 0.5,
  // Below this much air a breath is taken at a silence of the phrase's own, where one fits.
  topUp: 0.7,
  // The rest a player makes for a catch breath in a run (s; the singer's catch breath, 0.35, and a margin).
  breathRest: 0.4,
  // How far a held note may give itself up to a breath when the phrase asks it (the planner's own share is a half).
  shortenMost: 0.8
});

// public/shared/performers/transitions.js
var TRANSITIONS = Object.freeze({
  // (A woodwind's key, open or shut: "The time taken for a key to open or close was typically 10 ms when pushed by a
  // finger or 16 ms when moved by a spring" -- A. Almeida, R. Chow, J. Smith & J. Wolfe 2009, "The kinetics and acoustics
  // of fingering and note transitions on the flute", JASA 126(3), 1521-1529, doi:10.1121/1.3179674. Its fingers' delays
  // between one another "typically tens of milliseconds", the more fingers the longer: a change's keys need not move
  // together.)
  key: Object.freeze({ least: 0.01, basis: "measured", source: "Almeida, Chow, Smith & Wolfe 2009, doi:10.1121/1.3179674: a key pushed by a finger 10 ms (a spring 16 ms)" }),
  keyBySpring: Object.freeze({ least: 0.016, basis: "measured", source: "Almeida, Chow, Smith & Wolfe 2009, doi:10.1121/1.3179674: a key moved by its spring 16 ms" }),
  // (A brass valve's piston pressed or let up: not found measured; a finger's push, as a key's.)
  valve: Object.freeze({ least: 0.01, basis: "provisional", source: "a woodwind key pushed by a finger (Almeida et al. 2009), until a valve is measured" }),
  // (The lips' tension and opening, and the frequency they buzz at, moving with a change: as the valve or key it goes with.)
  lips: Object.freeze({ least: 0.01, basis: "provisional", source: "the fingering change it goes with (key, valve)" }),
  // (A trombone's slide: not found measured; its change already under a legato tongue's dip.)
  slide: Object.freeze({ least: 0.02, basis: "provisional", source: "the slide moving under a legato tongue (breath.mjs), until measured" }),
  // (The breath rising at an attack, the tongue let go, or moving between two notes' pressures: the quickest the breath
  // rose when it was first written (render/synthesis/src/breath.mjs, 9 October 2026, which now reads it here), its source
  // untraced.)
  breathRise: Object.freeze({ least: 0.014, basis: "provisional", source: "the breath's quickest rise as first written (breath.mjs, 9 October 2026), untraced" }),
  // (The breath falling at a release: as first written there, untraced.)
  breathFall: Object.freeze({ least: 0.03, basis: "provisional", source: "the breath's quickest release as first written (breath.mjs, 9 October 2026), untraced" }),
  // (The tongue stopping the air before a tongued note, or dipping it in a legato tongue: as first written there,
  // untraced. Notes closer than it are let go after it.)
  tongueStop: Object.freeze({ least: 8e-3, basis: "provisional", source: "the tongue's stop as first written (breath.mjs, 9 October 2026), untraced" }),
  // (The tongue touching a reed and leaving it: its tip's motion, not found measured -- a few milliseconds, its corners
  // smoothed; the reed's own oscillation then grows as its physics has it.)
  tongueTouch: Object.freeze({ least: 5e-3, basis: "provisional", source: "openwind_worker.py TONGUE_TOUCH, its corners smoothed" }),
  tongueRelease: Object.freeze({ least: 5e-3, basis: "provisional", source: "openwind_worker.py TONGUE_RELEASE, its corners smoothed" }),
  // (The vocal tract's resonances moving -- the tongue's body and the jaw shaping it, as between vowels (native/openwind
  // src/tract.rs): not found measured for a wind player; as the breath's quickest release.)
  tract: Object.freeze({ least: 0.03, basis: "provisional", source: "the breath's quickest release (breathFall), until a player's tract is measured moving" }),
  // (A technique begun or ended within a note -- a hum, a growl, flutter tonguing, its noise: as a breath rises.)
  technique: Object.freeze({ least: 0.014, basis: "provisional", source: "the breath's rise (breathRise)" }),
  // (A pitch's own modulation crossing a note's edge -- a vibrato's factor, a glide: continuous, never a jump.)
  modulation: Object.freeze({ least: 0.01, basis: "provisional", source: "a finger's motion (key)" }),
  // (The bowed strings: the bow's force and its contact point changing, a string crossed, the bow lifted or set down, a
  // finger stopping or leaving a string. Not found measured as rise times here -- A. Askenfelt 1989, "Measurement of the
  // bowing parameters in violin playing. II: Bow-bridge distance, dynamic range, and limits of bow force", JASA 86(2),
  // doi:10.1121/1.398230, to read for them.)
  bowForce: Object.freeze({ least: 0.01, basis: "provisional", source: "a finger's motion (key), until bowing rise times are read (Askenfelt 1989)" }),
  bowContact: Object.freeze({ least: 0.01, basis: "provisional", source: "as bowForce" }),
  stringCrossing: Object.freeze({ least: 0.01, basis: "provisional", source: "as bowForce" }),
  bowLift: Object.freeze({ least: 0.01, basis: "provisional", source: "as bowForce" }),
  finger: Object.freeze({ least: 0.01, basis: "measured-analogue", source: "a finger pushing a flute key, 10 ms (Almeida, Chow, Smith & Wolfe 2009, doi:10.1121/1.3179674)" }),
  // (Anything else a model is given that changes: never under this.)
  any: Object.freeze({ least: 5e-3, basis: "provisional", source: "the least of any kind: no control steps" })
});
function transition(kind) {
  const t = TRANSITIONS[kind];
  if (!t) throw new Error(`transitions.js: no such kind of change: ${kind}`);
  return t;
}
var eased = (x) => {
  const c = Math.min(1, Math.max(0, x));
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
};

// render/synthesis/src/breath.mjs
var BREATH = Object.freeze({
  // (The tuning probe's breath rise, s: the standard a tone's speaking is measured against.)
  probeRise: 0.05,
  // (The quickest a breath rises or falls, s: transitions.js's, one definition for every engine.)
  leastRise: transition("breathRise").least,
  leastFall: transition("breathFall").least,
  // (A tongue's stop, s: the air cut before a tongued note, from the note before's end or this long before its onset,
  // whichever is earlier -- cut only at the note's end, the stop had been as short as the gap, two milliseconds where
  // none was, and Op. 3.35's tongued notes had dipped 1 to 3 dB, attacks the owner could not tell from notes going on --
  // its air falling over tongueFall (transitions.js tongueStop); a legato tongue's ("da", a trombone's slur across a change
  // of position): how long its dip and how far the air falls in it, as a share.)
  tongueStop: 0.035,
  tongueFall: transition("tongueStop").least,
  softSeconds: 0.03,
  softDip: 0.55,
  // (A slurred note this near the pitch it follows, cents: the same pitch, legato-tongued.)
  samePitch: 10,
  swell: 0.08,
  // (The least a tone speaks over its probe's thump, dB: Op. 3.34's booming tuba B2 was 24 under; a horn's G3 on its
  // own valves, a tone players hold, 19 over.)
  speaksDb: 14,
  // (A slur's change of fingering: eight periods of the lower note, within these bounds, s; and the breath's move between
  // its two notes' pressures, slower than the fingers, s. NESS's trumpet slurred from open to its first and second valves
  // burst 7 dB over its held tone in the high band at 12 ms, as a tongued attack, and 2.5 dB at 25 ms, dipping 4 dB
  // there; a breath held steady across it took 2.6 dB more off -- Op. 3.35's slurs had all sounded reattacked, the owner,
  // 10 October 2026: "I'm not hearing any slurred notes - all seem reattacked".)
  joinPeriods: 8,
  join: Object.freeze([0.02, 0.06]),
  slurBreath: 0.08,
  // (A rest at least this long, s, is a breath: the seat's catch breath (wind-seat.js BREATH.catch) less the release of the
  // note it is taken from (at most 80 ms) and a margin -- at the catch breath's whole length, a released note's rest fell
  // short of it and breath groups ran on through their breaths.)
  breathGap: WIND_LINE.breathRest - 0.05 - 0.1
});
var CHANGING = Object.freeze(["key", "valve", "lips", "slide", "technique", "modulation"]);
var ANTICIPATION = Object.freeze({ most: 0.3, share: 0.5, tolerance: 0.02, window: 0.045, reach: 0.3, margin: 0.01, step: 0.8, slope: 0.2 });
var ARRIVAL = Object.freeze({ cents: 50, db: 15, repeat: 20, back: 6, dip: 3, step: 5e-3, frames: 3, before: 0.5, after: 0.6 });

// public/shared/performers/brass-tongue.js
var TONGUE_OPENING = Object.freeze({
  rate: 25e-4,
  range: Object.freeze([2e-3, 3e-3]),
  unit: "m^2/s",
  basis: "measured",
  source: `K. L. Poort 1995, "Stop consonant production: an articulation and acoustic study", S.M. thesis, MIT: the voiceless alveolar stop's constriction opening at 20-30 cm^2/s over its first 10 ms, from its articulation and its burst (11-16 ms)`
});
var lipsAperture = (zeta, closing, { zc, rho }) => zeta * Math.sqrt(rho * closing / 2) / zc;
function releasedShare(t, aperture2, rate = TONGUE_OPENING.rate) {
  if (!(aperture2 > 0)) return 1;
  const x = Math.max(0, t) * rate / aperture2;
  return x * x / (1 + x * x);
}
var RELEASE_STEPS = Object.freeze([[0.25, 2], [0.5, 4], [1, 8]]);
function releaseCourse(aperture2, { rate = TONGUE_OPENING.rate, steps = RELEASE_STEPS } = {}) {
  const half = aperture2 > 0 ? aperture2 / rate : 0;
  if (!half) return [[0, 1]];
  const at2 = [];
  let x = 0;
  for (const [step, to] of steps) while (x + step <= to + 1e-9) at2.push(x += step);
  return at2.map((x2, k) => [half * x2, k === at2.length - 1 ? 1 : releasedShare(half * x2, aperture2, rate)]);
}
function tongueLetGo(aperture2, shut, release, rate = TONGUE_OPENING.rate) {
  const course = aperture2 > 0 ? releaseCourse(aperture2, { rate }) : [[release, 1]], end = course.at(-1)[0];
  const share = (since) => since >= end || !(aperture2 > 0) ? 1 : releasedShare(since, aperture2, rate);
  return { times: course.map((p) => p[0]), at: (since) => since <= 0 ? shut : shut + (1 - shut) * share(since) };
}

// public/shared/performers/drawn-curves.js
var POINTS = 64;
function curveAt(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let k = 1; k < points.length; k++) {
    const [a, y0] = points[k - 1], [b, y1, shape] = points[k];
    if (t < b) {
      const x = (t - a) / (b - a);
      return y0 + (y1 - y0) * (shape === "straight" ? x : eased(x));
    }
  }
  return points.at(-1)[1];
}
var fewestOf = (kind) => kind.from != null || kind.settled != null ? 2 : 1;
function curveOf(given2, kind) {
  const { least: least2 = 0, most = Infinity, longest = Infinity, from = null, settled = null, straight = true, points: count = POINTS } = kind;
  if (!Array.isArray(given2) || !given2.length || given2.length > count) throw new Error(`a curve is from 1 to ${count} points`);
  const points = given2.map((p) => {
    if (!Array.isArray(p) || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])) throw new Error("a curve's point is [t, y]");
    const t = Math.min(longest, Math.max(0, +p[0])), y = Math.min(most, Math.max(least2, +p[1]));
    return p[2] === "straight" && straight ? [t, y, "straight"] : [t, y];
  }).sort((a, b) => a[0] - b[0]);
  points[0] = [0, from ?? points[0][1]];
  for (let k = 1; k < points.length; k++) if (!(points[k][0] > points[k - 1][0])) throw new Error("a curve's points are each later than the one before");
  if (points.length < fewestOf(kind)) {
    if (from != null) throw new Error("a curve from a fixed start moves: two points at least");
    points[0] = [0, settled];
  } else if (settled != null) points[points.length - 1] = [points.at(-1)[0], settled, ...points.at(-1).slice(2)];
  return points;
}
function segmentLasting(points, k, seconds, longest = Infinity) {
  if (k < 1 || k >= points.length) return points;
  const shift = Math.min(longest - points.at(-1)[0], points[k - 1][0] + seconds - points[k][0]);
  return points.map((p, i) => i >= k ? [+(p[0] + shift).toFixed(6), ...p.slice(1)] : p);
}
var firstEndingAt = (points, seconds) => points.length < 2 ? points : segmentLasting(points, 1, seconds);

// public/shared/performers/attack-curves.js
var MOST2 = 4;
var LONGEST = 2;
var ATTACK = Object.freeze({ least: 0, most: MOST2, longest: LONGEST, from: null, settled: 1, straight: true, points: POINTS });
var attackKind = ({ from = null, straight = true } = {}) => Object.freeze({ ...ATTACK, from, straight });
var curveOf2 = (given2, { from = null, straight = true } = {}) => curveOf(given2, attackKind({ from, straight }));

// public/shared/performers/lungs.js
var LUNGS = Object.freeze({
  capacity: Object.freeze({ litres: 4.21, sd: 1.11, evidence: "measured" }),
  spent: Object.freeze({ share: (0.72 + 0.83) / 2, evidence: "measured" }),
  inhale: Object.freeze({ seconds: VOICE.breaths.full.seconds, evidence: "borrowed: a singer's full breath" })
});
var BREATH_LITRES = +(LUNGS.capacity.litres * LUNGS.spent.share).toFixed(2);
var Lungs = class {
  constructor({ litres = BREATH_LITRES, inhale = LUNGS.inhale.seconds } = {}) {
    this.litres = litres;
    this.inhale = inhale;
    this.air = litres;
    this.taking = false;
  }
  // How long the air left lasts at `flow` L/s (s).
  secondsLeft(flow) {
    return flow > 0 ? Math.max(0, this.air) / flow : Infinity;
  }
  // `seconds` at `flow` L/s spent. -> whether it is spent.
  spend(flow, seconds) {
    if (flow > 0) this.air -= flow * seconds;
    return this.air <= 0;
  }
  // A breath begun or ended: taken in, the lungs full again.
  breathe() {
    this.taking = true;
  }
  filled() {
    this.taking = false;
    this.air = this.litres;
  }
  // Another breath's depth or time, the air left no more than it.
  set({ litres = this.litres, inhale = this.inhale } = {}) {
    this.litres = litres;
    this.inhale = inhale;
    this.air = Math.min(this.air, litres);
  }
};
var PLAYERS_AIRFLOW = Object.freeze({
  oboe: [{ midi: 58, pp: [0.061, 23], ff: [0.102, 33] }, { midi: 81, pp: [0.047, 55], ff: [0.058, 80] }],
  "english-horn": [{ midi: 57, pp: [0.09, 15.4], ff: [0.097, 22.7] }, { midi: 81, pp: [0.08, 18.5], ff: [0.074, 45.7] }],
  bassoon: [{ midi: 34, pp: [0.15, 44], ff: [0.81, 38.5] }],
  flute: [{ midi: 60, pp: [0.13, 5], ff: [0.56, 10.7] }, { midi: 93, pp: [0.1, 21], ff: [0.62, 29] }],
  trumpet: [{ midi: 81, pp: [0.15, 33], ff: [0.49, 110] }],
  tuba: [{ midi: 33, pp: [0.23, 2.4], ff: [1.57, 11.6] }, { midi: 57, pp: [0.14, 12.4], ff: [1.72, 74] }]
});
var BORROWED_AIRFLOW = Object.freeze({
  piccolo: ["flute"],
  "alto-flute": ["flute"],
  contrabassoon: ["bassoon"],
  clarinet: ["oboe", "english-horn", "bassoon"],
  "e-flat-clarinet": ["oboe", "english-horn", "bassoon"],
  "bass-clarinet": ["oboe", "english-horn", "bassoon"],
  "soprano-saxophone": ["oboe", "english-horn", "bassoon"],
  "alto-saxophone": ["oboe", "english-horn", "bassoon"],
  "tenor-saxophone": ["oboe", "english-horn", "bassoon"],
  "baritone-saxophone": ["oboe", "english-horn", "bassoon"],
  horn: ["trumpet", "tuba"],
  trombone: ["trumpet", "tuba"]
});
var ALIASES = { alto: "alto-flute" };
var MARKS2 = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"];
var PP = MARKS2.indexOf("pp");
var FF = MARKS2.indexOf("ff");
function measuredFlow(notes, dynamic, midi) {
  const k = MARKS2.indexOf(dynamic);
  if (k < 0) throw new RangeError(`a dynamic from ${MARKS2[0]} to ${MARKS2.at(-1)}`);
  const at2 = (n) => n.pp[0] * (n.ff[0] / n.pp[0]) ** ((k - PP) / (FF - PP));
  if (notes.length === 1 || midi <= notes[0].midi) return at2(notes[0]);
  if (midi >= notes.at(-1).midi) return at2(notes.at(-1));
  const j = notes.findIndex((n) => n.midi >= midi), a = notes[j - 1], b = notes[j], x = (midi - a.midi) / (b.midi - a.midi);
  return at2(a) ** (1 - x) * at2(b) ** x;
}
function airflow(model) {
  const id = ALIASES[model] ?? model;
  if (PLAYERS_AIRFLOW[id]) return {
    source: { evidence: "measured", from: [id] },
    of: ({ dynamic, midi, share = 1 }) => share * measuredFlow(PLAYERS_AIRFLOW[id], dynamic, midi)
  };
  const from = BORROWED_AIRFLOW[id];
  if (!from) throw new RangeError(`no airflow for ${model}`);
  return {
    source: { evidence: "borrowed", from: [...from] },
    of: ({ dynamic, midi, share = 1 }) => share * Math.exp(from.reduce((s, m) => s + Math.log(measuredFlow(PLAYERS_AIRFLOW[m], dynamic, midi)), 0) / from.length)
  };
}

// public/shared/performers/wind-multiphonics.json
var wind_multiphonics_default = {
  schema: "musebots.wind-multiphonics/1",
  from: "public/shared/performers/openwind-<instrument>.json (scripts/wind-multiphonics.mjs)",
  instruments: {
    clarinet: [],
    oboe: [],
    bassoon: [],
    flute: [],
    "alto-flute": [],
    piccolo: [],
    "e-flat-clarinet": [],
    "bass-clarinet": [],
    "english-horn": [],
    contrabassoon: [],
    "soprano-saxophone": [],
    "alto-saxophone": [],
    "tenor-saxophone": [],
    "baritone-saxophone": []
  }
};

// public/shared/performers/techniques.js
var EXTENDED_TECHNIQUES = Object.freeze(["pressure", "contact", "harmonic", "multiphonic", "hum", "growl", "flutter", "mute"]);
var PRESSURE_WORDS = Object.freeze([[0.75, "overpressure"], [0.35, "molto pressione"], [-0.35, null], [-Infinity, "flaut."]]);
var HUMMED = Object.freeze([instrumentRange("voice-low").register[0], instrumentRange("voice-high").register[1]]);
var MULTIPHONIC_WORD = "mult.";
var measuredOf = (instrument, measured3) => Object.freeze((measured3 ?? []).map((m) => Object.freeze({
  id: m.id,
  pitches: Object.freeze(m.peaks.map((hz) => +(69 + 12 * Math.log2(hz / 440)).toFixed(4)).sort((a, b) => a - b)),
  diagram: Object.freeze({ instrument, keys: m.keys })
})));
var WIND_MULTIPHONICS = Object.freeze(Object.fromEntries(Object.entries(wind_multiphonics_default.instruments).map(([instrument, measured3]) => [instrument, measuredOf(instrument, measured3)])));
var FLUTTER_HZ = Object.freeze([28, 33]);
var WIND_TECHNIQUE_WORDS = Object.freeze({ hum: "hum", growl: "growl", flutter: "flz.", mute: null, multiphonic: MULTIPHONIC_WORD });
var MUTE_WORDS = Object.freeze({
  straight: "con sord. (straight)",
  cup: "con sord. (cup)",
  "harmon-stem-in": "harmon mute (stem in)",
  "harmon-stem-out": "harmon mute (stem out)",
  stopped: "stopped (+)",
  off: "senza sord."
});
var MUTES_OF = Object.freeze({
  trumpet: Object.freeze(["straight", "cup", "harmon-stem-in", "harmon-stem-out"]),
  trombone: Object.freeze(["straight", "cup", "harmon-stem-in", "harmon-stem-out"]),
  horn: Object.freeze(["straight", "stopped"]),
  tuba: Object.freeze(["straight"])
});
function windTechniqueAt(technique, pitch, { pool = [], voice = HUMMED, mute = null } = {}) {
  const muted = mute ? { mute: { kind: mute } } : {};
  if (!technique) return mute ? muted : null;
  if (technique.kind === "flutter") return { flutter: { hz: technique.hz, depth: technique.depth }, ...muted };
  let sung = pitch + technique.interval;
  while (sung < voice[0]) sung += 12;
  while (sung > voice[1]) sung -= 12;
  const near = pool.flatMap((p) => [-24, -12, 0, 12, 24].map((o) => {
    const c = (p % 12 + 12) % 12;
    return Math.floor(sung / 12) * 12 + c + o;
  })).filter((p) => Math.abs(p - sung) <= 1.5).sort((a, b) => Math.abs(a - sung) - Math.abs(b - sung))[0];
  const hz = +(440 * 2 ** (((near ?? sung) - 69) / 12)).toFixed(3);
  return { ...technique.kind === "hum" ? { hum: { hz, level: technique.level } } : { growl: { hz, level: technique.level, rough: technique.rough } }, ...muted };
}

// public/shared/performers/vocal-tract-space.json
var vocal_tract_space_default = {
  schema: "musebots.vocal-tract-space/1",
  about: "The vocal tract's shapes as a space, and clarinettists' tract over it in normal playing and bending: baked by scripts/build-vocal-tract-space.mjs from Story 2008 (doi:10.1121/1.2805683, Table I) and Chen, Smith & Wolfe 2009 (doi:10.1121/1.3177269); never edited by hand.",
  space: {
    slice: 398182e-8,
    narrowest: 2e-3,
    mean: [
      682562e-8,
      701316e-8,
      73937e-7,
      820137e-8,
      980321e-8,
      0.0118585,
      0.0132461,
      0.0131441,
      0.0119637,
      0.010877,
      0.010721,
      0.0112871,
      0.0118154,
      0.0122577,
      0.0127781,
      0.0131557,
      0.0134105,
      0.0136724,
      0.0138382,
      0.0135696,
      0.0131867,
      0.0133485,
      0.0138404,
      0.0139618,
      0.0137847,
      0.0135986,
      0.0136608,
      0.0142434,
      0.0153946,
      0.0167353,
      0.0180177,
      0.0192634,
      0.0204236,
      0.0213301,
      0.0219444,
      0.0222347,
      0.0221152,
      0.0212815,
      0.0196145,
      0.0174393,
      0.0151251,
      0.0134128,
      0.0126324,
      0.0120319
    ],
    modes: [
      [
        -325461e-8,
        860174e-8,
        0.0166497,
        0.0197962,
        0.0131959,
        -449119e-8,
        -0.0349821,
        -0.0664761,
        -0.0779976,
        -0.0751289,
        -0.0816898,
        -0.103577,
        -0.136755,
        -0.169908,
        -0.189851,
        -0.1961,
        -0.196508,
        -0.195262,
        -0.188229,
        -0.178944,
        -0.167498,
        -0.134171,
        -0.0790312,
        -0.0267457,
        0.0148321,
        0.0518364,
        0.0885548,
        0.125393,
        0.160465,
        0.192509,
        0.221303,
        0.244644,
        0.257273,
        0.261952,
        0.260203,
        0.251677,
        0.235678,
        0.214484,
        0.188838,
        0.150598,
        0.102588,
        0.0675618,
        0.0552619,
        0.0548142
      ],
      [
        -0.0134757,
        -0.0254734,
        -0.0413729,
        -0.0478771,
        -0.073033,
        -0.114066,
        -0.121857,
        -0.0917489,
        -0.0688011,
        -0.0742452,
        -0.12005,
        -0.175636,
        -0.19007,
        -0.15618,
        -0.0959171,
        -0.0325192,
        0.017831,
        0.0554604,
        0.0807467,
        0.101214,
        0.118583,
        0.139116,
        0.16881,
        0.2059,
        0.236207,
        0.255088,
        0.264494,
        0.24988,
        0.207584,
        0.161107,
        0.123262,
        0.0773626,
        0.0130525,
        -0.0519226,
        -0.107006,
        -0.167586,
        -0.224471,
        -0.243294,
        -0.204737,
        -0.112845,
        0.0149832,
        0.154219,
        0.244691,
        0.262313
      ],
      [
        0.0647221,
        0.116831,
        0.131791,
        0.134429,
        0.170028,
        0.232883,
        0.255677,
        0.222541,
        0.190438,
        0.207016,
        0.243942,
        0.273462,
        0.281292,
        0.240332,
        0.173144,
        0.120988,
        0.0861204,
        0.0657658,
        0.0551528,
        0.0591545,
        0.0650127,
        0.0706812,
        0.0899619,
        0.1218,
        0.137423,
        0.135421,
        0.146778,
        0.180167,
        0.214991,
        0.230399,
        0.208542,
        0.165832,
        0.134196,
        0.105442,
        0.0715087,
        0.0538295,
        0.0467193,
        0.0177727,
        -0.0239862,
        -0.0302858,
        544556e-8,
        0.0239911,
        886739e-8,
        -398397e-10
      ],
      [
        0.0619994,
        0.0160428,
        -957454e-8,
        -0.0129914,
        -668884e-8,
        0.0105721,
        0.0274847,
        0.0253235,
        0.0110076,
        751433e-8,
        0.0158644,
        0.0346992,
        0.0449363,
        0.0510072,
        0.0546589,
        0.0648549,
        0.0791229,
        0.100449,
        0.122074,
        0.130562,
        0.128091,
        0.099783,
        0.0514164,
        766738e-8,
        -0.0267756,
        -0.0532168,
        -0.0777904,
        -0.0993227,
        -0.110196,
        -0.110096,
        -0.10959,
        -0.0957877,
        -0.0613108,
        -0.0238381,
        0.0126792,
        0.0745135,
        0.143025,
        0.205528,
        0.265102,
        0.297691,
        0.315926,
        0.358979,
        0.410637,
        0.457626
      ]
    ],
    variances: [
      0.7433,
      0.1467,
      0.05769,
      0.03828
    ],
    span: [
      [
        -0.057338,
        0.0498515
      ],
      [
        -0.0299411,
        0.0201988
      ],
      [
        -0.0118394,
        0.019748
      ],
      [
        -0.011258,
        0.0161225
      ]
    ],
    widest: [
      844402e-8,
      888487e-8,
      9167e-6,
      996557e-8,
      0.0129149,
      0.0171127,
      0.020498,
      0.0213797,
      0.020248,
      0.0190826,
      0.0195441,
      0.0214392,
      0.0236422,
      0.0251049,
      0.0256567,
      0.0256318,
      0.0256815,
      0.025879,
      0.025731,
      0.0252817,
      0.0244887,
      0.0229314,
      0.0208979,
      0.0189823,
      0.0211703,
      0.0227921,
      0.0245666,
      0.0267262,
      0.0289886,
      0.0311277,
      0.0328589,
      0.033964,
      0.0343924,
      0.0349433,
      0.0346322,
      0.0334351,
      0.0331098,
      0.0326451,
      0.0293379,
      0.0255572,
      0.0240692,
      0.0239897,
      0.0244887,
      0.0245147
    ],
    locations: {
      i: [
        -0.057338,
        693801e-8,
        0.019748,
        -793449e-9
      ],
      ɪ: [
        -0.0429019,
        0.0108507,
        -747254e-8,
        -564767e-8
      ],
      e: [
        -0.0332669,
        327933e-8,
        -557338e-8,
        11387e-7
      ],
      ε: [
        -0.0171766,
        9782e-6,
        -0.0112933,
        -597544e-8
      ],
      æ: [
        358393e-9,
        0.0112822,
        -0.0118394,
        0.0161225
      ],
      ʌ: [
        0.0312991,
        528175e-8,
        109143e-8,
        -0.011258
      ],
      ɑ: [
        0.0498515,
        0.0201988,
        0.0120859,
        0.010728
      ],
      ɔ: [
        0.0478849,
        509129e-8,
        406051e-8,
        -0.0103569
      ],
      o: [
        0.0257987,
        -0.0205054,
        -520782e-8,
        286901e-9
      ],
      ʊ: [
        0.0148818,
        -0.0222576,
        -510127e-8,
        173242e-8
      ],
      u: [
        -0.0193911,
        -0.0299411,
        950189e-8,
        402298e-8
      ]
    },
    airway: {
      glottis: {
        area: 15e-6,
        thickness: 3e-3,
        resistance: 34e5
      },
      trachea: 9e-3,
      insertion: 0.01,
      piston: 39e-4
    },
    fitted: {
      "airway.glottis.resistance": {
        range: [
          1e6,
          34e5
        ],
        first: 249,
        to: "the middle shape's first resonance at the middle of the first peaks Fritz & Wolfe 2005 measured, 220-280 Hz"
      }
    }
  },
  normal: {
    peak: 9e6,
    lowest: 600,
    reach: 1675,
    rows: [
      {
        target: 600,
        reached: true,
        coords: [
          -0.0331564,
          -34939e-7,
          -586505e-8,
          0.0290304
        ],
        second: {
          frequency: 600,
          peak: 9e6,
          q: 5.137
        },
        resonances: [
          {
            frequency: 243.47,
            q: 0.8972,
            peak: 4346e3
          },
          {
            frequency: 578.94,
            q: 5.946,
            peak: 7512e3
          }
        ],
        misfit: 0.0358
      },
      {
        target: 625,
        reached: true,
        coords: [
          -0.0271232,
          -0.0164399,
          -719731e-8,
          0.0123754
        ],
        second: {
          frequency: 625,
          peak: 9e6,
          q: 4.118
        },
        resonances: [
          {
            frequency: 263.35,
            q: 0.8371,
            peak: 5036e3
          },
          {
            frequency: 594.64,
            q: 5.141,
            peak: 6865e3
          },
          {
            frequency: 3237.5,
            q: 100,
            peak: 863200
          }
        ],
        misfit: 0.0483
      },
      {
        target: 650,
        reached: true,
        coords: [
          -0.0269966,
          -0.0156958,
          -566549e-8,
          0.0132388
        ],
        second: {
          frequency: 650,
          peak: 9e6,
          q: 4.527
        },
        resonances: [
          {
            frequency: 255.65,
            q: 0.8072,
            peak: 4687e3
          },
          {
            frequency: 622.55,
            q: 5.395,
            peak: 7223e3
          },
          {
            frequency: 3243.4,
            q: 4.145,
            peak: 715600
          }
        ],
        misfit: 0.0422
      },
      {
        target: 675,
        reached: true,
        coords: [
          -0.0266617,
          -0.0151458,
          -476091e-8,
          0.0132253
        ],
        second: {
          frequency: 675,
          peak: 9e6,
          q: 4.84
        },
        resonances: [
          {
            frequency: 248.9,
            q: 0.8195,
            peak: 4495e3
          },
          {
            frequency: 649.25,
            q: 5.213,
            peak: 7251e3
          },
          {
            frequency: 3244.8,
            q: 4.154,
            peak: 13450
          }
        ],
        misfit: 0.0429
      },
      {
        target: 700,
        reached: true,
        coords: [
          -0.0289142,
          -627801e-8,
          -535865e-8,
          0.0218921
        ],
        second: {
          frequency: 700,
          peak: 9e6,
          q: 5.765
        },
        resonances: [
          {
            frequency: 239.63,
            q: 0.8419,
            peak: 4212e3
          },
          {
            frequency: 680.28,
            q: 6.434,
            peak: 7901e3
          },
          {
            frequency: 3174.2,
            q: 3.939,
            peak: 327600
          }
        ],
        misfit: 0.0336
      },
      {
        target: 725,
        reached: true,
        coords: [
          -0.0281711,
          -43389e-7,
          -754385e-8,
          0.0212551
        ],
        second: {
          frequency: 725,
          peak: 9e6,
          q: 6.054
        },
        resonances: [
          {
            frequency: 240.98,
            q: 0.8587,
            peak: 4365e3
          },
          {
            frequency: 706.1,
            q: 6.779,
            peak: 7973e3
          },
          {
            frequency: 3182.7,
            q: 4.024,
            peak: 327600
          }
        ],
        misfit: 0.0336
      },
      {
        target: 750,
        reached: true,
        coords: [
          -0.027759,
          -334873e-8,
          -676073e-8,
          0.0214488
        ],
        second: {
          frequency: 750,
          peak: 9e6,
          q: 6.358
        },
        resonances: [
          {
            frequency: 237.62,
            q: 0.8635,
            peak: 425e4
          },
          {
            frequency: 732.52,
            q: 7.031,
            peak: 8126e3
          },
          {
            frequency: 3192,
            q: 3.932,
            peak: 327700
          }
        ],
        misfit: 0.0322
      },
      {
        target: 775,
        reached: true,
        coords: [
          -0.0272998,
          -235247e-8,
          -600972e-8,
          0.0215755
        ],
        second: {
          frequency: 775,
          peak: 9e6,
          q: 6.661
        },
        resonances: [
          {
            frequency: 234.72,
            q: 0.8704,
            peak: 4157e3
          },
          {
            frequency: 758.77,
            q: 7.277,
            peak: 8243e3
          },
          {
            frequency: 3188.9,
            q: 3.698,
            peak: 313600
          }
        ],
        misfit: 0.0311
      },
      {
        target: 800,
        reached: true,
        coords: [
          -0.026802,
          -118486e-8,
          -541608e-8,
          0.0217323
        ],
        second: {
          frequency: 800,
          peak: 9e6,
          q: 6.973
        },
        resonances: [
          {
            frequency: 232.3,
            q: 0.8801,
            peak: 4087e3
          },
          {
            frequency: 784.93,
            q: 7.535,
            peak: 8331e3
          },
          {
            frequency: 3180.4,
            q: 3.405,
            peak: 295200
          }
        ],
        misfit: 0.0301
      },
      {
        target: 825,
        reached: true,
        coords: [
          -0.0262974,
          -442715e-12,
          -471675e-8,
          0.0218965
        ],
        second: {
          frequency: 825,
          peak: 9e6,
          q: 7.277
        },
        resonances: [
          {
            frequency: 230,
            q: 0.8903,
            peak: 4018e3
          },
          {
            frequency: 810.98,
            q: 7.784,
            peak: 84e5
          },
          {
            frequency: 3166.9,
            q: 3.081,
            peak: 279700
          }
        ],
        misfit: 0.0292
      },
      {
        target: 850,
        reached: true,
        coords: [
          -0.0257738,
          134969e-8,
          -416487e-8,
          0.0220691
        ],
        second: {
          frequency: 850,
          peak: 9e6,
          q: 7.595
        },
        resonances: [
          {
            frequency: 228.1,
            q: 0.902,
            peak: 3967e3
          },
          {
            frequency: 836.9,
            q: 8.046,
            peak: 8465e3
          },
          {
            frequency: 3153.5,
            q: 2.822,
            peak: 275100
          }
        ],
        misfit: 0.0285
      },
      {
        target: 875,
        reached: true,
        coords: [
          -0.0252454,
          234676e-8,
          -343044e-8,
          0.0218987
        ],
        second: {
          frequency: 875,
          peak: 9e6,
          q: 7.792
        },
        resonances: [
          {
            frequency: 226.42,
            q: 0.9094,
            peak: 3916e3
          },
          {
            frequency: 862.68,
            q: 8.26,
            peak: 8548e3
          },
          {
            frequency: 3139,
            q: 2.619,
            peak: 289600
          }
        ],
        misfit: 0.0279
      },
      {
        target: 900,
        reached: true,
        coords: [
          -0.0246923,
          361122e-8,
          -293886e-8,
          0.0217665
        ],
        second: {
          frequency: 900,
          peak: 9e6,
          q: 7.969
        },
        resonances: [
          {
            frequency: 225.11,
            q: 0.9189,
            peak: 3884e3
          },
          {
            frequency: 888.82,
            q: 8.505,
            peak: 8642e3
          },
          {
            frequency: 3121.3,
            q: 2.471,
            peak: 309700
          }
        ],
        misfit: 0.0274
      },
      {
        target: 925,
        reached: true,
        coords: [
          -0.0239755,
          477213e-8,
          -246738e-8,
          0.0216162
        ],
        second: {
          frequency: 925,
          peak: 9e6,
          q: 8.29
        },
        resonances: [
          {
            frequency: 224.03,
            q: 0.9358,
            peak: 3846e3
          },
          {
            frequency: 914.48,
            q: 8.738,
            peak: 8617e3
          },
          {
            frequency: 3104.8,
            q: 100,
            peak: 289100
          }
        ],
        misfit: 0.0279
      },
      {
        target: 950,
        reached: true,
        coords: [
          -0.0233586,
          615575e-8,
          -208792e-8,
          0.0214708
        ],
        second: {
          frequency: 950,
          peak: 9e6,
          q: 8.48
        },
        resonances: [
          {
            frequency: 223,
            q: 0.9268,
            peak: 3839e3
          },
          {
            frequency: 940.08,
            q: 8.839,
            peak: 8704e3
          },
          {
            frequency: 2409.6,
            q: 17.76,
            peak: 283600
          },
          {
            frequency: 3467.9,
            q: 32.25,
            peak: 6153e3
          }
        ],
        misfit: 0.0254
      },
      {
        target: 975,
        reached: true,
        coords: [
          -0.0199342,
          -0.0148528,
          447442e-8,
          -549426e-8
        ],
        second: {
          frequency: 975,
          peak: 9e6,
          q: 6.782
        },
        resonances: [
          {
            frequency: 228.25,
            q: 0.8518,
            peak: 3768e3
          },
          {
            frequency: 962.58,
            q: 7.479,
            peak: 8478e3
          },
          {
            frequency: 2601,
            q: 16.13,
            peak: 1341e3
          }
        ],
        misfit: 0.0601
      },
      {
        target: 1e3,
        reached: true,
        coords: [
          -0.0196865,
          -0.0137655,
          5183e-6,
          -591624e-8
        ],
        second: {
          frequency: 1e3,
          peak: 9e6,
          q: 6.953
        },
        resonances: [
          {
            frequency: 226.8,
            q: 0.8674,
            peak: 3735e3
          },
          {
            frequency: 988.69,
            q: 7.662,
            peak: 8507e3
          },
          {
            frequency: 2591.9,
            q: 16.87,
            peak: 1638e3
          }
        ],
        misfit: 0.0616
      },
      {
        target: 1025,
        reached: true,
        coords: [
          -0.0194893,
          -0.012608,
          588455e-8,
          -637068e-8
        ],
        second: {
          frequency: 1025,
          peak: 9e6,
          q: 7.065
        },
        resonances: [
          {
            frequency: 225.49,
            q: 0.8838,
            peak: 3704e3
          },
          {
            frequency: 1015.3,
            q: 7.851,
            peak: 855e4
          },
          {
            frequency: 2583.7,
            q: 17.36,
            peak: 1988e3
          }
        ],
        misfit: 0.0636
      },
      {
        target: 1050,
        reached: true,
        coords: [
          -0.0186867,
          -42292e-7,
          -670709e-8,
          30955e-7
        ],
        second: {
          frequency: 1050,
          peak: 9e6,
          q: 7.714
        },
        resonances: [
          {
            frequency: 239.24,
            q: 0.8745,
            peak: 4447e3
          },
          {
            frequency: 1038.1,
            q: 8.547,
            peak: 8547e3
          },
          {
            frequency: 2473.7,
            q: 26.04,
            peak: 715400
          }
        ],
        misfit: 0.0457
      },
      {
        target: 1075,
        reached: true,
        coords: [
          -0.0194654,
          -483162e-8,
          483483e-8,
          251126e-8
        ],
        second: {
          frequency: 1075,
          peak: 9e6,
          q: 7.597
        },
        resonances: [
          {
            frequency: 222.31,
            q: 0.8962,
            peak: 3702e3
          },
          {
            frequency: 1066.3,
            q: 8.212,
            peak: 8643e3
          },
          {
            frequency: 2464.1,
            q: 19.57,
            peak: 1854e3
          }
        ],
        misfit: 0.0457
      },
      {
        target: 1100,
        reached: true,
        coords: [
          -0.0175377,
          583305e-8,
          -639854e-8,
          0.011789
        ],
        second: {
          frequency: 1100,
          peak: 9e6,
          q: 8.99
        },
        resonances: [
          {
            frequency: 230.9,
            q: 0.9329,
            peak: 4332e3
          },
          {
            frequency: 1092.4,
            q: 9.508,
            peak: 8837e3
          },
          {
            frequency: 2383.8,
            q: 14.02,
            peak: 685500
          },
          {
            frequency: 3390.3,
            q: 33.91,
            peak: 1083e4
          }
        ],
        misfit: 0.0297
      },
      {
        target: 1125,
        reached: true,
        coords: [
          -0.018985,
          636207e-8,
          399937e-8,
          0.011755
        ],
        second: {
          frequency: 1125,
          peak: 9e6,
          q: 8.475
        },
        resonances: [
          {
            frequency: 218.52,
            q: 0.9067,
            peak: 3684e3
          },
          {
            frequency: 1118.6,
            q: 8.621,
            peak: 8795e3
          },
          {
            frequency: 2333.4,
            q: 12.89,
            peak: 1479e3
          },
          {
            frequency: 3292.3,
            q: 29.44,
            peak: 9045e3
          }
        ],
        misfit: 0.0235
      },
      {
        target: 1150,
        reached: true,
        coords: [
          -0.0170396,
          -502266e-8,
          -598975e-8,
          -631892e-8
        ],
        second: {
          frequency: 1150,
          peak: 9e6,
          q: 7.778
        },
        resonances: [
          {
            frequency: 242.61,
            q: 0.8907,
            peak: 4519e3
          },
          {
            frequency: 1142.5,
            q: 8.893,
            peak: 8561e3
          },
          {
            frequency: 2499.3,
            q: 18.95,
            peak: 1848e3
          }
        ],
        misfit: 0.0658
      },
      {
        target: 1175,
        reached: true,
        coords: [
          -0.0167466,
          -409171e-8,
          -586757e-8,
          -699564e-8
        ],
        second: {
          frequency: 1175,
          peak: 9e6,
          q: 7.796
        },
        resonances: [
          {
            frequency: 242.36,
            q: 0.9027,
            peak: 4522e3
          },
          {
            frequency: 1168.6,
            q: 9.064,
            peak: 8619e3
          },
          {
            frequency: 2493.1,
            q: 18.57,
            peak: 2135e3
          }
        ],
        misfit: 0.0684
      },
      {
        target: 1200,
        reached: true,
        coords: [
          -0.0183579,
          -533168e-8,
          395783e-8,
          -0.0147958
        ],
        second: {
          frequency: 1200,
          peak: 9e6,
          q: 7.473
        },
        resonances: [
          {
            frequency: 229.27,
            q: 0.9868,
            peak: 3826e3
          },
          {
            frequency: 1201.8,
            q: 9.193,
            peak: 8399e3
          },
          {
            frequency: 2585.4,
            q: 16.9,
            peak: 539e4
          }
        ],
        misfit: 0.106
      },
      {
        target: 1225,
        reached: true,
        coords: [
          -0.0170351,
          544587e-8,
          452706e-8,
          246891e-8
        ],
        second: {
          frequency: 1225,
          peak: 9e6,
          q: 8.159
        },
        resonances: [
          {
            frequency: 220.67,
            q: 0.8825,
            peak: 38e5
          },
          {
            frequency: 1222.6,
            q: 8.276,
            peak: 8786e3
          },
          {
            frequency: 2353,
            q: 13.19,
            peak: 3794e3
          },
          {
            frequency: 3293.5,
            q: 28.63,
            peak: 1585e4
          }
        ],
        misfit: 0.0249
      },
      {
        target: 1250,
        reached: true,
        coords: [
          -0.0164177,
          -404668e-8,
          -59366e-7,
          -0.0161309
        ],
        second: {
          frequency: 1250,
          peak: 9e6,
          q: 7.808
        },
        resonances: [
          {
            frequency: 247.69,
            q: 0.9729,
            peak: 4614e3
          },
          {
            frequency: 1252.5,
            q: 9.825,
            peak: 839e4
          },
          {
            frequency: 2548.8,
            q: 15.99,
            peak: 3942e3
          }
        ],
        misfit: 0.11
      },
      {
        target: 1275,
        reached: true,
        coords: [
          -0.0184178,
          533354e-8,
          0.0144666,
          -574995e-8
        ],
        second: {
          frequency: 1275,
          peak: 9e6,
          q: 7.739
        },
        resonances: [
          {
            frequency: 213.24,
            q: 0.9188,
            peak: 3477e3
          },
          {
            frequency: 1280.7,
            q: 8.031,
            peak: 873e4
          },
          {
            frequency: 2425.3,
            q: 16.7,
            peak: 1279e4
          },
          {
            frequency: 3307,
            q: 25.87,
            peak: 2705e4
          }
        ],
        misfit: 0.0253
      },
      {
        target: 1300,
        reached: true,
        coords: [
          -0.016665,
          497989e-8,
          464763e-8,
          -627633e-8
        ],
        second: {
          frequency: 1300,
          peak: 9e6,
          q: 7.812
        },
        resonances: [
          {
            frequency: 223.38,
            q: 0.8693,
            peak: 3914e3
          },
          {
            frequency: 1303.8,
            q: 8.077,
            peak: 8725e3
          },
          {
            frequency: 2417.2,
            q: 14.4,
            peak: 7994e3
          },
          {
            frequency: 3358.4,
            q: 27.41,
            peak: 2965e4
          }
        ],
        misfit: 0.0284
      },
      {
        target: 1325,
        reached: true,
        coords: [
          -0.016248,
          625862e-8,
          416222e-8,
          -709742e-8
        ],
        second: {
          frequency: 1325,
          peak: 9e6,
          q: 7.823
        },
        resonances: [
          {
            frequency: 224.11,
            q: 0.8746,
            peak: 3958e3
          },
          {
            frequency: 1331.2,
            q: 8.067,
            peak: 866e4
          },
          {
            frequency: 2410.5,
            q: 14.36,
            peak: 8979e3
          },
          {
            frequency: 3335.4,
            q: 27.68,
            peak: 3125e4
          }
        ],
        misfit: 0.0289
      },
      {
        target: 1350,
        reached: true,
        coords: [
          -0.0159192,
          789593e-8,
          438125e-8,
          -767705e-8
        ],
        second: {
          frequency: 1350,
          peak: 9e6,
          q: 7.779
        },
        resonances: [
          {
            frequency: 223.86,
            q: 0.8835,
            peak: 3961e3
          },
          {
            frequency: 1359.1,
            q: 8.016,
            peak: 8594e3
          },
          {
            frequency: 2398.2,
            q: 14.44,
            peak: 105e5
          },
          {
            frequency: 3296.8,
            q: 27.84,
            peak: 3181e4
          }
        ],
        misfit: 0.0288
      },
      {
        target: 1375,
        reached: true,
        coords: [
          -0.0167769,
          603872e-8,
          333782e-8,
          -0.0151851
        ],
        second: {
          frequency: 1375,
          peak: 9e6,
          q: 7.375
        },
        resonances: [
          {
            frequency: 228.21,
            q: 0.8734,
            peak: 4107e3
          },
          {
            frequency: 1392.8,
            q: 8.003,
            peak: 8259e3
          },
          {
            frequency: 2511.6,
            q: 15.39,
            peak: 1397e4
          },
          {
            frequency: 3489.2,
            q: 24.72,
            peak: 6183e4
          }
        ],
        misfit: 0.0359
      },
      {
        target: 1400,
        reached: true,
        coords: [
          -365341e-8,
          0.0249834,
          -578597e-8,
          0.0120606
        ],
        second: {
          frequency: 1400,
          peak: 9e6,
          q: 11.87
        },
        resonances: [
          {
            frequency: 225.86,
            q: 1.24,
            peak: 4518e3
          },
          {
            frequency: 1403.2,
            q: 12.13,
            peak: 8889e3
          },
          {
            frequency: 2094.2,
            q: 7.728,
            peak: 632200
          },
          {
            frequency: 3016.9,
            q: 34.41,
            peak: 5691e3
          }
        ],
        misfit: 0.0332
      },
      {
        target: 1425,
        reached: true,
        coords: [
          -261727e-8,
          0.0252089,
          -623364e-8,
          0.0111266
        ],
        second: {
          frequency: 1425,
          peak: 9e6,
          q: 11.86
        },
        resonances: [
          {
            frequency: 226.61,
            q: 1.267,
            peak: 4621e3
          },
          {
            frequency: 1429.2,
            q: 12.15,
            peak: 8895e3
          },
          {
            frequency: 2074.9,
            q: 7.321,
            peak: 656e3
          },
          {
            frequency: 3009.4,
            q: 35.03,
            peak: 6098e3
          }
        ],
        misfit: 0.0343
      },
      {
        target: 1450,
        reached: true,
        coords: [
          -145021e-8,
          0.0258486,
          -640551e-8,
          0.0104583
        ],
        second: {
          frequency: 1450,
          peak: 9e6,
          q: 11.86
        },
        resonances: [
          {
            frequency: 226.89,
            q: 1.3,
            peak: 47e5
          },
          {
            frequency: 1455.2,
            q: 12.16,
            peak: 8897e3
          },
          {
            frequency: 2046.7,
            q: 6.865,
            peak: 663500
          },
          {
            frequency: 2998.7,
            q: 35.62,
            peak: 6314e3
          }
        ],
        misfit: 0.0351
      },
      {
        target: 1475,
        reached: true,
        coords: [
          -176358e-9,
          0.0268415,
          -62586e-7,
          996441e-8
        ],
        second: {
          frequency: 1475,
          peak: 9e6,
          q: 11.82
        },
        resonances: [
          {
            frequency: 226.73,
            q: 1.334,
            peak: 4749e3
          },
          {
            frequency: 1481.4,
            q: 12.14,
            peak: 8889e3
          },
          {
            frequency: 2009.1,
            q: 6.385,
            peak: 667e3
          },
          {
            frequency: 2985.6,
            q: 36.36,
            peak: 6353e3
          }
        ],
        misfit: 0.0356
      },
      {
        target: 1500,
        reached: true,
        coords: [
          194634e-8,
          0.027541,
          -745143e-8,
          0.0104778
        ],
        second: {
          frequency: 1500,
          peak: 9e6,
          q: 12.44
        },
        resonances: [
          {
            frequency: 227.2,
            q: 1.444,
            peak: 4992e3
          },
          {
            frequency: 1507.3,
            q: 12.45,
            peak: 885e4
          },
          {
            frequency: 2983.3,
            q: 38.69,
            peak: 6609e3
          }
        ],
        misfit: 0.0386
      },
      {
        target: 1525,
        reached: true,
        coords: [
          324466e-8,
          0.0282729,
          -739602e-8,
          0.0100251
        ],
        second: {
          frequency: 1525,
          peak: 9e6,
          q: 12.4
        },
        resonances: [
          {
            frequency: 227,
            q: 1.492,
            peak: 5081e3
          },
          {
            frequency: 1533.6,
            q: 12.28,
            peak: 8818e3
          },
          {
            frequency: 2975.9,
            q: 39.55,
            peak: 6738e3
          }
        ],
        misfit: 0.0392
      },
      {
        target: 1550,
        reached: true,
        coords: [
          388911e-8,
          0.0282274,
          -753671e-8,
          878784e-8
        ],
        second: {
          frequency: 1550,
          peak: 9e6,
          q: 12.09
        },
        resonances: [
          {
            frequency: 227.48,
            q: 1.518,
            peak: 5192e3
          },
          {
            frequency: 1560.6,
            q: 11.75,
            peak: 8752e3
          },
          {
            frequency: 2973,
            q: 39.96,
            peak: 7275e3
          }
        ],
        misfit: 0.0405
      },
      {
        target: 1575,
        reached: true,
        coords: [
          431725e-8,
          0.0286921,
          -689198e-8,
          727304e-8
        ],
        second: {
          frequency: 1575,
          peak: 9e6,
          q: 11.43
        },
        resonances: [
          {
            frequency: 227.47,
            q: 1.513,
            peak: 518e4
          },
          {
            frequency: 1589.1,
            q: 10.72,
            peak: 864e4
          },
          {
            frequency: 2964,
            q: 39.68,
            peak: 7544e3
          }
        ],
        misfit: 0.0415
      },
      {
        target: 1600,
        reached: true,
        coords: [
          548361e-8,
          0.0287901,
          -669318e-8,
          710941e-8
        ],
        second: {
          frequency: 1594.8,
          peak: 85e5,
          q: 10.97
        },
        resonances: [
          {
            frequency: 227.1,
            q: 1.535,
            peak: 5197e3
          },
          {
            frequency: 1612.1,
            q: 9.98,
            peak: 8057e3
          },
          {
            frequency: 2967.3,
            q: 40.1,
            peak: 7679e3
          }
        ],
        misfit: 0.0417
      },
      {
        target: 1625,
        reached: true,
        coords: [
          643626e-8,
          0.028735,
          -635557e-8,
          654897e-8
        ],
        second: {
          frequency: 1616.2,
          peak: 7892e3,
          q: 9.997
        },
        resonances: [
          {
            frequency: 226.87,
            q: 1.539,
            peak: 5189e3
          },
          {
            frequency: 1639.5,
            q: 8.909,
            peak: 7413e3
          },
          {
            frequency: 2971,
            q: 40.27,
            peak: 7928e3
          }
        ],
        misfit: 0.0421
      },
      {
        target: 1650,
        reached: true,
        coords: [
          464694e-8,
          0.027309,
          -613923e-8,
          221366e-8
        ],
        second: {
          frequency: 1638.8,
          peak: 7648e3,
          q: 8.334
        },
        resonances: [
          {
            frequency: 229.07,
            q: 1.447,
            peak: 5203e3
          },
          {
            frequency: 1661.8,
            q: 9.522,
            peak: 6981e3
          },
          {
            frequency: 1913.2,
            q: 7.146,
            peak: 2376e3
          },
          {
            frequency: 2969.6,
            q: 38.73,
            peak: 1002e4
          }
        ],
        misfit: 0.0404
      },
      {
        target: 1675,
        reached: true,
        coords: [
          473458e-8,
          0.0280996,
          -521492e-8,
          -442318e-9
        ],
        second: {
          frequency: 1673.9,
          peak: 7738e3,
          q: 6.398
        },
        resonances: [
          {
            frequency: 229.21,
            q: 1.437,
            peak: 5193e3
          },
          {
            frequency: 1702.3,
            q: 8.751,
            peak: 662e4
          },
          {
            frequency: 1921.6,
            q: 8.239,
            peak: 3904e3
          },
          {
            frequency: 2957.2,
            q: 38.37,
            peak: 1081e4
          }
        ],
        misfit: 0.0409
      },
      {
        target: 1700,
        reached: false,
        coords: [
          0.0107383,
          0.0288895,
          -573089e-8,
          748232e-8
        ],
        second: {
          frequency: 1679,
          peak: 638e4,
          q: 7.778
        },
        resonances: [
          {
            frequency: 224.99,
            q: 1.621,
            peak: 5205e3
          },
          {
            frequency: 1717.4,
            q: 7.743,
            peak: 614e4
          },
          {
            frequency: 2994.9,
            q: 41.52,
            peak: 7851e3
          }
        ],
        misfit: 0.0399
      },
      {
        target: 1725,
        reached: false,
        coords: [
          0.0115727,
          0.0287835,
          -545308e-8,
          6901e-6
        ],
        second: {
          frequency: 1708.2,
          peak: 6114e3,
          q: 6.562
        },
        resonances: [
          {
            frequency: 224.84,
            q: 1.627,
            peak: 5206e3
          },
          {
            frequency: 1750.8,
            q: 7.466,
            peak: 6055e3
          },
          {
            frequency: 3000.8,
            q: 41.63,
            peak: 809e4
          }
        ],
        misfit: 0.0397
      },
      {
        target: 1750,
        reached: false,
        coords: [
          0.0116335,
          0.0287401,
          -516956e-8,
          570187e-8
        ],
        second: {
          frequency: 1736.5,
          peak: 61e5,
          q: 5.679
        },
        resonances: [
          {
            frequency: 225.1,
            q: 1.615,
            peak: 5207e3
          },
          {
            frequency: 1779.8,
            q: 7.247,
            peak: 6229e3
          },
          {
            frequency: 3000.8,
            q: 41.52,
            peak: 8484e3
          }
        ],
        misfit: 0.04
      },
      {
        target: 1775,
        reached: false,
        coords: [
          0.010058,
          0.0284016,
          -487434e-8,
          250869e-8
        ],
        second: {
          frequency: 1774.5,
          peak: 6217e3,
          q: 4.508
        },
        resonances: [
          {
            frequency: 226.51,
            q: 1.552,
            peak: 521e4
          },
          {
            frequency: 1822.6,
            q: 6.496,
            peak: 6677e3
          },
          {
            frequency: 2991.9,
            q: 40.97,
            peak: 975e4
          }
        ],
        misfit: 0.0425
      },
      {
        target: 1800,
        reached: false,
        coords: [
          0.0101908,
          0.0284664,
          -482124e-8,
          248627e-8
        ],
        second: {
          frequency: 1801.3,
          peak: 6277e3,
          q: 4.628
        },
        resonances: [
          {
            frequency: 226.44,
            q: 1.555,
            peak: 521e4
          },
          {
            frequency: 1825.9,
            q: 6.595,
            peak: 6759e3
          },
          {
            frequency: 2992.2,
            q: 41,
            peak: 9733e3
          }
        ],
        misfit: 0.0424
      },
      {
        target: 1825,
        reached: false,
        coords: [
          0.0150728,
          0.028772,
          -449722e-8,
          616035e-8
        ],
        second: {
          frequency: 1853,
          peak: 6889e3,
          q: 7.889
        },
        resonances: [
          {
            frequency: 223.64,
            q: 1.685,
            peak: 5207e3
          },
          {
            frequency: 1847.3,
            q: 9.35,
            peak: 7027e3
          },
          {
            frequency: 3026.3,
            q: 42.81,
            peak: 8448e3
          }
        ],
        misfit: 0.0388
      },
      {
        target: 1850,
        reached: false,
        coords: [
          0.0154533,
          0.0287059,
          -442595e-8,
          614146e-8
        ],
        second: {
          frequency: 1863,
          peak: 7025e3,
          q: 8.313
        },
        resonances: [
          {
            frequency: 223.51,
            q: 1.691,
            peak: 5206e3
          },
          {
            frequency: 1856,
            q: 9.694,
            peak: 7166e3
          },
          {
            frequency: 3030.1,
            q: 42.74,
            peak: 8468e3
          }
        ],
        misfit: 0.0388
      },
      {
        target: 1875,
        reached: true,
        coords: [
          0.0167308,
          0.028425,
          -421997e-8,
          613576e-8
        ],
        second: {
          frequency: 1888.8,
          peak: 7633e3,
          q: 10.2
        },
        resonances: [
          {
            frequency: 223.1,
            q: 1.712,
            peak: 5204e3
          },
          {
            frequency: 1883.2,
            q: 11,
            peak: 7657e3
          },
          {
            frequency: 3043.8,
            q: 42.65,
            peak: 8545e3
          }
        ],
        misfit: 0.0385
      },
      {
        target: 1900,
        reached: true,
        coords: [
          0.0179434,
          0.0287202,
          -376885e-8,
          599384e-8
        ],
        second: {
          frequency: 1907,
          peak: 8748e3,
          q: 12.61
        },
        resonances: [
          {
            frequency: 222.51,
            q: 1.742,
            peak: 5205e3
          },
          {
            frequency: 1902.7,
            q: 12.99,
            peak: 8726e3
          },
          {
            frequency: 3052.1,
            q: 43.13,
            peak: 8487e3
          }
        ],
        misfit: 0.038
      },
      {
        target: 1925,
        reached: true,
        coords: [
          0.0185508,
          0.028386,
          -355601e-8,
          572274e-8
        ],
        second: {
          frequency: 1925,
          peak: 9e6,
          q: 13.2
        },
        resonances: [
          {
            frequency: 222.42,
            q: 1.736,
            peak: 5172e3
          },
          {
            frequency: 1922.5,
            q: 13.77,
            peak: 9041e3
          },
          {
            frequency: 3061.5,
            q: 43.34,
            peak: 8673e3
          }
        ],
        misfit: 0.0378
      },
      {
        target: 1950,
        reached: true,
        coords: [
          0.0195711,
          0.0276036,
          -326846e-8,
          588201e-8
        ],
        second: {
          frequency: 1950,
          peak: 9e6,
          q: 14.38
        },
        resonances: [
          {
            frequency: 222.17,
            q: 1.715,
            peak: 5078e3
          },
          {
            frequency: 1948.9,
            q: 14.42,
            peak: 8907e3
          },
          {
            frequency: 3079.1,
            q: 42.76,
            peak: 8735e3
          }
        ],
        misfit: 0.0372
      },
      {
        target: 1975,
        reached: true,
        coords: [
          0.020217,
          0.0274053,
          -209421e-8,
          58875e-7
        ],
        second: {
          frequency: 1975,
          peak: 9e6,
          q: 14.87
        },
        resonances: [
          {
            frequency: 221.59,
            q: 1.645,
            peak: 4831e3
          },
          {
            frequency: 1973.1,
            q: 14.71,
            peak: 8852e3
          },
          {
            frequency: 3089.9,
            q: 41.85,
            peak: 8447e3
          }
        ],
        misfit: 0.0359
      }
    ]
  },
  bend: {
    peak: 3464e4,
    lowest: 500,
    reach: 1725,
    rows: [
      {
        target: 450,
        reached: false,
        coords: [
          -0.0308084,
          -0.0299517,
          51767e-7,
          820878e-8
        ],
        second: {
          frequency: 475.32,
          peak: 1373e4,
          q: 4.03
        },
        resonances: [
          {
            frequency: 254.41,
            q: 1.036,
            peak: 4874e3
          },
          {
            frequency: 453.46,
            q: 4.687,
            peak: 1118e4
          }
        ],
        misfit: 0.0613
      },
      {
        target: 475,
        reached: false,
        coords: [
          -0.0420738,
          -0.0221631,
          45506e-7,
          0.0129164
        ],
        second: {
          frequency: 492.38,
          peak: 2405e4,
          q: 5.691
        },
        resonances: [
          {
            frequency: 251.99,
            q: 0.9596,
            peak: 4552e3
          },
          {
            frequency: 478.89,
            q: 6.118,
            peak: 215e5
          }
        ],
        misfit: 0.0601
      },
      {
        target: 500,
        reached: true,
        coords: [
          -0.0464019,
          -0.0190705,
          44392e-7,
          0.0135227
        ],
        second: {
          frequency: 505.26,
          peak: 3082e4,
          q: 6.515
        },
        resonances: [
          {
            frequency: 192.51,
            q: 0.3,
            peak: 3057e3
          },
          {
            frequency: 494.4,
            q: 6.956,
            peak: 2784e4
          }
        ],
        misfit: 0.0994
      },
      {
        target: 525,
        reached: true,
        coords: [
          -0.0481273,
          -0.0173777,
          46838e-7,
          0.01362
        ],
        second: {
          frequency: 525,
          peak: 3464e4,
          q: 7.201
        },
        resonances: [
          {
            frequency: 191.67,
            q: 0.3,
            peak: 3025e3
          },
          {
            frequency: 515.95,
            q: 7.763,
            peak: 3208e4
          }
        ],
        misfit: 0.0929
      },
      {
        target: 550,
        reached: true,
        coords: [
          -0.0479097,
          -0.0162497,
          45566e-7,
          0.0135692
        ],
        second: {
          frequency: 550,
          peak: 3464e4,
          q: 7.528
        },
        resonances: [
          {
            frequency: 194.87,
            q: 0.3,
            peak: 3004e3
          },
          {
            frequency: 541.61,
            q: 8.334,
            peak: 3266e4
          }
        ],
        misfit: 0.0875
      },
      {
        target: 575,
        reached: true,
        coords: [
          -0.0477488,
          -0.0154783,
          508072e-8,
          0.0136281
        ],
        second: {
          frequency: 575,
          peak: 3464e4,
          q: 7.889
        },
        resonances: [
          {
            frequency: 195.89,
            q: 0.3,
            peak: 2942e3
          },
          {
            frequency: 567.49,
            q: 8.935,
            peak: 3327e4
          }
        ],
        misfit: 0.0818
      },
      {
        target: 600,
        reached: true,
        coords: [
          -0.0474936,
          -0.0137658,
          457624e-8,
          0.0138558
        ],
        second: {
          frequency: 600,
          peak: 3464e4,
          q: 8.299
        },
        resonances: [
          {
            frequency: 197.08,
            q: 0.3,
            peak: 2927e3
          },
          {
            frequency: 592.72,
            q: 9.382,
            peak: 3338e4
          }
        ],
        misfit: 0.078
      },
      {
        target: 625,
        reached: true,
        coords: [
          -0.0464607,
          -0.013989,
          400914e-8,
          0.0121281
        ],
        second: {
          frequency: 625,
          peak: 3464e4,
          q: 8.409
        },
        resonances: [
          {
            frequency: 198.82,
            q: 0.3,
            peak: 294e4
          },
          {
            frequency: 617.86,
            q: 9.686,
            peak: 338e5
          }
        ],
        misfit: 0.0773
      },
      {
        target: 650,
        reached: true,
        coords: [
          -0.045724,
          -0.0146649,
          509756e-8,
          0.0112163
        ],
        second: {
          frequency: 650,
          peak: 3464e4,
          q: 8.814
        },
        resonances: [
          {
            frequency: 238.33,
            q: 0.7442,
            peak: 371e4
          },
          {
            frequency: 640.83,
            q: 9.024,
            peak: 3312e4
          },
          {
            frequency: 3299.6,
            q: 99.57,
            peak: 1045e3
          }
        ],
        misfit: 0.0482
      },
      {
        target: 675,
        reached: true,
        coords: [
          -0.0445328,
          -419752e-8,
          -613427e-8,
          0.0118026
        ],
        second: {
          frequency: 675,
          peak: 3464e4,
          q: 8.827
        },
        resonances: [
          {
            frequency: 251.48,
            q: 0.7897,
            peak: 4492e3
          },
          {
            frequency: 666.48,
            q: 9.229,
            peak: 3271e4
          }
        ],
        misfit: 0.0481
      },
      {
        target: 700,
        reached: true,
        coords: [
          -0.0443273,
          -382016e-8,
          -500595e-8,
          0.0118722
        ],
        second: {
          frequency: 700,
          peak: 3464e4,
          q: 9.19
        },
        resonances: [
          {
            frequency: 246.27,
            q: 0.7791,
            peak: 4339e3
          },
          {
            frequency: 692.43,
            q: 9.604,
            peak: 3315e4
          },
          {
            frequency: 3285.1,
            q: 3.99,
            peak: 829900
          }
        ],
        misfit: 0.0424
      },
      {
        target: 725,
        reached: true,
        coords: [
          -0.0441378,
          -335162e-8,
          -389925e-8,
          0.0119336
        ],
        second: {
          frequency: 725,
          peak: 3464e4,
          q: 9.498
        },
        resonances: [
          {
            frequency: 241.75,
            q: 0.7811,
            peak: 42e5
          },
          {
            frequency: 718.02,
            q: 9.985,
            peak: 3348e4
          },
          {
            frequency: 3288.5,
            q: 3.921,
            peak: 826200
          }
        ],
        misfit: 0.04
      },
      {
        target: 750,
        reached: true,
        coords: [
          -0.0438948,
          -277718e-8,
          -291749e-8,
          0.0119587
        ],
        second: {
          frequency: 750,
          peak: 3464e4,
          q: 9.815
        },
        resonances: [
          {
            frequency: 237.97,
            q: 0.7868,
            peak: 4093e3
          },
          {
            frequency: 743.49,
            q: 10.35,
            peak: 3372e4
          },
          {
            frequency: 3284.4,
            q: 3.764,
            peak: 801600
          }
        ],
        misfit: 0.0381
      },
      {
        target: 775,
        reached: true,
        coords: [
          -0.0413324,
          -0.0149797,
          312377e-8,
          350374e-8
        ],
        second: {
          frequency: 775,
          peak: 3464e4,
          q: 9.568
        },
        resonances: [
          {
            frequency: 232.53,
            q: 0.7732,
            peak: 3797e3
          },
          {
            frequency: 767.95,
            q: 10.05,
            peak: 3361e4
          },
          {
            frequency: 3283.4,
            q: 3.316,
            peak: 157e4
          }
        ],
        misfit: 0.0453
      },
      {
        target: 800,
        reached: true,
        coords: [
          -0.0441609,
          -446482e-8,
          364179e-8,
          0.0123234
        ],
        second: {
          frequency: 800,
          peak: 3464e4,
          q: 10.65
        },
        resonances: [
          {
            frequency: 224.88,
            q: 0.8321,
            peak: 3651e3
          },
          {
            frequency: 794.68,
            q: 11.14,
            peak: 3388e4
          },
          {
            frequency: 3255.8,
            q: 0.3,
            peak: 74560
          }
        ],
        misfit: 0.0379
      },
      {
        target: 825,
        reached: true,
        coords: [
          -0.0434394,
          -37789e-7,
          355036e-8,
          0.0117415
        ],
        second: {
          frequency: 825,
          peak: 3464e4,
          q: 11.01
        },
        resonances: [
          {
            frequency: 224.63,
            q: 0.8343,
            peak: 3649e3
          },
          {
            frequency: 819.7,
            q: 11.32,
            peak: 3369e4
          },
          {
            frequency: 3246.5,
            q: 100,
            peak: 1481e3
          }
        ],
        misfit: 0.0373
      },
      {
        target: 850,
        reached: true,
        coords: [
          -0.0430928,
          -283559e-8,
          428289e-8,
          0.0117028
        ],
        second: {
          frequency: 850,
          peak: 3464e4,
          q: 11.34
        },
        resonances: [
          {
            frequency: 222.84,
            q: 0.8477,
            peak: 3611e3
          },
          {
            frequency: 844.74,
            q: 11.63,
            peak: 3366e4
          },
          {
            frequency: 2532.2,
            q: 28.9,
            peak: 345600
          }
        ],
        misfit: 0.0367
      },
      {
        target: 875,
        reached: true,
        coords: [
          -0.0426727,
          -893089e-9,
          387665e-8,
          0.0116618
        ],
        second: {
          frequency: 875,
          peak: 3464e4,
          q: 11.53
        },
        resonances: [
          {
            frequency: 222.54,
            q: 0.8545,
            peak: 363e4
          },
          {
            frequency: 869.73,
            q: 11.95,
            peak: 3391e4
          },
          {
            frequency: 2512.3,
            q: 29.21,
            peak: 415300
          }
        ],
        misfit: 0.0357
      },
      {
        target: 900,
        reached: true,
        coords: [
          -0.0424282,
          428214e-9,
          446186e-8,
          0.0115576
        ],
        second: {
          frequency: 900,
          peak: 3464e4,
          q: 11.67
        },
        resonances: [
          {
            frequency: 221.19,
            q: 0.866,
            peak: 3604e3
          },
          {
            frequency: 895.47,
            q: 12.3,
            peak: 3433e4
          },
          {
            frequency: 2497.4,
            q: 26.2,
            peak: 498300
          }
        ],
        misfit: 0.0349
      },
      {
        target: 925,
        reached: true,
        coords: [
          -0.0424637,
          366668e-8,
          602517e-8,
          0.012891
        ],
        second: {
          frequency: 925,
          peak: 3464e4,
          q: 12.37
        },
        resonances: [
          {
            frequency: 218.34,
            q: 0.8895,
            peak: 3526e3
          },
          {
            frequency: 920.96,
            q: 12.71,
            peak: 3393e4
          },
          {
            frequency: 2460.2,
            q: 23.06,
            peak: 582300
          }
        ],
        misfit: 0.0317
      },
      {
        target: 950,
        reached: true,
        coords: [
          -0.0419494,
          557147e-8,
          601038e-8,
          0.0126445
        ],
        second: {
          frequency: 950,
          peak: 3464e4,
          q: 12.53
        },
        resonances: [
          {
            frequency: 217.83,
            q: 0.8667,
            peak: 3554e3
          },
          {
            frequency: 945.97,
            q: 12.9,
            peak: 3437e4
          },
          {
            frequency: 2441.3,
            q: 14.81,
            peak: 8e5
          },
          {
            frequency: 3448,
            q: 28.13,
            peak: 776e4
          }
        ],
        misfit: 0.0256
      },
      {
        target: 975,
        reached: true,
        coords: [
          -0.0412201,
          703075e-8,
          616191e-8,
          0.0122099
        ],
        second: {
          frequency: 975,
          peak: 3464e4,
          q: 12.75
        },
        resonances: [
          {
            frequency: 217.42,
            q: 0.8743,
            peak: 3556e3
          },
          {
            frequency: 971.87,
            q: 13.13,
            peak: 3438e4
          },
          {
            frequency: 2421,
            q: 14.63,
            peak: 919900
          },
          {
            frequency: 3399.6,
            q: 28.13,
            peak: 729e4
          }
        ],
        misfit: 0.0252
      },
      {
        target: 1e3,
        reached: true,
        coords: [
          -0.0404603,
          882522e-8,
          629511e-8,
          0.0119066
        ],
        second: {
          frequency: 1e3,
          peak: 3464e4,
          q: 13.05
        },
        resonances: [
          {
            frequency: 217.06,
            q: 0.8831,
            peak: 3558e3
          },
          {
            frequency: 996.29,
            q: 13.35,
            peak: 343e5
          },
          {
            frequency: 2397.6,
            q: 14.44,
            peak: 1029e3
          },
          {
            frequency: 3350.3,
            q: 27.84,
            peak: 6589e3
          }
        ],
        misfit: 0.0249
      },
      {
        target: 1025,
        reached: true,
        coords: [
          -0.039493,
          0.0112325,
          594196e-8,
          0.0114538
        ],
        second: {
          frequency: 1025,
          peak: 3464e4,
          q: 13.2
        },
        resonances: [
          {
            frequency: 217.24,
            q: 0.8922,
            peak: 3584e3
          },
          {
            frequency: 1022.3,
            q: 13.64,
            peak: 3451e4
          },
          {
            frequency: 2370.7,
            q: 14.2,
            peak: 1121e3
          },
          {
            frequency: 3296.9,
            q: 27.36,
            peak: 5737e3
          }
        ],
        misfit: 0.0246
      },
      {
        target: 1050,
        reached: true,
        coords: [
          -0.0385955,
          0.0129078,
          620022e-8,
          0.0109712
        ],
        second: {
          frequency: 1050,
          peak: 3464e4,
          q: 13.44
        },
        resonances: [
          {
            frequency: 216.9,
            q: 0.9005,
            peak: 3583e3
          },
          {
            frequency: 1046.6,
            q: 13.83,
            peak: 3448e4
          },
          {
            frequency: 2344.9,
            q: 13.93,
            peak: 1248e3
          },
          {
            frequency: 3253.5,
            q: 26.77,
            peak: 5189e3
          }
        ],
        misfit: 0.0243
      },
      {
        target: 1075,
        reached: true,
        coords: [
          -0.037874,
          0.0137016,
          72672e-7,
          0.0103261
        ],
        second: {
          frequency: 1075,
          peak: 3464e4,
          q: 13.6
        },
        resonances: [
          {
            frequency: 215.88,
            q: 0.9074,
            peak: 3549e3
          },
          {
            frequency: 1072.6,
            q: 13.89,
            peak: 3435e4
          },
          {
            frequency: 2319.7,
            q: 13.66,
            peak: 148e4
          },
          {
            frequency: 3218.4,
            q: 26.13,
            peak: 4988e3
          }
        ],
        misfit: 0.0237
      },
      {
        target: 1100,
        reached: true,
        coords: [
          -0.032848,
          -405142e-8,
          -641316e-8,
          -587858e-8
        ],
        second: {
          frequency: 1100,
          peak: 3464e4,
          q: 11.81
        },
        resonances: [
          {
            frequency: 244.67,
            q: 0.8573,
            peak: 4442e3
          },
          {
            frequency: 1092.7,
            q: 13.11,
            peak: 3393e4
          },
          {
            frequency: 2544.9,
            q: 21.41,
            peak: 1793e3
          }
        ],
        misfit: 0.0804
      },
      {
        target: 1125,
        reached: true,
        coords: [
          -0.0321964,
          665927e-8,
          -62433e-7,
          225134e-8
        ],
        second: {
          frequency: 1125,
          peak: 3464e4,
          q: 13.47
        },
        resonances: [
          {
            frequency: 236.92,
            q: 0.8515,
            peak: 4503e3
          },
          {
            frequency: 1121.2,
            q: 13.93,
            peak: 3429e4
          },
          {
            frequency: 2446.5,
            q: 13.84,
            peak: 1845e3
          },
          {
            frequency: 3376.7,
            q: 33.07,
            peak: 1942e4
          }
        ],
        misfit: 0.0331
      },
      {
        target: 1150,
        reached: true,
        coords: [
          -0.031759,
          78593e-7,
          -565373e-8,
          199029e-8
        ],
        second: {
          frequency: 1150,
          peak: 3464e4,
          q: 13.51
        },
        resonances: [
          {
            frequency: 235.66,
            q: 0.8585,
            peak: 4465e3
          },
          {
            frequency: 1147.2,
            q: 14.1,
            peak: 3453e4
          },
          {
            frequency: 2428,
            q: 13.61,
            peak: 2112e3
          },
          {
            frequency: 3331.5,
            q: 32.65,
            peak: 1837e4
          }
        ],
        misfit: 0.0327
      },
      {
        target: 1175,
        reached: true,
        coords: [
          -0.0312051,
          943119e-8,
          -555428e-8,
          178333e-8
        ],
        second: {
          frequency: 1175,
          peak: 3464e4,
          q: 13.36
        },
        resonances: [
          {
            frequency: 235.23,
            q: 0.8715,
            peak: 4476e3
          },
          {
            frequency: 1171.8,
            q: 14.41,
            peak: 3515e4
          },
          {
            frequency: 2408.5,
            q: 13.39,
            peak: 2324e3
          },
          {
            frequency: 3284.3,
            q: 32.26,
            peak: 1698e4
          }
        ],
        misfit: 0.0326
      },
      {
        target: 1200,
        reached: true,
        coords: [
          -0.0294564,
          0.0141265,
          -571872e-8,
          311952e-8
        ],
        second: {
          frequency: 1200,
          peak: 3464e4,
          q: 14.49
        },
        resonances: [
          {
            frequency: 234.07,
            q: 0.9204,
            peak: 4515e3
          },
          {
            frequency: 1197,
            q: 15.09,
            peak: 3459e4
          },
          {
            frequency: 2357.8,
            q: 12.91,
            peak: 2103e3
          },
          {
            frequency: 3182.2,
            q: 30.96,
            peak: 1126e4
          }
        ],
        misfit: 0.0327
      },
      {
        target: 1225,
        reached: true,
        coords: [
          -0.028629,
          0.0156702,
          -490112e-8,
          279465e-8
        ],
        second: {
          frequency: 1225,
          peak: 3464e4,
          q: 14.81
        },
        resonances: [
          {
            frequency: 232.68,
            q: 0.9286,
            peak: 4463e3
          },
          {
            frequency: 1222.9,
            q: 15.14,
            peak: 3442e4
          },
          {
            frequency: 2329.4,
            q: 12.54,
            peak: 2319e3
          },
          {
            frequency: 3140.3,
            q: 29.9,
            peak: 1007e4
          }
        ],
        misfit: 0.032
      },
      {
        target: 1250,
        reached: true,
        coords: [
          -0.0309677,
          0.0164791,
          396759e-8,
          259708e-8
        ],
        second: {
          frequency: 1250,
          peak: 3464e4,
          q: 13.51
        },
        resonances: [
          {
            frequency: 220.77,
            q: 0.8996,
            peak: 3839e3
          },
          {
            frequency: 1248.7,
            q: 13.95,
            peak: 346e5
          },
          {
            frequency: 2251.3,
            q: 12.44,
            peak: 3826e3
          },
          {
            frequency: 3089.9,
            q: 25.62,
            peak: 726e4
          }
        ],
        misfit: 0.025
      },
      {
        target: 1275,
        reached: true,
        coords: [
          -0.0294935,
          482859e-8,
          -633005e-8,
          -622446e-8
        ],
        second: {
          frequency: 1275,
          peak: 3464e4,
          q: 12.89
        },
        resonances: [
          {
            frequency: 241.09,
            q: 0.8338,
            peak: 4668e3
          },
          {
            frequency: 1272.5,
            q: 13.84,
            peak: 3508e4
          },
          {
            frequency: 2451.6,
            q: 13.33,
            peak: 4896e3
          },
          {
            frequency: 3410.6,
            q: 31.16,
            peak: 4161e4
          }
        ],
        misfit: 0.0367
      },
      {
        target: 1300,
        reached: true,
        coords: [
          -0.0291544,
          5412e-6,
          -58916e-7,
          -690149e-8
        ],
        second: {
          frequency: 1300,
          peak: 3464e4,
          q: 13.04
        },
        resonances: [
          {
            frequency: 240.41,
            q: 0.8365,
            peak: 4646e3
          },
          {
            frequency: 1297.2,
            q: 13.78,
            peak: 3481e4
          },
          {
            frequency: 2444.8,
            q: 13.32,
            peak: 5665e3
          },
          {
            frequency: 3389.1,
            q: 30.98,
            peak: 4321e4
          }
        ],
        misfit: 0.0367
      },
      {
        target: 1325,
        reached: true,
        coords: [
          -0.0321908,
          591949e-8,
          396758e-8,
          -608657e-8
        ],
        second: {
          frequency: 1325,
          peak: 3464e4,
          q: 12.66
        },
        resonances: [
          {
            frequency: 223.59,
            q: 0.837,
            peak: 3917e3
          },
          {
            frequency: 1323.4,
            q: 12.95,
            peak: 3431e4
          },
          {
            frequency: 2410.5,
            q: 14.19,
            peak: 102e5
          },
          {
            frequency: 3293.9,
            q: 28.12,
            peak: 361e5
          }
        ],
        misfit: 0.0291
      },
      {
        target: 1350,
        reached: true,
        coords: [
          -0.0318111,
          735787e-8,
          453395e-8,
          -649593e-8
        ],
        second: {
          frequency: 1350,
          peak: 3464e4,
          q: 12.64
        },
        resonances: [
          {
            frequency: 222.88,
            q: 0.8448,
            peak: 39e5
          },
          {
            frequency: 1349.3,
            q: 12.85,
            peak: 3413e4
          },
          {
            frequency: 2391,
            q: 14.28,
            peak: 1207e4
          },
          {
            frequency: 3248,
            q: 27.77,
            peak: 3442e4
          }
        ],
        misfit: 0.0285
      },
      {
        target: 1375,
        reached: true,
        coords: [
          -0.0314771,
          915843e-8,
          55259e-7,
          -676287e-8
        ],
        second: {
          frequency: 1375,
          peak: 3464e4,
          q: 12.54
        },
        resonances: [
          {
            frequency: 221.61,
            q: 0.8554,
            peak: 3861e3
          },
          {
            frequency: 1375.4,
            q: 12.69,
            peak: 3404e4
          },
          {
            frequency: 2361.6,
            q: 14.41,
            peak: 145e5
          },
          {
            frequency: 3191.2,
            q: 27.11,
            peak: 3068e4
          }
        ],
        misfit: 0.0275
      },
      {
        target: 1400,
        reached: true,
        coords: [
          -0.0310773,
          0.0109184,
          640855e-8,
          -725615e-8
        ],
        second: {
          frequency: 1400,
          peak: 3464e4,
          q: 12.36
        },
        resonances: [
          {
            frequency: 220.61,
            q: 0.8651,
            peak: 3831e3
          },
          {
            frequency: 1401.7,
            q: 12.48,
            peak: 3398e4
          },
          {
            frequency: 2331.6,
            q: 14.57,
            peak: 1747e4
          },
          {
            frequency: 3141.4,
            q: 26.37,
            peak: 2731e4
          }
        ],
        misfit: 0.0268
      },
      {
        target: 1425,
        reached: true,
        coords: [
          -0.0304105,
          0.0125791,
          654966e-8,
          -800047e-8
        ],
        second: {
          frequency: 1425,
          peak: 3464e4,
          q: 12.16
        },
        resonances: [
          {
            frequency: 220.6,
            q: 0.8716,
            peak: 3842e3
          },
          {
            frequency: 1427.9,
            q: 12.25,
            peak: 3389e4
          },
          {
            frequency: 2305.1,
            q: 14.63,
            peak: 2043e4
          },
          {
            frequency: 3101.2,
            q: 25.8,
            peak: 2493e4
          }
        ],
        misfit: 0.0267
      },
      {
        target: 1450,
        reached: true,
        coords: [
          -0.0299733,
          0.013786,
          693505e-8,
          -906808e-8
        ],
        second: {
          frequency: 1450,
          peak: 3464e4,
          q: 11.91
        },
        resonances: [
          {
            frequency: 220.4,
            q: 0.877,
            peak: 3842e3
          },
          {
            frequency: 1454.3,
            q: 11.95,
            peak: 3372e4
          },
          {
            frequency: 2287.1,
            q: 14.86,
            peak: 2487e4
          },
          {
            frequency: 3072.4,
            q: 25.29,
            peak: 2419e4
          }
        ],
        misfit: 0.027
      },
      {
        target: 1475,
        reached: true,
        coords: [
          -0.0294941,
          0.0149967,
          727414e-8,
          -0.0102691
        ],
        second: {
          frequency: 1475,
          peak: 3464e4,
          q: 11.63
        },
        resonances: [
          {
            frequency: 220.28,
            q: 0.8825,
            peak: 3846e3
          },
          {
            frequency: 1481.3,
            q: 11.58,
            peak: 3341e4
          },
          {
            frequency: 2269,
            q: 15.15,
            peak: 3068e4
          },
          {
            frequency: 3044.8,
            q: 24.82,
            peak: 235e5
          }
        ],
        misfit: 0.0278
      },
      {
        target: 1500,
        reached: true,
        coords: [
          -0.0171847,
          0.024886,
          -570217e-8,
          -627394e-8
        ],
        second: {
          frequency: 1500,
          peak: 3464e4,
          q: 14.33
        },
        resonances: [
          {
            frequency: 236.27,
            q: 1.088,
            peak: 4985e3
          },
          {
            frequency: 1503.3,
            q: 14.68,
            peak: 3439e4
          },
          {
            frequency: 2131.9,
            q: 9.24,
            peak: 5128e3
          },
          {
            frequency: 2905,
            q: 29.14,
            peak: 1058e4
          }
        ],
        misfit: 0.0395
      },
      {
        target: 1525,
        reached: true,
        coords: [
          -0.0164604,
          0.0252637,
          -571968e-8,
          -738354e-8
        ],
        second: {
          frequency: 1525,
          peak: 3464e4,
          q: 14.07
        },
        resonances: [
          {
            frequency: 236.69,
            q: 1.101,
            peak: 5039e3
          },
          {
            frequency: 1529.4,
            q: 14.3,
            peak: 3421e4
          },
          {
            frequency: 2118.7,
            q: 9.096,
            peak: 5823e3
          },
          {
            frequency: 2893.6,
            q: 29.38,
            peak: 1127e4
          }
        ],
        misfit: 0.0407
      },
      {
        target: 1550,
        reached: true,
        coords: [
          -0.0159913,
          0.025675,
          -520493e-8,
          -870073e-8
        ],
        second: {
          frequency: 1550,
          peak: 3464e4,
          q: 13.6
        },
        resonances: [
          {
            frequency: 236.39,
            q: 1.099,
            peak: 5022e3
          },
          {
            frequency: 1556.2,
            q: 13.62,
            peak: 3387e4
          },
          {
            frequency: 2103.4,
            q: 9.089,
            peak: 7115e3
          },
          {
            frequency: 2882.5,
            q: 29.26,
            peak: 117e5
          }
        ],
        misfit: 0.0415
      },
      {
        target: 1575,
        reached: true,
        coords: [
          -0.0146205,
          0.0263672,
          -602388e-8,
          -946398e-8
        ],
        second: {
          frequency: 1575,
          peak: 3464e4,
          q: 13.61
        },
        resonances: [
          {
            frequency: 237.72,
            q: 1.145,
            peak: 5208e3
          },
          {
            frequency: 1582.5,
            q: 13.56,
            peak: 3367e4
          },
          {
            frequency: 2085.5,
            q: 8.729,
            peak: 7082e3
          },
          {
            frequency: 2867.4,
            q: 30.45,
            peak: 1269e4
          }
        ],
        misfit: 0.044
      },
      {
        target: 1600,
        reached: true,
        coords: [
          -0.0138011,
          0.0264282,
          -58524e-7,
          -0.0100913
        ],
        second: {
          frequency: 1593.8,
          peak: 3241e4,
          q: 13.08
        },
        resonances: [
          {
            frequency: 237.62,
            q: 1.15,
            peak: 5216e3
          },
          {
            frequency: 1602.9,
            q: 12.8,
            peak: 3104e4
          },
          {
            frequency: 2079.3,
            q: 8.753,
            peak: 8018e3
          },
          {
            frequency: 2866.2,
            q: 30.74,
            peak: 1357e4
          }
        ],
        misfit: 0.045
      },
      {
        target: 1625,
        reached: true,
        coords: [
          -0.0304157,
          0.0152192,
          411774e-8,
          -0.0241647
        ],
        second: {
          frequency: 1625,
          peak: 3464e4,
          q: 7.731
        },
        resonances: [
          {
            frequency: 228.37,
            q: 0.838,
            peak: 4222e3
          },
          {
            frequency: 1663,
            q: 10.02,
            peak: 2379e4
          },
          {
            frequency: 2606.8,
            q: 18.9,
            peak: 166e6
          },
          {
            frequency: 3152.4,
            q: 29.45,
            peak: 3658e5
          }
        ],
        misfit: 0.0305
      },
      {
        target: 1650,
        reached: true,
        coords: [
          -0.0280391,
          0.0165221,
          -97275e-10,
          -0.022729
        ],
        second: {
          frequency: 1650,
          peak: 3464e4,
          q: 9.029
        },
        resonances: [
          {
            frequency: 234.57,
            q: 0.8695,
            peak: 4539e3
          },
          {
            frequency: 1682.8,
            q: 10.2,
            peak: 2647e4
          },
          {
            frequency: 2503.5,
            q: 17.93,
            peak: 1324e5
          },
          {
            frequency: 3078.5,
            q: 28.06,
            peak: 1981e5
          }
        ],
        misfit: 0.036
      },
      {
        target: 1675,
        reached: true,
        coords: [
          -0.0260696,
          0.017634,
          -298834e-8,
          -0.02299
        ],
        second: {
          frequency: 1675,
          peak: 3464e4,
          q: 9.203
        },
        resonances: [
          {
            frequency: 240.15,
            q: 0.9088,
            peak: 4867e3
          },
          {
            frequency: 1708.4,
            q: 10.2,
            peak: 2632e4
          },
          {
            frequency: 2472.6,
            q: 17.29,
            peak: 1182e5
          },
          {
            frequency: 3052.1,
            q: 29.01,
            peak: 1887e5
          }
        ],
        misfit: 0.0408
      },
      {
        target: 1700,
        reached: true,
        coords: [
          -0.0218056,
          0.0219146,
          -292444e-8,
          -0.0243388
        ],
        second: {
          frequency: 1700,
          peak: 3464e4,
          q: 7.512
        },
        resonances: [
          {
            frequency: 240.07,
            q: 0.9748,
            peak: 5e6
          },
          {
            frequency: 1746.9,
            q: 8.93,
            peak: 2218e4
          },
          {
            frequency: 2350.4,
            q: 19.71,
            peak: 1919e5
          },
          {
            frequency: 2894.8,
            q: 26.24,
            peak: 8825e4
          }
        ],
        misfit: 0.0426
      },
      {
        target: 1725,
        reached: true,
        coords: [
          -0.0184572,
          0.0246739,
          -337478e-8,
          -0.0227565
        ],
        second: {
          frequency: 1710.4,
          peak: 3544e4,
          q: 7.817
        },
        resonances: [
          {
            frequency: 239.69,
            q: 1.047,
            peak: 5112e3
          },
          {
            frequency: 1758.7,
            q: 8.713,
            peak: 2461e4
          },
          {
            frequency: 2200.8,
            q: 17.62,
            peak: 1265e5
          },
          {
            frequency: 2840,
            q: 27.18,
            peak: 3937e4
          }
        ],
        misfit: 0.0473
      },
      {
        target: 1750,
        reached: false,
        coords: [
          -0.0181458,
          0.0248267,
          -328933e-8,
          -0.0229542
        ],
        second: {
          frequency: 1711.3,
          peak: 3472e4,
          q: 7.521
        },
        resonances: [
          {
            frequency: 239.58,
            q: 1.05,
            peak: 5111e3
          },
          {
            frequency: 1761,
            q: 8.592,
            peak: 2361e4
          },
          {
            frequency: 2201.3,
            q: 17.9,
            peak: 1313e5
          },
          {
            frequency: 2838.5,
            q: 27.22,
            peak: 3956e4
          }
        ],
        misfit: 0.0471
      },
      {
        target: 1775,
        reached: false,
        coords: [
          -0.0190221,
          0.0243692,
          -261263e-8,
          -0.0244744
        ],
        second: {
          frequency: 1709.9,
          peak: 3556e4,
          q: 6.359
        },
        resonances: [
          {
            frequency: 239.14,
            q: 1.022,
            peak: 5036e3
          },
          {
            frequency: 1762.9,
            q: 8.347,
            peak: 2153e4
          },
          {
            frequency: 2245,
            q: 20.23,
            peak: 1954e5
          },
          {
            frequency: 2842.4,
            q: 26.48,
            peak: 4846e4
          }
        ],
        misfit: 0.044
      },
      {
        target: 1800,
        reached: false,
        coords: [
          -0.020957,
          0.0223493,
          -373819e-8,
          -0.0227837
        ],
        second: {
          frequency: 1701.6,
          peak: 3449e4,
          q: 8.446
        },
        resonances: [
          {
            frequency: 240.82,
            q: 1.001,
            peak: 5086e3
          },
          {
            frequency: 1744.3,
            q: 9.112,
            peak: 2449e4
          },
          {
            frequency: 2294.3,
            q: 17.8,
            peak: 1332e5
          },
          {
            frequency: 2885.5,
            q: 26.68,
            peak: 6509e4
          }
        ],
        misfit: 0.0455
      },
      {
        target: 1825,
        reached: false,
        coords: [
          -0.0198813,
          0.0242137,
          -254407e-8,
          -0.0243861
        ],
        second: {
          frequency: 1710.7,
          peak: 3886e4,
          q: 7.064
        },
        resonances: [
          {
            frequency: 239.06,
            q: 1.012,
            peak: 5014e3
          },
          {
            frequency: 1761.7,
            q: 8.587,
            peak: 2447e4
          },
          {
            frequency: 2233.2,
            q: 20.1,
            peak: 1997e5
          },
          {
            frequency: 2839.6,
            q: 26.31,
            peak: 4516e4
          }
        ],
        misfit: 0.044
      },
      {
        target: 1850,
        reached: false,
        coords: [
          -0.0197818,
          0.0242057,
          -254993e-8,
          -0.0244169
        ],
        second: {
          frequency: 1710.4,
          peak: 3827e4,
          q: 6.988
        },
        resonances: [
          {
            frequency: 239.08,
            q: 1.013,
            peak: 5016e3
          },
          {
            frequency: 1761.7,
            q: 8.548,
            peak: 2392e4
          },
          {
            frequency: 2237,
            q: 20.16,
            peak: 2001e5
          },
          {
            frequency: 2840.6,
            q: 26.31,
            peak: 4611e4
          }
        ],
        misfit: 0.0439
      },
      {
        target: 1875,
        reached: false,
        coords: [
          -0.0197634,
          0.0242321,
          -254767e-8,
          -0.0244119
        ],
        second: {
          frequency: 1710.5,
          peak: 3836e4,
          q: 6.988
        },
        resonances: [
          {
            frequency: 239.07,
            q: 1.014,
            peak: 5017e3
          },
          {
            frequency: 1761.8,
            q: 8.549,
            peak: 2399e4
          },
          {
            frequency: 2235.4,
            q: 20.14,
            peak: 1998e5
          },
          {
            frequency: 2840,
            q: 26.32,
            peak: 4572e4
          }
        ],
        misfit: 0.044
      },
      {
        target: 1900,
        reached: false,
        coords: [
          -0.019011,
          0.0244419,
          -275192e-8,
          -0.0241779
        ],
        second: {
          frequency: 1710.9,
          peak: 36e6,
          q: 6.844
        },
        resonances: [
          {
            frequency: 239.25,
            q: 1.026,
            peak: 5049e3
          },
          {
            frequency: 1763,
            q: 8.438,
            peak: 225e5
          },
          {
            frequency: 2233.5,
            q: 19.74,
            peak: 182e6
          },
          {
            frequency: 2840.6,
            q: 26.59,
            peak: 4585e4
          }
        ],
        misfit: 0.0446
      },
      {
        target: 1925,
        reached: false,
        coords: [
          -0.0189948,
          0.0244454,
          -275466e-8,
          -0.0241759
        ],
        second: {
          frequency: 1710.9,
          peak: 3595e4,
          q: 6.834
        },
        resonances: [
          {
            frequency: 239.25,
            q: 1.026,
            peak: 505e4
          },
          {
            frequency: 1763,
            q: 8.434,
            peak: 2246e4
          },
          {
            frequency: 2233.6,
            q: 19.74,
            peak: 1818e5
          },
          {
            frequency: 2840.6,
            q: 26.59,
            peak: 4588e4
          }
        ],
        misfit: 0.0446
      },
      {
        target: 1950,
        reached: false,
        coords: [
          -0.0292048,
          0.0175781,
          -253844e-8,
          -0.0237617
        ],
        second: {
          frequency: 1699.9,
          peak: 4766e4,
          q: 9.775
        },
        resonances: [
          {
            frequency: 239.47,
            q: 0.8852,
            peak: 4813e3
          },
          {
            frequency: 1732.2,
            q: 10.97,
            peak: 3601e4
          },
          {
            frequency: 2474.3,
            q: 18.69,
            peak: 1929e5
          },
          {
            frequency: 3003.5,
            q: 27.34,
            peak: 1957e5
          }
        ],
        misfit: 0.0392
      },
      {
        target: 1975,
        reached: false,
        coords: [
          -0.0230345,
          0.0227728,
          -167768e-8,
          -0.0249253
        ],
        second: {
          frequency: 1704.8,
          peak: 4593e4,
          q: 7.636
        },
        resonances: [
          {
            frequency: 238.08,
            q: 0.9582,
            peak: 4868e3
          },
          {
            frequency: 1752.3,
            q: 9.024,
            peak: 2904e4
          },
          {
            frequency: 2271.1,
            q: 21.58,
            peak: 273e6
          },
          {
            frequency: 2853.5,
            q: 25.26,
            peak: 5285e4
          }
        ],
        misfit: 0.0409
      }
    ]
  }
};

// public/shared/performers/vocal-tract-played.js
function playedTract(how, target, baked = vocal_tract_space_default) {
  const { rows } = baked[how], step = rows[1].target - rows[0].target;
  const at2 = Math.min(Math.max((target - rows[0].target) / step, 0), rows.length - 1), k = Math.min(Math.floor(at2), rows.length - 2), share = at2 - k;
  const [a, b] = [rows[k].resonances, rows[k + 1].resonances], blend = (u, v) => u ** (1 - share) * v ** share;
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
    const p = a[i], q = b[i];
    if (p && q) return { frequency: blend(p.frequency, q.frequency), q: blend(p.q, q.q), peak: blend(p.peak, q.peak) };
    const only = p ?? q;
    return { ...only, peak: only.peak * (p ? 1 - share : share) };
  }).filter((r) => r.peak > 0);
}

// public/shared/performers/vocal-tract.js
var VocalTract = class _VocalTract {
  constructor(resonances = []) {
    this.resonances = resonances.map((r) => ({ frequency: r.frequency, q: r.q, peak: r.peak }));
  }
  // The tract as the instrument's players keep it in normal playing at a note sounding at `hz`: the shape whose
  // resonance is held where they hold it under the notes it does not follow, and over them follows the note, some way
  // above it (Chen, Smith & Wolfe 2009 III.C: held near 600 Hz under notes of about 450 Hz, about 150 Hz above the note
  // over them, at about 9 MPa s/m^3), with every other resonance that shape has.
  static normal(instrument, hz) {
    return new _VocalTract(playedTract("normal", Math.max(player(instrument, "tract.normal.held"), hz + player(instrument, "tract.normal.offset"))));
  }
  // The tract bending a note: the shape whose resonance stands at `frequency` at the height bends and glissandi were
  // measured at (Chen, Smith & Wolfe 2009 III.B), the nearest the shapes come where they come no nearer.
  static bent(instrument, frequency) {
    playerEntry(instrument, "tract.bend.peak");
    return new _VocalTract(playedTract("bend", frequency));
  }
  // Its impedance at `hz` (complex, Pa s/m^3): what the reed meets upstream, in series with the bore's.
  impedance(hz) {
    let re = 0, im = 0;
    for (const { frequency, q, peak } of this.resonances) {
      const x = q * (hz / frequency - frequency / hz), d = 1 + x * x;
      re += peak / d;
      im -= peak * x / d;
    }
    return { re, im };
  }
  magnitude(hz) {
    const { re, im } = this.impedance(hz);
    return Math.hypot(re, im);
  }
  // As the engine's streaming player is told it (stream.rs TractLine): moved to over `seconds`.
  line(seconds) {
    return { resonances: this.resonances, seconds };
  }
};

// public/shared/performers/player-noise.js
var NOISED = (path) => player("instrument", `noise.${path}`);
var ACTION_PROFILE = Object.freeze({
  beta: NOISED("action.beta"),
  low: NOISED("action.low"),
  high: NOISED("action.high"),
  tremor: Object.freeze({ hz: NOISED("tremor.hz"), q: NOISED("tremor.q"), share: NOISED("tremor.share") })
});
var WINDS_NOISE = Object.freeze({
  kinds: Object.freeze({ breath: { sd: NOISED("breath.pressure"), path: ["breath", "pressure"] }, lips: { sd: NOISED("lips.tension"), path: ["lips", "tension"] } }),
  profile: ACTION_PROFILE
});
var windsNoiseKinds = (kind) => kind === "lips" ? ["breath", "lips"] : ["breath"];
function windsNoiseLine(what, temperature, seed2) {
  const { sd } = WINDS_NOISE.kinds[what], { beta, low, high, tremor } = WINDS_NOISE.profile;
  return { ...seed2 == null ? {} : { seed: seed2 }, what, sd, temperature, beta, low, high, tremor: { ...tremor } };
}

// public/shared/performers/turbulence.js
function turbulenceEntry(model) {
  let entry2;
  try {
    entry2 = playerEntry(model, "flow.turbulence");
  } catch {
    return null;
  }
  return { value: entry2.value, unit: entry2.unit, kind: entry2.kind, what: "its flow's turbulent fluctuation, a share of the flow per root hertz" };
}
var turbulenceOf = (model) => turbulenceEntry(model)?.value ?? null;

// public/shared/performers/bow.js
var PLANNER = (name) => setting("bow-planner", name);
var BOW = Object.freeze({
  // A violin: its strings' open pitches (G3 D4 A4 E5) and how far up the highest is played (semitones: to the top of its
  // compass; both the instrument registry's, instrument-ranges.js), and its bow (cm).
  strings: instrumentRange("violin").strings,
  reach: instrumentRange("violin").range[1] - instrumentRange("violin").strings.at(-1),
  lengthCm: value("violin", "bow.length"),
  // How fast the bow moves at each dynamic (cm a second): authored, a starting profile. Softer is slower here, as a
  // sustained soft tone is usually drawn; a player may as well draw a soft tone fast near the fingerboard (§5.4:
  // Schelleng's diagram, no universal table).
  speed: group("violin-family", "speed", "players"),
  // How long changing the bow's direction takes, a change inside a held note included, and a retake (the bow lifted and
  // set back at the frog or the tip): authored.
  changeSeconds: player("violin-family", "change.planned"),
  retakeSeconds: player("violin-family", "retake"),
  // Notes starting within this of each other are one group (s); bow positions within this are one state (cm); and where
  // a stroke may be set down to begin (a phrase's first, or after a retake), as shares of the bow from the frog.
  together: PLANNER("together"),
  positionGrain: PLANNER("positionGrain"),
  setDown: Object.freeze(PLANNER("setDown")),
  // Costs (authored): a direction change, a retake, a change inside a held note (an articulation changed).
  cost: Object.freeze({ change: PLANNER("costChange"), retake: PLANNER("costRetake"), hidden: PLANNER("costHidden") }),
  maxStates: PLANNER("maxStates")
});
var EPSILON = PLANNER("same");
var AT_ONCE = value("violin-family", "bow.stringsAtOnce");
var MARKS3 = Object.keys(DYNAMIC_VELOCITY);
var CENTRES = MARKS3.map((mark) => DYNAMIC_VELOCITY[mark]);
var INSIDE = CENTRES.slice(1, -1);

// public/shared/performers/bowed-line.js
var LINE_SETTING = (name) => setting("bowed-line", name);
var SAME = LINE_SETTING("same");
var JOIN_WITHIN = LINE_SETTING("joinWithin");
var MARGIN_GRAINS = LINE_SETTING("marginGrains");
var BISECTIONS = LINE_SETTING("bisections");
var REPAIRS_PER_NOTE = LINE_SETTING("repairsPerNote");
var REPAIRS_MORE = LINE_SETTING("repairsMore");
var SAME_PITCH = setting("strings-seat", "samePitch");
var bowed = (instrument, lengthCm) => {
  const { strings, range, register } = instrumentRange(instrument);
  return Object.freeze({ strings, reach: range[1] - strings.at(-1), lengthCm, register, range });
};
var BOW_CM = Object.freeze(Object.fromEntries(["violin", "viola", "cello", "contrabass"].map((name) => [name, value(name, "bow.length")])));
var BOWED_INSTRUMENTS = Object.freeze({
  ...Object.fromEntries(Object.entries(BOW_CM).map(([name, cm]) => [name, bowed(name, cm)])),
  ...Object.fromEntries(GIVEN_BOWED.map((i) => [i.name, bowed(i.name, bySize(BOW_CM, i.name))]))
});
var SLIDE = Object.freeze(Object.fromEntries(["violin", "viola", "cello", "contrabass"].map((name) => [name, player(name, "slide.most")])));
var BOWED_SLIDE_SPEED = Object.freeze({ ...SLIDE, ...Object.fromEntries(GIVEN_BOWED.map((i) => [i.name, bySize(SLIDE, i.name)])) });
var BOWED_LINE = Object.freeze({
  ...LINE,
  // How slowly a note may be drawn. A dynamic needs a string amplitude of about the bow's speed over its contact point
  // (beta, its distance from the bridge as a share of the string), and the contact point can come only so near the
  // bridge (Schoonderwaldt 2009, relayed by 7a: beta from about 0.3 at pp to 0.03 at f). So the slowest bow at a
  // dynamic is its speed (bow.js) times the nearest contact point over its usual one, and never slower than a tone holds
  // at (cm a second). The contact points by dynamic are authored within those measured ranges (registry/players/
  // bowed.json `line`, the violin family's: ours, unmeasured, the searches recorded).
  contact: group("violin-family", "line.contact", "players"),
  nearestContact: player("violin-family", "line.nearestContact"),
  slowestBow: player("violin-family", "line.slowestBow"),
  // How much faster than its dynamic's speed a note may be drawn (toward the fingerboard; authored), and the most a single
  // note too long for its bow is eased (dynamics) before it changes bow inside itself: one, so that a loud note stays
  // loud, its bow changed where one bow cannot hold it.
  fastestShare: player("violin-family", "line.fastestShare"),
  easeMost: player("violin-family", "line.easeMost")
});

// public/shared/performers/vibrato.js
var own = (id, path) => player(id, `vibrato.${path}`);
var every = (path) => group("instrument", `vibrato.${path}`, "players");
var rateWidth = (id) => Object.freeze({ rate: own(id, "rate"), width: own(id, "width") });
var MEASURED_VIBRATO = Object.freeze({
  violin: rateWidth("violin"),
  contrabass: rateWidth("contrabass"),
  register: group("violin-family", "vibrato.register", "players"),
  // from an instrument's lowest pitch to its highest
  forte: own("violin-family", "forte"),
  // cents wider at forte than at piano
  delay: Object.freeze([own("violin-family", "delay.least"), own("violin-family", "delay.most")])
  // s without vibrato as a note begins
});
var AUTHORED_VIBRATO = Object.freeze({
  viola: rateWidth("viola"),
  // between the violin's and the cello's
  cello: rateWidth("cello"),
  // its rate measured, its width narrower than the violin's (Geringer and Allen), how much authored
  spread: every("spread"),
  // between players: Hz, and a share of the width
  ending: every("ending"),
  // its rate rising by this share over a note's last seconds
  drift: every("drift"),
  // within a note: shares of its rate and width, wandering this fast
  onset: own("instrument", "onset"),
  // s over which its width grows once it begins
  step: setting("strings-compiler", "step")
  // s between the curve's points: a finger's path written a straight segment this long at a time
});
var WIND_VIBRATO = Object.freeze({
  flute: Object.freeze({ rate: 5, width: 30 }),
  piccolo: Object.freeze({ rate: 5.2, width: 24 }),
  alto: Object.freeze({ rate: 4.8, width: 30 }),
  oboe: Object.freeze({ rate: 5, width: 22 }),
  bassoon: Object.freeze({ rate: 5, width: 22 }),
  clarinet: Object.freeze({ rate: 5, width: 0 }),
  horn: Object.freeze({ rate: 4.7, width: 0 }),
  trumpet: Object.freeze({ rate: 4.8, width: 15.1 }),
  trombone: Object.freeze({ rate: 4.55, width: 0 }),
  tuba: Object.freeze({ rate: 4.7, width: 0 }),
  // (The rest of the woodwinds: the English horn's and contrabassoon's as their family's; the E-flat and bass clarinets'
  // none, as the clarinet's; the saxophones' their jaw's, a classical saxophonist's, wider than a double reed's.)
  "english-horn": Object.freeze({ rate: 5, width: 22 }),
  contrabassoon: Object.freeze({ rate: 5, width: 18 }),
  "e-flat-clarinet": Object.freeze({ rate: 5, width: 0 }),
  "bass-clarinet": Object.freeze({ rate: 5, width: 0 }),
  "soprano-saxophone": Object.freeze({ rate: 5.2, width: 26 }),
  "alto-saxophone": Object.freeze({ rate: 5.2, width: 26 }),
  "tenor-saxophone": Object.freeze({ rate: 5, width: 26 }),
  "baritone-saxophone": Object.freeze({ rate: 5, width: 22 })
});
var WIND_VIBRATO_REACH = Object.freeze({ clarinet: 20, "e-flat-clarinet": 20, "bass-clarinet": 16, horn: 16, trombone: 15.7, tuba: 16 });
var BOWED_VIBRATO = { violin: MEASURED_VIBRATO.violin, viola: AUTHORED_VIBRATO.viola, cello: AUTHORED_VIBRATO.cello, contrabass: MEASURED_VIBRATO.contrabass };
var of = (key, name) => bySize(Object.fromEntries(Object.entries(BOWED_VIBRATO).map(([n, v]) => [n, v[key]])), name);
var kinds = {
  ...AUTHORED_VIBRATO,
  violin: MEASURED_VIBRATO.violin,
  contrabass: MEASURED_VIBRATO.contrabass,
  ...WIND_VIBRATO,
  ...Object.fromEntries(GIVEN_BOWED.map((i) => [i.name, Object.freeze({ rate: of("rate", i.name), width: of("width", i.name) })]))
};
var deviate = equationOf("normal-deviate");
var ratioOf = equationOf("cents-ratio");
var VIBRATO_ARC = every("arc");
var SCOPE = own("instrument", "scope");
var FAMILY = {
  violin: "strings",
  viola: "strings",
  cello: "strings",
  contrabass: "strings",
  flute: "winds",
  piccolo: "winds",
  alto: "winds",
  oboe: "winds",
  bassoon: "winds",
  clarinet: "winds",
  "english-horn": "winds",
  contrabassoon: "winds",
  "e-flat-clarinet": "winds",
  "bass-clarinet": "winds",
  "soprano-saxophone": "winds",
  "alto-saxophone": "winds",
  "tenor-saxophone": "winds",
  "baritone-saxophone": "winds",
  horn: "brass",
  trumpet: "brass",
  trombone: "brass",
  tuba: "brass",
  ...Object.fromEntries(GIVEN_BOWED.map((i) => [i.name, "strings"]))
};

// render/synthesis/src/physical.mjs
var WIND_MODELS = Object.freeze({
  flute: Object.freeze({ backend: "openwind", model: "flute" }),
  oboe: Object.freeze({ backend: "openwind", model: "oboe" }),
  clarinet: Object.freeze({ backend: "openwind", model: "clarinet" }),
  bassoon: Object.freeze({ backend: "openwind", model: "bassoon" }),
  alto: Object.freeze({ backend: "openwind", model: "alto-flute" }),
  ...Object.fromEntries(["alto-flute", "piccolo", "e-flat-clarinet", "bass-clarinet", "english-horn", "contrabassoon", "soprano-saxophone", "alto-saxophone", "tenor-saxophone", "baritone-saxophone"].map((model) => [model, Object.freeze({ backend: "openwind", model })])),
  horn: Object.freeze({ backend: "ness", model: "horn" }),
  trumpet: Object.freeze({ backend: "ness", model: "trumpet" }),
  trombone: Object.freeze({ backend: "ness", model: "trombone" }),
  tuba: Object.freeze({ backend: "ness", model: "tuba" })
});
var WIND_MODELS_BY_DEFAULT = Object.freeze(Object.keys(WIND_MODELS));
var OPENWIND_WOODWINDS = Object.freeze(["clarinet", "oboe", "bassoon", "flute", "alto-flute", "piccolo", "e-flat-clarinet", "bass-clarinet", "english-horn", "contrabassoon", "soprano-saxophone", "alto-saxophone", "tenor-saxophone", "baritone-saxophone"]);
var WOODWIND_TONGUES = Object.freeze({ clarinet: "reed", oboe: "reed", bassoon: "reed", flute: "air", "alto-flute": "air", piccolo: "air", ...Object.fromEntries(["e-flat-clarinet", "bass-clarinet", "english-horn", "contrabassoon", "soprano-saxophone", "alto-saxophone", "tenor-saxophone", "baritone-saxophone"].map((model) => [model, "reed"])) });
var NESS_WOODWINDS = Object.freeze([
  "clarinet",
  "e-flat-clarinet",
  "bass-clarinet",
  "soprano-saxophone",
  "alto-saxophone",
  "tenor-saxophone",
  "baritone-saxophone",
  "oboe",
  "english-horn",
  "bassoon",
  "contrabassoon"
]);
var FIXED_PITCH = Object.freeze({ supercollider: Object.freeze(["piano", "membrane"]), openwind: OPENWIND_WOODWINDS, ness: NESS_WOODWINDS });
var BREATHES_VIBRATO = Object.freeze({ openwind: OPENWIND_WOODWINDS, ness: NESS_WOODWINDS });
var TECHNIQUES_REALIZED = Object.freeze({
  openwind: Object.freeze(Object.fromEntries(OPENWIND_WOODWINDS.map((model) => [model, Object.freeze(["hum", "growl", "flutter", "multiphonic"])]))),
  // (And NESS's brass: the same three in its mouth-pressure tremolo and noise, and a mute in its bore: ness.mjs.)
  ness: Object.freeze(Object.fromEntries(["trumpet", "trombone", "horn", "tuba"].map((model) => [model, Object.freeze(["hum", "growl", "flutter", "mute"])])))
});
var LEVELLED = Object.freeze(["openwind", "ness"]);

// render/synthesis/src/openwind-passages.mjs
var VIBRATO_SHARE = 4e-3;

// native/openwind/standing.mjs
var tractMeasured = (model) => {
  try {
    VocalTract.normal(model, 440);
    return true;
  } catch {
    return false;
  }
};
function playersTract(model, hz, raised = null) {
  if (!tractMeasured(model)) return [];
  return (raised ? VocalTract.bent(model, hz * raised) : VocalTract.normal(model, hz)).resonances;
}
var turbulenceLevel = (model) => turbulenceOf(model) ?? 0;
var NOISE_TEMPERATURES = Object.freeze({ player: 1, breath: 1, lips: 1 });
function noiseLines(kind, temperatures = NOISE_TEMPERATURES, seeded = false) {
  return windsNoiseKinds(kind).map((what, k) => windsNoiseLine(what, temperatures.player * temperatures[what], seeded && k === 0 ? DEFAULT_SEED : void 0));
}
var vibratoOf = (model) => {
  const own2 = WIND_VIBRATO[model] ?? WIND_VIBRATO[{ "alto-flute": "alto" }[model]] ?? { rate: 5, width: 0 };
  return { ...own2, reach: WIND_VIBRATO_REACH[model] ?? null };
};
var breathVibrato = (column, { width, rate }, seconds = 0) => ({ columns: [column], depths: [VIBRATO_SHARE * width / 2], cents: [false], rate, seconds });
if (globalThis.process?.argv?.[1] && decodeURIComponent(new URL(import.meta.url).pathname) === globalThis.process.argv[1]) {
  const [model, kind, pairs = "[]"] = process.argv.slice(2);
  console.log(JSON.stringify({
    turbulence: turbulenceLevel(model),
    noise: noiseLines(kind, NOISE_TEMPERATURES, true),
    vibrato: vibratoOf(model),
    share: VIBRATO_SHARE,
    tractSeconds: transition("tract").least,
    tracts: JSON.parse(pairs).map(([hz, raised]) => playersTract(model, hz, raised))
  }));
}

// render/synthesis/geometry/brass-mutes.json
var brass_mutes_default = {
  about: "Each brass instrument's mutes as its players' kit has them, mm (render/synthesis/src/brass-mutes.mjs muteIn sets each in its bell; NESS's and OpenWInD's bodies both take them). A straight mute: a cone closed at its wide end, open at its narrow tip, held in the bell by its corks -- inserted until they touch, where the bell is narrowest about it -- the sound out through the ring they leave, its hollow a resonator opening into the bell at its tip. A cup mute: a straight mute with a bowl round its wide end, the sound out of the bell into the bowl and out through the ring between its rim and the bell. A harmon: sealed in the bell by its cork, the sound through its chamber and out of its front hole, or the stem's tube and little bell in it. A stopping hand: the bell closed where it is `cork` wide to a ring `gap` wide. Each dimension {value, source}, and where nobody measured it a `range` -- what mutes of its kind are made within -- the value fitted to what was measured of mutes in their bells (render/synthesis/tools/fit_mutes.py: `fitted`, with its data) or, nothing measured to fit it to, the range's middle, said so (`chosen`).",
  instruments: {
    trumpet: {
      straight: {
        kind: "straight",
        length: { value: 160, source: "Denis Wick DW5504 trumpet straight mute, spun aluminium: 16 x 10.01 x 10.01 cm (its dealers' listings: johnpacker.co.uk/products/denis-wick-dw5504-bb-trumpet-bb-cornet-straight-mute, lamusainstrumentos.es/denis-wick-5504-trumpet-straight-mute.html; read 3 November 2026)" },
        base: { value: 100, source: "Denis Wick DW5504, as `length`" },
        tip: { value: 27, range: [20, 34], chosen: true, source: "its open tip's outer diameter: unmeasured (no maker gives it); within what the bell holds ahead of its corks" },
        gap: { value: 3.5, range: [2, 5], chosen: true, source: "its corks' thickness, the ring they leave: unmeasured; cork strip as mutes are corked" },
        wall: { value: 1, range: [0.6, 1.5], chosen: true, source: "spun aluminium's thickness: unmeasured" }
      },
      cup: {
        kind: "cup",
        length: { value: 150, range: [130, 170], chosen: true, source: "its cone's length to its bowl's bottom: unmeasured (Denis Wick DW5531 adjustable cup mute, 19.05 x 11.43 x 11.43 cm overall with its bowl: its dealers' listings, woodsysmusic.com/products/denis-wick-dw5531-adjustable-cup-mute-for-bb-trumpet-or-cornet; read 3 November 2026)" },
        base: { value: 90, range: [80, 100], chosen: true, source: "its cone's widest, where its bowl joins it: unmeasured" },
        tip: { value: 27, range: [20, 34], chosen: true, source: "as its straight mute's" },
        gap: { value: 3.5, range: [2, 5], chosen: true, source: "as its straight mute's" },
        wall: { value: 1, range: [0.6, 1.5], chosen: true, source: "as its straight mute's" },
        cup: { value: 114, source: "Denis Wick DW5531's bowl, its widest: 11.43 cm (as `length`)" },
        depth: { value: 30, range: [15, 45], chosen: true, source: "its bowl's depth past the bell's rim: unmeasured" },
        overlap: { value: 10, range: [4, 20], chosen: true, source: "how far its bowl's rim reaches back over the bell, the length of the ring the sound leaves by: unmeasured" },
        rimGap: { value: 6, range: [2, 12], chosen: true, source: "the ring between its bowl's rim and the bell, as it is set (an adjustable cup mute's): unmeasured; Martinez-Montejo et al. 2016 (ICA2016-399) measured a trumpet cup mute's first resonance in the bell near 1200 Hz, Campbell, Gilbert & Myers 2021 (doi:10.1121/at.2021.17.2.13) that it depends critically on this gap" }
      },
      "harmon-stem-out": {
        kind: "harmon",
        cork: { value: 52, range: [45, 60], chosen: true, source: "the bell's width where its cork seals it: unmeasured" },
        chamber: { value: [95, 85], range: [[85, 105], [70, 100]], chosen: true, source: "its chamber's diameter and length: unmeasured" },
        exit: { value: [22, 12], range: [[18, 28], [8, 16]], chosen: true, source: "its front hole's diameter and its neck's length, stem out: unmeasured" }
      },
      "harmon-stem-in": {
        kind: "harmon",
        cork: { value: 52, range: [45, 60], chosen: true, source: "as stem out" },
        chamber: { value: [95, 85], range: [[85, 105], [70, 100]], chosen: true, source: "as stem out" },
        exit: { value: [12, 60], range: [[10, 15], [50, 75]], chosen: true, source: "its stem's tube, diameter and length: unmeasured" },
        bell: { value: [34, 14], range: [[28, 40], [10, 20]], chosen: true, source: "its stem's little bell, diameter and length: unmeasured" }
      }
    },
    trombone: {
      straight: {
        kind: "straight",
        length: { value: 290, source: "Denis Wick DW5505 tenor trombone straight mute, spun aluminium: 29.01 x 14 x 14 cm (its dealers' listings: johnpacker.co.uk/products/denis-wick-dw5505-tenor-trombone-straight-mute, chamberlainmusic.com/products/dw5505; read 3 November 2026)" },
        base: { value: 140, source: "Denis Wick DW5505, as `length`" },
        tip: { value: 40, range: [30, 55], chosen: true, source: "its open tip's outer diameter: unmeasured" },
        gap: { value: 3.5, range: [2, 6], chosen: true, source: "its corks' thickness: unmeasured" },
        wall: { value: 1.2, range: [0.8, 2], chosen: true, source: "spun aluminium's thickness: unmeasured" }
      },
      cup: {
        kind: "cup",
        length: { value: 250, range: [220, 290], chosen: true, source: "its cone's length to its bowl: unmeasured (no maker's dimensions found)" },
        base: { value: 130, range: [115, 145], chosen: true, source: "its cone's widest: unmeasured" },
        tip: { value: 40, range: [30, 55], chosen: true, source: "as its straight mute's" },
        gap: { value: 3.5, range: [2, 6], chosen: true, source: "as its straight mute's" },
        wall: { value: 1.2, range: [0.8, 2], chosen: true, source: "as its straight mute's" },
        cup: { value: 185, range: [170, 200], chosen: true, source: "its bowl's widest: unmeasured" },
        depth: { value: 45, range: [25, 70], chosen: true, source: "its bowl's depth past the bell's rim: unmeasured" },
        overlap: { value: 15, range: [6, 30], chosen: true, source: "how far its bowl's rim reaches back over the bell: unmeasured" },
        rimGap: { value: 8, range: [3, 15], chosen: true, source: "the ring between its bowl's rim and the bell: unmeasured; Martinez-Montejo et al. 2016 measured a trombone cup mute damping its impedance's peaks above 800 Hz and keeping its tuning" }
      },
      "harmon-stem-out": {
        kind: "harmon",
        cork: { value: 86, range: [75, 100], chosen: true, source: "the bell's width where its cork seals it: unmeasured" },
        chamber: { value: [150, 130], range: [[135, 170], [110, 150]], chosen: true, source: "its chamber: unmeasured" },
        exit: { value: [30, 15], range: [[25, 38], [10, 20]], chosen: true, source: "its front hole: unmeasured" }
      },
      "harmon-stem-in": {
        kind: "harmon",
        cork: { value: 86, range: [75, 100], chosen: true, source: "as stem out" },
        chamber: { value: [150, 130], range: [[135, 170], [110, 150]], chosen: true, source: "as stem out" },
        exit: { value: [16, 85], range: [[13, 20], [70, 100]], chosen: true, source: "its stem's tube: unmeasured" },
        bell: { value: [48, 20], range: [[40, 56], [15, 25]], chosen: true, source: "its stem's little bell: unmeasured" }
      }
    },
    horn: {
      straight: {
        kind: "straight",
        length: { value: 190, source: "Denis Wick DW5524 French horn straight mute: 19 x 11.51 x 11.51 cm (its dealers' listings: lamusainstrumentos.es/en/denis-wick-5524-french-horn-straight-mute.html, target.com 7.48 x 4.53 x 4.53 in; read 3 November 2026)" },
        base: { value: 115, source: "Denis Wick DW5524, as `length`" },
        tip: { value: 40, range: [30, 55], chosen: true, source: "its open tip's outer diameter: unmeasured" },
        gap: { value: 4, range: [2, 7], chosen: true, source: "its corks' thickness: unmeasured (thicker corks open its sound, low notes less stable: D. Palacio Buil 2026, Technical and Acoustic Study on the Horn Mutes, researchcatalogue.net/view/3944849/3980181)" },
        wall: { value: 1.2, range: [0.8, 2], chosen: true, source: "spun aluminium's thickness: unmeasured" }
      },
      stopped: {
        kind: "hand",
        cork: { value: 95, range: [80, 110], chosen: true, source: "where the right hand closes the bell: unmeasured" },
        gap: { value: 2.5, range: [1, 4], chosen: true, source: "the ring the hand leaves: unmeasured" }
      }
    },
    tuba: {
      straight: {
        kind: "straight",
        length: { value: 725, range: [710, 740], source: "Denis Wick DW5518 tuba straight mute, spun aluminium: 73.99 x 32 x 32 cm, approx. 71 cm long (its dealers' listings: johnpacker.co.uk/prod/denis-wick-dw5518-tuba-mute-straight, thomann.co.uk/denis_wick_tuba_straight_dw5518.htm; read 3 November 2026), the two lengths its range" },
        base: { value: 320, source: "Denis Wick DW5518, as `length`" },
        tip: { value: 80, range: [60, 110], chosen: true, source: "its open tip's outer diameter: unmeasured" },
        gap: { value: 5, range: [3, 9], chosen: true, source: "its corks' thickness: unmeasured (its maker gives extra corks for larger tubas)" },
        wall: { value: 1.5, range: [1, 2.5], chosen: true, source: "spun aluminium's thickness: unmeasured" }
      }
    }
  },
  measuredInBells: [
    { instrument: "trombone", mute: "straight", parasitic: 77, source: `D. M. Campbell, J. Gilbert & A. Myers 2021, "'Put a Sock in It!' Mutes for Musical Horns", Acoustics Today 17(2) 13-21, doi:10.1121/at.2021.17.2.13, Fig. 10: a tenor trombone's impedance in first position with a straight mute, a small added peak at 77 Hz, its second to fourth peaks raised a little` },
    { instrument: "trombone", mute: "straight", parasitic: 140, source: "E. Martinez-Montejo, P. L. Rendon, L. Ruiz-Huerta, L. Vega-Alvarado & A. Caballero-Ruiz 2016, Characterisation of brass instruments with mutes through experimental means and finite-element simulations, Proc. 22nd ICA, ICA2016-399, Fig. 2: a small impedance peak at around 140 Hz, the peaks shifted up a little (research-downloads/brass/mutes/)" },
    { instrument: "trumpet", mute: "cup", risesAt: 1200, source: "Martinez-Montejo et al. 2016, Fig. 3: a distinct rise in the trumpet's impedance with its cup mute in near 1200 Hz, the cup mute's own first peak" }
  ]
};

// render/synthesis/src/brass-mutes.mjs
var BRASS_MUTES = brass_mutes_default.instruments;

// public/shared/performers/personality.js
var RHYTHM_LEVERS = Object.freeze(["tuplets", "syncopation"]);
var LATER_LEVERS = Object.freeze(["themes"]);
var LEVERS = Object.freeze(["daring", "density", "loudness", "fioriture", "leap", "slurs", "motifLength", "runs", "rests", "commas", "landing", "phraseRange", "quoting", "tone", ...RHYTHM_LEVERS, ...LATER_LEVERS]);
var TONE_RANGES = Object.freeze(["vibrato", "depth", "pressure", "contact"]);
var RANGE = "personality";
var ORDINARY = Object.freeze({ vibrato: () => 1 / setting(RANGE, "vibratoMost"), depth: () => 0, pressure: () => 1 / 2, contact: () => 1 / 2 });

// public/shared/estimation/harmonic-series.js
var SERIES = Object.freeze({ window: 16384, reading: 8192, apart: 0.4, floor: -45, peaks: 12, cents: 30, series: 0.95, lowest: 3, lattice: 0.9, steady: 30, simplest: 4, silent: -60 });

// public/shared/sha1.js
var encoder = new TextEncoder();
var rotl = (x, n) => x << n | x >>> 32 - n;
function sha1Hex(text) {
  const bytes = encoder.encode(text), n = bytes.length, blocks = (n + 8 >> 6) + 1, w = new Uint32Array(blocks * 16);
  for (let i = 0; i < n; i++) w[i >> 2] |= bytes[i] << 24 - (i & 3) * 8;
  w[n >> 2] |= 128 << 24 - (n & 3) * 8;
  w[blocks * 16 - 2] = Math.floor(n / 536870912);
  w[blocks * 16 - 1] = n * 8 >>> 0;
  let h0 = 1732584193, h1 = 4023233417, h2 = 2562383102, h3 = 271733878, h4 = 3285377520;
  const m = new Uint32Array(80);
  for (let b = 0; b < blocks; b++) {
    for (let t = 0; t < 16; t++) m[t] = w[b * 16 + t];
    for (let t = 16; t < 80; t++) m[t] = rotl(m[t - 3] ^ m[t - 8] ^ m[t - 14] ^ m[t - 16], 1);
    let a = h0, bb = h1, c = h2, d = h3, e = h4;
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? bb & c | ~bb & d : t < 40 ? bb ^ c ^ d : t < 60 ? bb & c | bb & d | c & d : bb ^ c ^ d, k = t < 20 ? 1518500249 : t < 40 ? 1859775393 : t < 60 ? 2400959708 : 3395469782;
      const next = rotl(a, 5) + f + e + k + m[t] >>> 0;
      e = d;
      d = c;
      c = rotl(bb, 30) >>> 0;
      bb = a;
      a = next;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + bb >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, "0")).join("");
}

// native/openwind/finger-holes.json
var finger_holes_default = {
  about: "Each charted woodwind's holes a finger covers itself and can hold part-way, as its body names them (body.json holes); every other hole a padded key's, open or shut: scripts/make-finger-holes.mjs, from fingering-diagrams.json's keywork.",
  instruments: {
    "alto-flute": [
      "h_A4",
      "h_A_sharp4",
      "h_E4",
      "h_F4",
      "h_F_sharp4"
    ],
    "alto-saxophone": [],
    "baritone-saxophone": [],
    "bass-clarinet": [],
    bassoon: [
      "h_A2",
      "h_B2",
      "h_C3",
      "h_D3",
      "h_E3",
      "h_F3"
    ],
    clarinet: [
      "h166",
      "h178",
      "h211",
      "h235",
      "h291",
      "h318",
      "h340"
    ],
    contrabassoon: [],
    "e-flat-clarinet": [
      "h166",
      "h178",
      "h211",
      "h235",
      "h291",
      "h318",
      "h340"
    ],
    "english-horn": [
      "h_A4",
      "h_B4",
      "h_C_sharp5",
      "h_E4",
      "h_G4",
      "h_fork-F"
    ],
    flute: [
      "h_A4",
      "h_A_sharp4",
      "h_E4",
      "h_F4",
      "h_F_sharp4"
    ],
    oboe: [
      "h_A4",
      "h_B4",
      "h_C_sharp5",
      "h_E4",
      "h_G4",
      "h_fork-F"
    ],
    piccolo: [
      "h_A4",
      "h_A_sharp4",
      "h_E4",
      "h_F4",
      "h_F_sharp4"
    ],
    "soprano-saxophone": [],
    "tenor-saxophone": []
  }
};

// native/openwind/blend.mjs
function shadedColumns(model, columns, holes) {
  const own2 = finger_holes_default.instruments[model];
  if (!own2) throw new Error(`no keywork's finger holes for the ${model} (native/openwind/finger-holes.json)`);
  return new Set(columns.flatMap((c, k) => c[0] === "opening" && own2.includes(holes[c[1]]) ? [k] : []));
}
var padsMoved = (a, b, columns, shaded) => a.flatMap((x, c) => columns[c][0] === "opening" && !shaded.has(c) && x !== b[c] ? [c] : []);
function blendRows(a, b, share, columns, shaded) {
  return a.map((x, c) => {
    const kind = columns[c][0];
    if (kind === "reed" && x > 0 && b[c] > 0) return x * (b[c] / x) ** share;
    if (kind === "opening" && !shaded.has(c)) return share < 0.5 ? x : b[c];
    return x + (b[c] - x) * share;
  });
}
function shareAt(glide, pitch, padded = false) {
  for (let k = 1; k < glide.length; k++) {
    const [s0, p0] = glide[k - 1], [s1, p1] = glide[k];
    if (p0 == null || p1 == null || (p0 - pitch) * (p1 - pitch) > 0 || padded && s0 < 0.5 && s1 >= 0.5) continue;
    return p1 === p0 ? s0 : s0 + (s1 - s0) * (pitch - p0) / (p1 - p0);
  }
  return null;
}
var GLIDE_EAR = `series ${SERIES.reading} ${SERIES.series}`;
var GlideBook = class {
  constructor({ columns, shaded, kept = {}, steps = 24 }) {
    this.columns = columns;
    this.shaded = shaded;
    this.kept = kept;
    this.steps = steps;
    this.waiting = [];
    this.asked = /* @__PURE__ */ new Map();
    this.working = false;
  }
  key(a, b) {
    const padded = padsMoved(a, b, this.columns, this.shaded);
    return sha1Hex(JSON.stringify({ a, b, steps: this.steps, ear: GLIDE_EAR, ...padded.length ? { padded } : {} })).slice(0, 20);
  }
  // (The glide from row `a` to row `b` where it is kept, else null: none measured.)
  known(a, b) {
    return this.kept[this.key(a, b)] ?? null;
  }
  // The glide from row `a` to row `b`: [[share, pitch], ...], measured where it is not kept.
  glide(a, b, { now = false } = {}) {
    const key = this.key(a, b);
    if (this.kept[key]) return Promise.resolve(this.kept[key]);
    if (!this.measure) return Promise.reject(new Error("a glide not measured where it was kept"));
    let job = this.asked.get(key);
    if (job) {
      if (now && this.waiting.includes(job)) {
        this.waiting.splice(this.waiting.indexOf(job), 1);
        this.waiting.unshift(job);
        job.now = true;
      }
      return job.promise;
    }
    job = { key, a, b, now };
    job.promise = new Promise((done, fail) => Object.assign(job, { done, fail }));
    this.asked.set(key, job);
    now ? this.waiting.unshift(job) : this.waiting.push(job);
    this.work();
    return job.promise;
  }
  async work() {
    if (this.working) return;
    this.working = true;
    while (this.waiting.length) {
      const job = this.waiting.shift();
      try {
        const glide = await this.measure(job);
        if (this.stopped) throw new Error("the glides were stopped");
        this.kept[job.key] = glide;
        this.keep?.(this.kept);
        job.done(glide);
      } catch (error) {
        job.fail(error);
      }
      this.asked.delete(job.key);
    }
    this.working = false;
  }
  // Every glide still asked for given up (the dial's instrument changed).
  stop() {
    this.stopped = true;
    const given2 = new Error("the glides were stopped");
    for (const job of this.waiting.splice(0)) job.fail(given2);
    this.asked.clear();
  }
};
function pairsAbout(pitch, notes, near) {
  const order = notes.map((m, k) => k).sort((a, b) => notes[a] - notes[b]);
  const pairs = order.slice(0, -1).map((k, i) => [k, order[i + 1]]);
  const away = ([k, next]) => pitch < notes[k] ? notes[k] - pitch : pitch > notes[next] ? pitch - notes[next] : 0;
  return [...pairs].sort((x, y) => away(x) - away(y)).slice(0, near);
}
function measuredAbout(pitch, { notes, rows, columns, shaded, glides, near = 4 }) {
  for (const [k, next] of pairsAbout(pitch, notes, near)) {
    const glide = glides.known?.(rows[k], rows[next]) ?? null;
    if (!glide) return false;
    if (shareAt(glide, pitch, padsMoved(rows[k], rows[next], columns, shaded).length > 0) !== null) return true;
  }
  return true;
}
function provisionalRow(pitch, { notes, rows, columns, shaded }) {
  const order = notes.map((m, k2) => k2).sort((a, b) => notes[a] - notes[b]), above = order.findIndex((k2) => notes[k2] >= pitch), i = above < 0 ? order.length - 1 : Math.max(1, above), k = order[i - 1], next = order[i];
  const share = notes[next] === notes[k] ? 0 : Math.min(1, Math.max(0, (pitch - notes[k]) / (notes[next] - notes[k])));
  return { low: notes[k], high: notes[next], share, row: blendRows(rows[k], rows[next], share, columns, shaded), sounds: null, provisional: true };
}
async function rowSounding(pitch, { notes, rows, columns, shaded, glides, near = 4 }) {
  let nearest = null;
  for (const [k, next] of pairsAbout(pitch, notes, near)) {
    const glide = await glides.glide(rows[k], rows[next], { now: true }), share = shareAt(glide, pitch, padsMoved(rows[k], rows[next], columns, shaded).length > 0);
    const of2 = (s) => ({ low: notes[k], high: notes[next], share: s, row: blendRows(rows[k], rows[next], s, columns, shaded) });
    if (share !== null) return { ...of2(share), sounds: pitch };
    for (const [s, p] of glide) if (p != null && (!nearest || Math.abs(p - pitch) < Math.abs(nearest.sounds - pitch))) nearest = { ...of2(s), sounds: p };
  }
  if (!nearest) throw new Error(`nothing near ${pitch} sounds`);
  return nearest;
}

// native/openwind/alternates.mjs
function fingeringAmong(alternatives, row, before, columns, holes) {
  if (!alternatives || !before || before.length !== row.length) return { row, documented: null };
  const opening = columns.flatMap((c, k) => c[0] === "opening" ? [[k, holes[c[1]]]] : []), [standard] = alternatives;
  const varied = opening.filter(([, h]) => alternatives.some((a) => (a.open[h] ?? 0) !== (standard.open[h] ?? 0)));
  if (varied.some(([k, h]) => row[k] !== (standard.open[h] ?? 0))) return { row, documented: null };
  let best = null;
  for (const a of alternatives) {
    const own2 = [...row];
    for (const [k, h] of varied) own2[k] = a.open[h] ?? 0;
    const moved = opening.reduce((sum, [k]) => sum + Math.abs(own2[k] - before[k]), 0);
    if (!best || moved < best.moved) best = { row: own2, documented: a.documented, moved };
  }
  return { row: best.row, documented: best.documented };
}

// native/openwind/dial-reach.json
var dial_reach_default = {
  about: "How far the live dial (native/openwind/live.mjs) moves a column it multiplies: from 1/factor to factor times its rules' value. Read by live.mjs, and by render/synthesis/workers/openwind_bodies.py ring_of, which lays a flute's jet memory out to hold the longest delay the dial can ask (its jet's delay constant at factor times its rules', its breath at 1/factor, floored at JET_FLOOR) -- one reach, so that the dial and the body cannot part (31 October 2026).",
  factor: 4
};

// render/synthesis/breath-literature.json
var breath_literature_default = {
  schema: "musebots.breath-literature/1",
  about: "Wind players' mouth pressures as measured, each instrument's tables as their sources publish them (a list, one table a source's): read by workers/woodwind_reeds.py (breath_means) for its players' laws",
  sources: {
    "fuks-sundberg-1996": `L. Fuks & J. Sundberg 1996, "Blowing pressures in reed woodwind instruments", KTH TMH-QPSR 37(3), 41-57 (https://www.speech.kth.se/music/publications/leofuks/thesis/paper1/ifuks4.html; research-downloads/winds/fuks-sundberg-1996-blowing-pressures-tables.html), revised as "Blowing pressures in bassoon, clarinet, oboe and saxophone", Acta Acustica united with Acustica 85 (1999), 267-277: two professional players of each instrument, a pressure transducer in the mouth's corner; Appendix Tables A1-A2 (clarinet players Cl1, Cl2), A3-A4 (alto saxophone, Sx1, Sx2), A5-A6 (oboe, Ob1, Ob2), A7-A8 (bassoon, Bn1, Bn2), each pitch's mean over its repetitions in an arpeggio, ascending then descending, at pp, mp, mf and ff (sounding pitches as the tables name them)`,
    "pamies-vila-2018": 'M. Pamies-Vila, A. Hofmann & V. Chatziioannou 2018, "Analysis of tonguing and blowing actions during clarinet performance", Frontiers in Psychology 9, 617, doi:10.3389/fpsyg.2018.00617 (research-downloads/winds/pamies-vila-2018-tonguing-blowing.pdf): ten clarinettists, the mean mouth pressure over a melody at piano and forte, slow tempo, Table 1 (mean and standard deviation across players)'
  },
  clarinet: [
    {
      source: "fuks-sundberg-1996",
      tables: "A1-A2",
      unit: "cm H2O",
      pitches: [
        "Eb3",
        "G3",
        "Bb3",
        "Eb4",
        "G4",
        "Bb4",
        "Eb5",
        "G5",
        "Bb5",
        "Eb6",
        "Bb5",
        "G5",
        "Eb5",
        "Bb4",
        "G4",
        "Eb4",
        "Bb3",
        "G3",
        "Eb3"
      ],
      players: {
        Cl1: {
          ff: [
            65,
            55,
            46,
            47,
            46,
            50,
            46,
            45,
            43,
            37,
            37,
            38,
            48,
            51,
            46,
            44,
            43,
            46,
            47
          ],
          mf: [
            43,
            41,
            39,
            39,
            40,
            43,
            39,
            33,
            34,
            31,
            32,
            34,
            39,
            44,
            37,
            37,
            36,
            40,
            42
          ],
          mp: [
            33,
            32,
            30,
            32,
            32,
            34,
            31,
            29,
            28,
            26,
            27,
            28,
            31,
            34,
            30,
            30,
            30,
            33,
            33
          ],
          pp: [
            26,
            26,
            24,
            25,
            26,
            29,
            26,
            24,
            23,
            23,
            23,
            24,
            25,
            27,
            24,
            24,
            24,
            25,
            26
          ]
        },
        Cl2: {
          ff: [
            59,
            60,
            59,
            56,
            53,
            55,
            52,
            50,
            44,
            40,
            40,
            45,
            48,
            49,
            46,
            46,
            48,
            50,
            51
          ],
          mf: [
            42,
            42,
            39,
            38,
            37,
            43,
            41,
            37,
            34,
            31,
            33,
            36,
            39,
            40,
            35,
            36,
            36,
            38,
            38
          ],
          mp: [
            32,
            32,
            31,
            31,
            30,
            35,
            33,
            31,
            29,
            29,
            29,
            31,
            33,
            34,
            28,
            29,
            28,
            29,
            30
          ],
          pp: [
            28,
            27,
            27,
            27,
            25,
            31,
            30,
            29,
            27,
            31,
            29,
            30,
            31,
            33,
            27,
            27,
            27,
            27,
            27
          ]
        }
      }
    },
    {
      source: "pamies-vila-2018",
      unit: "kPa",
      players: 10,
      means: {
        p: 2.7,
        f: 3.8
      },
      spreads: {
        p: 0.3,
        f: 0.6
      },
      note: "Table 1, slow tempo (forte at the fast tempo 4.1 to 4.2 kPa); legato, portato and staccato the same. W. Li et al. 2016's pp 1.9-2.4 and ff 2.6-3.6 kPa (JASA 139, 825, doi:10.1121/1.4941660) are averaged over each attack's rise, not a held note: not here"
    }
  ],
  "alto-saxophone": [
    {
      source: "fuks-sundberg-1996",
      tables: "A3-A4",
      unit: "cm H2O",
      pitches: [
        "Eb3",
        "G3",
        "Bb3",
        "Eb4",
        "G4",
        "Bb4",
        "Eb5",
        "G5",
        "Eb5",
        "Bb4",
        "G4",
        "Eb4",
        "Bb3",
        "G3",
        "Eb3"
      ],
      players: {
        Sx1: {
          ff: [
            25,
            37,
            43,
            45,
            61,
            60,
            49,
            43,
            45,
            48,
            55,
            35,
            34,
            37,
            26
          ],
          mf: [
            21,
            24,
            28,
            29,
            40,
            39,
            32,
            29,
            32,
            32,
            35,
            26,
            24,
            25,
            21
          ],
          mp: [
            20,
            23,
            22,
            24,
            30,
            28,
            26,
            24,
            26,
            27,
            30,
            24,
            23,
            25,
            21
          ],
          pp: [
            20,
            21,
            20,
            21,
            24,
            23,
            22,
            21,
            22,
            23,
            26,
            21,
            20,
            22,
            21
          ]
        },
        Sx2: {
          ff: [
            28,
            36,
            31,
            34,
            48,
            54,
            51,
            45,
            44,
            43,
            43,
            32,
            28,
            28,
            25
          ],
          mf: [
            16,
            19,
            18,
            19,
            28,
            27,
            25,
            24,
            24,
            26,
            27,
            19,
            18,
            20,
            16
          ],
          mp: [
            19,
            20,
            18,
            19,
            25,
            24,
            22,
            22,
            22,
            23,
            25,
            20,
            18,
            20,
            18
          ],
          pp: [
            21,
            21,
            18,
            18,
            23,
            22,
            20,
            20,
            20,
            21,
            23,
            19,
            18,
            21,
            20
          ]
        }
      }
    }
  ],
  oboe: [
    {
      source: "fuks-sundberg-1996",
      tables: "A5-A6",
      unit: "cm H2O",
      pitches: [
        "Bb3",
        "D4",
        "F4",
        "Bb4",
        "D5",
        "F5",
        "Bb5",
        "D6",
        "Bb5",
        "F5",
        "D5",
        "Bb4",
        "F4",
        "D4",
        "Bb3"
      ],
      players: {
        Ob1: {
          ff: [
            41,
            46,
            52,
            56,
            62,
            68,
            69,
            80,
            70,
            62,
            56,
            46,
            45,
            41,
            42
          ],
          mf: [
            40,
            43,
            47,
            48,
            52,
            57,
            57,
            62,
            59,
            54,
            48,
            43,
            39,
            38,
            38
          ],
          mp: [
            37,
            39,
            41,
            42,
            45,
            50,
            51,
            53,
            52,
            49,
            44,
            40,
            38,
            37,
            35
          ],
          pp: [
            39,
            40,
            41,
            41,
            45,
            48,
            46,
            50,
            46,
            45,
            43,
            41,
            41,
            39,
            39
          ]
        },
        Ob2: {
          ff: [
            52,
            63,
            70,
            77,
            82,
            103,
            118,
            113,
            120,
            94,
            78,
            69,
            59,
            56,
            50
          ],
          mf: [
            40,
            45,
            48,
            55,
            57,
            70,
            78,
            74,
            76,
            64,
            56,
            52,
            44,
            42,
            38
          ],
          mp: [
            40,
            39,
            40,
            43,
            47,
            50,
            57,
            56,
            54,
            51,
            46,
            41,
            39,
            38,
            38
          ],
          pp: [
            42,
            42,
            41,
            43,
            45,
            48,
            50,
            51,
            49,
            47,
            44,
            41,
            40,
            39,
            39
          ]
        }
      }
    }
  ],
  bassoon: [
    {
      source: "fuks-sundberg-1996",
      tables: "A7-A8",
      unit: "cm H2O",
      pitches: [
        "Bb1",
        "D2",
        "F2",
        "Bb2",
        "D3",
        "F3",
        "Bb3",
        "D4",
        "F4",
        "Bb4",
        "F4",
        "D4",
        "Bb3",
        "F3",
        "D3",
        "Bb2",
        "F2",
        "D2",
        "Bb1"
      ],
      players: {
        Bn1: {
          ff: [
            26,
            27,
            31,
            35,
            35,
            37,
            53,
            61,
            65,
            56,
            58,
            60,
            52,
            37,
            35,
            32,
            25,
            25,
            23
          ],
          mf: [
            18,
            21,
            23,
            28,
            28,
            30,
            39,
            45,
            48,
            43,
            43,
            44,
            38,
            28,
            25,
            26,
            20,
            19,
            15
          ],
          mp: [
            15,
            17,
            17,
            21,
            21,
            24,
            31,
            37,
            38,
            33,
            36,
            35,
            31,
            25,
            22,
            23,
            19,
            17,
            16
          ],
          pp: [
            13,
            16,
            16,
            19,
            19,
            22,
            28,
            32,
            33,
            29,
            32,
            32,
            28,
            23,
            21,
            21,
            17,
            16,
            16
          ]
        },
        Bn2: {
          ff: [
            19,
            21,
            22,
            25,
            24,
            26,
            34,
            38,
            42,
            40,
            44,
            40,
            32,
            25,
            23,
            23,
            19,
            19,
            17
          ],
          mf: [
            12,
            13,
            14,
            16,
            16,
            18,
            23,
            27,
            29,
            27,
            29,
            28,
            24,
            20,
            19,
            19,
            17,
            17,
            16
          ],
          pp: [
            13,
            14,
            14,
            16,
            16,
            18,
            22,
            24,
            27,
            27,
            28,
            25,
            22,
            18,
            17,
            16,
            15,
            15,
            13
          ]
        }
      },
      note: "Bn2's mp row, as the page gives it, is Bn1's mp row repeated value for value -- over Bn2's own mf at every pitch -- a transcription's slip: left out, Bn2's mp read from Bn1's at Bn2's own level against Bn1's (workers/woodwind_reeds.py breath_means)"
    }
  ]
};

// render/synthesis/reed-literature.json
var reed_literature_default = {
  schema: "musebots.reed-literature/1",
  source: `J. Chabassier & R. Auvray 2022, "Control parameters for reed wind instruments or organ pipes with reed induced flow", Proceedings of the 25th International Conference on Digital Audio Effects (DAFx20in22), Vienna, Table 1: the clarinet-like reeds' dimensioned values found in the literature; the values they set in italic (guessed, not found in the reference) left out (null)`,
  use: "tools/fit_reed.py: each single reed's parameter's prior spread, the standard deviation of its logarithm over these reeds -- how far published reeds stand from one another (tools/measured_registry.py exciter_spreads); workers/woodwind_reeds.py: each kind's damping as its player's lip leaves it, the geometric mean of its reeds' `qr` measured under a player's lip (LIP_QR); workers/openwind_worker.py: the saxophones' reed's resonance, the geometric middle of its kind's measured under a lip (`lip` foam), and the stiffness per area measured under a player's lip (`lip` player) that checks its reed's (SAX_REED). Rows after Chabassier & Auvray's: [6]'s and [8]'s, added from their papers, each with its size, the lip it was measured under (`lip`: a player's, or a foam lip) and, where measured, its stiffness and resistance per area",
  references: {
    "[1]": 'S. Bilbao 2008, "Direct simulation for wind instrument synthesis", DAFx-08, 145-152',
    "[2]": 'V. Chatziioannou & M. van Walstijn 2012, "Estimation of clarinet reed parameters by inverse modelling", Acta Acustica united with Acustica 98(4), 629-639',
    "[3]": 'F. Avanzini & D. Rocchesso 2002, "Efficiency, accuracy, and stability issues in discrete-time simulations of single reed wind instruments", JASA 111(5), 2293-2301',
    "[4]": 'M. van Walstijn 2002, "Discrete-time modelling of brass and reed woodwind instruments with application to musical sound synthesis", PhD thesis, University of Edinburgh',
    "[6]": 'A. Munoz Arancon, B. Gazengel, J.-P. Dalmont & E. Conan 2016, "Estimation of saxophone reed parameters during playing", JASA 139(5), 2754-2765, doi:10.1121/1.4948774',
    "[7]": 'V. Chatziioannou, S. Schmutzhard, M. Pamies-Vila & A. Hofmann 2019, "Investigating clarinet articulation using a physical model and an artificial blowing machine", Acta Acustica united with Acustica 105(4), 682-694',
    "[8]": `D. Tonetti & E. A. Piana 2025, "Imaging based saxophone reed modelling", Forum Acusticum / EuroNoise 2025, Malaga, 2871-2876, doi:10.61782/fa.2025.0442 (checked on Crossref; CC BY 3.0; research-downloads/winds/saxophone-reed/tonetti-piana-2025-sax-reed-imaging.pdf): a synthetic tenor reed (Legere 3) on its mouthpiece, its tip filmed at 10 kHz under a sine sweep, a foam lip loaded 0 to 1000 g; their Table 1, a one-degree oscillator fitted to each load's transfer function`,
    "[9]": `A. Gaillard, V. Koehl & B. Gazengel 2024, "Theoretical and experimental studies about single cane reeds: a review", Acta Acustica 8, 63, doi:10.1051/aacus/2024050 (checked on Crossref; research-downloads/winds/saxophone-reed/aacus240040.pdf): Table A7, the reed + lip's equivalent parameters published (clarinet: damping rates 453 to 2900 /s, damping factors 0.03 to 0.24; the tenor saxophone, [6]'s); Table A4, Nederveen's measured stiffness by saxophone size (soprano 1e7, alto 8.33e6, tenor 3.33e6 N/m3)`,
    "[11]": `V. Chatziioannou 2010, "Forward and inverse modelling of single-reed woodwind instruments with application to digital sound synthesis", PhD thesis, Queen's University Belfast (research-downloads/winds/from-owner-2026-11-05/chatziioannou-2010-thesis-single-reed-inverse-modelling.pdf): its Table 6.1, a clarinet reed's parameters estimated from a real player's blowing (its chapter 6, "a real player-clarinet system"), two of its takes, beating smoothly and strongly -- its reed m y'' + m g y' + Ka y, g its damping (1/s), Sr its area for its flow, ym its opening; its resonance the root of Ka over m`,
    "[12]": `J.-M. Chen, J. Smith & J. Wolfe 2011, "Saxophonists tune vocal tract resonances in advanced performance techniques", JASA 129(1), 415-426, doi:10.1121/1.3514423 (checked on Crossref; research-downloads/winds/vocal-tract/chen-smith-wolfe-2011-saxophonists-tune-vocal-tract-resonances.pdf): its II.A, the tenor saxophone reed's effective compliance in playing conditions (Benade's technique: played on cylindrical pipes), Legere synthetic reeds of hardness 2.5, 3, 3.5 and 4`,
    "[10]": `D. Tonetti & E. A. Piana 2026, "Saxophone acoustical modeling and vibrato 'a la machoire' sound synthesis", JASA 159, 141-156, doi:10.1121/10.0041870 (checked on Crossref; research-downloads/winds/from-owner-2026-10-25/141_1_10.0041870.pdf): [8]'s reed against [6]'s, whose in-vivo damping is some eight times its foam lip's and its resonance half -- the lip's material, they say, sets the damping; a saxophonist's vibrato matched at a blowing pressure of 2.3 kPa`
  },
  reeds: [
    { ref: "[4] Fig 10.17 A", instrument: "clarinet", massPerArea: 0.052, section: 8e-5, opening: 85e-5, width: null, dissip: 3e3, hz: 1900 },
    { ref: "[4] Fig 10.17 B", instrument: "clarinet", massPerArea: 0.035, section: 55e-6, opening: 106e-5, width: null, dissip: 3e3, hz: 2400 },
    { ref: "[4] Fig 10.17 C", instrument: "clarinet", massPerArea: 0.035, section: 38e-6, opening: 123e-5, width: null, dissip: 3e4, hz: 3e3 },
    { ref: "[3] Tab. I", instrument: "clarinet", massPerArea: 0.0231, section: 146e-6, opening: 4e-4, width: 0.0634, dissip: 3e3, hz: 3700 },
    { ref: "[1] Fig. 7", instrument: "clarinet", massPerArea: 0.0231, section: 146e-6, opening: 4e-4, width: 0.01, dissip: 3e3, hz: 3700 },
    { ref: "[2] Tab. I", instrument: "clarinet", massPerArea: 0.05, section: 7e-5, opening: 4e-4, width: 0.013, dissip: 3e3, hz: 2747 },
    { ref: "[2] Tab. II", instrument: "clarinet", lip: "player", nonlinearStiffness: 37e10, massPerArea: 0.056, section: 177e-6, opening: 255e-6, width: 0.012, dissip: 453, hz: 2368 },
    {
      ref: "[6] Tab VI",
      instrument: "saxophone",
      lip: "player",
      nonlinearStiffness: 7e11,
      massPerArea: null,
      section: null,
      opening: 36e-5,
      width: null,
      dissip: null,
      hz: null,
      size: "tenor",
      stiffness: 48e5,
      resistance: 1e3,
      notMeasured: `its massPerArea (0.269), and the hz (672) and dissip (3717) Chabassier & Auvray derive from it, and its qr with them (0.88: the reed and its player's lip as played, its damping over its resonance (R over the root of K times M: 1.0e3 over the root of 4.8e6 x 0.269) -- of the measured reeds' damping the one taken under a player's lip with its mass (A. Gaillard, V. Koehl & B. Gazengel 2024, Acta Acustica 8, 63, doi:10.1051/aacus/2024050, Table A7: 'measured', 0.88), its mass not accurately estimated: with RKnl's stiffness and resistance at p and mf (Table V) and this mass, 1.45 and 1.09; taken until 7 November 2026, its reed's lag, 0.2 ms, pulled every saxophone's upper first register 100 to 460 cents under its reed-free resonance at its threshold, where UNSW's soprano, played, stands at its maxima): its authors' Table VI "provides some improvement ... though the mass is not accurately estimated because a linear modeling of the inertial effects is employed. This result is presented as an insight" (p. 2763), their reed at mf an oscillator of stiffness and damping, "the effect of mass (inertia) being very small" (abstract); its stiffness K 4.8e6 Pa/m and damping R 1.0e3 Pa s/m its measurements`
    },
    { ref: "[6] Tab V p", instrument: "saxophone", lip: "player", massPerArea: null, section: null, opening: null, width: null, dissip: null, hz: null, size: "tenor", stiffness: 64e5, resistance: 1900, note: "their reed at p as a spring and damper (RKnl), played by a saxophonist: its stiffness and resistance per area measured, its mass none" },
    { ref: "[6] Tab V mf", instrument: "saxophone", lip: "player", massPerArea: null, section: null, opening: null, width: null, dissip: null, hz: null, size: "tenor", stiffness: 45e5, resistance: 1200, note: "their reed at mf as a spring and damper (RKnl), played by a saxophonist: its stiffness and resistance per area measured, its mass none" },
    { ref: "[8] Tab. 1 250 g", instrument: "saxophone", lip: "foam", massPerArea: 0.1674, section: null, opening: null, width: null, dissip: 1036, hz: 1526, size: "tenor", stiffness: 154e5, resistance: 173.4, derived: "their kr 1.54e+07 Pa/m, wr 9.59e+03 rad/s, xi 0.054 at a foam lip loaded 250 g: massPerArea kr/wr^2, dissip 2 xi wr, resistance dissip x massPerArea", qr: 0.108, qrOf: "the reed under the lip as their synthesis played it, its damping over its resonance, 2 xi" },
    { ref: "[8] Tab. 1 500 g", instrument: "saxophone", lip: "foam", massPerArea: 0.1524, section: null, opening: null, width: null, dissip: 1238, hz: 1579, size: "tenor", stiffness: 15e6, resistance: 188.7, derived: "their kr 1.5e+07 Pa/m, wr 9.92e+03 rad/s, xi 0.0624 at a foam lip loaded 500 g: massPerArea kr/wr^2, dissip 2 xi wr, resistance dissip x massPerArea", qr: 0.1248, qrOf: "the reed under the lip as their synthesis played it, its damping over its resonance, 2 xi" },
    { ref: "[8] Tab. 1 750 g", instrument: "saxophone", lip: "foam", massPerArea: 0.1646, section: null, opening: null, width: null, dissip: 1304, hz: 1655, size: "tenor", stiffness: 178e5, resistance: 214.6, derived: "their kr 1.78e+07 Pa/m, wr 1.04e+04 rad/s, xi 0.0627 at a foam lip loaded 750 g: massPerArea kr/wr^2, dissip 2 xi wr, resistance dissip x massPerArea", qr: 0.1254, qrOf: "the reed under the lip as their synthesis played it, its damping over its resonance, 2 xi" },
    { ref: "[8] Tab. 1 1000 g", instrument: "saxophone", lip: "foam", massPerArea: 0.1555, section: null, opening: null, width: null, dissip: 1727, hz: 1783, size: "tenor", stiffness: 195e5, resistance: 268.5, derived: "their kr 1.95e+07 Pa/m, wr 1.12e+04 rad/s, xi 0.0771 at a foam lip loaded 1000 g: massPerArea kr/wr^2, dissip 2 xi wr, resistance dissip x massPerArea", qr: 0.1542, qrOf: "the reed under the lip as their synthesis played it, its damping over its resonance, 2 xi" },
    { ref: "[7] initial", instrument: "clarinet", massPerArea: 0.033, section: 986e-7, opening: 246e-6, width: 0.012, dissip: 3e3, hz: 3709 },
    { ref: "[11] Tab. 6.1 smooth", instrument: "clarinet", lip: "player", massPerArea: 0.0357, section: 23714e-8, opening: 32204e-8, width: null, dissip: 8626, hz: 2775, stiffness: 10853e3, qr: 0.495, qrOf: "the reed and its player's lip as played, its damping over its resonance (g over the root of Ka over m), beating smoothly" },
    { ref: "[11] Tab. 6.1 strong", instrument: "clarinet", lip: "player", massPerArea: 0.0508, section: 10012e-8, opening: 33625e-8, width: null, dissip: 6969, hz: 1825, stiffness: 6681200, qr: 0.608, qrOf: "the reed and its player's lip as played, its damping over its resonance (g over the root of Ka over m), beating strongly" }
  ],
  measured: [
    { ref: "[8] Tab. 1 0 g", instrument: "saxophone", size: "tenor", condition: "alone", stiffness: 601e4, hz: 1109, q: 12.66, note: "a synthetic tenor reed (Legere 3) on its mouthpiece with no lip: their kr 6.01e6 Pa/m, wr 6.97e3 rad/s, xi 0.0395 (q 1/(2 xi)); two resonances in its measured transfer function, 1104 and 2549 Hz, 'in agreement with the one measured in [their 16] for a tenor saxophone cane reed' (4)" },
    { ref: "[9] Tab. A4", instrument: "saxophone", size: "soprano", condition: "alone", stiffness: 1e7, note: "Nederveen's reed alone under a static load, a reed of medium hardness free to move (Gaillard et al. 2024 A.3.1, from C. J. Nederveen 1969, JASA 45(2), 513-514)" },
    { ref: "[9] Tab. A4", instrument: "saxophone", size: "alto", condition: "alone", stiffness: 833e4, note: "as the soprano's row" },
    { ref: "[9] Tab. A4", instrument: "saxophone", size: "tenor", condition: "alone", stiffness: 333e4, note: "as the soprano's row" },
    { ref: "[9] Tab. A4", instrument: "clarinet", condition: "alone", stiffness: 1e7, note: "as the saxophones' rows" },
    { ref: "[9] Tab. A6 [66]", instrument: "clarinet", condition: "alone", hzRange: [1890, 2270], qRange: [30, 50], stiffnessRange: [25e6, 67e6], note: "a clarinet reed alone on a bench, its free length 30 mm, measured 2 mm from its tip (B. Gazengel, J.-P. Dalmont & J.-F. Petiot 2016, Applied Acoustics 106, 155-166)" },
    { ref: "[9] Tab. A6 [50]", instrument: "clarinet", condition: "alone", hzRange: [1530, 2440], note: "clarinet reeds alone on a mouthpiece: 2140-2440 Hz dry, 1530-1890 wet (F. Pinard, B. Laine & H. Vach 2003, JASA 113(3), 1736-1742)" },
    { ref: "[9] Tab. A6 [70]", instrument: "clarinet", condition: "alone", hzRange: [2060, 2300], note: "a clarinet reed alone on a mouthpiece: 2300 Hz dry, 2060 wet (K. Stetson 2014, Optical Engineering 53(11), 112305)" },
    { ref: "[12] II.A", instrument: "saxophone", size: "tenor", condition: "played", complianceVolume: [27e-7, 37e-7], note: "the tenor reed's effective compliance in playing, an equivalent volume of air of 3.2 +- 0.5 ml for every reed measured, hardness 2.5 to 4" }
  ]
};

// native/live/players-ranges.mjs
var label = (m) => m.replace(/-/g, " ");
var STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
var midiNamed = (name) => {
  const m = /^([A-G])(b|#)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`a pitch named ${name}`);
  return 12 * (+m[3] + 1) + STEP[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0);
};
var CM_H2O = 98.0665;
function compassOf(model) {
  const r = instrumentRange(DEFAULT_INSTRUMENT_RANGES[model] ?? model);
  if (!r?.range) return null;
  const host = String(r.sources?.[0] ?? "").match(/^https?:\/\/(?:www\.)?([^/]+)/)?.[1];
  return {
    range: [...r.range],
    what: `The range of notes its players play (${r.name}).`,
    source: host === "vsl.co.at" ? "Vienna Symphonic Library" : host === "phys.unsw.edu.au" ? "Chen, Smith & Wolfe" : host ?? "instrument-ranges.js",
    ...model === "trumpet" ? { by: "the C trumpet" } : {}
  };
}
var MEASURED_BREATH = {
  clarinet: "clarinet",
  "e-flat-clarinet": "clarinet",
  "bass-clarinet": "clarinet",
  oboe: "oboe",
  "english-horn": "oboe",
  bassoon: "bassoon",
  contrabassoon: "bassoon",
  "soprano-saxophone": "alto-saxophone",
  "alto-saxophone": "alto-saxophone",
  "tenor-saxophone": "alto-saxophone",
  "baritone-saxophone": "alto-saxophone"
};
var transposition = (model) => instrumentRange(DEFAULT_INSTRUMENT_RANGES[model] ?? model)?.writtenToSounding ?? 0;
function reedBreath(model) {
  const from = MEASURED_BREATH[model];
  if (!from) return null;
  const table = breath_literature_default[from].find((t) => t.source === "fuks-sundberg-1996"), shift = transposition(model) - transposition(from), at2 = /* @__PURE__ */ new Map();
  table.pitches.forEach((name, k) => {
    const midi = midiNamed(name) + shift, rows = Object.values(table.players);
    const low = Math.min(...rows.map((p) => p.pp?.[k]).filter(Number.isFinite)), high = Math.max(...rows.map((p) => p.ff?.[k]).filter(Number.isFinite));
    const was = at2.get(midi);
    at2.set(midi, was ? [Math.min(was[0], low), Math.max(was[1], high)] : [low, high]);
  });
  return {
    points: [...at2].sort((a, b) => a[0] - b[0]).map(([midi, [low, high]]) => [midi, Math.round(low * CM_H2O), Math.round(high * CM_H2O)]),
    what: "The pressure in the mouths of two professional players, from their softest (pp) to their loudest (ff) at this note.",
    source: "Fuks & Sundberg 1996",
    ...from !== model ? { by: `${label(from)} players, at the same written note` } : {}
  };
}
function lipsBreath(model, compass) {
  const [lo, hi] = compass?.range ?? [24, 96], line2 = ({ at: at2, slope }, hz) => Math.exp(at2 + slope * Math.log(hz)), points = [];
  for (let midi = lo; midi <= hi; midi++) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    points.push([midi, Math.round(line2(PLAYERS_BREATH.pp, hz) / PLAYERS_BREATH.pp.scatter), Math.round(Math.min(MOST, line2(PLAYERS_BREATH.ff, hz) * PLAYERS_BREATH.ff.scatter))]);
  }
  return {
    points,
    what: "The pressure in brass players' mouths, from their softest (pp) to their loudest (ff) at this pitch.",
    source: "Fletcher & Tarnopolsky 1999; Bouhuys 1965",
    ...["trumpet", "tuba"].includes(model) ? {} : { by: "trumpet and tuba players, at the same pitch" }
  };
}
var REED_KIND = {
  clarinet: "clarinet",
  "e-flat-clarinet": "clarinet",
  "bass-clarinet": "clarinet",
  "soprano-saxophone": "saxophone",
  "alto-saxophone": "saxophone",
  "tenor-saxophone": "saxophone",
  "baritone-saxophone": "saxophone"
};
var spanOf = (values) => values.length ? values.length > 1 ? { range: [Math.min(...values), Math.max(...values)] } : { value: values[0] } : null;
var hzText = (values) => {
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  return lo === hi ? `${Math.round(lo)}` : `${Math.round(lo)}-${Math.round(hi)}`;
};
function reedOwn(model) {
  const kind = REED_KIND[model];
  if (!kind) return {};
  const size = model.replace(/-saxophone$/, ""), mine = (r) => r.instrument === kind && (!r.size || kind !== "saxophone" || r.size === size);
  const played = reed_literature_default.reeds.filter((r) => r.instrument === kind && r.lip === "player"), machine = reed_literature_default.reeds.filter((r) => r.instrument === kind && r.lip === "foam");
  const alone = reed_literature_default.measured.filter((r) => r.condition === "alone" && r.instrument === kind), aloneMine = alone.filter(mine);
  const by = kind === "saxophone" && model !== "tenor-saxophone" ? { by: "a tenor saxophone's reed" } : kind === "clarinet" && model !== "clarinet" ? { by: "a B-flat clarinet's reed" } : {};
  const aloneHz = alone.flatMap((r) => r.hzRange ?? (r.hz ? [r.hz] : [])), machineHz = machine.filter((r) => r.hz).map((r) => r.hz);
  const said = (parts) => parts.filter(Boolean).join(" ");
  const playedHz = played.filter((r) => r.hz > 0).map((r) => r.hz);
  const pulsation = playedHz.length ? {
    ...spanOf(playedHz.map((h) => 2 * Math.PI * h)),
    what: said([`The reed's resonance while a player plays it, the lip on it: ${hzText(playedHz)} Hz.`, aloneHz.length && `The reed alone, with no lip on it: ${hzText(aloneHz)} Hz.`, machineHz.length && `Under a playing machine's foam lip: ${hzText(machineHz)} Hz.`]),
    source: "Chatziioannou & van Walstijn 2012; Chatziioannou 2010; Gaillard, Koehl & Gazengel 2024",
    ...by
  } : aloneHz.length ? {
    ...spanOf(alone.flatMap((r) => r.hz ? [r.hz] : []).map((h) => 2 * Math.PI * h)),
    what: said([`The reed's resonance alone, with no lip on it: ${hzText(aloneHz)} Hz. Nobody has measured it while a player plays it.`, machineHz.length && `Under a playing machine's foam lip: ${hzText(machineHz)} Hz.`]),
    source: "Tonetti & Piana 2025",
    ...by
  } : null;
  const playedQ = played.filter((r) => r.hz > 0 && r.dissip > 0).map((r) => 2 * Math.PI * r.hz / r.dissip), aloneQ = alone.flatMap((r) => r.qRange ?? (r.q ? [r.q] : [])), machineQ = machine.filter((r) => r.hz > 0 && r.dissip > 0).map((r) => 2 * Math.PI * r.hz / r.dissip);
  const qText = (values) => {
    const [lo, hi] = [Math.min(...values), Math.max(...values)];
    return lo === hi ? lo.toFixed(1) : `${lo.toFixed(1)}-${hi.toFixed(1)}`;
  };
  const qfactor = playedQ.length ? { ...spanOf(playedQ), what: said([`How lightly the reed is damped (its Q, no unit) while a player plays it: ${qText(playedQ)}.`, aloneQ.length && `The reed alone, with no lip on it: ${qText(aloneQ)}.`]), source: "Chatziioannou & van Walstijn 2012; Chatziioannou 2010; Gaillard, Koehl & Gazengel 2024", ...by } : aloneQ.length ? { ...spanOf(alone.flatMap((r) => r.q ? [r.q] : [])), what: said([`How lightly the reed is damped (its Q, no unit) alone, with no lip on it: ${qText(aloneQ)}. Nobody has measured it while a player plays it; a lip damps it more.`, machineQ.length && `Under a playing machine's foam lip: ${qText(machineQ)}.`]), source: "Tonetti & Piana 2025", ...by } : null;
  const shut = played.filter((r) => r.stiffness > 0 && r.opening > 0).map((r) => r.stiffness * r.opening);
  const stiffAlone = aloneMine.flatMap((r) => r.stiffnessRange ?? (r.stiffness ? [r.stiffness] : [])).map((k) => (k / 1e6).toFixed(1));
  const closing_pressure = shut.length ? {
    ...spanOf(shut),
    what: said([`The pressure that pushes the reed shut while a player plays it (its stiffness times its opening): ${hzText(shut)} Pa.`, stiffAlone.length && `The reed's stiffness alone: ${[...new Set(stiffAlone)].join(", ")} MPa per metre.`]),
    source: "Muñoz Arancón et al. 2016; Chatziioannou 2010; Gaillard, Koehl & Gazengel 2024 (Nederveen 1969)",
    ...by
  } : null;
  const nonlinear = played.filter((r) => r.nonlinearStiffness).map((r) => r.nonlinearStiffness);
  const contact_stifness = nonlinear.length ? {
    value: null,
    what: `How much stiffer the reed grows as it bends towards the mouthpiece, measured while played: ${nonlinear.map((k) => k.toExponential(1)).join(", ")} N/m⁴. This slider is something else: the model's stiffness once the reed is fully shut, which nobody has measured.`,
    source: "Gaillard, Koehl & Gazengel 2024, Table A7",
    ...by
  } : null;
  return { pulsation, qfactor, closing_pressure, contact_stifness };
}
function tongueOf(model) {
  const portato = playerEntry("reed-woodwind", "tongue.portato.contact"), staccato = player("reed-woodwind", "tongue.staccato.contact");
  const clarinets = ["clarinet", "e-flat-clarinet", "bass-clarinet"].includes(model);
  return {
    range: [+(portato.value - portato.sd).toFixed(3), Math.max(...staccato.map(([, s]) => s))],
    what: "How long the tongue touches the reed, from portato to staccato, at two notes a second.",
    source: "Pàmies-Vilà, Hofmann & Chatziioannou 2018",
    ...clarinets ? {} : { by: "clarinettists" }
  };
}
function breathTaken() {
  const { capacity, spent } = LUNGS, low = Math.max(0, capacity.litres - 2 * capacity.sd) * spent.share, high = (capacity.litres + 2 * capacity.sd) * spent.share;
  return {
    litres: { range: [+low.toFixed(2), +high.toFixed(2)], what: `The air in one breath: ${Math.round(100 * spent.share)} % of what wind players' lungs hold, from two standard deviations below the average to two above.`, source: "Bouros et al. 2018; Cossette, Sliwinski & Macklem 2000" },
    inhale: { range: [0.3, LUNGS.inhale.seconds], what: "How long a breath takes to draw in: from reed players' quickest to a singer's full breath.", source: "Fuks & Sundberg 1998; Salomoni, van den Hoorn & Hodges 2016" }
  };
}
function windsRanges(model, kind) {
  const compass = compassOf(model), { litres, inhale } = breathTaken();
  return {
    pitch: compass,
    breath: kind === "reed" ? reedBreath(model) : kind === "lips" ? lipsBreath(model, compass) : null,
    columns: kind === "reed" ? reedOwn(model) : {},
    stroke: tongueOf(model),
    softSeconds: null,
    rise: null,
    repeatRate: { range: [null, 8], what: "The fastest repeated notes with single tonguing: about 8 a second (about 11.5 with double tonguing).", source: "Bertsch & Hoole 2014", ...kind === "lips" ? {} : { by: "brass players" } },
    litres,
    inhale,
    vibratoWidth: null,
    vibratoRate: null,
    flutterHz: null,
    flutterDepth: null,
    humInterval: null,
    humLevel: null
  };
}

// native/openwind/dial.mjs
var REACH = dial_reach_default.factor;
var least = (kind) => transition(kind).least;
var TONGUE = Object.freeze({
  shut: 0.03,
  soft: 0.3,
  contact: Object.freeze({ mass: 5, damping: 333 }),
  touch: least("tongueTouch"),
  release: least("tongueRelease"),
  fall: least("tongueStop"),
  dip: BREATH.softDip,
  stroke: BREATH.tongueStop,
  softSeconds: BREATH.softSeconds,
  samePitch: BREATH.samePitch,
  measured: Object.freeze({
    portato: [player("reed-woodwind", "tongue.portato.contact"), playerEntry("reed-woodwind", "tongue.portato.contact").sd],
    staccato: player("reed-woodwind", "tongue.staccato.contact"),
    saxophone: 0.0255,
    single: 8,
    double: 11.5
  })
});
var JET_FLOOR = 0.01;
var RISE = BREATH.probeRise;
var SLIDE_SPEED = 2;
var SLIDE_LEAST = 0.2;
var TECHNIQUE = Object.freeze({
  flutter: Object.freeze({ hz: (FLUTTER_HZ[0] + FLUTTER_HZ[1]) / 2, depth: 0.7, hzReach: [5, 60], depthReach: [0, 1] }),
  hum: Object.freeze({ interval: -12, level: 0.2, intervalReach: [-36, 12], levelReach: [0, 1] }),
  growl: Object.freeze({ interval: -12, level: 0.2, rough: 0.6, intervalReach: [-36, 12], levelReach: [0, 1], roughReach: [0, 1] })
});
var slideSeconds = (from, to) => {
  const travel = Math.abs(to - from) / 2;
  return travel > 0 ? Math.max(SLIDE_LEAST, Math.PI * travel / (2 * SLIDE_SPEED)) : 0;
};
function windsDial(env) {
  const { log = console.log, warn = console.error } = env;
  let current = null, version = 0;
  const bodies = /* @__PURE__ */ new Map();
  let muting = null, quiet = 0;
  const RUNG = 0.5;
  const state = {
    midi: null,
    note: null,
    pitch: null,
    dynamic: "mf",
    rules: null,
    row: null,
    x: {},
    fingers: {},
    between: null,
    blowing: false,
    tract: null,
    tractFollows: false,
    turbulence: 0,
    lip: null,
    lipDialled: false,
    bend: 0,
    valves: null,
    slide: null,
    slideDialled: false,
    articulation: "tongued",
    stroke: TONGUE.stroke,
    softSeconds: TONGUE.softSeconds,
    rise: RISE,
    breathAttack: [[0, 0], [RISE, 1]],
    repeat: { on: false, rate: 4 },
    vibrato: { on: false, width: 0, rate: 5 },
    breathing: { on: false, litres: BREATH_LITRES, inhale: LUNGS.inhale.seconds },
    flutter: { on: false, hz: TECHNIQUE.flutter.hz, depth: TECHNIQUE.flutter.depth },
    hum: { on: false, interval: TECHNIQUE.hum.interval, level: TECHNIQUE.hum.level },
    growl: { on: false, interval: TECHNIQUE.growl.interval, level: TECHNIQUE.growl.level, rough: TECHNIQUE.growl.rough },
    swell: 1,
    noise: { ...NOISE_TEMPERATURES }
  };
  const held = { breath: 0, tongue: 1 };
  const lungs = new Lungs();
  const flows = /* @__PURE__ */ new Map();
  const airflowOf = (model) => {
    if (!flows.has(model)) flows.set(model, airflow(model));
    return flows.get(model);
  };
  const columnName = (k) => current.columns[k][2];
  const fingered = () => current.lips ? "valve" : "key";
  const kindOf = (k) => k === current.breath ? "breath" : current.columns[k][0] === "opening" ? fingered() : "lips";
  const DERIVED2 = /* @__PURE__ */ new Set(["model", "dUj", "next_Uj", "presence"]);
  const dialled = (k) => ["reed", "flute"].includes(current.columns[k][0]) && !DERIVED2.has(columnName(k));
  const ADDITIVE = { contact_exponent: 3, y0: 1 };
  const ofDial = (k, v, x) => !x || !dialled(k) || current.lips && columnName(k) === "pulsation" ? v : columnName(k) in ADDITIVE ? v + ADDITIVE[columnName(k)] * x : v > 0 ? v * REACH ** x : v;
  const composed = () => state.rules.map((v, k) => current.columns[k][0] === "opening" ? state.fingers[k] ?? v : ofDial(k, v, state.x[k] ?? 0));
  function played(row, { breath = held.breath, tongue = held.tongue } = {}) {
    const out = [...row], { breath: b, zeta, damping, resonance } = current, lips = current.kind === "lips";
    out[b] = row[b] * breath * state.swell * (lips ? tongue : 1);
    if (zeta != null) out[zeta] = row[zeta] * (lips && tongue > TONGUE.shut ? 1 : tongue);
    if (damping != null && tongue < 1) {
      const c = Math.min(1, (1 - tongue) / (1 - TONGUE.shut)), mass = 1 + (TONGUE.contact.mass - 1) * c;
      out[damping] = row[damping] * (1 + (TONGUE.contact.damping - 1) * c) * Math.sqrt(mass);
      out[resonance] = row[resonance] / Math.sqrt(mass);
    }
    return out;
  }
  const holdAs = (row, seconds, how) => send(played(row, how), seconds, current.presence != null ? JET_FLOOR * row[current.breath] : void 0);
  const hold = (row, seconds) => holdAs(row, seconds);
  const send = (row, seconds, floor) => current.stream.hold(row, seconds, floor);
  let queue = [];
  function after(seconds, run, tag = "tongue") {
    const at2 = current.frames + Math.max(1, Math.round(seconds * WINDS_RATE));
    queue.push({ at: at2, run, tag });
    queue.sort((a, b) => a.at - b.at);
  }
  const cancel = (tag) => {
    queue = queue.filter((e) => e.tag !== tag);
  };
  const tonguing = () => queue.some((e) => e.tag === "tongue");
  const PULL_MOST = 16384;
  let soloist = null;
  let playerSettings = { seed: DEFAULT_SEED, seconds: 60, personality: {} };
  const playerShown = () => ({ ...playerSettings, levers: LEVERS, grammars: LINE.grammars, ranges: TONE_RANGES });
  async function solo(given2) {
    const now = current.frames / WINDS_RATE;
    if (soloist?.line) {
      soloist = { said: soloist.line.shown(now), playing: false };
      withdrawn({ by: "soloist", from: now });
      if (state.blowing) await change("/blow", { on: false });
      await givenBack();
    }
    if (!given2.on) return { status: 200, json: { ...playing(), soloist } };
    pageOwn = ownOf();
    const { composeSolo, SoloLine, playerSettingsOf } = await import("./soloist/soloist.js");
    const of2 = (name) => given2[name] === void 0 ? playerSettings[name] : name === "personality" ? given2[name] : Number(given2[name]);
    playerSettings = playerSettingsOf({ seed: of2("seed"), seconds: of2("seconds"), personality: of2("personality") });
    const { windsEngineOf } = await import("./soloist/soloist.js");
    const composed2 = await composeSolo({ model: current.model, kind: current.kind, ...playerSettings, compass: [Math.min(...current.notes), Math.max(...current.notes)], engine: windsEngineOf(shown()) });
    const dial = shown(), lead = Math.max(dial.strokeLeast.tongued, dial.strokeLeast.legato) + PULL_MOST / WINDS_RATE, start = current.frames / WINDS_RATE + lead;
    const send2 = async (path, asked) => {
      try {
        return path === "/withdraw" ? withdrawn(asked) : await later(path, asked);
      } catch (error) {
        return { status: 400, json: { error: error.message } };
      }
    };
    soloist = { line: new SoloLine(composed2, { dial, send: send2, start, lead }), playing: true };
    return { status: 200, json: { ...playing(), soloist: { said: soloist.line.shown(start), playing: true } } };
  }
  const soloShown = () => soloist && { said: soloist.line ? soloist.line.shown(current.frames / WINDS_RATE) : soloist.said, playing: soloist.playing };
  const strokeLength = (how, asked = how === "legato" ? state.softSeconds : state.stroke) => how === "legato" ? Math.max(asked, 2 * TONGUE.fall, current.kind === "reed" ? least("breathRise") : 0) : Math.max(asked, TONGUE.touch + least(fingered()));
  function stroke(before, how, moving = 0) {
    cancel("tongue");
    cancel("attack");
    const kind = current.kind, legato = how === "legato";
    const seconds = Math.max(moving, strokeLength(how));
    const length = state.repeat.on && state.blowing ? Math.min(seconds, 0.7 / state.repeat.rate) : seconds;
    const fingers = (stopped) => {
      const from = Math.max(stopped, length - least(fingered()));
      after(from, () => hold(state.row, Math.max(length - from, least(fingered()))));
    };
    if (kind === "reed" || kind === "lips" && !legato) {
      const touch = TONGUE.touch, left = legato ? TONGUE.soft : TONGUE.shut;
      held.tongue = left;
      holdAs(before, touch);
      fingers(touch);
      after(length, () => {
        if (legato) {
          held.tongue = 1;
          hold(state.row, TONGUE.release);
        } else if (kind === "lips") attackNow(TONGUE.release, { shut: 0 });
        else {
          held.tongue = 1;
          attackNow(TONGUE.release);
        }
      });
      return length;
    }
    if (legato) {
      held.breath = TONGUE.dip;
      holdAs(before, length / 2);
      after(length / 2, () => {
        held.breath = 1;
        hold(state.row, length / 2);
      });
      return length;
    }
    held.breath = 0;
    holdAs(before, TONGUE.fall);
    fingers(TONGUE.fall);
    after(length, () => attackNow(TONGUE.release));
    return length;
  }
  function released() {
    const { zeta, closing, reed } = current, aperture2 = current.kind === "lips" && reed && closing != null ? lipsAperture(state.row[zeta], state.row[closing], reed) : 0;
    return tongueLetGo(aperture2, TONGUE.shut, TONGUE.release);
  }
  function attackNow(seconds, { shut = null } = {}) {
    cancel("attack");
    const attack = attackHeld(), lips = current.lips && attack && attack.share !== 1 ? attack : null, settle = lips ? (shut ?? 0) + lips.settleAfter : null;
    const holdAt = (t, span2) => {
      if (lips && t <= settle) {
        const own2 = lipsRow(current.lips, state.lip, 1, state.valves), from = lipsRow(current.lips, state.lip * lips.share, 1, state.valves);
        send(played(state.row).map((v, k) => own2[k] ? v * from[k] / own2[k] : v), span2);
      } else hold(state.row, span2);
    };
    const tongue = shut != null ? released() : null;
    if (state.breathAttack.length === 2) {
      held.breath = 1;
      held.tongue = shut != null ? TONGUE.shut : 1;
      holdAt(0, seconds);
      if (tongue) tongue.times.forEach((t, k) => {
        const from = k ? tongue.times[k - 1] : 0;
        after(shut + from, () => {
          held.tongue = tongue.at(t);
          holdAt(shut + from, t - from);
        }, "attack");
      });
      if (lips) after(settle, () => hold(state.row, least("lips")), "attack");
      return;
    }
    const curve = firstEndingAt(state.breathAttack, seconds);
    const times = [.../* @__PURE__ */ new Set([...curve.slice(1).map((p) => p[0]), ...lips ? [settle, settle + least("lips")] : [], ...tongue ? [shut, ...tongue.times.map((t) => shut + t)] : []])].filter((t) => t > 0).sort((a, b) => a - b);
    const move = (t, span2) => {
      held.breath = curveAt(curve, t);
      held.tongue = tongue ? tongue.at(t - shut) : 1;
      holdAt(t, span2);
    };
    times.forEach((t, k) => {
      const from = k ? times[k - 1] : 0;
      if (k) after(from, () => move(t, t - from), "attack");
      else move(t, t);
    });
  }
  function changed(before, { pitch = null, moving = 0 } = {}) {
    if (state.blowing && !lungs.taking && pitch !== null) {
      const how = state.articulation === "slurred" && Math.abs(100 * (pitch.to - pitch.from)) < TONGUE.samePitch ? "legato" : state.articulation;
      if (how !== "slurred") {
        stroke(before, how, moving);
        return;
      }
    }
    const kinds2 = new Set(state.row.map((v, k) => v !== before[k] ? kindOf(k) : null).filter(Boolean));
    const breath = current.breath, rising = state.row[breath] > before[breath];
    hold(state.row, Math.max(moving, ...[...kinds2].map((kind) => kind === "breath" ? least(rising ? "breathRise" : "breathFall") : least(kind))));
  }
  function blow(on) {
    if (on === state.blowing) return;
    state.blowing = on;
    cancel("tongue");
    cancel("repeat");
    cancel("attack");
    cancel("breath");
    lungs.filled();
    if (on) {
      fromRest();
      repeating();
    } else {
      held.breath = 0;
      held.tongue = 1;
      hold(state.row, least("breathFall"));
      quiet = current.frames + Math.round((least("breathFall") + RUNG) * WINDS_RATE);
    }
    techniques();
    sway();
  }
  function fromRest() {
    if (current.kind === "reed" || current.kind === "lips") attackNow(state.rise, { shut: state.rise });
    else {
      held.tongue = 1;
      attackNow(state.rise);
    }
  }
  const spends = () => Boolean(current && state.pitch != null && state.row && state.breathing.on && state.blowing && !lungs.taking);
  function playersSpend() {
    if (!current || state.pitch == null || !state.row) return 0;
    const b = current.breath, rules = state.rules?.[b], share = rules > 0 ? state.row[b] * state.swell / rules : 1;
    return airflowOf(current.model).of({ dynamic: state.dynamic, midi: state.pitch, share });
  }
  function breathe() {
    cancel("tongue");
    cancel("repeat");
    cancel("attack");
    lungs.breathe();
    techniques();
    held.breath = 0;
    held.tongue = 1;
    hold(state.row, least("breathFall"));
    sway();
    after(least("breathFall") + lungs.inhale, () => {
      lungs.filled();
      fromRest();
      repeating();
      techniques();
      sway();
    }, "breath");
  }
  function repeating() {
    cancel("repeat");
    if (!(state.repeat.on && state.blowing) || lungs.taking) return;
    const next = () => {
      stroke(state.row, state.articulation === "tongued" ? "tongued" : "legato");
      after(1 / state.repeat.rate, next, "repeat");
    };
    after(1 / state.repeat.rate, next, "repeat");
  }
  function sway(seconds = 0.2) {
    const sounding2 = state.blowing && !lungs.taking;
    const { on, width, rate } = state.vibrato, v = on && sounding2 ? width / 2 : 0;
    if (current.lips) {
      const way = lipsDirection(current.lips, state.lip, 1, state.valves), got2 = on && width > 0 ? pressed(width / 2) : null, depth = v && got2 ? got2.depth : 0;
      current.heard = got2 && 2 * got2.heard;
      current.stream.vibrato({ columns: way.columns, depths: way.slopes.map((s) => s * depth), cents: way.columns.map(() => true), rate, seconds });
    } else current.stream.vibrato(breathVibrato(current.breath, { width: 2 * v, rate }, seconds));
  }
  const voiced = (kind) => windTechniqueAt({ kind, ...state[kind] }, state.pitch)[kind];
  const hummed = (kind) => voiced(kind).hz;
  function techniques() {
    const sounding2 = state.blowing && !lungs.taking && state.pitch != null, on = (kind) => sounding2 && state[kind].on, floor = on("flutter") ? speaksAt() : null;
    current.stream.technique({
      column: current.breath,
      seconds: least("technique"),
      ...on("hum") ? { hum: voiced("hum") } : {},
      ...on("growl") ? { growl: voiced("growl") } : {},
      ...on("flutter") ? { flutter: { hz: state.flutter.hz, depth: state.flutter.depth } } : {},
      ...floor != null ? { floor } : {}
    });
  }
  function speaksAt() {
    const { speaks, velocities: v } = current;
    if (!speaks || state.pitch == null) return null;
    const x = Math.min(Math.max(DYNAMIC_VELOCITY[state.dynamic], v[0]), v.at(-1));
    let j = 0;
    while (j < v.length - 2 && v[j + 1] <= x) j++;
    const w = v[j + 1] > v[j] ? (x - v[j]) / (v[j + 1] - v[j]) : 0, at2 = (midi) => {
      const g = speaks[current.notes.indexOf(midi)];
      return g && g[j] != null && g[j + 1] != null ? g[j] + (g[j + 1] - g[j]) * w : null;
    };
    const { low = state.midi, high = state.midi, share = 0 } = state.between ?? {}, a = at2(low), b = at2(high);
    return a == null || b == null ? null : a + (b - a) * share;
  }
  async function rowsOf(made, dynamic) {
    const rows = [];
    for (const [k, midi] of made.notes.entries()) rows.push(made.lips ? lipsRow(made.lips, made.lips.notes[k].lip, made.lips.notes[k].pressures[dynamic], made.lips.notes[k].valves) : await env.rulesRow(made.stream, made.model, midi, dynamic));
    return rows;
  }
  function onLips(pitch, dynamic) {
    if (current.lips.slide) return onSlide(pitch, dynamic);
    const hz = 440 * 2 ** ((pitch - 69) / 12), notes = current.lips.notes, { k, share } = charted(pitch), of2 = (n) => Math.log(n.lip / n.hz);
    const lip = hz * Math.exp(of2(notes[k]) + (notes.length < 2 ? 0 : (of2(notes[k + 1]) - of2(notes[k])) * share));
    const valves = notes[share < 0.5 ? k : Math.min(k + 1, notes.length - 1)].valves ?? null;
    return { low: notes[k].midi, high: notes[Math.min(k + 1, notes.length - 1)].midi, share, sounds: null, lip, valves, row: lipsRow(current.lips, lip, lipsBreath2(pitch, dynamic, { a: notes[k], b: notes[Math.min(k + 1, notes.length - 1)], share }), valves) };
  }
  function lipsBreath2(pitch, dynamic, { a, b, share }) {
    const onset = a.threshold > 0 && b.threshold > 0 ? a.threshold * (b.threshold / a.threshold) ** share : a.threshold || b.threshold || null;
    return speakingBreath(440 * 2 ** ((pitch - 69) / 12), DYNAMIC_VELOCITY[dynamic], onset);
  }
  function pitchOfLips(lip, dynamic) {
    let [low, high] = [current.notes[0], current.notes.at(-1)];
    if (lip <= onLips(low, dynamic).lip) return low;
    if (lip >= onLips(high, dynamic).lip) return high;
    for (let k = 0; k < 40; k++) {
      const mid = (low + high) / 2;
      onLips(mid, dynamic).lip < lip ? low = mid : high = mid;
    }
    return (low + high) / 2;
  }
  function lipsHeld() {
    const own2 = current.lips.slide && state.note != null && current.notes[state.note] === state.pitch ? current.lips.notes[state.note] : null;
    return { pitch: state.lipDialled && !current.lips.slide ? pitchOfLips(state.lip, state.dynamic) : state.pitch, own: own2 };
  }
  const attackHeld = () => {
    if (!(current?.lips && state.lip)) return null;
    const { pitch, own: own2 } = lipsHeld();
    return attackOn(pitch, state.dynamic, own2);
  };
  function standardOf(rules) {
    const charted2 = rules.notes.filter((n) => n.names?.length).map((n) => n.midi), [low, high] = [Math.min(...charted2), Math.max(...charted2)];
    return rules.notes.filter((n) => !n.alternate && (n.names?.length || n.midi < low || n.midi > high));
  }
  function about(notes, pitch) {
    const k = Math.max(0, Math.min(notes.length - 2, notes.findLastIndex((n) => n.midi <= pitch))), a = notes[k], b = notes[Math.min(k + 1, notes.length - 1)];
    return { a, b, share: a === b ? 0 : Math.min(Math.max((pitch - a.midi) / (b.midi - a.midi), 0), 1) };
  }
  function tubeFor(n, hz) {
    const rules = current.lips, on = rules.notes.filter((m) => m.partial === n).sort((x, y) => x.hz - y.hz), { a, b, share } = about(on, 69 + 12 * Math.log2(hz / 440));
    const over = Math.exp(Math.log(a.hz / a.resonance) + (Math.log(b.hz / b.resonance) - Math.log(a.hz / a.resonance)) * share), r = hz / over;
    const ps = rules.slide.positions.filter((p2) => p2.resonances.length >= n).map((p2) => ({ out: p2.out, r: p2.resonances[n - 1] }));
    const i = Math.min(Math.max(ps.findIndex((p2) => p2.r <= r), 1), ps.length - 1) || ps.length - 1, [p, q] = [ps[i - 1], ps[i]];
    return p.out + (q.out - p.out) * Math.log(r / p.r) / Math.log(q.r / p.r);
  }
  function onSlide(pitch, dynamic) {
    const rules = current.lips, hz = 440 * 2 ** ((pitch - 69) / 12), { a, b, share } = about(standardOf(rules), pitch), most = rules.slide.most;
    const tried = (share < 0.5 ? [a, b] : [b, a]).map((n) => ({ partial: n.partial, out: tubeFor(n.partial, hz) }));
    const { partial, out } = tried.find((t) => t.out >= 0 && t.out <= most) ?? tried[0];
    const on = about(rules.notes.filter((n) => n.partial === partial).sort((x, y) => x.hz - y.hz), pitch), of2 = (n) => Math.log(n.lip / n.hz);
    const lip = hz * Math.exp(of2(on.a) + (of2(on.b) - of2(on.a)) * on.share);
    return {
      low: on.a.midi,
      high: on.b.midi,
      share: on.share,
      sounds: null,
      lip,
      valves: null,
      out: Math.min(Math.max(out, 0), most),
      partial,
      on,
      row: lipsRow(rules, lip, lipsBreath2(pitch, dynamic, on), null)
    };
  }
  function positionAt(out) {
    const ps = current.lips.slide.positions, k = Math.max(0, Math.min(ps.length - 2, ps.findLastIndex((p) => p.out <= out)));
    return ps[k].position + (out - ps[k].out) / (ps[k + 1].out - ps[k].out);
  }
  function slideTo(out) {
    const seconds = slideSeconds(state.slide ?? out, out);
    state.slide = out;
    current.stream.slide(out, seconds);
    return seconds;
  }
  function charted(pitch) {
    const notes = current.lips.notes, k = Math.max(0, Math.min(notes.length - 2, notes.findLastIndex((n) => n.midi <= pitch)));
    return { k, share: notes.length < 2 ? 0 : Math.min(Math.max((pitch - notes[k].midi) / (notes[k + 1].midi - notes[k].midi), 0), 1) };
  }
  function attackOn(pitch, dynamic, own2 = null) {
    const at2 = (n) => {
      const a2 = current.attacks?.notes.find((a3) => noteKey(a3) === noteKey(n))?.dynamics[dynamic];
      return a2?.share != null ? a2 : null;
    };
    const { a: na, b: nb, share } = partialsAbout(pitch, dynamic, own2), a = at2(na), b = at2(nb);
    const kept = (g) => g && { share: g.share, settleAfter: g.settleAfter };
    if (!a || !b || share === 0 || share === 1) return kept(share === 1 ? b ?? a : a ?? b);
    return { share: Math.exp(Math.log(a.share) + (Math.log(b.share) - Math.log(a.share)) * share), settleAfter: a.settleAfter + (b.settleAfter - a.settleAfter) * share };
  }
  function partialsAbout(pitch, dynamic, own2 = null) {
    const notes = current.lips.notes, { k, share } = charted(pitch);
    return own2 ? { a: own2, b: own2, share: 0 } : current.lips.slide ? onSlide(pitch, dynamic).on : { a: notes[k], b: notes[Math.min(k + 1, notes.length - 1)], share };
  }
  function pressed(half) {
    const law = current.vibrato, { pitch, own: own2 } = lipsHeld(), { a, b, share } = partialsAbout(pitch, state.dynamic, own2);
    const at2 = (n) => {
      const p = n.pressures[state.dynamic], by = Object.values(law?.notes.find((m) => noteKey(m) === noteKey(n))?.dynamics ?? {}).filter((d) => d.heard?.[0] != null).map((d) => ({ p: d.pressure, ...heardAs(law.depths, d.heard, half) })).sort((x3, y3) => x3.p - y3.p), j = by.findIndex((d) => d.p >= p);
      if (!by.length) return null;
      if (j <= 0) return by.at(j);
      const [x2, y2] = [by[j - 1], by[j]], s = Math.log(p / x2.p) / Math.log(y2.p / x2.p);
      return { depth: x2.depth + (y2.depth - x2.depth) * s, heard: x2.heard + (y2.heard - x2.heard) * s };
    };
    const [x, y] = [at2(a), at2(b)];
    if (!x || !y || share === 0 || share === 1) return share === 1 ? y ?? x : x ?? y;
    return { depth: x.depth + (y.depth - x.depth) * share, heard: x.heard + (y.heard - x.heard) * share };
  }
  function heardAs(depths, heard, half) {
    let [d0, h0] = [0, 0];
    for (const [k, h] of heard.entries()) {
      if (h == null) break;
      if (h >= half) return { depth: d0 + (depths[k] - d0) * (half - h0) / (h - h0), heard: half };
      [d0, h0] = [depths[k], h];
    }
    return { depth: d0, heard: h0 };
  }
  async function sounding(pitch, dynamic) {
    if (current.lips) return onLips(pitch, dynamic);
    const made = current, rows = made.rows.get(dynamic), asked = { notes: made.notes, rows, columns: made.columns, shaded: made.shaded, glides: made.glides };
    const measured3 = measuredAbout(pitch, asked), found = measured3 ? rowSounding(pitch, asked) : null;
    if (!made.glided.has(dynamic)) {
      made.glided.add(dynamic);
      const order = made.notes.map((m, k) => k).sort((a, b) => made.notes[a] - made.notes[b]);
      for (let i = 1; i < order.length; i++) made.glides.glide(rows[order[i - 1]], rows[order[i]]).catch((error) => {
        if (current === made) warn(`  a glide: ${error.message}`);
      });
    }
    if (measured3) return await found;
    const still = () => current === made && state.pitch === pitch && state.dynamic === dynamic && state.between?.provisional;
    rowSounding(pitch, asked).then((found2) => still() && serial(() => still() ? settleAt(made, pitch, dynamic, false, null, found2) : null)).catch((error) => {
      if (current === made) warn(`  a glide: ${error.message}`);
    });
    return provisionalRow(pitch, asked);
  }
  async function toPitch(pitch, dynamic, charted2 = false, note = null) {
    const made = current, [low, high] = [Math.min(...made.notes), Math.max(...made.notes)];
    if (note !== null) {
      if (!(Number.isInteger(note) && note >= 0 && note < made.notes.length)) throw new Error("no such charted note");
      pitch = made.notes[note];
      charted2 = true;
    }
    if (!(pitch >= low && pitch <= high) || !(dynamic in DYNAMIC_VELOCITY)) throw new Error(`a pitch from ${low} to ${high}, and a dynamic`);
    if (charted2 && !made.notes.includes(pitch)) throw new Error("no such charted note");
    const k = note ?? made.notes.indexOf(pitch);
    const found = charted2 ? {
      low: pitch,
      high: pitch,
      share: 0,
      sounds: null,
      row: made.rows.get(dynamic)[k],
      lip: made.lips ? made.lips.notes[k].lip : null,
      valves: made.lips?.notes[k].valves ?? null,
      out: made.lips?.notes[k].out ?? null
    } : await sounding(pitch, dynamic);
    settleAt(made, pitch, dynamic, charted2, k, found);
  }
  function settleAt(made, pitch, dynamic, charted2, k, found) {
    if (current !== made) throw new Error("another instrument was taken up");
    const before = state.row, from = state.pitch, near = made.notes.reduce((a, m, j) => Math.abs(m - pitch) < Math.abs(made.notes[a] - pitch) ? j : a, 0);
    const own2 = made.alternates ? fingeringAmong(made.alternates[made.notes[charted2 ? k : near]], found.row, before, made.columns, made.holes) : { row: found.row, documented: null };
    Object.assign(state, {
      pitch,
      dynamic,
      midi: made.notes[charted2 ? k : near],
      note: charted2 ? k : near,
      rules: [...own2.row],
      fingered: own2.documented,
      fingers: {},
      lip: found.lip ?? null,
      lipDialled: false,
      bend: 0,
      valves: found.valves ?? null,
      slideDialled: false,
      between: { low: found.low, high: found.high, share: found.share, sounds: found.sounds, ...found.provisional ? { provisional: true } : {} }
    });
    state.row = composed();
    changed(before, { pitch: { from, to: pitch }, moving: found.out != null ? slideTo(found.out) : 0 });
    if (state.tractFollows) followed(made.model, pitch);
    if (made.lips) sway();
    if (state.hum.on || state.growl.on || state.flutter.on) techniques();
  }
  const raisedAt = (pitch) => {
    const k = current.raised ? current.notes.indexOf(Math.round(pitch)) : -1;
    return k < 0 ? null : current.raised[k];
  };
  const followed = (of2, pitch) => tract(playersTract(of2, 440 * 2 ** ((pitch - 69) / 12), raisedAt(pitch)));
  function tract(resonances) {
    state.tract = new VocalTract(resonances);
    current.stream.tract(state.tract.resonances, least("tract"));
  }
  function turbulence(level) {
    state.turbulence = level;
    current.stream.turbulence(level);
  }
  const TURBULENCE_MOST = 0.01;
  const NOISE_MOST = 5;
  function noise(temperatures, seeded = false) {
    state.noise = { ...state.noise, ...temperatures };
    noiseLines(current.kind, state.noise, seeded).forEach((line2) => current.stream.noise(line2));
  }
  let wanted = null, loading = null, failed = null, loader = null;
  const step = (said) => {
    if (loading) Object.assign(loading, { step: said });
  };
  function choose(model) {
    if (!env.instruments.includes(model)) throw new Error(`one of ${env.instruments.join(", ")}`);
    wanted = model;
    failed = null;
    loader ??= (async () => {
      while (wanted && wanted !== current?.model) {
        const model2 = wanted;
        loading = { model: model2, step: "its body", since: Date.now() };
        try {
          await takeUp(model2);
        } catch (error) {
          if (wanted === model2) {
            failed = { model: model2, error: error.message };
            wanted = current?.model ?? null;
            warn(`The ${model2}: ${error.message}`);
          }
        }
      }
      loading = null;
      loader = null;
    })();
  }
  async function takeUp(model) {
    log(`The ${model}'s body ...`);
    if (current && state.blowing) await serial(() => {
      cancel("repeat");
      cancel("tongue");
      cancel("attack");
      cancel("breath");
      lungs.filled();
      state.blowing = false;
      techniques();
      held.breath = 0;
      held.tongue = 1;
      hold(state.row, least("breathFall"));
      sway();
    });
    const made = await bodyOf(model, null, () => wanted === model, step);
    if (!made) return;
    await serial(() => {
      const before = current;
      givenBack({ played: false });
      current = made;
      version++;
      queue = [];
      refused = [];
      pace = null;
      soloist = null;
      muting = null;
      quiet = 0;
      making.clear();
      for (const kept of /* @__PURE__ */ new Set([before, ...bodies.values()])) if (kept && kept !== made) {
        kept.glides?.stop();
        kept.stream.close();
      }
      bodies.clear();
      bodies.set(null, made);
      Object.assign(state, { x: {}, fingers: {}, blowing: false, lip: null, lipDialled: false, bend: 0, valves: null, slide: null, slideDialled: false, vibrato: { on: false, ...vibratoOf(model) }, row: null, pitch: null });
      Object.assign(held, { breath: 0, tongue: 1 });
      if (made.neutral) state.dynamic = made.neutral.dynamic;
      const k = made.neutral ? made.neutral.note : Math.floor(made.notes.length / 2), middle2 = made.notes[k];
      Object.assign(state, {
        pitch: middle2,
        midi: middle2,
        note: k,
        rules: [...made.rows.get(state.dynamic)[k]],
        lip: made.lips ? made.lips.notes[k].lip : null,
        valves: made.lips?.notes[k].valves ?? null,
        between: { low: middle2, high: middle2, share: 0, sounds: null }
      });
      if (made.neutral?.breath) state.x[made.breath] = made.neutral.breath;
      state.row = composed();
      state.vibrato.on = state.vibrato.width > 0;
      holdAs(state.row, 0);
      if (made.lips?.slide) slideTo(made.lips.notes[k].out);
      state.tractFollows = tractMeasured(model);
      followed(model, middle2);
      turbulence(turbulenceLevel(model));
      noise({}, true);
      sway(0);
    });
    log(`  the ${model} ready${made.stream.threads > 1 ? `, its engine on ${made.stream.threads} cores` : ""}`);
  }
  async function bodyOf(model, mute, still, said) {
    const kind = env.kinds[model], brass = kind === "lips";
    const body = await env.body(model, { mute }), folder = body.folder;
    if (!still()) return null;
    said("its engine");
    const stream2 = env.engine({ model, folder, onError: (said2) => warn(`  the engine: ${said2}`) });
    try {
      await stream2.ready;
      const columns = await stream2.columns(), rules = body.rules;
      const width = brass ? rowLayout(rules)?.width ?? rules.columns.length : null;
      if (brass && !(width === columns.length && rules.columns.every((name) => columns[lipsColumn(rules, name)]?.[0] === "reed" && columns[lipsColumn(rules, name)][2] === name) && [...(rules.valves?.columns ?? []).flat(), ...rowLayout(rules)?.closed ?? []].every((k) => columns[k]?.[0] === "opening"))) throw new Error(`the ${model}'s saved rows are not its engine's columns`);
      const at2 = (kind_, name) => {
        const k = columns.findIndex((c) => c[0] === kind_ && c[2] === name);
        return k < 0 ? null : k;
      };
      const laid = body.laid;
      const made = {
        model,
        kind,
        mute,
        folder,
        name: body.name,
        stream: stream2,
        columns,
        frames: 0,
        flow: 0,
        blown: null,
        notes: rules.notes.map((n) => n.midi),
        lips: brass ? rules : null,
        // (Where each charted note stops speaking at each of its rules' velocities, a reed's: speaksAt.)
        speaks: !brass && rules.notes.some((n) => n.values?.some((x) => x.speaks != null)) ? rules.notes.map((n) => n.values.map((x) => x.speaks ?? null)) : null,
        velocities: rules.velocities ?? null,
        // (The tract its fitted player raises at each charted note, where it raises one: standing.mjs playersTract.)
        raised: !brass && rules.notes.some((n) => n.values?.some((x) => x.tract?.raised)) ? rules.notes.map((n) => n.values.find((x) => x.tract?.raised)?.tract.raised ?? null) : null,
        attacks: brass ? body.attacks : null,
        vibrato: brass ? body.vibrato : null,
        heard: null,
        holes: laid.holes,
        // (How its body is laid out for the engine -- its losses, its mesh, its elements' order, its precision and rates:
        // the page's physics.)
        layout: { losses: laid.losses, mesh: laid.mesh, order: laid.order, single: laid.single, rate: laid.rate, ratio: laid.ratio, unknowns: laid.ni, entries: laid.nd, madeFrom: laid.madeFrom },
        breath: kind === "air" ? at2("flute", "Uj") : at2("reed", "gamma"),
        presence: kind === "air" ? at2("flute", "presence") : null,
        zeta: kind === "air" ? null : at2("reed", "zeta"),
        // (A reed's damping and resonance, which its player's tongue on it changes: played.)
        damping: kind === "reed" ? at2("reed", "qfactor") : null,
        resonance: kind === "reed" ? at2("reed", "pulsation") : null,
        // (A brass body's lips' closing pressure and its bore's entrance -- its characteristic impedance and its air's
        // density -- their aperture's: brass-tongue.js lipsAperture.)
        closing: brass ? at2("reed", "closing_pressure") : null,
        reed: brass ? laid.reed ?? null : null,
        rows: /* @__PURE__ */ new Map(),
        glided: /* @__PURE__ */ new Set(),
        impedance: null,
        // (What players were measured doing with its dials, drawn on them: players-ranges.mjs.)
        players: windsRanges(model, kind)
      };
      made.shaded = brass ? null : shadedColumns(model, columns, laid.holes);
      made.alternates = brass ? null : body.alternates ?? null;
      made.glides = brass ? null : env.glides({ model, folder, columns, shaded: made.shaded });
      made.neutral = env.neutral(folder);
      if (made.neutral && made.notes[made.neutral.note] !== made.neutral.midi) made.neutral = null;
      for (const dynamic of Object.keys(DYNAMIC_VELOCITY)) {
        said(`its notes at ${dynamic}`);
        made.rows.set(dynamic, await rowsOf(made, dynamic));
        if (!still()) {
          stream2.close();
          return null;
        }
      }
      env.impedance(made, { current: () => current === made });
      return made;
    } catch (error) {
      stream2.close();
      throw error;
    }
  }
  function muteTo(mute, { ready: ready2 = false } = {}) {
    const model = current.model, own2 = BRASS_MUTES[model] ?? {};
    if (mute !== null && !Object.hasOwn(own2, mute)) throw new Error(Object.keys(own2).length ? `the ${model}'s mutes: ${Object.keys(own2).join(", ")}, or none` : `the ${model} takes no mute`);
    if (ready2) {
      readied(mute).catch((error) => warn(`The ${model}'s ${mute} mute: ${error.message}`));
      return;
    }
    if (mute === current.mute) {
      muting = null;
      return;
    }
    const asked = { mute, made: bodies.get(mute) ?? null, error: null, since: Date.now() };
    muting = asked;
    if (asked.made) return;
    readied(mute).then((made) => {
      if (muting === asked && made) asked.made = made;
    }, (error) => {
      asked.error = error.message;
      if (muting === asked) warn(`The ${model}'s ${mute} mute: ${error.message}`);
    });
  }
  const making = /* @__PURE__ */ new Map();
  let closed = false;
  function readied(mute) {
    if (bodies.has(mute)) return Promise.resolve(bodies.get(mute));
    if (making.has(mute)) return making.get(mute).promise;
    const model = current.model, kept = () => !closed && current?.model === model, job = { step: "its body" };
    const done = () => {
      if (making.get(mute) === job) making.delete(mute);
    };
    job.promise = bodyOf(model, mute, kept, (said) => {
      job.step = said;
    }).then((made) => {
      done();
      if (!made) return null;
      if (kept() && !bodies.has(mute)) {
        bodies.set(mute, made);
        return made;
      }
      made.stream.close();
      return kept() ? bodies.get(mute) ?? null : null;
    }, (error) => {
      done();
      throw error;
    });
    making.set(mute, job);
    return job.promise;
  }
  function changedOver() {
    const from = current, to = muting.made;
    muting = null;
    to.frames = from.frames;
    to.flow = 0;
    to.blown = null;
    current = to;
    const [low, high] = [Math.min(...to.notes), Math.max(...to.notes)], pitch = Math.min(Math.max(state.pitch, low), high);
    const k = state.midi === state.pitch ? to.notes.indexOf(pitch) : -1;
    const found = k >= 0 ? { row: to.rows.get(state.dynamic)[k], lip: to.lips.notes[k].lip, valves: to.lips.notes[k].valves ?? null, out: to.lips.notes[k].out ?? null, low: pitch, high: pitch, share: 0, sounds: null } : onLips(pitch, state.dynamic);
    const near = to.notes.reduce((a, m, j) => Math.abs(m - pitch) < Math.abs(to.notes[a] - pitch) ? j : a, 0);
    Object.assign(state, {
      pitch,
      midi: to.notes[k >= 0 ? k : near],
      note: k >= 0 ? k : near,
      rules: [...found.row],
      lip: state.lipDialled ? state.lip : found.lip,
      bend: 0,
      valves: found.valves ?? null,
      between: { low: found.low, high: found.high, share: found.share, sounds: found.sounds }
    });
    state.row = composed();
    holdAs(state.row, 0);
    if (to.lips.slide) {
      state.slide = state.slideDialled || found.out == null ? state.slide : found.out;
      if (state.slide != null) to.stream.slide(state.slide, 0);
    }
    tract(state.tract.resonances);
    turbulence(state.turbulence);
    noise({}, true);
    techniques();
    sway(0);
    log(`  the ${to.model} ${to.mute ? `with its ${to.mute} mute in` : "open"}`);
  }
  let rendering = Promise.resolve();
  const serial = (job) => rendering = rendering.catch(() => {
  }).then(job);
  let pace = null;
  async function pulled(frames) {
    if (!current) return new Float32Array(frames);
    if (soloist?.line) {
      const now = current.frames / WINDS_RATE;
      await soloist.line.take(now);
      if (soloist.line.done(now)) {
        soloist = { said: soloist.line.shown(now), playing: false };
        await givenBack();
      }
    }
    const t = performance.now(), out = new Float32Array(frames);
    let made = current;
    const changing = () => Boolean(muting?.made) && !state.blowing, over = () => {
      if (changing() && made.frames >= quiet) {
        changedOver();
        made = current;
      }
    };
    for (let got2 = 0; got2 < frames; ) {
      over();
      while (queue.length && queue[0].at <= made.frames) {
        await queue.shift().run();
        over();
      }
      const spending = spends(), flow = made.flow;
      const next = Math.min(
        frames - got2,
        queue.length ? queue[0].at - made.frames : frames - got2,
        spending && flow > 0 ? Math.max(1, Math.ceil(lungs.secondsLeft(flow) * WINDS_RATE)) : Infinity,
        changing() && quiet > made.frames ? quiet - made.frames : Infinity
      );
      out.set(await made.stream.render(next), got2);
      got2 += next;
      made.frames += next;
      const air = await made.stream.air();
      if (air.seconds > 0) made.flow = air.litres / air.seconds;
      if (state.blowing && !lungs.taking && made.flow > 0) made.blown = made.flow;
      if (spending && current === made && lungs.spend(made.flow, air.seconds)) breathe();
    }
    const taken = (performance.now() - t) / 1e3 / (frames / WINDS_RATE);
    pace = pace == null ? taken : 0.9 * pace + 0.1 * taken;
    return out;
  }
  function shown() {
    const out = {
      instruments: env.instruments.map((model) => ({ model, kind: env.kinds[model] })),
      wanted,
      loading: loading && { model: loading.model, step: loading.step, seconds: (Date.now() - loading.since) / 1e3 },
      failed,
      rate: WINDS_RATE,
      dynamics: Object.keys(DYNAMIC_VELOCITY),
      tongue: TONGUE,
      limits: LIMITS(),
      reach: REACH,
      version,
      model: current?.model ?? null
    };
    if (!current) return out;
    const { lips, attacks } = current;
    return {
      ...out,
      kind: current.kind,
      tractMeasured: tractMeasured(current.model),
      columns: current.columns,
      breath: current.breath,
      holes: current.holes,
      notes: current.notes,
      dials: current.columns.map((c, k) => dialled(k) ? k : -1).filter((k) => k >= 0),
      threads: current.stream.threads,
      impedance: Boolean(current.impedance),
      strokeLeast: { tongued: strokeLength("tongued", 0), legato: strokeLength("legato", 0) },
      partials: lips ? lips.notes.map((n) => n.partial) : null,
      fingerings: lips?.valves ? lips.notes.map((n) => n.fingering) : null,
      names: lips?.valves || lips?.slide ? lips.notes.map((n) => n.names ?? []) : null,
      positions: lips?.slide ? lips.notes.map((n) => n.position) : null,
      alternates: lips?.slide ? lips.notes.map((n) => Boolean(n.alternate)) : null,
      slide: lips?.slide ? { most: lips.slide.most, positions: lips.slide.positions.map((p) => ({ position: p.position, out: p.out })), speed: SLIDE_SPEED, least: SLIDE_LEAST } : null,
      valves: lips?.valves?.columns ?? null,
      unplayed: lips ? lips.unplayed : null,
      lipReach: lips ? [lips.grid.lips[0], lips.grid.lips.at(-1)] : null,
      unattacked: attacks ? attacks.notes.map((a) => Object.entries(a.dynamics).filter(([, g]) => g.share == null).map(([d]) => d)) : null,
      // (Its mutes, the one in, the one asked and how far its body has come, and those kept taken up.)
      mute: current.mute,
      mutes: Object.keys(BRASS_MUTES[current.model] ?? {}),
      muting: muting && { mute: muting.mute, ready: Boolean(muting.made), step: muting.made ? null : making.get(muting.mute)?.step ?? "its body", seconds: (Date.now() - muting.since) / 1e3, error: muting.error },
      mutesKept: [...bodies.keys()],
      vibratoOwn: vibratoOf(current.model),
      layout: current.layout,
      players: current.players,
      lungs: { ...LUNGS, breath: BREATH_LITRES, airflow: airflowOf(current.model).source },
      noise: { kinds: windsNoiseKinds(current.kind).map((what) => ({ what, sd: WINDS_NOISE.kinds[what].sd })), profile: WINDS_NOISE.profile, most: NOISE_MOST },
      neutral: current.neutral ? {
        note: current.neutral.note,
        midi: current.neutral.midi,
        dynamic: current.neutral.dynamic,
        cents: current.neutral.cents,
        found: current.neutral.found,
        breath: current.neutral.breath ?? 0,
        breathTimes: current.neutral.breathTimes ?? 1
      } : null,
      played: playing(),
      refused,
      soloist: soloShown(),
      player: playerShown()
    };
  }
  const LIMITS = () => ({
    stroke: [TONGUE.touch + least("key"), 0.5],
    softSeconds: [2 * TONGUE.fall, 0.2],
    rise: [least("breathRise"), 0.5],
    repeat: [0.5, 16],
    width: [0, 200],
    rate: [0.5, 12],
    litres: [0.5, +(LUNGS.capacity.litres + 2 * LUNGS.capacity.sd).toFixed(2)],
    inhale: [0.2, 2],
    flutterHz: TECHNIQUE.flutter.hzReach,
    flutterDepth: TECHNIQUE.flutter.depthReach,
    humInterval: TECHNIQUE.hum.intervalReach,
    humLevel: TECHNIQUE.hum.levelReach,
    growlInterval: TECHNIQUE.growl.intervalReach,
    growlLevel: TECHNIQUE.growl.levelReach,
    growlRough: TECHNIQUE.growl.roughReach,
    swell: [1 / REACH, REACH]
  });
  const fingeringOf = (row) => current?.lips?.valves ? current.lips.valves.columns.map(([k]) => row[k] < 0.5 ? "1" : "0").join("") : null;
  const playing = () => ({
    ...state,
    mute: current?.mute ?? null,
    tract: state.tract?.resonances ?? [],
    attack: attackHeld(),
    fingering: state.row ? fingeringOf(state.row) : null,
    lungs: { air: lungs.air, taking: lungs.taking, flow: current?.blown ?? null, players: playersSpend() },
    hummed: current && state.pitch != null ? hummed("hum") : null,
    growled: current && state.pitch != null ? hummed("growl") : null,
    position: current?.lips?.slide && state.slide != null ? positionAt(state.slide) : null,
    vibratoHeard: current?.lips ? current.heard : null
  });
  async function change(path, given2) {
    const before = state.row;
    switch (path) {
      // (A pitch: the row found sounding it, or `charted`, a charted note's own.)
      case "/pitch":
        await toPitch(Number(given2.pitch), given2.dynamic ?? state.dynamic, Boolean(given2.charted), given2.note === void 0 ? null : Number(given2.note));
        break;
      // (A reed's or jet's column dialled: its share of the rules' value, -1 to 1 1/REACH to REACH times it.)
      case "/dial": {
        const k = Number(given2.column), x = Number(given2.x);
        if (!(Number.isInteger(k) && dialled(k)) || !(x >= -1 && x <= 1)) throw new Error("a dialled column, and a place from -1 to 1");
        state.x[k] = x;
        state.row = composed();
        changed(before);
        break;
      }
      // (A hole's opening, 0 closed to 1 open, or a valve's, 0 pressed to 1 raised, until the pitch moves: every column
      // of its side -- a valve's two switches -- together.)
      case "/hole": {
        const k = Number(given2.column), v = Number(given2.value);
        if (current.columns[k]?.[0] !== "opening" || !(v >= 0 && v <= 1)) throw new Error("a hole or a valve, and its opening from 0 to 1");
        current.columns.forEach((c, j) => {
          if (c[0] === "opening" && c[1] === current.columns[k][1]) state.fingers[j] = v;
        });
        state.row = composed();
        changed(before);
        break;
      }
      // (Every dial back to the rules' value at the pitch and dynamic, the holes the pitch's.)
      case "/reset":
        state.x = {};
        state.fingers = {};
        state.row = composed();
        changed(before);
        break;
      // (Its neutral note again -- read again from its body's folder, so that one found since it was taken up is played
      // -- at its dynamic and breath, every other dial the rules' there; the middle of its charted notes at the dynamic
      // dialled where none has been found.)
      case "/neutral": {
        const found = env.neutral(current.folder);
        current.neutral = found && current.notes[found.note] === found.midi ? found : null;
        const n = current.neutral, k = n ? n.note : Math.floor(current.notes.length / 2);
        await toPitch(current.notes[k], n ? n.dynamic : state.dynamic, true, k);
        state.x = n?.breath ? { [current.breath]: n.breath } : {};
        state.fingers = {};
        state.row = composed();
        changed(before);
        break;
      }
      // (The lips' frequency dialled by itself, the pitch asked kept: their other values those that go with it
      // (lipsRow, its register's), the breath the pitch's; the partial heard the one the bore locks to. Its attack
      // from rest the partial's whose lips these are.)
      case "/lip": {
        if (!current.lips) throw new Error("only a brass instrument's lips are dialled by their frequency");
        const [low, high] = [current.lips.grid.lips[0], current.lips.grid.lips.at(-1)], lip = Number(given2.lip);
        if (!(lip >= low && lip <= high)) throw new Error(`lips from ${low.toFixed(1)} to ${high.toFixed(1)} Hz`);
        Object.assign(state, { lip, lipDialled: true, bend: 0, rules: lipsRow(current.lips, lip, lipsBreath2(state.pitch, state.dynamic, partialsAbout(state.pitch, state.dynamic)), state.valves) });
        state.row = composed();
        changed(before);
        sway();
        break;
      }
      // (A brass player's pitch bent by the lips, as its players follow a pitch's path: `cents` from the pitch held, its
      // lips that much over or under those it holds it with -- the bore pulling its partial less far than they move --
      // moved to over `seconds`, its valves, slide and breath held: as the renders bend a brass note, its lips scaled by
      // its pitch curve over its pitch (ness.mjs), within the lips its rows reach. Undone by the next pitch.)
      case "/bend": {
        if (!current.lips) throw new Error("only a brass instrument's lips are bent");
        const cents = Number(given2.cents), seconds = given2.seconds === void 0 ? 0 : Number(given2.seconds);
        if (!Number.isFinite(cents) || !(seconds >= 0)) throw new Error("a bend in cents, over some seconds");
        if (state.lip == null) throw new Error("a pitch to bend first");
        const [low, high] = [current.lips.grid.lips[0], current.lips.grid.lips.at(-1)], lip = Math.min(Math.max(state.lip * 2 ** (cents / 1200), low), high);
        state.bend = cents;
        state.rules = lipsRow(current.lips, lip, lipsBreath2(state.pitch, state.dynamic, partialsAbout(state.pitch, state.dynamic)), state.valves);
        state.row = composed();
        if (!tonguing() && !queue.some((e) => e.tag === "attack")) hold(state.row, Math.max(seconds, least("lips")));
        break;
      }
      // (A trombone's slide drawn by itself, `out` m of tube past its first position, as its players draw it: its lips
      // and breath held, the pitch the bore gives there.)
      case "/slide": {
        if (!current.lips?.slide) throw new Error("only a trombone's slide is drawn");
        const out = Number(given2.out), most = current.lips.slide.most;
        if (!(out >= 0 && out <= most)) throw new Error(`a slide drawn from 0 to ${most.toFixed(3)} m of tube`);
        slideTo(out);
        state.slideDialled = true;
        break;
      }
      // (A row of the body's columns held as it is given: the brass stream's test, a tool.)
      case "/row":
        if (!Array.isArray(given2.row) || given2.row.length !== current.columns.length || !given2.row.every(Number.isFinite)) throw new Error("a row of the body's columns");
        state.row = given2.row;
        changed(before);
        break;
      case "/blow":
        blow(Boolean(given2.on));
        break;
      // (The tongue now, as the articulation says: a slurred note's a legato tongue's.)
      case "/tongue":
        if (state.blowing && !lungs.taking) stroke(state.row, state.articulation === "tongued" ? "tongued" : "legato");
        break;
      case "/articulation": {
        if (given2.articulation !== void 0) {
          if (!["slurred", "legato", "tongued"].includes(given2.articulation)) throw new Error("slurred, legato or tongued");
          state.articulation = given2.articulation;
        }
        const within2 = (name, low, high) => {
          if (given2[name] === void 0) return;
          const v = Number(given2[name]);
          if (!(v >= low && v <= high)) throw new Error(`${name} from ${low} to ${high} s`);
          state[name] = v;
        };
        const limits = LIMITS();
        for (const name of ["stroke", "softSeconds", "rise"]) within2(name, ...limits[name]);
        state.breathAttack = firstEndingAt(state.breathAttack, state.rise);
        if (state.repeat.on) repeating();
        break;
      }
      // (The breath's attack, a curve (attack-curves.js) from rest, each segment eased as the engine moves: its first
      // segment the rise, within the rise's limits.)
      case "/attack": {
        const points = curveOf2(given2.points, { from: 0, straight: false }), [low, high] = LIMITS().rise;
        if (!(points[1][0] >= low && points[1][0] <= high)) throw new Error(`its first segment, the rise, from ${low} to ${high} s`);
        state.breathAttack = points;
        state.rise = points[1][0];
        break;
      }
      // (Its breathing: on, a breath `litres` deep taken in over `inhale` s each time it is spent; off, one breath
      // without end -- one being taken let go, the note attacked again at once.)
      case "/breathing": {
        const litres = given2.litres === void 0 ? state.breathing.litres : Number(given2.litres), inhale = given2.inhale === void 0 ? state.breathing.inhale : Number(given2.inhale);
        const limits = LIMITS();
        if (!(litres >= limits.litres[0] && litres <= limits.litres[1])) throw new Error(`a breath from ${limits.litres[0]} to ${limits.litres[1]} L`);
        if (!(inhale >= limits.inhale[0] && inhale <= limits.inhale[1])) throw new Error(`a breath taken in over ${limits.inhale[0]} to ${limits.inhale[1]} s`);
        const on = given2.on === void 0 ? state.breathing.on : Boolean(given2.on), begun = on && !state.breathing.on;
        state.breathing = { on, litres, inhale };
        lungs.set({ litres, inhale });
        if (begun) lungs.filled();
        if (!on && lungs.taking) {
          cancel("breath");
          lungs.filled();
          if (state.blowing) {
            fromRest();
            repeating();
            techniques();
            sway();
          }
        }
        break;
      }
      // (Its flutter: on while it is blown, `hz` turns of the roll a second, `depth` of the breath closed off; its hum and
      // its growl: on, the voice's pitch `interval` semitones from the note, its breath swung `level` of itself, a growl's
      // voice `rough`.)
      case "/flutter": {
        const hz = given2.hz === void 0 ? state.flutter.hz : Number(given2.hz), depth = given2.depth === void 0 ? state.flutter.depth : Number(given2.depth), limits = LIMITS();
        if (!(hz >= limits.flutterHz[0] && hz <= limits.flutterHz[1])) throw new Error(`a flutter from ${limits.flutterHz[0]} to ${limits.flutterHz[1]} times a second`);
        if (!(depth >= limits.flutterDepth[0] && depth <= limits.flutterDepth[1])) throw new Error(`a flutter's depth from ${limits.flutterDepth[0]} to ${limits.flutterDepth[1]}`);
        state.flutter = { on: given2.on === void 0 ? state.flutter.on : Boolean(given2.on), hz, depth };
        techniques();
        break;
      }
      case "/hum":
      case "/growl": {
        const kind = path.slice(1), own2 = state[kind], limits = LIMITS(), of2 = (name) => given2[name] === void 0 ? own2[name] : Number(given2[name]);
        const interval = of2("interval"), level = of2("level"), rough = kind === "growl" ? of2("rough") : void 0;
        if (!(interval >= limits[`${kind}Interval`][0] && interval <= limits[`${kind}Interval`][1])) throw new Error(`a ${kind}'s pitch from ${limits[`${kind}Interval`][0]} to ${limits[`${kind}Interval`][1]} semitones from the note`);
        if (!(level >= limits[`${kind}Level`][0] && level <= limits[`${kind}Level`][1])) throw new Error(`a ${kind}'s level from ${limits[`${kind}Level`][0]} to ${limits[`${kind}Level`][1]}`);
        if (kind === "growl" && !(rough >= limits.growlRough[0] && rough <= limits.growlRough[1])) throw new Error(`a growl's roughness from ${limits.growlRough[0]} to ${limits.growlRough[1]}`);
        state[kind] = { on: given2.on === void 0 ? own2.on : Boolean(given2.on), interval, level, ...kind === "growl" ? { rough } : {} };
        techniques();
        break;
      }
      case "/repeat": {
        const rate = given2.rate === void 0 ? state.repeat.rate : Number(given2.rate);
        if (!(rate >= 0.5 && rate <= 16)) throw new Error("a rate from 0.5 to 16 notes a second");
        state.repeat = { on: given2.on === void 0 ? state.repeat.on : Boolean(given2.on), rate };
        repeating();
        break;
      }
      case "/vibrato": {
        const width = given2.width === void 0 ? state.vibrato.width : Number(given2.width), rate = given2.rate === void 0 ? state.vibrato.rate : Number(given2.rate);
        if (!(width >= 0 && width <= 200) || !(rate >= 0.5 && rate <= 12)) throw new Error("a width from 0 to 200 cents and a rate from 0.5 to 12 Hz");
        state.vibrato = { on: given2.on === void 0 ? state.vibrato.on : Boolean(given2.on), width, rate };
        sway();
        break;
      }
      // (Its player's swell through a note: its breath `share` of the row's, the breath dialled kept, moved there over
      // `seconds` -- its expression, as the renders' players swell a note (breath.mjs swellOf) and breathe its vibrato
      // (openwind-passages.mjs VIBRATO_SHARE); taken up by the next move where its tongue or its attack is moving it.)
      case "/swell": {
        const share = Number(given2.share), seconds = given2.seconds === void 0 ? 0 : Number(given2.seconds), [low, high] = LIMITS().swell;
        if (!(share >= low && share <= high) || !(seconds >= 0)) throw new Error(`a swell from ${low.toFixed(3)} to ${high.toFixed(3)} of the breath, over some seconds`);
        const rising = share > state.swell;
        state.swell = share;
        if (state.blowing && !lungs.taking && !tonguing() && !queue.some((e) => e.tag === "attack")) hold(state.row, Math.max(seconds, least(rising ? "breathRise" : "breathFall")));
        break;
      }
      // (A tract dialled, held until its players' is asked for again -- `follow`: theirs, following the note.)
      case "/tract":
        if (given2.follow === true) {
          if (!tractMeasured(current.model)) throw new Error(`no ${current.model} players' tract measured yet`);
          state.tractFollows = true;
          followed(current.model, state.pitch);
          break;
        }
        if (!Array.isArray(given2.resonances) || !given2.resonances.every((r) => r.frequency > 0 && r.q > 0 && r.peak >= 0)) throw new Error("resonances, each its frequency, q and peak; or follow");
        state.tractFollows = false;
        tract(given2.resonances);
        break;
      // (Its reed's or lips' flow's turbulence, a share of the flow per root hertz -- native/openwind/turbulence-fit.mjs
      // trying levels -- none for a jet's.)
      case "/turbulence": {
        const level = Number(given2.level);
        if (!["reed", "lips"].includes(current.kind) || !(level >= 0 && level <= TURBULENCE_MOST)) throw new Error(`a reed's or the lips' turbulence from 0 to ${TURBULENCE_MOST}`);
        turbulence(level);
        break;
      }
      // (A brass player's mute put in, or none: `mute`, one of its mutes (/state mutes), or null -- put in once its body
      // is ready and the bell has rung down after its breath (/state muting); `ready`, its body only made ready.)
      case "/mute": {
        if (!(given2.mute === null || given2.mute === void 0 || typeof given2.mute === "string")) throw new Error("a mute's name, or null");
        muteTo(given2.mute ?? null, { ready: given2.ready === true });
        break;
      }
      // (Its player's noise: the player's temperature, or a kind's its body's player has.)
      case "/noise": {
        const asked = {};
        for (const k of ["player", ...windsNoiseKinds(current.kind)]) if (given2[k] !== void 0) asked[k] = Number(given2[k]);
        if (!Object.keys(asked).length || !Object.values(asked).every((t) => t >= 0 && t <= NOISE_MOST)) throw new Error(`the player's noise, or its ${windsNoiseKinds(current.kind).join(" or ")}'s, from 0 to ${NOISE_MOST}`);
        noise(asked);
        break;
      }
      default:
        return null;
    }
    return playing();
  }
  const CHANGES = /* @__PURE__ */ new Set([
    "/pitch",
    "/dial",
    "/hole",
    "/reset",
    "/neutral",
    "/lip",
    "/bend",
    "/slide",
    "/row",
    "/blow",
    "/tongue",
    "/articulation",
    "/attack",
    "/breathing",
    "/flutter",
    "/hum",
    "/growl",
    "/repeat",
    "/vibrato",
    "/swell",
    "/tract",
    "/turbulence",
    "/mute"
  ]);
  let refused = [];
  async function later(path, given2) {
    if (!CHANGES.has(path)) return { status: 404 };
    const seconds = Number(given2.at), { at: _, by = null, ...rest } = given2;
    if (!(seconds >= 0)) throw new Error("a time from 0 s on the dial's clock");
    const at2 = Math.round(seconds * WINDS_RATE);
    if (at2 <= current.frames) {
      voicing(path, rest, by);
      return { status: 200, json: { ...await change(path, rest), rules: state.rules } };
    }
    queue.push({ at: at2, tag: "given", by, run: () => {
      voicing(path, rest, by);
      return change(path, rest).catch((error) => {
        refused = [...refused.slice(-9), { path, at: seconds, error: error.message }];
      });
    } });
    queue.sort((a, b) => a.at - b.at);
    return { status: 200, json: { queued: path, at: seconds } };
  }
  const VOICES = ["flutter", "hum", "growl"], voicedBy = {};
  function voicing(path, given2, by) {
    const kind = path.slice(1);
    if (VOICES.includes(kind) && given2.on !== void 0) voicedBy[kind] = given2.on ? by : null;
  }
  async function unvoiced(by) {
    for (const kind of VOICES) if (voicedBy[kind] === by) {
      voicedBy[kind] = null;
      if (state[kind]?.on) await change(`/${kind}`, { on: false });
    }
  }
  let pageOwn = null;
  const ownOf = () => ({ articulation: state.articulation, stroke: state.stroke, softSeconds: state.softSeconds, rise: state.rise, breathAttack: state.breathAttack, swell: state.swell });
  async function givenBack({ played: played2 = true } = {}) {
    if (!pageOwn) return;
    const { swell, ...tongue } = pageOwn;
    pageOwn = null;
    Object.assign(state, tongue);
    if (!played2) {
      for (const kind of VOICES) if (voicedBy[kind] === "soloist") {
        voicedBy[kind] = null;
        state[kind] = { ...state[kind], on: false };
      }
      state.swell = swell;
      return;
    }
    await unvoiced("soloist");
    if (state.repeat.on) repeating();
    if (state.swell !== swell) await change("/swell", { share: swell });
  }
  function withdrawn({ by = null, from }) {
    const seconds = Number(from);
    if (!(seconds >= 0)) throw new Error("a time from 0 s on the dial's clock");
    const at2 = Math.round(seconds * WINDS_RATE), before = queue.length;
    queue = queue.filter((e) => !(e.tag === "given" && e.by === by && e.at >= at2));
    return { status: 200, json: { withdrawn: before - queue.length } };
  }
  function settingsOf() {
    const name = (k) => current.columns[k].join(":"), named = (values) => Object.fromEntries(Object.entries(values).map(([k, v]) => [name(k), v]));
    const row = (values) => Object.fromEntries(current.columns.map((c, k) => [c.join(":"), values[k]]));
    return {
      family: "winds",
      model: current.model,
      body: current.name,
      mute: current.mute ?? null,
      pitch: state.pitch,
      charted: state.between?.low === state.between?.high,
      note: state.note,
      dynamic: state.dynamic,
      dials: named(state.x),
      holes: named(state.fingers),
      lip: state.lipDialled ? state.lip : null,
      slide: state.slideDialled ? state.slide : null,
      articulation: { articulation: state.articulation, stroke: state.stroke, softSeconds: state.softSeconds, rise: state.rise },
      attack: state.breathAttack,
      breathing: state.breathing,
      flutter: state.flutter,
      hum: state.hum,
      growl: state.growl,
      repeat: state.repeat,
      vibrato: state.vibrato,
      swell: state.swell,
      tract: state.tract?.resonances ?? [],
      tractFollows: state.tractFollows,
      turbulence: state.turbulence,
      noise: state.noise,
      player: playerSettings,
      plays: { row: row(state.row), rules: row(state.rules), fingering: fingeringOf(state.row) }
    };
  }
  async function applySettings(s) {
    if (s?.family !== "winds") throw new Error(`a winds dial's settings (family "winds")`);
    if (s.model !== current.model) throw new Error(`settings for the ${s.model}: take it up first`);
    const column = (name) => current.columns.findIndex((c) => c.join(":") === name), refused2 = [];
    let made = 0;
    const run = async (path, given2) => {
      try {
        await change(path, given2);
        made++;
      } catch (error) {
        refused2.push({ path, error: error.message });
      }
    };
    if ((s.mute ?? null) !== (current.mute ?? null) && BRASS_MUTES[current.model]) {
      try {
        muteTo(s.mute ?? null);
        if (muting && !state.blowing && current.frames >= quiet) {
          muting.made ??= await readied(muting.mute);
          if (muting?.made) changedOver();
        }
        made++;
      } catch (error) {
        refused2.push({ path: "/mute", error: error.message });
      }
    }
    await run("/pitch", s.charted && Number.isInteger(s.note) ? { pitch: s.pitch, dynamic: s.dynamic, charted: true, note: s.note } : { pitch: s.pitch, dynamic: s.dynamic });
    if (s.lip != null) await run("/lip", { lip: s.lip });
    if (s.slide != null) await run("/slide", { out: s.slide });
    for (const [route, values, key] of [["/dial", s.dials, "x"], ["/hole", s.holes, "value"]]) for (const [name, v] of Object.entries(values ?? {})) {
      const k = column(name);
      if (k < 0) refused2.push({ path: route, error: `no column ${name} on this body` });
      else await run(route, { column: k, [key]: v });
    }
    if (s.articulation) await run("/articulation", s.articulation);
    if (s.attack) await run("/attack", { points: s.attack });
    for (const what of ["breathing", "flutter", "hum", "growl", "repeat", "vibrato"]) if (s[what]) await run(`/${what}`, s[what]);
    if (s.swell != null) await run("/swell", { share: s.swell });
    if (s.tractFollows) await run("/tract", { follow: true });
    else if (s.tract) await run("/tract", { resonances: s.tract });
    if (s.turbulence != null && ["reed", "lips"].includes(current.kind)) await run("/turbulence", { level: s.turbulence });
    if (s.noise) await run("/noise", s.noise);
    if (s.player) {
      try {
        const { playerSettingsOf } = await import("./soloist/soloist.js");
        playerSettings = playerSettingsOf(s.player);
        made++;
      } catch (error) {
        refused2.push({ path: "/soloist", error: error.message });
      }
    }
    return { status: 200, json: { ...playing(), rules: state.rules, loaded: { made, refused: refused2 }, player: playerShown() } };
  }
  async function handle(method, path, query, given2 = {}) {
    try {
      if (path === "/state") return { status: 200, json: shown() };
      if (path === "/impedance") return { status: 200, json: current?.impedance ?? null };
      if (path === "/settings" && method !== "POST") return current ? { status: 200, json: settingsOf() } : { status: 400, json: { error: "no instrument yet" } };
      if (path === "/audio") {
        const frames = Math.min(Math.max(1, Number(query?.get("frames")) || 1024), PULL_MOST);
        const samples = await serial(() => pulled(frames));
        return { status: 200, samples, headers: {
          "x-pace": pace == null ? "" : pace.toFixed(3),
          "x-model": current?.model ?? "",
          "x-version": String(version),
          "x-lungs": `${lungs.air.toFixed(3)} ${lungs.taking ? 1 : 0}`,
          "x-seconds": String((current?.frames ?? 0) / WINDS_RATE)
        } };
      }
      if (method !== "POST") return { status: 404 };
      if (path === "/instrument") {
        choose(given2.model);
        return { status: 200, json: shown() };
      }
      if (path === "/keep") {
        if (!current) throw new Error("no instrument yet");
        const named = (row) => Object.fromEntries(current.columns.map((c, k) => [c.join(":"), row[k]]));
        const kept = await env.keep({
          at: (/* @__PURE__ */ new Date()).toISOString(),
          model: current.model,
          body: current.name,
          ...current.mute ? { mute: current.mute } : {},
          midi: state.midi,
          pitch: state.pitch,
          ...current.lips ? { lip: state.lip } : {},
          ...current.lips?.slide ? { slide: state.slide, position: positionAt(state.slide) } : {},
          dynamic: state.dynamic,
          words: String(given2.words ?? ""),
          row: named(state.row),
          rules: named(state.rules),
          tract: state.tract.resonances,
          articulation: state.articulation,
          stroke: state.stroke,
          softSeconds: state.softSeconds,
          rise: state.rise,
          breathAttack: state.breathAttack,
          repeat: state.repeat,
          vibrato: state.vibrato,
          breathing: state.breathing,
          flutter: state.flutter,
          hum: state.hum,
          growl: state.growl
        });
        return { status: 200, json: { kept } };
      }
      if (!current) throw new Error("no instrument yet");
      if (given2.version !== void 0 && given2.version !== version) return { status: 409, json: { error: "another instrument was taken up", version } };
      if (path === "/withdraw") return await serial(() => withdrawn(given2));
      if (path === "/soloist") return await serial(() => solo(given2));
      if (path === "/settings") return await serial(() => applySettings(given2.settings));
      if (given2.at != null) return await serial(() => later(path, given2));
      const answer = await serial(() => change(path, given2));
      if (answer === null) return { status: 404 };
      return { status: 200, json: { ...answer, rules: state.rules } };
    } catch (error) {
      return { status: 400, json: { error: error.message } };
    }
  }
  const close = () => {
    closed = true;
    for (const made of /* @__PURE__ */ new Set([current, ...bodies.values()])) if (made) {
      made.glides?.stop();
      made.stream.close();
    }
  };
  return { choose, handle, close };
}

// public/studio/engines/openwind-stream.js
var decoder = new TextDecoder();
var encoder2 = new TextEncoder();
var textAt = (buffer, at2, length) => decoder.decode(new Uint8Array(buffer, at2, length).slice());
function wasiImports(memory, { said = (text) => console.error(text) } = {}) {
  const view = () => new DataView(memory.buffer), BAD = 8;
  let line2 = "";
  return {
    clock_time_get(id, precision, out) {
      view().setBigUint64(out, BigInt(Math.round(id === 0 ? Date.now() * 1e6 : (performance.timeOrigin + performance.now()) * 1e6)), true);
      return 0;
    },
    random_get(at2, length) {
      for (let k = 0; k < length; k += 65536) {
        const n = Math.min(65536, length - k), bytes = crypto.getRandomValues(new Uint8Array(n));
        new Uint8Array(memory.buffer, at2 + k, n).set(bytes);
      }
      return 0;
    },
    environ_sizes_get(count, size) {
      view().setUint32(count, 0, true);
      view().setUint32(size, 0, true);
      return 0;
    },
    environ_get() {
      return 0;
    },
    fd_write(fd, iovs, n, written) {
      let total = 0;
      for (let k = 0; k < n; k++) {
        const at2 = view().getUint32(iovs + 8 * k, true), length = view().getUint32(iovs + 8 * k + 4, true);
        line2 += textAt(memory.buffer, at2, length);
        total += length;
      }
      for (let newline; (newline = line2.indexOf("\n")) >= 0; line2 = line2.slice(newline + 1)) if (fd === 1 || fd === 2) said(line2.slice(0, newline));
      view().setUint32(written, total, true);
      return 0;
    },
    fd_close: () => BAD,
    fd_fdstat_get: () => BAD,
    fd_filestat_get: () => BAD,
    fd_prestat_get: () => BAD,
    fd_prestat_dir_name: () => BAD,
    fd_read: () => BAD,
    path_open: () => BAD,
    proc_exit(code) {
      throw new Error(`the winds' engine exited (${code})`);
    },
    sched_yield: () => 0
  };
}
function memoryLimits(bytes) {
  const b = new Uint8Array(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength);
  let at2 = 8;
  const leb = () => {
    let v = 0, shift = 0, byte;
    do {
      byte = b[at2++];
      v += (byte & 127) * 2 ** shift;
      shift += 7;
    } while (byte & 128);
    return v;
  };
  const name = () => {
    const n = leb();
    at2 += n;
  };
  while (at2 < b.length) {
    const id = b[at2++], size = leb(), end = at2 + size;
    if (id !== 2) {
      at2 = end;
      continue;
    }
    for (let k = leb(); k > 0; k--) {
      name();
      name();
      const kind = b[at2++];
      if (kind === 0) {
        leb();
        continue;
      }
      if (kind === 1) {
        at2++;
        const f = b[at2++];
        leb();
        if (f & 1) leb();
        continue;
      }
      if (kind === 3) {
        at2 += 2;
        continue;
      }
      const flags = b[at2++], initial = leb(), maximum = flags & 1 ? leb() : void 0;
      return { initial, maximum, shared: Boolean(flags & 2) };
    }
    at2 = end;
  }
  return null;
}
async function openwindEngine(bytes, { thread = null, said } = {}) {
  const limits = memoryLimits(bytes), threaded2 = Boolean(limits?.shared);
  const module = await WebAssembly.compile(bytes);
  let memoryOf = null, cores2 = null;
  if (threaded2) {
    if (!thread) throw new Error("the winds' threaded engine needs its Workers (`thread`)");
    const memory2 = new WebAssembly.Memory({ initial: limits.initial, maximum: limits.maximum, shared: true });
    memoryOf = memory2;
    cores2 = threadCores(module, memory2, thread, said);
  }
  const instance = await WebAssembly.instantiate(module, threaded2 ? { env: { memory: memoryOf }, wasi_snapshot_preview1: wasiImports(memoryOf, { said }), wasi: { "thread-spawn": cores2.spawn } } : {});
  const x = instance.exports, memory = () => (memoryOf ?? x.memory).buffer;
  if (threaded2) x.ow_start();
  const error = () => textAt(memory(), x.ow_error(), x.ow_error_len());
  const holding = (views, call) => {
    const held = views.map((view) => {
      const data = view instanceof Uint8Array ? view : new Uint8Array(view.buffer ?? view, view.byteOffset ?? 0, view.byteLength);
      const at2 = x.ow_alloc(data.length);
      new Uint8Array(memory(), at2, data.length).set(data);
      return { at: at2, length: data.length };
    });
    try {
      return call(held);
    } finally {
      for (const { at: at2, length } of held) x.ow_free(at2, length);
    }
  };
  const json = (value3) => encoder2.encode(typeof value3 === "string" ? value3 : JSON.stringify(value3));
  const given2 = (call, stream2, value3) => {
    if (holding([json(value3)], ([{ at: at2, length }]) => call(stream2, at2, length)) !== 0) throw new Error(error());
  };
  const answer = (at2) => {
    if (!at2) throw new Error(error());
    return JSON.parse(textAt(memory(), at2, x.ow_text_len()));
  };
  return {
    threaded: threaded2,
    // (Its cores' Workers, `threads` - 1 of them waiting, made where they are not yet: before a player is opened on them.)
    async prepare(threads) {
      if (threaded2) await cores2.made(threads - 1);
    },
    open({ header, I, D, law, rules }, { single = false, threads = 1 } = {}) {
      const text = (value3) => typeof value3 === "string" ? encoder2.encode(value3) : value3;
      const k = threaded2 ? Math.min(threads, cores2.idle() + 1) : 1;
      const stream2 = holding([text(header), I, D, text(law), text(rules)], (held) => {
        const at2 = held.flatMap(({ at: at3, length }) => [at3, length]);
        return k > 1 ? x.ow_open_threaded(...at2, single ? 1 : 0, k) : x.ow_open(...at2, single ? 1 : 0);
      });
      if (!stream2) throw new Error(`The winds' engine could not open its body: ${error()}`);
      let closed = false;
      return {
        nativeRate: x.ow_native_rate(stream2),
        threads: x.ow_threads ? x.ow_threads(stream2) : 1,
        get late() {
          return Number(x.ow_late(stream2));
        },
        // A breath group (stream.rs GroupLine), an object or its JSON.
        group(line2) {
          if (holding([json(line2)], ([{ at: at2, length }]) => x.ow_group(stream2, at2, length)) !== 0) throw new Error(error());
        },
        letGo(seconds) {
          x.ow_let_go(stream2, seconds);
        },
        // A breath group's controls as it would shape them, `tail` seconds past its end besides (stream.rs spec), for
        // another engine to play it from (render/synthesis/src/ness-woodwind.mjs). -> its Spec (controls.rs).
        spec(line2, tail = 0) {
          return answer(holding([json(line2)], ([{ at: at2, length }]) => x.ow_spec(stream2, at2, length, tail)));
        },
        // The live dial's, as the stream binary takes them (src/bin/musebots-openwind-stream.rs): its controls' columns
        // (`c`), the row a group's line gives `seconds` after its start (`o`), its controls held at a row (`h`: stream.rs
        // HeldLine), a vibrato on it (`v`), its player's techniques on it (`k`: stream.rs TechniqueLine, a hum, a growl, a
        // flutter on its breath's column), its player's tract (`t`), its slide (`s`), its flow's turbulence (`n`), its
        // player's noise of one kind (`p`: stream.rs NoiseLine, player-noise.js windsNoiseLine), the air its player spent
        // since it was last asked (`a`: stream.rs Air, {litres, seconds}).
        columns() {
          return answer(x.ow_columns(stream2));
        },
        air() {
          return answer(x.ow_air(stream2));
        },
        row(line2, seconds) {
          return answer(holding([json({ line: line2, seconds })], ([{ at: at2, length }]) => x.ow_row(stream2, at2, length)));
        },
        hold(row, seconds = 0, floor) {
          given2(x.ow_hold, stream2, { row, seconds, floor });
        },
        vibrato({ columns, depths, cents = [], rate, seconds = 0 }) {
          given2(x.ow_vibrato, stream2, { columns, depths, cents, rate, seconds });
        },
        technique({ column, hum, growl, flutter, seconds = 0 }) {
          given2(x.ow_technique, stream2, { column, hum, growl, flutter, seconds });
        },
        tract(resonances, seconds = 0) {
          given2(x.ow_tract, stream2, { resonances, seconds });
        },
        turbulence(level) {
          given2(x.ow_turbulence, stream2, { level });
        },
        noise(line2) {
          given2(x.ow_noise, stream2, line2);
        },
        slide(out, seconds = 0) {
          given2(x.ow_slide, stream2, { out, seconds });
        },
        // `frames` more of its sound. -> a Float32Array of its own.
        render(frames) {
          const at2 = x.ow_render(stream2, frames);
          if (!at2) throw new Error(`The winds' engine stopped: ${error()}`);
          return new Float32Array(memory(), at2, frames).slice();
        },
        close() {
          if (!closed) {
            closed = true;
            x.ow_close(stream2);
          }
        }
      };
    },
    // (Its cores' Workers let go: the engine done with.)
    end() {
      cores2?.end();
    }
  };
}
var SLOT = 4;
var IDLE = 0;
var ASKED = 1;
var RUNNING = 2;
var END = 3;
var CLAIMED = 4;
function threadCores(module, memory, thread, said) {
  const most = 16, control = new Int32Array(new SharedArrayBuffer(4 * SLOT * most)), workers = [];
  let next = 1, making = null;
  const cores2 = {
    get count() {
      return workers.length;
    },
    // (Those waiting for a thread.)
    idle() {
      let n = 0;
      for (let slot = 0; slot < workers.length; slot++) if (Atomics.load(control, slot * SLOT) === IDLE) n++;
      return n;
    },
    // (Made where fewer than `n` wait for a thread, each answering once it has instantiated the module.)
    made(n) {
      making = (making ?? Promise.resolve()).then(async () => {
        while (cores2.idle() < n && workers.length < most) {
          const slot = workers.length, worker = thread();
          await new Promise((done, fail) => {
            const told = (event) => {
              const m = event.data ?? event;
              if (m === "ready") done();
              else if (m?.error) fail(new Error(m.error));
              else if (m?.said) said?.(m.said);
            };
            if (typeof worker.on === "function") {
              worker.on("message", told);
              worker.on("error", fail);
            } else {
              worker.onmessage = told;
              worker.onerror = (e) => fail(new Error(e.message));
            }
            worker.postMessage({ module, memory, control, slot, SLOT });
          });
          workers.push(worker);
        }
      });
      return making;
    },
    // (wasi-threads' thread-spawn: a waiting core handed the thread. -> its id, or -1 where every core is busy.)
    spawn(start) {
      for (let slot = 0; slot < workers.length; slot++) {
        if (Atomics.compareExchange(control, slot * SLOT, IDLE, CLAIMED) !== IDLE) continue;
        const id = next++;
        Atomics.store(control, slot * SLOT + 1, id);
        Atomics.store(control, slot * SLOT + 2, start);
        Atomics.store(control, slot * SLOT, ASKED);
        Atomics.notify(control, slot * SLOT);
        return id;
      }
      return -1;
    },
    end() {
      for (let slot = 0; slot < workers.length; slot++) {
        Atomics.store(control, slot * SLOT, END);
        Atomics.notify(control, slot * SLOT);
      }
      for (const w of workers) w.terminate?.();
    }
  };
  return cores2;
}
var THREAD_STATES = Object.freeze({ SLOT, IDLE, ASKED, RUNNING, END, CLAIMED });
var PRUNE = 1.3;
var HEADROOM = 0.5;
function fastestCores(engine2, files, { single = false, most = 1, row, frames = 4800, rate = RATE, rounds = 3 } = {}) {
  const times = {};
  const timed = (k, warm) => {
    const player2 = engine2.open(files, { single, threads: k });
    try {
      player2.hold(row);
      player2.render(warm);
      const began = performance.now();
      player2.render(frames);
      (times[player2.threads] ??= []).push((performance.now() - began) / 1e3 / (frames / rate));
    } finally {
      player2.close();
    }
  };
  const median2 = (v) => [...v].sort((a, b) => a - b)[v.length >> 1], paces = {};
  timed(most, 3 * frames);
  for (const k in times) delete times[k];
  let asked = [...new Set([1, 2, 3, 4, 6, 8, 12, 16].filter((k) => k < most).concat(most))];
  for (let round = 0; round < rounds && asked.length; round++) {
    for (const k of round % 2 ? [...asked].reverse() : asked) timed(k, frames / 4);
    for (const k in times) paces[k] = median2(times[k]);
    if (round === 0) asked = Object.keys(times).map(Number);
    const best2 = Math.min(...asked.map((k) => paces[k]));
    asked = asked.filter((k) => paces[k] <= PRUNE * best2 || paces[k] <= HEADROOM);
    if (asked.length === 1) break;
  }
  const best = Math.min(...asked.map((k) => paces[k]));
  asked.sort((a, b) => a - b);
  return { threads: asked.find((k) => paces[k] <= HEADROOM) ?? asked.find((k) => paces[k] <= 1.03 * best), paces };
}
function liveStream(engine2, files, { single = false, threads = 1, most = null, onError = () => {
} } = {}) {
  let player2 = null, closed = false;
  const said = (call) => (...a) => {
    if (closed || !player2) return;
    try {
      call(...a);
    } catch (error) {
      onError(error.message);
    }
  };
  const stream2 = {
    threads: 1,
    ready: (async () => {
      const [given2, made] = await Promise.all([files, engine2]);
      await made.prepare(most ?? threads);
      if (closed) throw new Error("the winds' player has ended");
      if (most > 1) ({ threads, paces: stream2.paces } = fastestCores(made, given2, { single, most, row: given2.row }));
      player2 = made.open(given2, { single, threads });
      stream2.threads = player2.threads;
      stream2.own = player2.nativeRate;
      return stream2;
    })(),
    columns: async () => player2.columns(),
    row: async (line2, seconds) => player2.row(line2, seconds),
    air: async () => player2.air(),
    hold: said((row, seconds, floor) => player2.hold(row, seconds, floor)),
    tract: said((resonances, seconds) => player2.tract(resonances, seconds)),
    turbulence: said((level) => player2.turbulence(level)),
    noise: said((line2) => player2.noise(line2)),
    vibrato: said((line2) => player2.vibrato(line2)),
    technique: said((line2) => player2.technique(line2)),
    slide: said((out, seconds) => player2.slide(out, seconds)),
    async render(frames) {
      if (closed) throw new Error("the winds' player has ended");
      return player2.render(frames);
    },
    close() {
      if (!closed) {
        closed = true;
        player2?.close();
      }
    }
  };
  stream2.ready.catch(() => {
  });
  return stream2;
}
var SILENT = 2 ** -23;
var RATE = 48e3;

// native/live/site/dial-worker.js
var at = (path) => new URL(path, self.location.href);
var got = async (path, as = "json") => {
  const r = await fetch(at(`${path}.gz`));
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return new Response(r.body.pipeThrough(new DecompressionStream("gzip")))[as]();
};
var say = (text) => self.postMessage({ said: text });
var threaded = Boolean(self.crossOriginIsolated) && typeof SharedArrayBuffer !== "undefined";
var CORES = threaded ? Math.max(1, Math.min(16, (navigator.hardwareConcurrency || 1) - 2)) : 1;
var engine = got(threaded ? "openwind-threads.wasm" : "openwind.wasm", "arrayBuffer").then((bytes) => openwindEngine(bytes, {
  said: say,
  thread: threaded ? () => new Worker(at("openwind-thread.js"), { type: "module" }) : null
}));
var fetched = /* @__PURE__ */ new Map();
var loaded = /* @__PURE__ */ new Map();
var cores = /* @__PURE__ */ new Map();
function filesOf(m, mute = null) {
  const own2 = mute ? m.mutes?.[mute] : m;
  if (!own2) return Promise.reject(new Error(`the ${m.model}'s body with its ${mute} mute is not published here`));
  const folder = mute ? `winds/${m.model}/muted/${mute}` : `winds/${m.model}`, of2 = (file) => `${folder}/${file}`, has = (file) => own2.files.includes(file) ? got(of2(file)) : null;
  if (!fetched.has(folder)) fetched.set(folder, (async () => {
    const [laid, rules, attacks, vibrato, neutral, rows, glides, impedance, alternates] = await Promise.all(["body.json", "rules.json", "attacks.json", "vibrato.json", "neutral.json", "rows.json", "glides.json", "impedance.json", "alternates.json"].map(has));
    const files = {
      folder,
      laid,
      rules,
      attacks,
      vibrato,
      neutral,
      rows,
      glides,
      impedance,
      alternates,
      engine: Promise.all([got(of2("body.json"), "text"), got(of2("I.bin"), "arrayBuffer"), got(of2("D.bin"), "arrayBuffer"), got(of2("law.json"), "text"), got(of2("rules.json"), "text")]).then(([header, I, D, law, text]) => ({ header, I: new Uint8Array(I), D: new Uint8Array(D), law, rules: text }))
    };
    files.engine.catch(() => {
    });
    loaded.set(folder, files);
    return files;
  })());
  return fetched.get(folder);
}
function neutralRow(m, { rules, rows, neutral }) {
  const note = rules.notes[neutral?.note ?? 0];
  return m.kind === "lips" ? lipsRow(rules, note.lip, note.pressures.mf, note.valves) : rows.mf[String(note.midi)];
}
var ready = (async () => {
  const { instruments, first, strings } = await got("winds/manifest.json");
  const by = Object.fromEntries(instruments.map((m) => [m.model, m]));
  const dial = windsDial({
    instruments: instruments.map((m) => m.model),
    kinds: Object.fromEntries(instruments.map((m) => [m.model, m.kind])),
    body: async (model, { mute = null } = {}) => {
      const m = by[model], f = await filesOf(m, mute);
      return { folder: f.folder, name: mute ? m.mutes[mute].name : m.name, rules: f.rules, laid: { ...f.laid, single: f.laid.single || m.single }, attacks: f.attacks, vibrato: f.vibrato, alternates: f.alternates };
    },
    // (On the cores found fastest for it here, the first time it is taken up: openwind-stream.js fastestCores.)
    engine: ({ model, folder, onError }) => {
      const m = by[model];
      const stream2 = liveStream(engine, (async () => {
        await engine;
        const f = loaded.get(folder);
        return { ...await f.engine, row: neutralRow(m, f) };
      })(), { single: m.single, ...cores.has(model) ? { threads: cores.get(model) } : { most: CORES }, onError });
      stream2.ready.then(() => {
        if (!cores.has(model)) {
          cores.set(model, stream2.threads);
          if (stream2.paces) say(`  the ${model} on ${stream2.threads} of ${CORES} cores, timed here: ${Object.entries(stream2.paces).map(([k, pace]) => `${k} ${Math.round(100 * pace)} %`).join(", ")} of real time`);
        }
      }, () => {
      });
      return stream2;
    },
    // (The glides the Mac kept; one it never measured is the two notes' rows blended -- `provisional` -- here.)
    glides: ({ folder, columns, shaded }) => new GlideBook({ columns, shaded, kept: loaded.get(folder).glides ?? {} }),
    // (Its rules' rows at each dynamic, as the Mac's engine gave them for this body: glides.mjs rulesRow.)
    rulesRow: async (_, model, midi, dynamic) => {
      const row = (await filesOf(by[model])).rows?.[dynamic]?.[String(midi)];
      if (!row) throw new Error(`no row of the ${model}'s at ${midi} ${dynamic} was packed`);
      return row;
    },
    neutral: (folder) => loaded.get(folder)?.neutral ?? null,
    impedance: (made) => {
      made.impedance = loaded.get(made.folder)?.impedance ?? null;
    },
    keep: (record2) => {
      self.postMessage({ kept: record2 });
      return "this browser (live.kept() in the console gives them)";
    },
    log: say,
    warn: say
  });
  const built = engine.then((e) => ({ threaded: e.threaded, cores: CORES }), (error) => ({ error: error.message }));
  const families = async () => ({
    strings: { instruments: strings, running: false, starting: false, ended: null },
    winds: { instruments: instruments.map(({ model, kind }) => ({ model, kind })), running: true, starting: false, ended: null },
    first,
    engine: await built
  });
  return { dial, families };
})();
self.onmessage = async ({ data: { id, method, path, query, given: given2 } }) => {
  try {
    const { dial, families } = await ready;
    if (path === "/families" || path === "/start") {
      self.postMessage({ id, status: 200, json: await families() });
      return;
    }
    const m = /^\/winds(\/.*)$/.exec(path);
    if (!m) {
      self.postMessage({ id, status: 404 });
      return;
    }
    const answer = await dial.handle(method, m[1], new URLSearchParams(query), given2 ?? {});
    if (answer.samples) {
      const samples = new Float32Array(answer.samples);
      self.postMessage({ id, status: answer.status, samples, headers: answer.headers }, [samples.buffer]);
      return;
    }
    self.postMessage({ id, status: answer.status, json: answer.json });
  } catch (error) {
    self.postMessage({ id, status: 400, json: { error: error.message } });
  }
};
