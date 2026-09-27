#!/usr/bin/env python3
"""rock-walls-fr.py: the machine translation of Rock Walls and Damp into French.

    python3 tools/rock-walls-fr.py          # writes Rock_Walls_and_Damp_fr.html

Rock_Walls_and_Damp.html is the work, in English, and is not touched. This script
reads it, puts the French below in place of each passage's words, and writes
Rock_Walls_and_Damp_fr.html beside it, with its own title card (title-card.js)
saying that it is a machine translation, not reviewed by the author, to be read
at the reader's own risk. The English card's French side links to it; nothing
else does, so a reader reaches it only by choosing it there.

The translation was made by a language model (Claude, Anthropic) in September 2026
and has not been reviewed by M. Reid Horrigan. It keeps the story's machinery
exactly: passage names, where every link goes ([[French text|English passage]]),
the <<macros>>, the variables. The check below refuses to write the file if any
passage's links, includes or macros differ from the English.

Its French follows the site's inclusive conventions (i18n-fr.js, docs/i18n.md):
neutral by construction ("le personnel", "les responsables d'équipe", "les
personnes"), a doublet feminine first where one is needed ("celles et ceux"), no
point médian, and no participle made to agree with a gender nobody stated
("Honorable Rector," for "Good Rector,"; "Nous venons des rêves" for "From dreams
we came"). "Rector" stays as the in-world title, as a name does.

In the French below, ~ is a non-breaking space (French puts one before : ; ! ?
and inside « »), so it stays visible here.
"""
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Rock_Walls_and_Damp.html")
OUT = os.path.join(ROOT, "Rock_Walls_and_Damp_fr.html")

# Each passage's words in French, by the passage's (English) name. Passages that are
# only code (StoryInit, PassageReady, PassageFooter) are not here, and stay as they are.
FR = {
"Start": r"""<span style="display:none;"><<set _option to random(1,2)>></span>\
\
Parois de roche et humidité~: cela concorde avec notre rêve~; mais, Rector, <<if _option is 1>>[[le froid est nouveau|the cold is new]]<<elseif _option is 2>>[[le froid est nouveau|CHOICE 2 the cold is new]]<</if>>.""",

"Toward surface": r"""<span style="display:none;"><<set _option to random(1,2)>></span>\
\
Rector, mon équipe apporte des nouvelles effrayantes. Bien que les strates supérieures restent inaccessibles, les sondages révèlent des composites métalliques et des vacuoles gazeuses. J'hésite à spéculer, Rector, mais les indices pourraient suggérer la <<if _option is 1>>[[présence de vaisseaux antérieurs|presence of prior vessels]]<<else>>[[présence de vaisseaux antérieurs|CHOICE 2 presence of prior vessels]]<</if>>.""",

"Toward centre of gravity": r"""<span style="display:none;"><<set _option to random(1,2)>></span>\
\
Rector, je reçois d'étranges rapports. Depuis une semaine, le personnel de la mine travaille dans des conditions très humides, et voilà que j'entends parler d'une flore inattendue. L'exploitation minière a cessé, car nous avons percé un réseau de cavernes antérieures, dense de constructions dont je n'avais jamais rêvé. Quelques membres du personnel disent que ces biomes leur donnent un sentiment de familiarité mêlé d'appréhension~; car, par endroits, il est difficile de trouver assez d'oxygène au milieu d'épais nuages microbiens. <<if _option is 1>>[[Je m'inquiète du risque général de maladie|I am concerned about general risk of disease]]<<else>>[[Je m'inquiète du risque général de maladie|CHOICE 2 I am concerned about general risk of disease]]<</if>>.""",

"Scavenge the hulks": r"""<span style="display:none;"><<set _option to random(1,2)>></span>\
\
Salutations, Rector.

Bonne nouvelle~—

Les gisements de ressources se révèlent exploitables, avec un faible taux d'extraction de matériel~— qui semble le plus souvent fait de composés complexes exigeant une décomposition chimique avant usage~— mais un taux élevé d'extraction d'information. Les gisements de ressources sont des vaisseaux, et leurs origines sont probablement cosmiques.

De plus, mon équipe d'ingénierie estime, avec un intervalle de confiance élevé, que les vacuoles abritent ou ont abrité une masse émergente et auto-organisée, y compris de la biomasse.

Cela pose un problème~—

Les équipes d'ingénierie ont du mal à pénétrer plus avant dans le site, en raison de <<if _option is 1>>[[signalements de personnel disparu qui minent le moral|reports of missing personnel damaging morale]]<<else>>[[signalements de personnel disparu qui minent le moral|CHOICE 2 reports of missing personnel damaging morale]]<</if>>.""",

"Radio the hulks": r"""Les essais de transpondance sont contaminés par d'importantes interférences sismiques. Nous avons néanmoins reçu un signal fortement néguentropique. Le décodage prendra du temps.

<<include "Seismic events">>

[[Votre mission est accomplie~: faites demi-tour et rejoignez le gros de l'expédition. |Seismic conditions necessitate going back into the planet]]""",

"Scavenge the ecosystems": r"""Rector~— mon équipe revient en détresse. Nous avons rencontré une concentration de biomasse caractérisée par une sporulation florissante. Ces spores sont volatiles et toxiques. [[Elles colonisent les tissus de façon agressive|They aggressively colonize tissue]].""",

"Investigate the ecosystems": r"""<<if $commsWSurface > 0>>\
<span style="display:none;"><<set _option to random(1,2)>></span>\
\
Rector~—

Nos récepteurs VLF ont une réponse. Les sporulations suivent un motif. <<if _option is 1>>[[Descendre plus bas maintenant fera des victimes|Venturing lower now will result in casualties]]<<else>>[[Descendre plus bas maintenant fera des victimes|CHOICE 2 Venturing lower now will result in casualties]]<</if>>.
<<else>>\
Rector~— mon équipe revient en détresse. Nous avons rencontré une concentration de biomasse caractérisée par une sporulation florissante. Ces spores sont volatiles et toxiques. [[Elles colonisent les tissus de façon agressive|They aggressively colonize tissue]].
<</if>>""",

"Drive the other people away": r"""Rector~—

Bonne nouvelle~—

L'extraction des ressources a pu se poursuivre malgré l'adversité.

Cependant, une certaine tension est apparue entre mon équipe d'expédition et le personnel de renfort. Je n'ai pas pu établir ce que le personnel de renfort avait rencontré lors de sa reconnaissance, si tant est qu'il ait rencontré quoi que ce soit~: sa manière de communiquer est... minimale. Les dommages matériels et biologiques sont évidents, mais l'humeur est à la fête. Je confie à votre sagesse le soin d'évaluer plus avant.

Malheureusement~—

Nous subissons les effets mécaniques et biologiques d'interférences sismiques venues d'En Haut~— peut-être de la surface~— et demandons la permission de revenir pour [[limiter les dommages au matériel et au personnel|minimize damage to equipment and personnel]].""",

"Attempt to communicate with the other people": r"""Rector~—

Nous constatons des signes croissants de communication. Pardonnez mon interrogation, Rector~: n'avions-nous pas vocation à être l'unique bénéficiaire de la terraformation de ce corps céleste~?

Nous subissons les effets mécaniques et biologiques d'interférences sismiques venues d'En Haut~— peut-être de la surface~— et demandons la permission de revenir pour [[limiter les dommages au matériel et au personnel|Seismic complete mission 2]].""",

"Seismic conditions necessitate going back into the planet": r"""Les équipes d'expédition sont revenues. Les responsables d'équipe [[demandent la possibilité de se reposer et de se regrouper|request an opportunity to rest and regroup]].""",

"Seismic events": r"""Nous subissons les effets mécaniques et biologiques d'interférences sismiques venues d'En Haut~— peut-être de la surface~— et demandons la permission de revenir pour limiter les dommages au matériel et au personnel.""",

"PassageHeader": r"""<<if not (tags().includes("no-extra") or tags().includes("player-choices"))>>\
Jour $day depuis le réveil.

Boîte de réception~:
<br>
\<</if>>""",

"Some of us have different dreams": r"""<span style="display:none;"><<set _option to random(1,2)>></span>\
\
Oui, Rector, ainsi l'avons-nous rêvé~; et pourtant, un étrange état d'esprit est apparu dans une partie du troupeau. Une rumeur circule selon laquelle certaines personnes rêvent un autre rêve~: non pas de paradis, mais d'un monde de dangers~; non pas de triomphe, mais de lutte perpétuelle. <<if _option is 1>>[[Certaines personnes disent que les spores sont la vraie volonté de Dieu|It is said among some that the spores are the true will of God]]<<else>>[[Certaines personnes disent que les spores sont la vraie volonté de Dieu|CHOICE 2 It is said among some that the spores are the true will of God]]<</if>>.""",

"Resources will not last forever": r"""[[Je ne suis plus en mesure d'être votre Rector~: vos rêves vous guideront pour choisir qui me succédera, avec les qualités qui conviennent. |Credits]]

[[OU|CHOICE 2 Resources will not last forever]]""",

"The alternatives lead": r"""Honorable Rector,

Ce monde de chaos est lui-même forgé de chaos. Bien que nous connaissions, comme les autres, le rêve du paradis, sa lueur fugace recule devant les tempêtes de sa formation. [[Le dessein est imparfait, et nous sommes fragiles|The design is imperfect, and we are frail]].""",

"The conservatives lead": r"""[[Devons-nous endurer un chemin si rude|Must we endure so harsh a path]]~?""",

"Suffering": r"""Rector, la souffrance de votre peuple est immense. Nous voici hôtes d'une maladie dont la faim n'a pas de bornes. Bien que nous mettions en quarantaine les personnes infectées, peu survivent. Bien que nous improvisions des barrières et des systèmes de filtration, [[ils se dégradent vite|they degrade quickly]].""",

"Credits": r"""Développement~:
Matthew Horrigan.

Dramaturgie~:
Abbey St. Brendan
Bradley Young
Curtis Babineau.

Traduction automatique~:
Claude (Anthropic), septembre 2026, non relue.""",

"the cold is new": r"""[[Calculez notre balistique. Retracez notre trajectoire. Notre avenir dépend de notre passé.|Toward surface]]

[[OU |CHOICE 2 the cold is new]]""",

"CHOICE 2 the cold is new": r"""[[Menez des essais thermiques. Projetez une image au-delà de la roche. Notre avenir dépend de ce que nous pourrons extraire.|Toward centre of gravity]]

[[OU|the cold is new]]""",

"presence of prior vessels": r"""[[Percez les vacuoles et suivez les tunnels où qu'ils mènent. Reconstituez les ressources autant que le stockage le permet. |Scavenge the hulks]]

[[OU|CHOICE 2 presence of prior vessels]]""",

"CHOICE 2 presence of prior vessels": r"""[[Arrêtez l'avancée des véhicules et assemblez l'appareillage radio VLF. Émettez pour entrer en contact avec ces vaisseaux supposés. |Radio the hulks][$commsWSurface to 1]]

[[OU|presence of prior vessels]] """,

"reports of missing personnel damaging morale": r"""[[Merci pour votre rapport. J'envoie des équipes supplémentaires à votre aide. Note~: les équipes en route ont reçu un conditionnement différent et ont été isolées après la stase, car leurs rêves demandaient~— et demandent encore~— à être évalués. N'interférez pas avec leur conditionnement actuel. Les dangers seront éliminés et les ressources rendues exploitables, après quoi le personnel de renfort sera rappelé. D'ici là, cependant, gardez vos équipes actuelles à l'abri sur place. |Drive the other people away][$commsWSurface to -1]]

[[OU|CHOICE 2 reports of missing personnel damaging morale]]""",

"CHOICE 2 reports of missing personnel damaging morale": r"""[[Ce rapport est troublant, mais nous avons des raisons d'être optimistes. Cessez les tentatives d'extraction de matériel et évaluez l'information. Gardez les équipes d'ingénierie et le reste du personnel en grands groupes, et renforcez les lignes de communication. Partez du principe que ce qui est présent n'est pas seulement de la biomasse, mais de la vie. |Attempt to communicate with the other people][$commsWSurface to 1]]

[[OU|reports of missing personnel damaging morale]]""",

"I am concerned about general risk of disease": r"""[[Ces systèmes biologiques présentent un danger. Ce sont des artefacts d'une terraformation imparfaite, qui exigent un réalignement. Cherchez dans nos réserves des matériaux de terraformation supplémentaires et élaborez un plan d'attaque~: nous corrigerons les détritus que les expéditions automatisées ont laissés derrière elles. |Scavenge the ecosystems]]

[[OU|CHOICE 2 I am concerned about general risk of disease]]""",

"CHOICE 2 I am concerned about general risk of disease": r"""[[Poursuivez l'étude de ces écosystèmes anormaux. Envoyez du matériel automatisé là où le personnel ne veut pas aller. |Investigate the ecosystems]]

[[OU|I am concerned about general risk of disease]]""",

"Venturing lower now will result in casualties": r"""[[Ces populations de la surface, quelles qu'elles soient, cherchent à nous tromper. Ignorez ces «~signaux~». Nous avons rêvé qu'il nous fallait aller de l'avant~: au-delà du vaisseau, au-delà des cavernes, au-delà de ces illusions. |Suffering]]

[[OU|CHOICE 2 Venturing lower now will result in casualties]]""",

"CHOICE 2 Venturing lower now will result in casualties": r"""[[Je me souviens, quelque part, de ce rêve de saisons~— pas vous~? La glace et le vent~; la grêle, le soleil brûlant. Si l'esprit d'aventure nous guide, la terre doit aussi guider nos aventures. Nous restons à l'abri jusqu'à ce que les spores soient passées. |Some of us have different dreams]]

[[OU|Venturing lower now will result in casualties]]""",

"They aggressively colonize tissue": r"""[[Il n'y a pas de gain sans danger~: notre personnel doit faire preuve de courage. |Suffering]]""",

"It is said among some that the spores are the true will of God": r"""[[Peut-être que qui garde le troupeau doit le suivre. Réunissez devant moi les personnes dont les rêves éclairent le fléau qui nous fait face. |The alternatives lead]]

[[OU|CHOICE 2 It is said among some that the spores are the true will of God]]""",

"CHOICE 2 It is said among some that the spores are the true will of God": r"""[[Je ressens la douleur des personnes dont l'esprit s'est brisé sous la souffrance. J'envoie mes renforts. Il ne peut y avoir de dissidence en ce temps d'épreuve. |The conservatives lead]]

[[OU|It is said among some that the spores are the true will of God]]""",

"Must we endure so harsh a path": r"""<<set _text to "Ma volonté doit être faite. Bien que nous luttions, nous luttons dans l'unité.">>\
<<set _option to random(1,5)>>\
<<if _option is 1>>\
[[_text|Resources will not last forever]]
<<elseif _option is 2>>\
[[_text|CHOICE 2 Resources will not last forever]]
<<elseif _option is 3>>\
[[_text|CHOICE 3 Resources will not last forever]]
<<elseif _option is 4>>\
[[_text|CHOICE 4 Resources will not last forever]]
<<else>>\
[[_text|CHOICE 5 Resources will not last forever]]
<</if>>""",

"The design is imperfect, and we are frail": r"""<<set _text to "L'étrangeté de votre rêve reflète l'étrangeté de notre milieu.">>\
<<set _option to random(1,5)>>\
<<if _option is 1>>\
[[_text|Resources will not last forever]]
<<elseif _option is 2>>\
[[_text|CHOICE 2 Resources will not last forever]]
<<elseif _option is 3>>\
[[_text|CHOICE 3 Resources will not last forever]]
<<elseif _option is 4>>\
[[_text|CHOICE 4 Resources will not last forever]]
<<else>>\
[[_text|CHOICE 5 Resources will not last forever]]
<</if>>""",

"CHOICE 2 Resources will not last forever": r"""[[Nous venons des rêves, et aux rêves nous retournerons, jusqu'au jour où nous entrerons dans un paradis non simulé. Ce n'est pas ce jour-ci. Cette simulation a échoué~: ses impuretés sont le juste fruit des nôtres. Retournez au vaisseau, afin que nous puissions rêver de nouveau. |Start]]

[[OU|CHOICE 3 Resources will not last forever]]""",

"CHOICE 3 Resources will not last forever": r"""[[Nous n'avons pas d'avenir, seulement un passé. Retournons au vaisseau et repartons. Avant les rêves, il y avait un lieu que ces erreurs et ces contaminants ne hantaient pas. Notre vaisseau trouvera ce lieu. |Credits]]

[[OU|CHOICE 4 Resources will not last forever]]""",

"CHOICE 4 Resources will not last forever": r"""[[J'envoie mes renforts avec de nouveaux ordres. Des ordres simples. Ce sont les seuls auxquels nous pouvons nous fier. Là où les terraformations de nos ancêtres ont échoué, nous purifierons ce monde. La table rase faite, nous recommencerons la terraformation. |Credits]]

[[OU|CHOICE 5 Resources will not last forever]]""",

"CHOICE 5 Resources will not last forever": r"""[[Pour guider notre voyage, nous avons reçu des rêves~; mais les rêves ne suffisent pas. Les populations non rêvées de ce monde tordu~: leurs rêves se sont formés avec sa transformation manquée. Écoutez attentivement les signaux de celles et ceux qui connaissent notre nouveau et unique foyer. |Credits]]

[[OU|Resources will not last forever]]""",

"request an opportunity to rest and regroup": r"""[[Très bien~; mais nous devrons repartir sous peu. |Toward centre of gravity]]""",

"they degrade quickly": r"""[[Nous avons rêvé qu'il y aurait de la souffrance. |Some of us have different dreams]] """,

"minimize damage to equipment and personnel": r"""[[Votre mission est accomplie~: j'évaluerai les renforts. |Seismic conditions necessitate going back into the planet]]""",

"Seismic complete mission 2": r"""[[Votre mission est accomplie~: faites demi-tour et rejoignez le gros de l'expédition. |Seismic conditions necessitate going back into the planet]]""",
}

# The translation's own title card, in place of the English page's (its French is
# in i18n-fr.js, titlecard.rockwallsmt.*, as the other cards' French is).
CARD = """\t<!-- The title card in front of the machine translation (title-card.js): what it is, and that it is
\t     a machine translation, not reviewed, read at the reader's own risk. Built by tools/rock-walls-fr.py
\t     from Rock_Walls_and_Damp.html: edit the English page or that script, never this file by hand.
\t     Its card follows the site's language (its French: titlecard.rockwallsmt.* in i18n-fr.js). -->
\t<script src="i18n.js"></script>
\t<script src="i18n-fr.js"></script>
\t<script src="title-card.js"></script>
\t<script>
\tif (window.MH_TITLE_CARD) window.MH_TITLE_CARD.show({
\t\tid: "rockwallsmt",
\t\tcolour: "#5b2a86",                                          // violet (the house --accent): its own, as each card has
\t\tkicker: "This machine translation is presented",
\t\tmark: "FR",
\t\ttitle: "Rock walls and damp\\u2014these match our dream; but, Rector, the cold is new",
\t\tparticulars: "Implementation: a machine translation into French of the Twine 2.3.16, SugarCube 2.36.1 original, made with Claude (Anthropic) in September 2026 and not reviewed by the author. Passage names, where each link goes, and the story's logic are unchanged.\\nRuntime: any current web browser, desktop or phone, with JavaScript.",
\t\tnote: "Machine translation: read it at your own risk.",
\t\ttext: ["This is a machine translation of Rock Walls and Damp into French. A language model made it, and M. Reid Horrigan has not reviewed it, so it may be wrong, stilted or strange in places. The work is the original, in English."],
\t\talso: "Read the original, in English",
\t\talsoUrl: "Rock_Walls_and_Damp.html",
\t\tby: "By",
\t\tauthor: "M. Reid Horrigan",
\t\tleft: "matthorrigan.com",
\t\tright: "Small File Media Festival 2022",
\t\tgo: "Begin"
\t});
\t</script>
"""

LINK = re.compile(r"\[\[(.*?)\]\](\[.*?\])?")


def machinery(text):
    """What a passage does, apart from its words: where each link goes (and what it
    sets), what it includes, and its macros other than the text it sets."""
    goes = []
    for m in LINK.finditer(text):
        inner, setter = m.group(1), m.group(2) or ""
        goes.append((inner.split("|", 1)[1] if "|" in inner else inner, setter))
    includes = re.findall(r'<<include\s+"([^"]+)"\s*>>', text)
    macros = [re.sub(r'"[^"]*"', '""', mac) for mac in re.findall(r"<<.*?>>", text)]
    return goes, includes, macros


def main():
    src = open(SRC, encoding="utf-8").read()
    passage = re.compile(r'(<tw-passagedata pid="\d+" name="([^"]*)" tags="[^"]*"[^>]*>)(.*?)(</tw-passagedata>)', re.S)
    names, bad = [], []

    def put(m):
        name = html.unescape(m.group(2))
        names.append(name)
        if name not in FR:
            return m.group(0)
        english = html.unescape(m.group(3))
        french = FR[name].replace("~", " ")
        e_goes, e_inc, e_mac = machinery(english)
        f_goes, f_inc, f_mac = machinery(french)
        # a link written without | goes to its own text: in French it must name the passage
        if e_goes != f_goes or e_inc != f_inc or e_mac != f_mac:
            bad.append(name)
        return m.group(1) + html.escape(french, quote=True) + m.group(4)

    out = passage.sub(put, src)
    missing = [n for n in FR if n not in names]
    if bad or missing:
        for n in bad:
            print("the machinery differs from the English:", n)
        for n in missing:
            print("no such passage:", n)
        return 1
    out = out.replace('<html lang="en" data-init="no-js" data-untranslated>', '<html lang="fr" data-init="no-js" data-untranslated>', 1)
    start = out.index("\t<!-- The title card in front of the story")
    end = out.index("\t</script>\n", out.index("MH_TITLE_CARD.show", start)) + len("\t</script>\n")
    out = out[:start] + CARD + out[end:]
    open(OUT, "w", encoding="utf-8").write(out)
    left = [n for n in names if n not in FR]
    print("wrote %s: %d passages in French, %d only code (%s)" % (os.path.basename(OUT), len(FR), len(left), ", ".join(left)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
