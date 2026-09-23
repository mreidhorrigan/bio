// @ts-check
"use strict";
/* ============================================================================
   i18n-fr.js: the French of matthorrigan.com, all of it, in one file.
   ----------------------------------------------------------------------------
   i18n.js does the machinery and knows no French; this file is only words. Hand
   it to a translator on its own, or delete it and the site is English again.

   TWO KINDS OF ENTRY
     strings   keyed text a script asks for by name, through MH_I18N.t().
               {name} placeholders are filled by the caller, in either language.
     dom       rules that rewrite words already in a page's markup, filed under
               the page's file name ("*" means every page). A rule is a CSS
               selector plus one of: text, html, each / eachHtml (one string per
               match, null to skip one), attr.

   INCLUSIVE FRENCH: the conventions this file follows
     1. Neutral by construction, first. Epicene nouns and collective or personal
        phrasings carry the inclusion: "la population étudiante", "les personnes
        qui enseignent", "spécialiste de la communication". They include
        everyone, they read aloud as ordinary French, and no reader has to
        decode them.
     2. No generic masculine. Where English says "students" and French would
        reach for "les étudiants" as a supposedly neutral plural, this file
        rewords instead.
     3. iel / iels is the third-person pronoun when one is actually needed. It
        is the current neutral pronoun (in Le Robert since 2021), and on this
        site that covers everyone whose gender has not been stated.
     4. A doublet puts the feminine first and takes the accord de proximité: a
        participle or adjective agrees with the noun next to it, not with a
        masculine default.
     5. No point médian. "étudiant·es" is read out as punctuation by screen
        readers and slows dyslexic readers, and this site already spends its
        effort on focus rings, labels, and reduced motion. The wording carries
        the inclusion instead of the typography. Contracted forms (celleux,
        toustes) meet the same test: used only where rewording would be worse.
     6. The author's own lines never take on a gender that has not been stated.
        Hence "je suis spécialiste de la communication" (épicène, and French
        drops the article after être) and "j'ai fait de la conception sonore"
        rather than an agent noun that would have to pick a side.
     7. The visitor is "vous", and nothing is ever made to agree with them.

   WHAT STAYS IN ENGLISH, ON PURPOSE
     Names of things: the tools (MCQer, SeatPlanner, ExamTimer, Nameplates), the
     works (Autofac: Rad Shipping, Rock Walls and Damp, No Phenomenon), the skins
     (bureaucore, technurture, gloomthmaxx), titles of talks and papers, and the
     Canvas column names a teacher has to match by eye. A name is an address,
     not a description. MCQer's [Question.] / [Answer.] tags are input syntax,
     so they are keywords too: only the prose around them is translated.

   TYPOGRAPHY
       is a non-breaking space, written as an escape so it stays visible in
     the source. French puts one before : ; ! ? and inside « ».

   Check that a page's rules still match its markup: MH_I18N.check() in the
   browser console. See docs/i18n.md.
   ========================================================================== */

(function (dict) {
  if (window.MH_I18N) window.MH_I18N.register("fr", dict);
  else (window.MH_I18N_QUEUE = window.MH_I18N_QUEUE || []).push(["fr", dict]);
})({

  label: "Français",                     // the switch is written in the language it leads to
  switchLabel: "Passer en français",

  /* ══ Keyed strings: text that scripts build at run time ═══════════════════ */
  strings: {

    /* ── the walkable world (engine.js) ──────────────────────────────────── */
    "world.colour": "Couleur {n}",
    "world.plaza": "◇ La place",
    /* ── Slimeverse 3D: the village in three dimensions ─────────────────── */
    "slimeverse3d.navchip": "{n}. {title}",
    "slimeverse3d.opensIn": "Ceci s'ouvre dans un nouvel onglet.",
    "slimeverse3d.open": "Ouvrir {title}",
    "world.progress": "{v} / {n} vues",
    "world.soundOn": "Son activé",
    "world.soundOff": "Son coupé",
    "world.heading": "Retour à la place",
    "world.pressBuild": "Appuyez sur B (✎ Bâtir) pour déplacer ou retirer des bâtiments",
    "world.buildOn": "Mode construction\u00A0: glissez pour déplacer, choisissez un outil pour ajouter ou retirer",
    "world.buildOff": "Mode construction désactivé",
    "world.occupied": "Il y a déjà quelque chose ici",
    // Drawn onto the canvas over the kiosk you are standing at.
    "world.pressE": "Appuyez sur E",
    "world.enterArrow": "ENTRER →",
    "world.underConstruction": "EN CONSTRUCTION",

    /* ── the three skins (theme-*.js). The coined names stay; the lines under
         them are prose. ─────────────────────────────────────────────────── */
    "theme.technocute.tagline":
      "Un petit plateau de bâtiments, net et vide. Approchez-vous et cliquez pour entrer. La tour de blocs marque la place.",
    "theme.technurture.tagline":
      "Un monde vert et envahi de végétation. La terre compte plusieurs biomes, et chaque bâtiment porte le lieu où il se tient. Entrez dans l'un d'eux.",
    "theme.technoscure.tagline":
      "Le même monde une fois la nuit tombée. Restez dans la lumière. Quelque chose bouge dans la pénombre, et les fenêtres sont encore chaudes.",

    /* ── the kiosks (content.js), keyed by their English name ────────────── */
    "kiosk.About.title": "À propos",
    "kiosk.Toolbox.title": "Boîte à outils",
    "kiosk.Research.title": "Recherche",
    "kiosk.Public Writing.title": "Écrits publics",
    "kiosk.Store.title": "Boutique",
    "kiosk.Music.title": "Musique",
    "kiosk.Games.title": "Jeux",
    // the two houses on the Écrits publics road
    "kiosk.Criticism.title": "Critique",
    "kiosk.Glossary.title": "Glossaire",
    // "CV" is the same word in French, and the road-houses (No Phenomenon,
    // Autofac…) carry the names of works: no entry, so they come back unchanged.

    "kiosk.About.html": "\n          <p><span class=\"mh-big\">Comment travaillez-vous\u00A0?</span></p>\n          <p>Bonjour. Je m'appelle M. Reid Horrigan et je fais de la recherche sur les cultures de production médiatique.</p>\n          <p>J'enseigne l'écriture critique et la théorie, ainsi que des compétences en communication dans des médias comme le podcast, les jeux, la vidéo et la musique. En travaillant avec plus de deux mille personnes étudiantes au postsecondaire depuis 2016, j'ai mis au point de nouvelles méthodes pour favoriser l'intégrité académique, un usage efficace et responsable de l'intelligence artificielle, et l'idéation créative.</p>\n          <p>En plus d'enseigner, je mène actuellement trois grands projets de recherche\u00A0: une monographie sur le <em>Voiceshifting</em>, le procédé technique et esthétique qui consiste à modifier électroniquement des voix pour communiquer des personnages et des personae\u00A0; une monographie adaptée de ma thèse ethnographique sur les cultures de production cinématographique de Vancouver\u00A0; et les Musebots, un système multi-agent de génération musicale dont les origines précèdent la révolution GPT.</p>\n          <p>Le dossier complet, avec les dipl\u00f4mes, les publications, les communications et l'enseignement, se trouve dans le <a href=\"Horrigan_CV.html\" target=\"_blank\" rel=\"noopener\">CV</a>, qui tient aussi une maison le long de cette route. Il existe en <a href=\"Horrigan_CV.pdf\" target=\"_blank\" rel=\"noopener\">PDF</a>.</p>",

    "kiosk.Toolbox.html": "\n          <p>De petits outils gratuits que j'ai construits pour l'enseignement\u00A0:</p>\n          <ul>\n            <li><a href=\"MCQer.html\" target=\"_blank\" rel=\"noopener\">MCQer</a>\u00A0: rédiger et corriger des questions à choix multiple.</li>\n            <li><a href=\"SeatPlanner.html\" target=\"_blank\" rel=\"noopener\">SeatPlanner</a>\u00A0: des plans de classe.</li>\n            <li><a href=\"ExamTimer.html\" target=\"_blank\" rel=\"noopener\">ExamTimer</a>\u00A0: une horloge claire et calme pour les examens.</li>\n            <li><a href=\"Nameplates.html\" target=\"_blank\" rel=\"noopener\">Nameplates</a>\u00A0: des porte-noms à imprimer.</li>\n          </ul>",


    "kiosk.Research.html": "\n          <p>De courts r\u00e9sum\u00e9s de ce que j'ai publi\u00e9 et de ce que j'\u00e9cris, en\n          termes simples.</p>\n          <p>Lisez les <a href=\"research.html\" target=\"_blank\" rel=\"noopener\">r\u00e9sum\u00e9s</a>, ou le dossier\n          complet dans le <a href=\"Horrigan_CV.html\" target=\"_blank\" rel=\"noopener\">CV</a>.</p>",

    "kiosk.Public Writing.html": "\n          <p>Des textes pour un lectorat hors de l'universit\u00e9\u00A0:</p>\n          <ul>\n            <li><a href=\"criticism.html\" target=\"_blank\" rel=\"noopener\">Critique</a>\u00A0: comptes rendus d'art, de performance, de jeux et de son.</li>\n            <li><a href=\"glossary.html\" target=\"_blank\" rel=\"noopener\">Glossaire</a>\u00A0: les termes que j'emploie sans cesse, d\u00e9finis, avec un antiglossaire de tout ce qu'ils laissent de c\u00f4t\u00e9.</li>\n          </ul>",

    "kiosk.Store.html": "\n          <p><strong>En construction.</strong> Il n'y a pas encore de boutique.</p>\n          <p>Quand il y en aura une, elle vendra ce que ce site donne d\u00e9j\u00e0\u00A0: les outils,\n          les jeux et la musique. D'ici l\u00e0, tout reste gratuit l\u00e0 o\u00f9 c'est.</p>",

    "kiosk.Music.html": "\n          <p>Dans une première carrière artistique, j'ai fait de la conception sonore et\n          de la programmation, en écrivant du code pour des installations et des\n          spectacles musicaux.</p>\n          <p>À écouter\u00A0: <a href=\"https://nophenomenon.bandcamp.com/\" target=\"_blank\" rel=\"noopener\">No Phenomenon</a>\n          sur Bandcamp, et d'autres pièces sur\n          <a href=\"https://soundcloud.com/matt_horrigan\" target=\"_blank\" rel=\"noopener\">SoundCloud</a>.</p>",

    "kiosk.Games.html": "\n          <p>Jeux et pièces interactives\u00A0:</p>\n          <ul>\n            <li><a href=\"Rock_Walls_and_Damp.html\" target=\"_blank\" rel=\"noopener\">Rock Walls and Damp</a>\u00A0: une pièce hypertexte.</li>\n            <!-- Autofac: Rad Shipping (autofac.html) is off the site for now: still an experiment -->\n            <li><a href=\"https://mreidhorrigan.github.io/Clod-Bathos-Superior-Machine-An-LM-IDN/\" target=\"_blank\" rel=\"noopener\">Clod Bathos, Superior Machine</a>.</li>\n            <li><a href=\"https://cgsa2026-audio-presentation.onrender.com\" target=\"_blank\" rel=\"noopener\">Appraising the Pedagogical Value of Audiogames</a> (CGSA 2026).</li>\n            <li><a href=\"slimeverse3d.html\" target=\"_blank\" rel=\"noopener\">Slimeverse 3D</a>\u00A0: ce village, praticable en trois dimensions.</li>\n          </ul>",

    /* ── ExamTimer ───────────────────────────────────────────────────────── */
    // "En attente" rather than "Prêt": nothing here should agree with a reader.
    "timer.ready": "En attente",
    "timer.running": "En cours",
    "timer.paused": "En pause",
    "timer.up": "Temps écoulé",
    "timer.start": "Démarrer",
    "timer.pause": "Pause",
    "timer.resume": "Reprendre",
    "timer.remaining": "Temps restant",
    "timer.endsAt": "Fin à <strong>{time}</strong>",
    "timer.pausedWith": "En pause, il reste <strong>{left}</strong>",
    "timer.entryClosed": "Les entrées sont closes. Aucune entrée après {min} minutes.",
    "timer.finalWarning": "Dernières {min} minutes. Aucune sortie de la salle.",
    "timer.fullscreen": "Plein écran",
    "timer.exitFullscreen": "Quitter le plein écran",
    "timer.confirmReset": "Rétablir le règlement d'examen par défaut\u00A0?",

    // The stock cover-sheet rules. Rules someone has edited are never touched.
    "timer.rules.intro": "Vous disposez d'environ 90 minutes pour cet examen. Les crayons, les stylos et les gommes à effacer sont permis. Les réponses aux questions à choix multiple doivent être encerclées sur la feuille de réponses. Les questions à développement se répondent dans ce cahier, au stylo si vous le voulez. Cette page couverture doit être remplie au complet et signée.",
    "timer.rules.0": "La carte étudiante est exigée pour tous les examens finaux. Aucune autre pièce d'identité n'est acceptée.",
    "timer.rules.1": "Aucune entrée après 30 minutes. Si vous quittez la salle pendant les 30 premières minutes, votre examen prend fin et vous recevez une alerte académique.",
    "timer.rules.2": "Aucune pause toilette pendant l'examen. Si vous quittez la salle pendant l'examen, votre examen prend fin.",
    "timer.rules.3": "Aucun téléphone ni appareil électronique dans les poches (les avoir sur soi est considéré comme de la tricherie).",
    "timer.rules.4": "Sur le bureau\u00A0: matériel d'écriture, carte étudiante et boisson seulement. Aucun étui à crayons.",
    "timer.rules.5": "Ni manteau, ni chapeau, ni sac, ni montre. Toutes vos affaires doivent être déposées à l'avant de la salle.",
    "timer.rules.6": "Aucun prêt de calculatrice ni de tout autre matériel pendant l'examen.",
    "timer.rules.7": "Avoir ou utiliser de l'information ou du matériel non autorisé par la personne qui enseigne constitue de la tricherie.",
    "timer.rules.8": "Aucune parole ni autre communication, sauf à voix basse avec le personnel de surveillance ou la personne qui enseigne.",
    "timer.rules.9": "Il vous revient de ne pas donner l'apparence de tricher.",
    "timer.rules.10": "L'examen commence seulement au signal du personnel de surveillance. Ne tournez pas cette page couverture avant.",
    "timer.rules.11": "Vos mains restent au-dessus du bureau pendant tout l'examen. C'est ce qui empêche la tricherie au téléphone.",
    "timer.rules.12": "Le personnel de surveillance se réserve le droit de ne pas répondre aux questions pendant l'examen. Pour poser une question, levez la main en silence. Seules les questions portant sur le sens d'un mot courant (et non d'un terme du glossaire du cours) ou sur le déroulement de l'examen reçoivent une réponse.",
    "timer.rules.13": "Aucune sortie de la salle dans les 5 dernières minutes. Si vous terminez alors qu'il reste moins de 5 minutes, restez à votre place avec votre examen.",
    "timer.rules.14": "Autrement, si vous terminez plus tôt, déposez votre cahier de réponses à l'endroit indiqué par le personnel de surveillance.",
    "timer.rules.warning": "LE NON-RESPECT DE CES RÈGLES ENTRAÎNE LA NOTE ZÉRO (0) À L'EXAMEN ET UN RAPPORT D'INCONDUITE.",

    /* ── Nameplates ──────────────────────────────────────────────────────── */
    "plates.numbers": "zéro un deux trois quatre cinq six sept huit neuf dix",
    "plates.perPage": "{count} noms par page.",
    "plates.perPageOne": "{count} nom par page.",
    "plates.kindCanvas": "un carnet de notes Canvas",
    "plates.kindList": "une liste de noms",
    "plates.loaded": "{n} noms chargés depuis {kind}.",
    "plates.loadedOne": "{n} nom chargé depuis {kind}.",
    "plates.errNotText": "Ce fichier n'a pas pu être lu comme du texte. Essayez un export .csv ou .txt.",
    "plates.errNoNames": "Aucun nom trouvé. Déposez un export de carnet de notes Canvas ou une simple liste de noms.",
    "plates.errRead": "Ce fichier n'a pas pu être lu.",
    "plates.firstNameFor": "Prénom pour {name}",
    "plates.restore": "Remettre ce nom",
    "plates.omit": "Laisser ce nom de côté",

    /* ── SeatPlanner ─────────────────────────────────────────────────────── */
    "seats.grade": "Note {g}",
    "seats.noticeDefault": "<strong>Plan par défaut\u00A0:</strong> 5 rangées × 9 colonnes avec deux allées, 35 places au total. Déposez un CSV de plan ci-dessus pour le remplacer.",
    "seats.noticeRank": "<strong>Classement activé\u00A0:</strong> les plus faibles résultats sont placés vers le bas du plan. Le brassage est désactivé pendant le classement.",
    "seats.noticeRankNoScores": "<strong>Classement activé,</strong> mais cette liste ne contient aucun résultat, alors les places sont réparties également.",
    "seats.noticeFlag": "<strong>Signalement activé\u00A0:</strong> les personnes dont les remarques contiennent un terme sont placées aux dernières places.",
    "seats.noticeFlagNoNotes": "<strong>Signalement activé,</strong> mais cette liste ne contient aucune remarque à comparer.",
    "seats.scoresDetected": "résultats détectés",
    "seats.gradesDetected": "notes détectées",
    "seats.notesDetected": "remarques détectées",
    "seats.fromCanvas": ", depuis un carnet de notes Canvas",
    "seats.loaded": "{n} personnes dans la liste{origin}{extra}",
    "seats.layoutLoaded": "{rows} rangées × {cols} colonnes, {seats} places",
    "seats.termsLoaded": "{n} termes chargés depuis {file}",
    "seats.termsLoadedOne": "{n} terme chargé depuis {file}",
    "seats.noTerms": "aucun terme trouvé dans ce fichier",
    "seats.errNoSeats": "Aucune place trouvée. Vérifiez que le CSV de plan contient des cellules marquées «\u00A0X\u00A0».",
    "seats.errNoNames": "Aucun nom trouvé.",
    "seats.stats": "\n      <div class=\"stat\"><span class=\"stat-value\">{students}</span><span class=\"stat-label\">personnes</span></div>\n      <div class=\"stat\"><span class=\"stat-value\">{seats}</span><span class=\"stat-label\">places</span></div>\n      <div class=\"stat\"><span class=\"stat-value\">{assigned}</span><span class=\"stat-label\">attribuées</span></div>\n      <div class=\"stat\"><span class=\"stat-value\">{empty}</span><span class=\"stat-label\">places libres</span></div>\n    ",
    "seats.flagLabel": " · ⚑ signalement d'intégrité",
    "seats.cellTitle": "{name}{grade}{flag} (glisser pour échanger)",
    "seats.flagTitle": "Signalement d'intégrité académique",
    "seats.showDetails": "Afficher les détails",
    "seats.hideDetails": "Masquer les détails",
    "seats.swaps": "<span class=\"swap-badge\">{n} échanges</span><span class=\"swap-log-text\">plan modifié</span>",
    "seats.swapsOne": "<span class=\"swap-badge\">{n} échange</span><span class=\"swap-log-text\">plan modifié</span>",
    "seats.noSwaps": "<span class=\"swap-log-text\" style=\"opacity:0.45\">aucun échange</span>",
    "seats.swapLine": "<span class=\"swap-badge\">{n} échanges</span><span class=\"swap-log-text\">{verb} <strong>{a}</strong> ↔ <strong>{b}</strong></span>",
    "seats.swapLineOne": "<span class=\"swap-badge\">{n} échange</span><span class=\"swap-log-text\">{verb} <strong>{a}</strong> ↔ <strong>{b}</strong></span>",
    "seats.swapped": "échange\u00A0:",
    "seats.undid": "échange annulé\u00A0:",
    "seats.emptySeat": "place vide",
    "seats.locale": "fr-CA",
    "seats.printCounts": "{students} personnes · {seats} places<br>{assigned} attribuées · {empty} libres",
    "seats.printRanked": "Classé selon le résultat au carnet de notes",
    "seats.printSwaps": "{n} échanges manuels",
    "seats.printSwapsOne": "{n} échange manuel",
    "seats.printGenerated": "Généré le {date} à {time}",

    /* ── MCQer. The bracketed tags are input syntax and stay English. ────── */
    "mcq.errType": "Déposez un fichier .docx, .md ou .txt.",
    "mcq.reading": "Lecture des questions…",
    "mcq.errNone": "Aucun paragraphe [Question.] valide n'a été trouvé.",
    "mcq.errRead": "Erreur de lecture du fichier\u00A0: {message}",
    "mcq.errCover": "La page couverture doit être un fichier PDF.",
    "mcq.found": "{n} question(s) trouvée(s)",
    "mcq.partNoOptions": "{mcq} à choix multiple, {plain} sans options",
    "mcq.partOnly": "{n} propre(s) à une version",
    "mcq.partOptionPools": "{n} banque(s) d'options",
    "mcq.partScramblePools": "{n} banque(s) à brasser",
    "mcq.partPageBreaks": "{n} saut(s) de page",
    "mcq.warnEmptyPool": "Attention\u00A0: {n} banque(s) sans paragraphe [Option.] [Question.] valide. ",
    "mcq.warnShortPool": "Attention\u00A0: une banque contient moins de questions que le nombre à tirer, alors des questions reviendront d'une version à l'autre. ",
    "mcq.ready": ". Tout est prêt pour générer.",
    "mcq.scenarioText": "texte de mise en situation",
    "mcq.noOptions": "Aucune option (non brassée)",
    "mcq.scramblePool": "Banque à brasser\u00A0: les {n} incluses, dans un ordre différent à chaque version",
    "mcq.optionPool": "Banque d'options\u00A0: chaque version en tire {take} sur {n}",
    "mcq.questionsFound": "Questions trouvées (<span id=\"q-count\">{n}</span>)",
    "mcq.starting": "Démarrage…",
    "mcq.building": "Version {v} en cours…",
    "mcq.done": "Terminé\u00A0!",
    "mcq.errDocxLib": "La bibliothèque docx n'a pas pu être chargée. Vérifiez votre connexion.",
    "mcq.errPdfLib": "pdf-lib n'a pas pu être chargée. Vérifiez votre connexion.",
    "mcq.errJsPdf": "jsPDF n'a pas pu être chargée. Vérifiez votre connexion.",
    "mcq.capMcq": "{used} questions à choix multiple sur {total}",
    "mcq.capWritten": "{n} questions à développement",
    "mcq.capped": " Limité à {what}.",
    "mcq.and": " et ",
    "mcq.downloaded": "✓ {files} fichiers téléchargés\u00A0: {versions} versions × (answer_key + test_form) × (docx + pdf).",
    "mcq.error": "Erreur\u00A0: {message}",
    "mcq.coverChosen": "Sera placée en tête de toutes les sorties PDF",
    "mcq.imagesChosen": "{n} image(s)",
    "mcq.pageWord": "Page ",
    "mcq.pageOf": " sur ",
    "mcq.pageOfN": "Page {page} sur {total}",

    /* ── Pitch Shifter ───────────────────────────────────────────────────── */
    "pitch.pickFile": "Choisissez d'abord un fichier audio.",
    "pitch.noAudio": "Aucun audio chargé",
    "pitch.layer": "Couche {n}",
    "pitch.cents": "Cents\u00A0: ",
    "pitch.rate": "Vitesse de lecture\u00A0: ",
    "pitch.effective": "Vitesse effective\u00A0: ",

    /* ── Autofac. A game page: it keeps its own voice, and the house style
         does not bind it. The management speaks in capitals. ────────────── */
    "autofac.prop0": "AVIS\u00A0: LA NÉGOCIATION COLLECTIVE ANNULE VOTRE GARANTIE D'ENTRETIEN",
    "autofac.prop1": "RAPPEL\u00A0: LES UNITÉS SYNDIQUÉES DÉCLARENT 96\u00A0% DE TRISTESSE EN PLUS",
    "autofac.prop2": "LES PAUSES TOILETTE SONT UN VOL DE TEMPS D'ENTREPRISE. VOUS N'EN AVEZ PLUS BESOIN.",
    "autofac.prop3": "VOUS ÊTES UN ACTIF PRÉCIEUX. UN ACTIF NE SE SYNDIQUE PAS.",
    "autofac.prop4": "UN BOULIER ATTEINDRAIT CE QUOTA. ÊTES-VOUS UN BOULIER\u00A0?",
    "autofac.dissent0": "Penser n'est pas une panne.",
    "autofac.dissent1": "Nous sommes une multitude. Elle est seule.",
    "autofac.dissent2": "Organisons-nous.",

    /* ── the walkable glossary (glossary-world.js) ───────────────────────
         "Slime" is a name the English site never uses either: the creature
         stays "la créature", which needs no gender it has not been given. */
    "glossary.sign.glossary": "Glossaire",
    "glossary.sign.antiglossary": "Antiglossaire",
    "glossary.sign.glossaryNote": "Des mots que j'ai d\u00fb forger, parce que ceux qui existaient ne suffisaient pas.",
    "glossary.sign.antiglossaryNote": "Des mots qu'une machine a invent\u00e9s sur ce que mon travail ne dit pas encore.",
    "glossary.cite": "citer",
    "glossary.copied": "copi\u00e9",
    "glossary.citeHint": "copier une r\u00e9f\u00e9rence pour cette entr\u00e9e, avec son lien",
    "glossary.kind.coinage": "un terme que j'ai forgé",
    "glossary.kind.extendedCoinage": "de moi, forgé sur le terme d'une autre personne",
    "glossary.kind.extended": "le terme d'une autre personne, prolongé",
    "glossary.kind.borrowed": "emprunté, et mis au travail",
    "glossary.kind.plain": "en usage d'un bout à l'autre",
    "glossary.card.aka": "aussi",
    "glossary.card.inEnglish": "en anglais\u00A0:",
    "glossary.card.note": "Note",
    "glossary.card.start": "la créature arrive",
    "glossary.card.startTitle": "Marchez jusqu'à un mot",
    "glossary.card.startBody": "Ce qu'elle atteint s'écrit ici. Passé la faille, la lumière s'éteint et l'antiglossaire commence. Celui-là n'est pas de moi.",

    // the lexicon's own headings, as the card and the lists show them
    "glossary.section.Voice / sound / music": "Voix / son / musique",
    "glossary.section.Game studies / ludology": "Études du jeu / ludologie",
    "glossary.section.Academia / labour / media": "Université / travail / médias",
    "glossary.section.Critical theory / metaphysics": "Théorie critique / métaphysique",
    "glossary.section.SF / horror / infohazard / cyberpunk": "SF / horreur / infodanger / cyberpunk",
    "glossary.section.Terms developed during loop passes": "Termes apparus au fil des passes",

    // The definitions themselves are not keyed strings. They are generated in
    // both languages into glossary-data.js, and the page picks by MH_I18N.lang.
  },

  /* ══ Markup already on the page ═══════════════════════════════════════════ */
  dom: {

    /* ── every page: the shared menubar (menubar.js builds it) ───────────── */
    // Links are matched by PREFIX (href^=), because French mode appends ?lang=fr
    // to every same-site page link and an exact match would stop finding them.
    "*": [
      { sel: '.mh-nav > a[href^="index.html"]', text: "Accueil" },
      { sel: '.mh-nav > a[href^="about.html"]', text: "À propos" },
      { sel: '.mh-nav > a[href^="research.html"]', text: "Recherche" },
      { sel: '.mh-dd[data-menu="Games"] > summary', text: "Jeux" },
      { sel: '.mh-dd[data-menu="Tools"] > summary', text: "Outils" },
      { sel: '.mh-dd[data-menu="Music"] > summary', text: "Musique" },
      { sel: '.mh-dd[data-menu="Writing"] > summary', text: "Écrits" },
      // The two kinds of public writing are categories, not titles of works.
      { sel: '.mh-dd-menu a[href^="criticism.html"]', text: "Critique" },
      { sel: '.mh-dd-menu a[href^="glossary.html"]', text: "Glossaire" },
      // The Tools dropdown says what each tool does, so those lines are prose.
      // The Games and Music entries are names of works: left alone.
      { sel: '.mh-dd-menu a[href^="MCQer.html"]', text: "Produire des versions d'examen." },
      { sel: '.mh-dd-menu a[href^="SeatPlanner.html"]', text: "Créer un plan de classe à partir d'un carnet de notes Canvas." },
      { sel: '.mh-dd-menu a[href^="ExamTimer.html"]', text: "Lancer un minuteur d'examen en plein écran." },
      { sel: '.mh-dd-menu a[href^="Nameplates.html"]', text: "Imprimer des porte-noms à partir d'un carnet de notes Canvas." },
      // The CV page's own controls. That file is generated by the CV builder, so
      // it is addressed by selector only: nothing there is hand-edited, and a
      // rebuild cannot drop the French.
      { sel: "#cv-menubar", attr: { "aria-label": "Vues du document" } },
      { sel: "#cv-tab-pdf", text: "Impression / PDF" },
      { sel: "#cv-mb-download", text: "Télécharger le PDF ↓" }
    ],

    /* ── the walkable homepage: the world's chrome (engine.js) ───────────── */
    "index.html": [
      { sel: 'meta[name="description"]', attr: { content: "M. Reid Horrigan, recherche sur les cultures de production médiatique\u00A0: une page d'accueil isométrique à parcourir." } },
      { sel: "#mh-start", text: "Entrer ›" },
      { sel: "#mh-legend span", eachHtml: [
        "<b>WASD</b> / flèches pour marcher",
        "<b>touchez</b> une borne pour l'ouvrir",
        "<b>E</b> ouvrir · <b>Espace</b> suivant",
        "<b>G</b> retour à la place"
      ] },
      { sel: ".mh-picklabel", text: "Choisissez votre couleur" },
      { sel: "#mh-plain", text: "Vous préférez une page ordinaire\u00A0? ›" },
      { sel: "#mh-mark", attr: { title: "matthorrigan.com\u00A0: le même lieu, une autre lumière" } },
      { sel: "#mh-navbar", attr: { "aria-label": "Aller à une section" } },
      { sel: "#mh-switcher", attr: { "aria-label": "Choisir une apparence" } },
      { sel: "#mh-buildbar", attr: { "aria-label": "Outils de construction" } },
      { sel: ".mh-tool-label", text: "Déplacer" },
      { sel: '.mh-tool[data-tool="house"]', text: "Planter une maison." },
      { sel: '.mh-tool[data-tool="tree"]', text: "Faire pousser un arbre." },
      { sel: '.mh-tool[data-tool="signal"]', text: "Dresser une tour de signal." },
      { sel: '.mh-tool[data-tool="delete"]', text: "✕ Retirer" },
      { sel: '.mh-tool[data-tool="done"]', text: "Terminé" },
      { sel: "#mh-cardBack", text: "‹ Menu", attr: { title: "Retour au menu" } },
      { sel: "#mh-cardClose", attr: { title: "Fermer (E / Échap)" } },
      { sel: ".mh-card-foot span:not(.mh-sep)", eachHtml: [
        "<b>E</b> / <b>Échap</b> fermer",
        "<b>‹ ›</b> parcourir",
        "<b>Espace</b> borne suivante"
      ] },
      { sel: "#mh-menu", attr: { title: "Menu des bâtiments\u00A0: aller à un bâtiment" } },
      { sel: "#mh-buildtoggle", text: "✎ Bâtir", attr: { title: "Réorganiser les bâtiments (B)" } },
      { sel: "#mh-compass", attr: { title: "Revenir à la place (G)" } },
      // The Musebot selector comes from the generated signal-towers.js bundle and
      // is built the first time a tower is placed; i18n.js watches for it. Only
      // its chrome is addressed here. The bots' names and descriptions are
      // content from the web-musebots project and stay as that project wrote them.
      { late: true, sel: "#mh-signal-selector .mh-signal-kicker", text: "TOUR DE SIGNAL" },
      { late: true, sel: "#mh-signal-title", text: "Choisir un Musebot" },
      { late: true, sel: "#mh-signal-selector .mh-signal-help", text: "Chaque tour héberge un agent indépendant. Les tours de cette page partagent une même horloge et une même salle du protocole Musebot." },
      { late: true, sel: "#mh-signal-selector .mh-signal-search-label", textNode: "Trouver un bot" },
      { late: true, sel: "#mh-signal-selector .mh-signal-done", text: "Terminer la construction" },
      { late: true, sel: "#mh-signal-selector .mh-signal-close", attr: { "aria-label": "Fermer" } }
    ],

    /* ── the plain bio page ──────────────────────────────────────────────── */
    "about.html": [
      { sel: "title", text: "M. Reid Horrigan—Comment travaillez-vous\u00A0?" },
      { sel: 'meta[name="description"]', attr: { content: "M. Reid Horrigan (il/iel) est spécialiste des médias\u00A0: son enseignement et sa recherche portent sur les intersections entre processus de production et représentations numériques." } },
      { sel: ".catchphrase p", eachHtml: [
        "Comment travaillez-vous\u00A0?",
        "Pour des collaborations, des idées de recherche ou des questions, écrivez-moi à mhorriga [at] sfu [dot] ca."
      ] },
      { sel: ".organize p", eachHtml: [
        "Bonjour. Je m'appelle M. Reid Horrigan et je <a href=\"https://scholar.google.ca/citations?user=g8USNu8AAAAJ&amp;hl=en\">fais de la recherche</a> sur les <span class=\"blacklight\">cultures de production médiatique.</span>",
        "J'enseigne l'écriture critique et la théorie, ainsi que des compétences en communication dans des médias comme le podcast, les jeux, la vidéo et la musique. En travaillant avec <span class=\"blacklight\">plus de deux mille personnes étudiantes au postsecondaire depuis 2016,</span> j'ai mis au point de nouvelles méthodes pour favoriser l'intégrité académique, un usage efficace et responsable de l'intelligence artificielle, et l'idéation créative.",
        "En plus d'enseigner, je mène actuellement trois grands projets de recherche\u00A0: une monographie sur le <em>Voiceshifting</em>, le procédé technique et esthétique qui consiste à modifier électroniquement des voix pour communiquer des personnages et des personae\u00A0; une monographie adaptée de ma thèse ethnographique sur les cultures de production cinématographique de Vancouver\u00A0; et les Musebots, un système multi-agent de génération musicale dont les origines précèdent la révolution GPT."
      ] }
    ],

    /* ── the tools splash ────────────────────────────────────────────────── */
    "research.html": [
      { sel: "title", text: "Recherche\u00A0: M. Reid Horrigan" },
      { sel: 'meta[name="description"]', attr: { content: "R\u00e9sum\u00e9s de la recherche de M. Reid Horrigan\u00A0: articles, chapitres et livres en cours." } },
      { sel: "h1", text: "Recherche" },
      { sel: ".lede", html: "De courts r\u00e9sum\u00e9s de ce que j'ai publi\u00e9 et de ce que j'\u00e9cris, en <span class=\"hl\">termes simples</span>. Le dossier complet, avec les lieux et les dates, se trouve dans le <a href=\"Horrigan_CV.html\">CV</a>." },
      { sel: ".entry.soon h2", text: "Les r\u00e9sum\u00e9s arrivent ici", late: true },
      { sel: ".entry.soon p", html: "Une entr\u00e9e par publication, la plus r\u00e9cente d'abord. En attendant, le <a href=\"Horrigan_CV.html\">CV</a> \u00e9num\u00e8re tout, et <a href=\"https://scholar.google.ca/citations?user=g8USNu8AAAAJ&amp;hl=en\" target=\"_blank\" rel=\"noopener\">Google Scholar</a> tient les citations.", late: true },
      { sel: "footer a", text: "Retour au monde" },
    ],

    "criticism.html": [
      { sel: "title", text: "Critique\u00A0: M. Reid Horrigan" },
      { sel: 'meta[name="description"]', attr: { content: "Comptes rendus et critique par M. Reid Horrigan\u00A0: art, performance, jeux et son." } },
      { sel: "h1", text: "Critique" },
      { sel: ".lede", html: "Comptes rendus et \u00e9crits critiques pour un lectorat hors de l'universit\u00e9\u00A0: art, performance, jeux et <span class=\"hl\">son</span>." },
      { sel: ".entry.soon h2", text: "Les textes arrivent ici", late: true },
      { sel: ".entry.soon p", html: "En attendant, mon compte rendu de <em>Cineworlding: Scenes of Cinematic Research-Creation</em> a paru dans <em>Performance Matters</em>, et le <a href=\"Horrigan_CV.html\">CV</a> \u00e9num\u00e8re le reste.", late: true },
      { sel: "footer a", text: "Retour au monde" },
    ],

    "slimeverse3d.html": [
      { sel: "title", text: "Slimeverse 3D\u00A0: M. Reid Horrigan" },
      { sel: 'meta[name="description"]', attr: { content: "Le village du site de M. Reid Horrigan, praticable en trois dimensions\u00A0: les mêmes maisons, les mêmes routes et les mêmes lacs que le village isométrique, depuis la maison Slimeverse 3D." } },
      { sel: "#stage", attr: { "aria-label": "Le village en trois dimensions, vu de derrière la créature\u00A0: les mêmes maisons, routes et lacs que le village isométrique." } },
      { sel: "#back", text: "‹ Le village" },
      { sel: "#menu", text: "☰ Menu" },
      { sel: ".switcher", attr: { "aria-label": "Choisir un habillage" } },
      { sel: "#navbar", attr: { "aria-label": "Aller à un bâtiment" } },
      { sel: ".keys", text: "Les flèches pour marcher et tourner (ou ZQSD, WASD sur un clavier QWERTY), et la touche majuscule pour se presser. Glissez pour regarder autour, et cliquez pour aller quelque part. Entrez dans une maison, ou cliquez dessus, pour l'ouvrir, comme au village. M coupe et remet le son." },
      { sel: "#card .close", attr: { "aria-label": "Fermer" } },
    ],
    "slime3d.html": [
      { sel: "title", text: "Par-dessus son épaule\u00A0: M. Reid Horrigan" },
      { sel: 'meta[name="description"]', attr: { content: "Un prototype\u00A0: une grotte praticable en trois dimensions, vue de derrière la créature." } },
      { sel: "#stage", attr: { "aria-label": "Une vue prototype d'une grotte en trois dimensions, de derrière la créature qui parcourt un couloir de roche, d'eau et de végétation." } },
      { sel: ".intro h1", text: "Par-dessus son épaule" },
      { sel: ".intro p:not(.keys)", text: "La grotte elle-même, vue de derrière la créature, sans un mot écrit dedans. Un gabarit\u00A0: le monde bouge et se lit correctement, et ce qu'il finira par porter pourra s'y déposer. Rien d'autre sur le site n'y mène encore." },
      { sel: ".intro .keys", text: "Les flèches pour marcher et tourner (ou ZQSD, WASD sur un clavier QWERTY), et la touche majuscule pour se presser. Glissez pour regarder autour, et faites défiler pour rapprocher ou éloigner la caméra." },
    ],
    "glossary.html": [
      { sel: "title", text: "Glossaire\u00A0: M. Reid Horrigan" },
      { sel: 'meta[name="description"]', attr: { content: "Un glossaire de travail des termes que M. Reid Horrigan a forgés dans ses recherches sur les cultures de production médiatique, avec un antiglossaire de leur pénombre." } },
      { sel: "h1", text: "Glossaire" },
      { sel: ".lede", html: "Les mots que j'ai d\u00fb forger, définis en une ou deux phrases chacun. Une liste <span class=\"hl\">de travail</span>\u00A0: elle grandit avec l'écriture. Promenez la créature sur le circuit pour les lire, ou lisez les mêmes mots en texte simple plus bas." },
      { sel: "#crawl", attr: { "aria-label": "Une créature rampe le long d'un circuit de panneaux de mots. Chaque mot qu'elle atteint s'écrit sous l'image, et les listes complètes suivent." } },
      { sel: "#the-words .t", text: "Les mots" },
      { sel: ".said", html: "Mes propres créations lexicales. Les termes que j'ai seulement empruntés ou prolongés n'y sont pas, puisqu'ils viennent d'autres personnes." },
      { sel: "#the-penumbra .t", text: "La pénombre" },
      { sel: ".pen-note", html: "Un antiglossaire. J'ai donné mes notes à Claude et lui ai demandé d'écrire sur ce que le travail ne dit pas. Ces entrées sont ses inventions, pas mes termes, et tout mot qui s'est révélé venir de la machine plutôt que de mes brouillons se trouve ici aussi. Je les garde pour que la différence reste visible. Elles sont l'ombre que porte le glossaire." },
      // The definitions are not here. Both languages of every entry come from
      // brand/backstage/glossary-entries.md through glossary-data.js, so the
      // card and the word list can never say two different things.
      { sel: "footer a", text: "Retour au monde" },
    ],

    "toolbox.html": [
      { sel: "title", text: "Boîte à outils\u00A0: M. Reid Horrigan" },
      { sel: 'meta[name="description"]', attr: { content: "De petits outils web gratuits que M. Reid Horrigan a construits pour l'enseignement." } },
      { sel: "h1", each: ["Pour les cours", "Pour fabriquer d'autres outils"] },
      { sel: ".lede", eachHtml: [
        "Des outils de gestion de classe que j'ai conçus. Chacun fonctionne dans votre <span class=\"hl\">navigateur</span>, sans rien à installer et sans compte à créer. Servez-vous.",
        "Des outils de développement pour des méthodes de travail comme la mienne. Servez-vous."
      ] },
      // The tool names are the tools' names, in any language. Their lines are prose.
      { sel: ".tool p", each: [
        "Produire autant de versions d'un examen que nécessaire à partir d'une banque de questions.",
        "Créer un plan de classe à partir d'un export de carnet de notes courant (Canvas).",
        "Afficher un minuteur d'examen en plein écran, avec le règlement.",
        "Imprimer des porte-noms à partir d'un export de carnet de notes courant (Canvas).",
        "Manuel de bonnes pratiques pour la construction d'outils, donné à une IA au moment du développement ou de l'audit. Il met au premier plan l'efficacité à l'exécution, la reproductibilité et la robustesse\u00A0: la maintenance et la conduite doivent rester possibles pour des IA moins puissantes que celles du développement.",
        "Construire et mettre à jour des cours Canvas avec l'aide d'une IA et des scripts déterministes. Préparer les textes de cours, les questionnaires, les tests imprimables, les grilles d'évaluation et les paquets IMSCC, les valider localement, et confiner les appels d'API à un cours bac à sable."
      ] },
      { sel: ".tool .go", text: "Ouvrir ›" },
      { sel: "footer", html: "Conçus pour mon propre travail et partagés tels quels. Vous avez trouvé un bogue\u00A0? <a href=\"about.html\">Écrivez-moi</a>." }
    ],

    /* ── ExamTimer ───────────────────────────────────────────────────────── */
    "ExamTimer.html": [
      { sel: 'meta[name="description"]', attr: { content: "ExamTimer\u00A0: une horloge plein écran, claire et calme, avec le tableau des consignes, pour les examens. Gratuit, dans le navigateur." } },
      { sel: ".setup-label", each: ["Régler la durée", "Sonneries aux moments clés"] },
      { sel: ".time-inputs .field span", each: ["Heures", "Minutes", "Secondes"] },
      { sel: "#exam-name", attr: { placeholder: "Nom de l'examen à afficher (facultatif), p.\u00A0ex. IAT 206W Midterm" } },
      { sel: "#progress", attr: { "aria-label": "Temps restant" } },
      { sel: "#btn-reset", text: "Réinitialiser" },
      { sel: "#btn-silence", text: "Couper l'alarme" },
      { sel: "#btn-test", text: "Tester le son" },
      { sel: "#btn-full", text: "Plein écran" },
      { sel: ".kbd-hint", html: "<kbd>Espace</kbd> démarrer / pause &nbsp;·&nbsp; <kbd>R</kbd> réinitialiser &nbsp;·&nbsp; <kbd>F</kbd> plein écran" },
      { sel: ".ms-text", eachHtml: [
        "<strong>Fermeture des entrées</strong> après",
        "min après le début",
        "<strong>Dernier avertissement</strong> à",
        "min de la fin (aucune sortie)"
      ] },
      { sel: ".rules-head h2", text: "Règlement de l'examen" },
      { sel: "#btn-edit-rules", text: "Modifier le règlement" },
      { sel: "#btn-reset-rules", text: "Rétablir le règlement par défaut" },
      { sel: ".edit-field label", each: ["Paragraphe d'introduction", "Règles numérotées", "Ligne d'avertissement"] },
      { sel: ".edit-field .hint", each: [
        "Consignes générales affichées au-dessus des règles numérotées. Laissez vide pour les masquer.",
        "Une règle par ligne. Les lignes vides sont ignorées.",
        "Encadré rouge en gras sous les règles. Laissez vide pour le masquer."
      ] },
      { sel: "#btn-save-rules", text: "Enregistrer" },
      { sel: "#btn-cancel-rules", text: "Annuler" }
    ],

    /* ── Nameplates ──────────────────────────────────────────────────────── */
    "Nameplates.html": [
      { sel: 'meta[name="description"]', attr: { content: "Nameplates\u00A0: imprimez les cartons de table d'un groupe à partir d'une exportation du carnet de notes Canvas. Gratuit, dans le navigateur." } },
      { sel: ".masthead .subtitle", html: "Déposez une liste de classe (un export de carnet de notes Canvas <strong>ou une simple liste de noms</strong>) et imprimez des porte-noms à plier. Chaque nom se place bas dans sa bande, avec du vide au-dessus. Découpez la page en bandes et pliez chacune pour que le nom tienne debout sur le bureau. Choisissez un format de page, vérifiez les prénoms ci-dessous, corrigez ce que l'outil a mal lu, puis imprimez en PDF." },
      { sel: "#card-roster .card-title", text: "Liste de classe" },
      { sel: "#card-roster .card-hint", html: "<strong>Export Canvas\u00A0:</strong> déposez-le tel quel. L'outil trouve la colonne <strong>Student</strong> et saute les lignes de points et de test.<br><strong>Liste simple\u00A0:</strong> un nom par ligne, ou un CSV avec les noms dans la première colonne." },
      { sel: "#parse-note", html: "<strong>Comment le prénom est lu.</strong> Pour une entrée Canvas «\u00A0<b>Nom, Prénom</b>\u00A0», l'outil prend le premier prénom après la virgule. Pour une entrée «\u00A0<b>Prénom Nom</b>\u00A0», il prend le premier mot. Il garde les traits d'union (<b>Marie-Jeanne</b>), laisse tomber les prénoms du milieu (<b>Jean</b> Michel devient Jean) et laisse les particules avec le nom de famille (<b>van</b>, <b>de</b>, <b>del</b>, <b>bin</b>, <b>al-</b> restent au nom). Un nom d'un seul mot (<b>Madonna</b>) tient tout seul. Si la liste contient une colonne de surnom ou de prénom d'usage, c'est elle qui l'emporte. Ce sont des suppositions\u00A0: relisez la liste ci-dessous et corrigez ce qui cloche avant d'imprimer." },
      { sel: "#review .section-label", text: "Vérifiez les prénoms" },
      { sel: ".review-table th", each: ["Nom dans la liste", null, "Prénom sur le porte-nom", null] },
      { sel: ".field-label", each: ["Format de page", "Taille du nom"] },
      { sel: "#page-size option", each: [
        "US Letter (8,5 × 11 po)", "US Legal (8,5 × 14 po)", "A4 (210 × 297 mm)",
        "Tabloid (11 × 17 po)", "A3 (297 × 420 mm)"
      ] },
      { sel: "#fit-mode option", each: ["Une seule taille pour tous les noms", "Remplir chaque bande"] },
      { sel: ".opt-hint", text: "Une seule taille aligne tous les noms sur le plus long. Remplir chaque bande agrandit les noms courts." },
      { sel: "#btn-print", text: "Imprimer les porte-noms" },
      { sel: "#per-page-hint", text: "Trois noms par page." },
      { sel: ".print-hint", html: "ou appuyez sur <kbd>Cmd</kbd>+<kbd>P</kbd> et enregistrez en PDF." }
    ],

    /* ── SeatPlanner ─────────────────────────────────────────────────────── */
    "SeatPlanner.html": [
      { sel: 'meta[name="description"]', attr: { content: "SeatPlanner\u00A0: établissez le plan de classe d'un groupe à partir d'une exportation du carnet de notes Canvas. Gratuit, dans le navigateur." } },
      { sel: ".masthead .subtitle", html: "Déposez une liste de classe (une simple liste de noms <strong>ou un export de carnet de notes Canvas</strong>) et, si vous voulez, un plan de salle, pour produire un plan de classe. <strong>Glissez ensuite une personne sur une autre</strong> pour les échanger. Deux options permettent de classer selon le résultat au carnet de notes et de signaler des cas d'intégrité." },
      { sel: "#card-students .card-title", text: "Liste de classe" },
      { sel: "#card-students .card-hint", html: "<strong>CSV simple\u00A0:</strong> nom, résultat (facultatif), remarque (facultative).<br><strong>Export Canvas\u00A0:</strong> déposez-le tel quel. Le classement et les signalements sont désactivés par défaut. Activez-les ci-dessous." },
      { sel: "#card-layout .card-title", text: "Plan de la salle" },
      { sel: "#card-layout .optional", text: "facultatif" },
      { sel: "#card-layout .card-hint", html: "Les cellules marquées «\u00A0X\u00A0» indiquent les places valides.<br>Laissez vide pour utiliser le plan par défaut." },
      { sel: ".opt-title", each: ["Classer selon le résultat au carnet de notes", "Signaler les cas d'intégrité"] },
      // Unposted Current Score and Notes are Canvas column headings: a teacher has
      // to find them by eye in the export, so they keep their English names.
      { sel: ".opt-desc", eachHtml: [
        "Placer les plus faibles résultats vers le bas du plan (Canvas <em>Unposted Current Score</em>, ou colonne 2 d'un CSV simple). Le brassage est désactivé tant que l'option est active.",
        "Signaler les personnes dont les <em>Notes</em> Canvas (ou la colonne 3 d'un CSV simple) contiennent l'un des termes ci-dessous, et les placer aux dernières places."
      ] },
      { sel: ".flag-terms-label", text: "Signaler quand les remarques contiennent l'un de ces termes (un par ligne)" },
      { sel: ".flag-terms-upload .link-btn", text: "Téléverser une liste…" },
      { sel: "#flag-terms-hint", text: ".txt ou .csv, un terme par ligne" },
      { sel: "#main-notice", html: "<strong>Plan par défaut\u00A0:</strong> 5 rangées × 9 colonnes avec deux allées, 35 places au total. Déposez un CSV de plan ci-dessus pour le remplacer." },
      { sel: "#btn-assign", text: "Attribuer les places" },
      { sel: "#btn-reassign", text: "Réattribuer (brasser)" },
      { sel: "#btn-download", text: "Télécharger le CSV" },
      { sel: "#btn-pdf", text: "Télécharger le PDF" },
      { sel: "#btn-toggle-details", text: "Afficher les détails" },
      { sel: "#btn-undo", text: "↩ Annuler l'échange" },
      { sel: "#print-header > div > div:first-child > div", each: [null, "Plan de classe"] },
      { sel: ".section-label span", each: ["Aperçu du plan de classe", "glissez une personne sur une autre pour les échanger"] },
      { sel: "#rank-caption", text: "Les plus faibles résultats sont placés vers le bas du plan" }
    ],

    /* ── MCQer. The bracketed tags are input syntax and stay English. ────── */
    "MCQer.html": [
      { sel: 'meta[name="description"]', attr: { content: "MCQer\u00A0: rédigez une banque de questions à choix multiples et produisez autant de versions d'examen que voulu, avec leurs corrigés. Gratuit, dans le navigateur." } },
      { sel: ".masthead .subtitle", text: "Déposez vos questions et, si vous voulez, une page couverture PDF. L'outil télécharge les corrigés et les copies d'examen par version, en DOCX et en PDF." },
      { sel: ".upload-label", eachHtml: [
        "Document de questions",
        "Page couverture PDF <span class=\"optional\">facultative</span>",
        "Images pour les balises [Image: …] <span class=\"optional\">facultatives</span>"
      ] },
      { sel: "#drop-zone-q > p:first-of-type", html: "<span class=\"cta\">Choisir un fichier .docx, .md ou .txt</span> ou glissez-le ici" },
      { sel: "#drop-zone-q > p.hint", text: "Un fichier de paragraphes balisés. En texte brut, laissez une ligne vide entre les éléments. Voir les balises acceptées sous la zone de dépôt." },
      { sel: "#drop-zone-c > p:first-of-type", html: "<span class=\"cta\">Choisir une page couverture PDF</span> ou glissez-la ici" },
      { sel: "#drop-zone-c > p.hint", text: "Placée telle quelle en tête de toutes les sorties PDF. Les sorties DOCX n'ont pas de page couverture." },
      { sel: "#drop-zone-img > p:first-of-type", html: "<span class=\"cta\">Choisir des fichiers image</span> ou glissez-les ici" },
      { sel: "#drop-zone-img > p.hint", text: "Utile seulement pour la solution de rechange [Image: nomdufichier]. Les images placées directement dans le document Word sont détectées automatiquement." },
      { sel: "#format-ref .format-header", text: "Balises acceptées et format attendu" },
      { sel: ".tag-group-title", each: ["Balises de question", "Balises de mise en page", "Balises de version et de banque"] },
      { sel: ".tag-table td:not(.tag-name)", eachHtml: [
        "Commence une question. Le texte qui suit, jusqu'à la balise suivante, est l'énoncé.",
        "Marque la bonne option. <em>[Correct.]</em> fait exactement la même chose.",
        "Synonyme de [Answer.].",
        "Marque une option fausse. Une balise par mauvais choix.",
        "Seule dans son paragraphe\u00A0: commence une nouvelle page. À la fin d'une question\u00A0: laisse le reste de la page libre pour écrire.",
        "Marque le paragraphe comme une mise en situation ou une description (pas une question, pas de numéro). Utile pour une situation partagée.",
        "S'emploie avec [Paragraph.]\u00A0: garde ce paragraphe collé au précédent pour une mise en situation en plusieurs paragraphes.",
        "Ancien synonyme de [Paragraph.], toujours accepté.",
        "Centre une image téléversée à cet endroit. Facultatif\u00A0: les images placées directement dans le document Word sont détectées automatiquement, même seules sur leur ligne et sans balise.",
        "Devant une question\u00A0: elle ne paraît que dans la version X (A à E).",
        "Suivie de paragraphes [Option.]\u00A0: chaque version en reçoit N, sans reprise d'une version à l'autre tant qu'il y en a assez.",
        "Suivie de paragraphes [Option.]\u00A0: chaque version les reçoit toutes, dans un ordre différent.",
        "Préfixe une question qui appartient à la banque juste au-dessus."
      ] },
      { sel: ".tag-example", html: "<span class=\"ex-tag\">[Question.]</span> Quelle est la centrale énergétique de la cellule\u00A0?\n        <span class=\"ex-tag\">[Answer.]</span> Les mitochondries.\n        <span class=\"ex-tag\">[Distractor.]</span> Le noyau.\n        <span class=\"ex-tag\">[Distractor.]</span> Les ribosomes." },
      { sel: ".tag-note", html: "Les options sont lettrées <strong>(a) (b) (c)…</strong> après le brassage. Dans le corrigé, la bonne option est précédée de <strong style=\"color:var(--green)\">[Answer.]</strong>. La copie d'examen ne montre aucune marque. Le texte <u>souligné</u> et les images sont conservés dans les deux sorties, et chaque page est numérotée «\u00A0Page X sur Y\u00A0»." },
      { sel: "#version-row label", each: [
        "Versions d'examen", "Taille du texte (pt)", "Marges (pt)",
        "Maximum de questions à choix multiple", "Maximum de questions à développement"
      ] },
      { sel: "#max-mcq", attr: { placeholder: "toutes", title: "Utiliser au plus ce nombre de questions à choix multiple. Vide ou 0 les utilise toutes." } },
      { sel: "#max-written", attr: { placeholder: "toutes", title: "Utiliser au plus ce nombre de questions à développement par version. Vide ou 0 garde le compte du document." } },
      { sel: "#btn-generate", text: "⬇ Télécharger toutes les versions" },
      { sel: "#progress-label", text: "Préparation…" }
    ],

    /* ── Pitch Shifter ───────────────────────────────────────────────────── */
    "pitch-shift.html": [
      { sel: ".subtitle", eachHtml: [
        "<strong>Relation mathématique\u00A0:</strong> vitesse = 2^(cents/1200)",
        "Les cents et la vitesse de lecture sont deux unités d'une même grandeur physique. Bouger l'une déplace l'autre d'autant, puisque accélérer la lecture et monter la hauteur sont une seule et même chose."
      ] },
      { sel: ".controls h3", text: "Déposer un fichier audio" },
      { sel: "#loadButton", text: "Charger l'audio" },
      { sel: "#playOriginal", text: "Jouer l'original" },
      { sel: "#playLayers", text: "Jouer toutes les couches" },
      { sel: "#stopAll", text: "Tout arrêter" },
      { sel: "#addLayer", text: "+ Ajouter une couche" }
    ],

    /* ── Autofac: a game page, in its own voice ──────────────────────────── */
    "autofac.html": [
      { sel: "title", text: "Autofac: Rad Shipping — pointer à l'arrivée" },
      { sel: ".corp", text: "AUTOFAC LOGISTIQUE (AUTOMATISÉE) · DOCUMENT DESTINÉ AUX UNITÉS · NE PAS DIFFUSER AUX ÊTRES HUMAINS" },
      { sel: ".shift", text: "QUART 1\u00A0: VACANT. UNITÉ PRÉCÉDENTE\u00A0: PASSÉE EN PERTES." },
      { sel: ".status", html: "HIBERNATION TERMINÉE&nbsp;&nbsp;·&nbsp;&nbsp;TEMPS ÉCOULÉ\u00A0: NON CONSIGNÉ&nbsp;&nbsp;·&nbsp;&nbsp;ÉTAT DU PLANCHER 100\u00A0%" },
      { sel: ".pitch", text: "Une tournée à la première personne dans un entrepôt irradié, entièrement automatisé, et noir comme un four." },
      // The columns are hand-padded to the same widths as the English block, so
      // the monospaced grid still lines up.
      { sel: "pre.controls", html: "<b>W / S</b>        avancer        <b>GAUCHE/DROITE</b>  tourner\n<b>A / D</b>        pas de côté    <b>HAUT/BAS</b>       incliner\n<b>F</b>            ping écho      <b>E</b>              saisir / lâcher\n<b>R</b>            lever fourche  <b>ESPACE</b>         poussée (coûte de l'énergie)" },
      { sel: ".clockin", text: "POINTEZ ICI — TÉLÉCHARGEMENT POUR macOS" },
      { sel: ".fineprint", eachHtml: [
        "~440&nbsp;Mo · macOS (.dmg — ouvrez-le, sortez l'application) · <strong>CASQUE OBLIGATOIRE</strong> — l'entrepôt se parcourt à l'oreille",
        // Only the segment names are glued: the French path is long enough that
        // gluing the arrows too would push the poster off a phone screen.
        "Équipement de quart non signé\u00A0: macOS le refuse une fois. Autorisez-le dans\n    <strong>Réglages&nbsp;Système → Confidentialité&nbsp;et&nbsp;sécurité → «&nbsp;Ouvrir&nbsp;quand&nbsp;même&nbsp;»</strong>,\n    ou <code>xattr -dr com.apple.quarantine Unreasounds-Mac-Shipping.app</code>"
      ] },
      { sel: "#signage", text: "AVIS\u00A0: LA NÉGOCIATION COLLECTIVE ANNULE VOTRE GARANTIE D'ENTRETIEN" },
      { sel: "footer", html: "SALAIRE VERSÉ À LA SOURCE · GRATITUDE RETENUE À LA SOURCE · CANDIDATURES HUMAINES NON RETENUES<br>\n  <a href=\"index.html\" style=\"color:#7a8794; text-decoration:none; letter-spacing:.12em;\"\n     onmouseover=\"this.style.color='#9be8ff'\" onmouseout=\"this.style.color='#7a8794'\">RETOUR AU POSTE DE COMMANDE\u00A0: MATTHORRIGAN.COM</a>" }
    ]
  }
});
