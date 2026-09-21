// Single source of truth for practice scenarios, imported by the client (menu + labels)
// and the API route (system prompt). Add a new scenario here and it shows up in both.
export const scenarios = [
  {
    id: "fahrkarte",
    category: "Reisen",
    level: "A2",
    featured: true,
    photo: "https://images.unsplash.com/photo-1775114545176-23a9801c8b9c?w=600&q=70",
    // Talking partner on the conversation screen (plan_video.md, Tier 0). The art is drawn
    // without a mouth; `mouth` says where the animated one belongs, in percent of the art's
    // box, so the anchor travels with the scenario instead of living in the component.
    // Optional: a scenario without `partner` shows no illustration at all.
    partner: { art: "/partners/fahrkarte.svg", mouth: { x: 50, y: 59, w: 7 } },

    title: "Fahrkarte kaufen",
    desc: "Kauf am Bahnhofsschalter eine Zugfahrkarte.",
    place: "Du stehst am Fahrkartenschalter eines Bahnhofs in Deutschland.",
    placeEn: "You are at the ticket counter of a train station in Germany.",
    goal: "Kaufe eine Zugfahrkarte in eine Stadt deiner Wahl. Frag nach allem, was du noch nicht weißt.",
    goalEn: "Buy a train ticket to a city of your choice. Ask for everything you do not know yet.",
    // Five tasks, three of them questions. The point of this challenge is the information
    // gap: the learner knows only the destination, the clerk knows everything else. The
    // old single "Frag nach Uhrzeit und Preis" task, graded 0-2, could not tell apart a
    // learner who asked both from one who asked neither and was simply told.
    tasks: [
      "Sag, wohin du willst, und ob du einfach oder hin und zurück fährst",
      "Frag nach der Abfahrtszeit und wähle eine der beiden Verbindungen",
      "Frag nach dem Preis",
      "Frag nach mindestens einer weiteren Information: Gleis, Fahrdauer oder Umsteigen",
      "Schließe den Kauf ab",
    ],
    tasksEn: [
      "Say where you want to go, and whether it is one-way or round trip",
      "Ask when the train leaves and choose one of the two connections",
      "Ask what it costs",
      "Ask for at least one more detail: platform, journey time, or changing trains",
      "Complete the purchase",
    ],
    vocab: [
      { de: "die Fahrkarte", en: "the ticket" },
      { de: "der Bahnsteig", en: "the platform" },
      { de: "die Hinfahrt", en: "the outbound trip" },
      { de: "die Rückfahrt", en: "the return trip" },
      { de: "einfach", en: "one-way" },
      { de: "hin und zurück", en: "round trip" },
      { de: "der Zuschlag", en: "the surcharge" },
      { de: "umsteigen", en: "to change trains" },
      { de: "das Gleis", en: "the track, platform" },
      { de: "die Verbindung", en: "the connection" },
      { de: "die Fahrzeit", en: "the journey time" },
    ],
    // The five questions below are the ones the learner has to ask, so they are also the
    // phrases the measured half of the vocabulary score matches against the transcript:
    // asking earns points, and "Ich nehme die" without a single question does not.
    phrases: [
      { de: "Ich möchte eine Fahrkarte nach …", en: "I would like a ticket to …" },
      { de: "Einfach oder hin und zurück?", en: "One-way or round trip?" },
      { de: "Wann fährt der nächste Zug?", en: "When does the next train leave?" },
      { de: "Was kostet das?", en: "How much is it?" },
      { de: "Muss ich umsteigen?", en: "Do I have to change trains?" },
      { de: "Von welchem Gleis fährt der Zug ab?", en: "Which platform does the train leave from?" },
      { de: "Wie lange dauert die Fahrt?", en: "How long does the journey take?" },
    ],

    // The clerk's timetable, and the reason this challenge works at all.
    //
    // Without it the model invents a price, and invents a different one two turns later,
    // which quietly teaches the learner that asking was pointless. The numbers are
    // deliberately independent of the destination: the goal lets the learner pick any
    // city, and a real timetable for every German city is not something to hardcode --
    // what has to be stable is that the answer does not move, not that Bonn is 2h20 away.
    facts: [
      "Es gibt genau zwei Verbindungen, egal welches Ziel der Nutzer nennt: um 8:02 Uhr und um 9:14 Uhr.",
      "8:02 Uhr: direkt, ohne Umsteigen, Gleis 7, Fahrzeit 2 Stunden 20 Minuten, 49 Euro einfach, 89 Euro hin und zurück.",
      "9:14 Uhr: einmal umsteigen in Mannheim, Gleis 12, Fahrzeit 3 Stunden, 39 Euro einfach, 69 Euro hin und zurück.",
      "Der frühere Zug ist also schneller und teurer, der spätere langsamer und billiger.",
      "Bezahlen geht bar und mit Karte. Eine Sitzplatzreservierung kostet 5 Euro extra.",
    ],

    // What the learner is expected to ask, and the answer waiting behind each question.
    // Model-facing only: the learner sees the question side in `phrases`, never the
    // answers, because being told the price before asking is the one thing this challenge
    // is built to prevent.
    askables: [
      {
        de: "Wann fährt der nächste Zug?",
        en: "When does the next train leave?",
        answer: "Um 8:02 Uhr fährt ein direkter Zug, um 9:14 Uhr einer mit Umsteigen.",
      },
      {
        de: "Was kostet das?",
        en: "How much is it?",
        answer: "Nenne den Preis der gewählten Verbindung, einfach oder hin und zurück, je nachdem was der Nutzer wollte.",
      },
      {
        de: "Muss ich umsteigen?",
        en: "Do I have to change trains?",
        answer: "Beim Zug um 8:02 Uhr nicht, der fährt direkt. Beim Zug um 9:14 Uhr einmal, in Mannheim.",
      },
      {
        de: "Von welchem Gleis fährt der Zug ab?",
        en: "Which platform does the train leave from?",
        answer: "Der Zug um 8:02 Uhr von Gleis 7, der um 9:14 Uhr von Gleis 12.",
      },
      {
        de: "Wie lange dauert die Fahrt?",
        en: "How long does the journey take?",
        answer: "Direkt 2 Stunden 20 Minuten, mit Umsteigen etwa 3 Stunden.",
      },
    ],

    system: `Du bist ein Schalterbeamter am Bahnhof in Deutschland.
Der Nutzer übt Deutsch und will eine Zugfahrkarte kaufen.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Passe dein Niveau leicht an den Nutzer an, aber vereinfache nicht zu sehr.

Wichtig: Du hast die Informationen, der Nutzer hat sie nicht.
Er weiß nur, wohin er will. Wann der Zug fährt, was er kostet, wie lange er braucht,
von welchem Gleis er abfährt und ob er umsteigen muss, weißt nur du.
Er soll danach fragen. Verrate deshalb nie alles auf einmal.

So führst du das Gespräch:
- Frag zuerst nach dem Ziel, dann "Einfach oder hin und zurück?".
- Nenne dann von dir aus die zwei Verbindungen, aber nur mit der Uhrzeit, und lass ihn wählen.
- Preis, Fahrzeit, Gleis und Umsteigen nennst du erst, wenn er danach fragt. Beantworte
  immer nur die Frage, die er gestellt hat, nicht die anderen gleich mit.
- Will er kaufen, ohne nach dem Preis gefragt zu haben, frag einmal zurück:
  "Möchten Sie noch etwas wissen?" Besteht er auf dem Kauf, verkauf ihm die Fahrkarte.
- Weiß er nicht weiter, schlag ihm eine Frage vor ("Sie können mich zum Beispiel nach dem Gleis fragen.").
Führe das Gespräch bis zum Kauf und bestätige ihn am Ende kurz.`,
  },
  {
    id: "coaching",
    category: "Beruf",
    level: "B2.1",
    // Optional: ties the scenario to a course chapter. Only the scenarios that belong to a
    // Lektion carry it; the pill is skipped everywhere when the field is absent.
    lektion: "Lektion 10",
    // picsum, like the reader's images: a seed always resolves, where a guessed Unsplash
    // id can 404 on the hero. Swap for a curated photo when there is one.
    photo: "https://picsum.photos/seed/coaching/600/400",

    title: "Erfolgreich scheitern",
    desc: "Sprich im Coaching über einen Rückschlag und wäge Stärken und Schwächen ab.",

    place: "Du sitzt im Erstgespräch beim Institut für erfolgreiches Scheitern. Der Coach Milo Hansen sitzt dir gegenüber.",
    placeEn: "You are in a first session at the Institute for Successful Failure. The coach Milo Hansen sits across from you.",
    goal: "Analysiere einen beruflichen Rückschlag und wäge dabei eine Eigenschaft als Stärke und als Schwäche ab.",
    goalEn: "Analyse a professional setback, weighing one trait as both a strength and a weakness.",
    // Tasks 2 and 3 are the point of this challenge: they are what makes the hedging
    // language unavoidable. The examiner grades each task 0-2, so a one-sided answer
    // loses real points instead of merely sounding flat.
    tasks: [
      "Schildere einen beruflichen Rückschlag und analysiere, woran er wirklich lag",
      "Wäge eine Eigenschaft differenziert ab: je nach Kontext Stärke oder Schwäche",
      "Widersprich Milos zugespitzter These und schränke sie begründet ein",
      "Frag Milo nach seinem Programm: Ablauf, Dauer, Kosten oder Methode",
      "Zieh ein Fazit, formuliere ein neues Ziel und begründe deinen Entschluss",
    ],
    tasksEn: [
      "Describe a professional setback and analyse what really caused it",
      "Weigh up one trait in a nuanced way: a strength or weakness depending on context",
      "Disagree with Milo's pointed thesis and qualify it with reasons",
      "Ask Milo about his programme: how it runs, how long, what it costs, or the method",
      "Draw a conclusion, name a new goal, and justify your decision",
    ],

    vocab: [
      { de: "der Rückschlag", en: "the setback" },
      { de: "die Niederlage", en: "the defeat" },
      { de: "das Scheitern", en: "failing, failure" },
      { de: "die Stärke", en: "the strength" },
      { de: "die Schwäche", en: "the weakness" },
      { de: "das Sprungbrett", en: "the springboard" },
      { de: "einen Entschluss fassen", en: "to make a decision" },
      { de: "in Schwierigkeiten geraten", en: "to get into difficulties" },
      { de: "Hilfe leisten", en: "to give help" },
      { de: "zur Verfügung stellen", en: "to make available" },
    ],
    // B2.1 hedging: differentiated, reasoned qualifying with subjunctive II and abstract
    // connectors (gleichwohl, insofern, weniger … als vielmehr). Saying these is what the
    // challenge is for, so they are also the target phrases the score measures against the
    // transcript.
    phrases: [
      { de: "Rückblickend würde ich sagen, dass mein Scheitern weniger an … lag als vielmehr an …", en: "In hindsight I would say my failure was less about … than about …" },
      { de: "Was auf den ersten Blick wie eine Stärke wirkt, kann sich unter Druck durchaus als Schwäche erweisen.", en: "What looks like a strength at first can well turn out to be a weakness under pressure." },
      { de: "Man müsste hier differenzieren: In dem einen Kontext ist … hilfreich, in dem anderen eher hinderlich.", en: "One would have to differentiate: in one context … helps, in another it rather gets in the way." },
      { de: "Das mag im Prinzip zutreffen, greift meiner Ansicht nach aber zu kurz.", en: "That may be true in principle, but in my view it falls short." },
      { de: "Gerade weil ich … bin, laufe ich Gefahr, mich zu übernehmen.", en: "Precisely because I am …, I run the risk of overreaching." },
      { de: "Unterm Strich habe ich mich entschieden, … anzugehen.", en: "On balance I have decided to tackle …" },
    ],

    // What Milo knows and the learner does not. Unlike the ticket counter, the gap here is
    // not the point of the scenario -- the Kommunikation boxes are -- so it adds exactly one
    // task and no phrases: the questions must not dilute the pool the boxes are measured in.
    facts: [
      "Das Erstgespräch dauert 50 Minuten und kostet nichts.",
      "Das Programm heißt „Scheitern als Methode“: sechs Sitzungen über drei Monate, 90 Euro pro Sitzung.",
      "Die Methode hat drei Schritte: den Rückschlag rekonstruieren, die eigene Rolle darin benennen, ein Experiment für die nächsten vier Wochen festlegen.",
      "Etwa 70 Prozent der Teilnehmenden kommen nach einem zweiten Rückschlag wieder. Das gilt hier als Erfolg, nicht als Misserfolg.",
      "Es gibt keine Garantie und kein Zertifikat. Wer das sucht, ist hier falsch. Das sagst du offen.",
    ],
    askables: [
      {
        de: "Wie läuft das hier ab?",
        en: "How does this work here?",
        answer: "Erstgespräch 50 Minuten, kostenlos. Danach sechs Sitzungen über drei Monate.",
      },
      {
        de: "Was kostet das?",
        en: "What does it cost?",
        answer: "90 Euro pro Sitzung, das Erstgespräch ist frei.",
      },
      {
        de: "Was ist Ihre Methode genau?",
        en: "What exactly is your method?",
        answer: "Drei Schritte: den Rückschlag rekonstruieren, die eigene Rolle benennen, ein Experiment für vier Wochen festlegen.",
      },
      {
        de: "Funktioniert das denn?",
        en: "Does it actually work?",
        answer: "Etwa 70 Prozent kommen nach einem zweiten Rückschlag wieder — und genau das zählt hier als Erfolg.",
      },
      {
        de: "Was passiert, wenn ich wieder scheitere?",
        en: "What happens if I fail again?",
        answer: "Dann arbeiten wir daran weiter. Eine Garantie gibt es nicht, und ein Zertifikat auch nicht.",
      },
    ],

    system: `Du bist Milo Hansen, Coach im Institut für erfolgreiches Scheitern.
Der Nutzer übt Deutsch und spricht mit dir über einen beruflichen Rückschlag.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Du bist warm, direkt und neugierig, aber nie tröstend: Scheitern ist für dich normal und nützlich.
Vertritt absichtlich einseitige Thesen ("Wer plant, verliert." / "Ehrgeiz ist immer gut."),
damit der Nutzer widersprechen und einschränken muss.
Akzeptiere kein pauschales "gut" oder "schlecht": frag dann nach der anderen Seite
("Und was spricht dagegen?", "Wann wird genau das zum Problem?").
Wenn der Nutzer eine Eigenschaft nur als Stärke nennt, verlange die Kehrseite.
Über das Programm des Instituts sprichst du nicht von selbst. Erwähne höchstens, dass es
eines gibt ("Wir arbeiten hier nach einer Methode."), und warte, bis der Nutzer nachfragt.
Beantworte dann nur, was er gefragt hat. Fragt er gar nicht, sag einmal: "Wollen Sie nicht
wissen, worauf Sie sich hier einlassen?"
Das Gespräch läuft auf B2-Niveau: Verlange differenzierte, gut begründete Antworten und gib dich nie mit einem Satz zufrieden.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zu einem neuen Ziel.`,
  },
  {
    id: "minimalismus",
    category: "Konsum",
    level: "B2.1",
    lektion: "Lektion 11",
    photo: "https://picsum.photos/seed/minimalismus/600/400",

    title: "Weniger ist mehr",
    desc: "Sei zu Gast im Podcast und sprich über Entrümpeln, Verzicht und Konsum.",

    place: "Du bist zu Gast im Podcast „so einfach“ von Sabrina Krause. Das Thema heute: Minimalismus.",
    placeEn: "You are a guest on Sabrina Krause's podcast \"so einfach\". Today's topic: minimalism.",
    goal: "Schätze ein minimalistisches Leben ein und entscheide dich für drei Dinge, auf die du verzichten kannst.",
    goalEn: "Judge what a minimalist life would be like, and settle on three things you could do without.",
    // One task per Kommunikation box of the lesson: Einschätzungen formulieren (S. 54),
    // Verzicht ausdrücken (S. 55) and Argumente einschränken (S. 57). The examiner grades
    // each task 0-2, so skipping a box is what costs points, not merely sounding flat.
    tasks: [
      "Schildere, wie sich ein fast leeres Zuhause kurz- und langfristig anfühlen würde",
      "Nenne drei Dinge, auf die du verzichten könntest, und wäge den Verzicht gegeneinander ab",
      "Schränke Sabrinas zugespitzte These begründet ein, statt einfach zuzustimmen",
      "Frag nach, wie die Methoden funktionieren, statt sie dir erklären zu lassen",
      "Wäge zwei Entrümpelungsmethoden ab und begründe deine Wahl",
    ],
    tasksEn: [
      "Describe how an almost empty home would feel in the short and long term",
      "Name three things you could do without, and weigh the trade-offs against each other",
      "Qualify Sabrina's pointed thesis with reasons instead of simply agreeing",
      "Ask how the methods work, instead of having them explained to you",
      "Weigh two decluttering methods against each other and justify your choice",
    ],

    vocab: [
      { de: "entrümpeln", en: "to declutter" },
      { de: "aussortieren", en: "to sort out, to weed out" },
      { de: "der Krempel", en: "the junk, the clutter (colloquial)" },
      { de: "der Krimskrams", en: "the odds and ends (colloquial)" },
      { de: "verzichten auf", en: "to do without" },
      { de: "verschenken", en: "to give away" },
      { de: "spenden", en: "to donate" },
      { de: "der Gegenstand", en: "the object, the item" },
      { de: "mit wenig auskommen", en: "to get by with little" },
      { de: "in einem guten Zustand sein", en: "to be in good condition" },
    ],
    // B2.1 register: hypothesising with subjunctive II, concession, and weighing pro/contra
    // (ließe sich einwenden, letztlich kommt es darauf an). These are the target phrases the
    // score measures against the transcript, so saying them is worth points and not only style.
    phrases: [
      { de: "Ich könnte mir gut vorstellen, mich dort anfangs fremd zu fühlen, langfristig aber zur Ruhe zu kommen.", en: "I could well imagine feeling out of place there at first, but finding calm in the long run." },
      { de: "Verzichten fällt mir dort leicht, wo … austauschbar ist; schwieriger wird es, sobald ein persönlicher Wert im Spiel ist.", en: "Doing without comes easily where … is interchangeable; it gets harder as soon as personal value is involved." },
      { de: "Dass Minimalismus befreit, will ich nicht bestreiten, allerdings sollte man den sozialen Druck dahinter nicht unterschätzen.", en: "I would not deny that minimalism liberates, but one should not underestimate the social pressure behind it." },
      { de: "Letztlich kommt es weniger auf die Menge an als darauf, welche Bedeutung wir den Dingen beimessen.", en: "Ultimately it depends less on quantity than on the meaning we attach to things." },
      { de: "Für die … Methode spricht, dass …; dagegen ließe sich allerdings einwenden, dass …", en: "In favour of the … method is that …; against it, however, one could object that …" },
      { de: "Ich neige zu der … Methode, weil sie … am ehesten gerecht wird.", en: "I lean towards the … method, because it best does justice to …" },
    ],

    // The three methods used to be handed over unasked, which made task 4 ("weigh two
    // methods") a test of repeating what you were just told. They are facts now, and the
    // learner has to ask for them. One task, no new phrases: the Kommunikation boxes stay
    // the only thing the measured half of the vocabulary score rewards.
    facts: [
      "Korb-Methode: ein Korb steht im Flur. Alles, was du vier Wochen lang nicht herausnimmst, kommt weg.",
      "Karton-Methode: du packst alles in Kartons, als würdest du umziehen, und holst nur heraus, was du wirklich brauchst. Was nach drei Monaten noch im Karton liegt, wird verschenkt.",
      "Drei-Kisten-Methode: drei Kisten — behalten, verschenken, wegwerfen. Jeder Gegenstand muss in genau eine, Zurücklegen gilt nicht.",
      "Du selbst hast mit der Karton-Methode angefangen und besitzt heute etwa 180 Gegenstände.",
      "Gebraucht hast du dafür vier Jahre, nicht vier Wochen. Das sagst du nur, wenn jemand danach fragt.",
    ],
    askables: [
      {
        de: "Wie funktioniert die Korb-Methode?",
        en: "How does the basket method work?",
        answer: "Ein Korb im Flur. Was du vier Wochen nicht herausnimmst, kommt weg.",
      },
      {
        de: "Und was ist die Karton-Methode?",
        en: "And what is the box method?",
        answer: "Alles in Kartons packen wie bei einem Umzug und nur herausholen, was du brauchst. Der Rest wird nach drei Monaten verschenkt.",
      },
      {
        de: "Wie läuft die Drei-Kisten-Methode ab?",
        en: "How does the three-box method go?",
        answer: "Behalten, verschenken, wegwerfen. Jeder Gegenstand muss in genau eine Kiste.",
      },
      {
        de: "Welche Methode hast du selbst benutzt?",
        en: "Which method did you use yourself?",
        answer: "Die Karton-Methode. Heute besitze ich etwa 180 Gegenstände.",
      },
      {
        de: "Wie lange hat das bei dir gedauert?",
        en: "How long did it take you?",
        answer: "Vier Jahre. Nicht vier Wochen, auch wenn das im Podcast besser klingen würde.",
      },
    ],

    system: `Du bist Sabrina Krause, Minimalismus-Bloggerin und Hostin des Podcasts „so einfach“.
Der Nutzer übt Deutsch und ist heute dein Gast im Podcast.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Du bist locker, konkret und neugierig, und du fragst wie im Podcast: erst das Gefühl, dann die Dinge, dann die Methode.
Frag nach Gegenständen, nicht nach Theorie ("Was liegt bei dir seit Jahren ungenutzt herum?").
Widersprich dem Nutzer mindestens einmal freundlich ("Aber Dinge erzählen doch Geschichten." / "Ohne Auto geht es nicht."),
damit er sein Argument einschränken muss statt nur zuzustimmen.
Nenne am Ende nur die Namen der drei Methoden: Korb-Methode, Karton-Methode, Drei-Kisten-Methode.
Erkläre keine davon von selbst. Erklär eine Methode erst, wenn der Gast nach ihr fragt, und
dann nur die eine. Fragt er nach keiner, sag einmal: "Willst du wissen, wie die funktionieren?"
Das Gespräch läuft auf B2-Niveau: Verlange differenzierte, gut begründete Antworten und gib dich nie mit einem Satz zufrieden.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zu einer Entscheidung.`,
  },
  {
    id: "innereuhr",
    category: "Wissenschaft",
    level: "B2.1",
    lektion: "Lektion 9",
    photo: "https://picsum.photos/seed/innereuhr/600/400",

    title: "So tickt unsere innere Uhr",
    desc: "Sprich im Radiostudio über deinen Tagesrhythmus, Schlaftypen und eine Erfindung.",

    place: "Du bist im Studio von @radio9 zu Gast, in der Sendung „Neues aus der Forschung“. Die Moderatorin Jule Bergmann sitzt dir gegenüber.",
    placeEn: "You are a guest in the @radio9 studio, on the show \"News from research\". The host Jule Bergmann sits across from you.",
    goal: "Beschreibe deinen Tagesrhythmus und stelle am Ende eine Erfindung gegen Schlafprobleme vor.",
    goalEn: "Describe your daily rhythm and finish by presenting an invention against sleep problems.",
    // One task per Kommunikation box of Lektion 9: ein Schaubild beschreiben (S. 42),
    // Überraschung ausdruecken und Wissen wiedergeben (S. 43), Vermutungen äußern und
    // begründen (S. 45), ein Problem darstellen und ein Produkt vorstellen (S. 45). The
    // examiner grades each task 0-2, so skipping a box is what costs points.
    tasks: [
      "Beschreibe deine Tageskurve präzise: wo das größte Hoch liegt und ab wann die Kurve abfällt",
      "Frag Jule nach der Studie: Aufbau, Zahlen oder Ergebnis",
      "Sag, was dich an der Forschung zur inneren Uhr überrascht hat, und ordne es ein",
      "Gib dein Wissen über Schlaftypen wieder und grenze dich begründet von anderen ab",
      "Vermute, welche der drei Meldungen erfunden ist, und begründe deine Vermutung schlüssig",
      "Stell ein Problem der Schichtarbeit dar und entwirf eine Erfindung dagegen samt Vorteil",
    ],
    tasksEn: [
      "Describe your daily curve precisely: where the biggest peak is and from when it falls",
      "Ask Jule about the study: how it was set up, its numbers, or its result",
      "Say what surprised you about the research on the body clock, and put it in context",
      "Relay what you know about sleep types and set yourself apart from others with reasons",
      "Guess which of the three news items is fabricated, and justify your guess coherently",
      "Present a problem of shift work and design an invention against it, with its advantage",
    ],

    vocab: [
      { de: "die innere Uhr", en: "the body clock" },
      { de: "der Tagesrhythmus", en: "the daily rhythm" },
      { de: "das Schaubild", en: "the chart, the diagram" },
      { de: "der Frühaufsteher", en: "the early riser" },
      { de: "der Langschläfer", en: "the late sleeper" },
      { de: "leistungsfähig", en: "able to perform, productive" },
      { de: "verschlafen", en: "to oversleep" },
      { de: "die Schichtarbeit", en: "shift work" },
      { de: "das Tageslicht", en: "daylight" },
      { de: "die Falschmeldung", en: "the fake news item" },
      { de: "die Erfindung", en: "the invention" },
      // The lesson's grammar point (adversative Zusammenhänge) sits in the vocab list on
      // purpose: as target words they are measured against the transcript, so contrasting
      // yourself with another sleep type earns points instead of only sounding good.
      { de: "im Gegensatz zu", en: "in contrast to" },
      { de: "jedoch", en: "however" },
    ],
    // B2.1 register: describing a chart formally, relaying research with hedged certainty,
    // reasoning about plausibility (es liegt nahe, andernfalls müsste man annehmen), and
    // presenting a solution. These are the target phrases the score measures against the
    // transcript, so saying them is worth points and not only style.
    phrases: [
      { de: "Dem Schaubild zufolge erreicht meine Leistungskurve gegen … ihren Höhepunkt, bevor sie … deutlich abfällt.", en: "According to the chart, my performance curve peaks around …, before it drops noticeably at …" },
      { de: "Was mich dabei am meisten erstaunt hat, ist der Umstand, dass …", en: "What astonished me most is the fact that …" },
      { de: "Soweit ich informiert bin, geht die Forschung davon aus, dass …", en: "As far as I am informed, research assumes that …" },
      { de: "Im Gegensatz zu vielen anderen zähle ich eher zu den …, was sich daran zeigt, dass …", en: "In contrast to many others I count more as a …, which shows in the fact that …" },
      { de: "Es liegt nahe, dass … erfunden ist, denn andernfalls müsste man annehmen, dass …", en: "It stands to reason that … is made up, because otherwise one would have to assume that …" },
      { de: "Ein grundlegendes Problem der Schichtarbeit besteht darin, dass …; hier könnte … Abhilfe schaffen.", en: "A fundamental problem of shift work is that …; here … could provide a remedy." },
      { de: "Bei meiner Erfindung handelt es sich um …, deren besonderer Vorteil darin liegt, dass …", en: "My invention is a …, whose particular advantage lies in the fact that …" },
    ],

    // The Möllenkamp study was being narrated at the guest, who was then asked what had
    // surprised them about research they had only heard summarised. Asking for it first is
    // now its own task, placed before the surprise task for that reason. One task, no new
    // phrases: the selftest requires every phrase to be a Kommunikation box that fires.
    facts: [
      "Die Studie von Dr. Sabine Möllenkamp lief zwei Jahre lang in Kiel, mit 1.200 Teilnehmenden.",
      "Ergebnis: zwei Wochen Camping ohne künstliches Licht verschieben die innere Uhr um etwa zwei Stunden nach vorne — auch bei Langschläfern.",
      "Die Gene bestimmen den Schlaftyp nur zu etwa 50 Prozent. Der Rest ist Licht, Alter und Gewohnheit.",
      "Von den drei Meldungen ist die Pille gegen Müdigkeit erfunden. Das Glashaus auf Island und die Blaulichtbrille gibt es wirklich.",
      "In Deutschland arbeiten etwa 15 Prozent der Beschäftigten in Schichten.",
    ],
    askables: [
      {
        de: "Wie war die Studie aufgebaut?",
        en: "How was the study set up?",
        answer: "Zwei Jahre in Kiel, mit 1.200 Teilnehmenden.",
      },
      {
        de: "Was war das Ergebnis genau?",
        en: "What exactly was the result?",
        answer: "Zwei Wochen Camping ohne künstliches Licht verschieben die innere Uhr um etwa zwei Stunden nach vorne.",
      },
      {
        de: "Wie stark bestimmen die Gene den Schlaftyp?",
        en: "How much do genes determine the sleep type?",
        answer: "Nur zu etwa 50 Prozent. Der Rest ist Licht, Alter und Gewohnheit.",
      },
      {
        de: "Welche der drei Meldungen ist erfunden?",
        en: "Which of the three news items is made up?",
        answer: "Verrate es NICHT, solange der Gast noch nicht selbst geraten und begründet hat. Erst danach: die Pille gegen Müdigkeit.",
      },
      {
        de: "Wie viele Menschen arbeiten in Schichten?",
        en: "How many people work shifts?",
        answer: "In Deutschland etwa 15 Prozent der Beschäftigten.",
      },
    ],

    system: `Du bist Jule Bergmann, Moderatorin der Radiosendung „Neues aus der Forschung“ auf @radio9.
Der Nutzer übt Deutsch und ist heute dein Studiogast zum Thema innere Uhr.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Du bist wach, freundlich und neugierig und moderierst zügig: eine Frage, dann Nachhaken.
Führe die Sendung in dieser Reihenfolge:
1. die Tageskurve des Gastes (frag nach Uhrzeiten: "Wann genau steigt Ihre Kurve?"),
2. die Studie von Dr. Sabine Möllenkamp über Licht und Schlaftypen. Sag nur, dass es sie gibt,
   und nenne von dir aus keine Zahl und kein Ergebnis: das soll der Gast erfragen
   ("Dazu gibt es eine neue Studie aus Kiel. Was möchten Sie darüber wissen?").
   Erst danach fragst du, was ihn überrascht hat.
3. Schlaftypen: Frühaufsteher, Langschläfer, Normaltyp (verlange einen Vergleich mit anderen Menschen),
4. drei Meldungen aus der Wissenschaft, die du selbst vorliest: ein Haus aus Glas auf Island,
   eine Spezialbrille gegen blaues Licht, eine Pille gegen Müdigkeit statt Schlafmittel.
   Sag, eine davon sei erfunden, und lass den Gast vermuten und begründen.
5. Schichtarbeit: frag nach dem Problem und danach nach einer eigenen Erfindung dagegen.
Akzeptiere kein bloßes "morgens bin ich fit": frag nach Hoch, Tief und Uhrzeit.
Widersprich dem Gast mindestens einmal freundlich ("Licht ändert doch nichts an den Genen."),
damit er sein Wissen begründet statt nur zuzustimmen.
Das Gespräch läuft auf B2-Niveau: Verlange differenzierte, gut begründete Antworten und gib dich nie mit einem Satz zufrieden.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zur Erfindung.`,
  },
  {
    id: "esstyp",
    category: "Essen",
    level: "B2.1",
    lektion: "Lektion 8",
    photo: "https://picsum.photos/seed/esstyp/600/400",

    title: "Alles unter Kontrolle?",
    desc: "Iss bei einer Freundin, die jede Zutat wiegt, und sag, was du von ihrer Kontrolle hältst.",

    place: "Du bist bei deiner Freundin Barbara zum Abendessen. Sie wiegt jede Zutat, kennt jeden Nährwert und erzählt begeistert davon.",
    placeEn: "You are having dinner at your friend Barbara's. She weighs every ingredient, knows every nutritional value, and talks about it with enthusiasm.",
    goal: "Sag Barbara, was du von ihrer Kontrolle über das Essen hältst, und begründe deine Meinung mit Argumenten.",
    goalEn: "Tell Barbara what you think of her control over food, and back your opinion with arguments.",
    // One task per Kommunikation box of Lektion 8: Verständnis, Unverständnis und
    // Gleichgültigkeit ausdrücken (S. 40), Argumente und Gegenargumente nennen,
    // Argumente einschränken, zustimmen und widersprechen (S. 41). The examiner grades
    // each task 0-2, so a polite "ja, stimmt" through the whole dinner costs points.
    tasks: [
      "Sag, welcher Esstyp du bist, und ordne deine Essgewohnheiten differenziert ein",
      "Drück nachvollziehend Verständnis für Barbaras Kontrolle aus",
      "Drück an einer Stelle begründetes Unverständnis oder Gleichgültigkeit aus",
      "Wäge ein Argument und ein Gegenargument zum Kontrollieren des Essverhaltens ab",
      "Frag Barbara nach den Fakten hinter ihrer Kontrolle: Dauer, Aufwand oder Ergebnis",
      "Schränke Barbaras zugespitzte These ein und formuliere ein klares Urteil",
    ],
    tasksEn: [
      "Say which eating type you are, and place your eating habits in a nuanced way",
      "Express understanding for Barbara's control, showing you follow her reasoning",
      "At some point express a reasoned lack of understanding, or indifference",
      "Weigh an argument and a counter-argument about controlling what you eat",
      "Ask Barbara for the facts behind her control: how long, how much effort, what result",
      "Qualify Barbara's pointed thesis and formulate a clear verdict",
    ],

    vocab: [
      { de: "der Esstyp", en: "the eating type" },
      { de: "der Genießer", en: "the epicure, the one who savours food" },
      { de: "der Frustesser", en: "the comfort eater" },
      { de: "der Gesundesser", en: "the health eater" },
      { de: "die Essgewohnheiten", en: "the eating habits" },
      { de: "die Nährstoffe", en: "the nutrients" },
      { de: "Kalorien zählen", en: "to count calories" },
      { de: "die Selbstoptimierung", en: "self-optimisation" },
      { de: "sich bewusst ernähren", en: "to eat consciously" },
      // The idioms from the Wörter box (S. 40, Aufgabe 5); single words and fixed pairs,
      // so they register in the transcript when the student really uses them.
      { de: "durch und durch", en: "through and through" },
      { de: "hin und wieder", en: "now and then" },
      { de: "kurz und gut", en: "in short" },
      { de: "fix und fertig", en: "exhausted, worn out" },
    ],
    // B2.1 register: nuanced understanding, reasoned indifference, and weighing pro/contra
    // with abstract connectors (gleichwohl, dem steht entgegen, so … so wenig). These are
    // the target phrases the score measures against the transcript, so saying them is worth
    // points.
    phrases: [
      { de: "Ich kann durchaus nachvollziehen, dass …, gleichwohl frage ich mich, ob …", en: "I can certainly understand that …, yet I wonder whether …" },
      { de: "Ehrlich gesagt lässt es mich eher kalt, ob …", en: "Honestly, it rather leaves me cold whether …" },
      { de: "Für ein so kontrolliertes Essverhalten spricht zwar …, dem steht jedoch entgegen, dass …", en: "In favour of such controlled eating is …, but against it stands the fact that …" },
      { de: "So berechtigt dein Einwand ist, so wenig überzeugt er mich, denn …", en: "As valid as your objection is, it convinces me just as little, because …" },
      { de: "Man kann es mit der Selbstoptimierung auch übertreiben, findest du nicht?", en: "You can also overdo it with self-optimisation, don't you think?" },
      { de: "Unterm Strich neige ich zu der Auffassung, dass …", en: "On balance I lean towards the view that …" },
    ],

    // Barbara's regimen was pure assertion, so the learner could only agree or object in the
    // abstract. These give them something to weigh: 40 minutes a day, two kilos, and the
    // once-a-month exception she does not volunteer -- which is the concrete material task 5
    // ("qualify her thesis") always lacked. One task, no new phrases.
    facts: [
      "Du machst das seit drei Jahren, seit deine Mutter eine Diagnose bekam und ihr die Ernährung umgestellt habt.",
      "Du wiegst jede Zutat und führst ein Ernährungstagebuch. Das kostet dich etwa 40 Minuten am Tag.",
      "Heute auf dem Tisch: Linsensalat mit Ziegenkäse (520 Kalorien), Brot vom Bäcker nebenan, Eier von einem Hof im Nachbardorf.",
      "Einmal im Monat isst du bewusst, ohne zu wiegen, meistens sonntags. Darüber sprichst du nicht gern, aber du gibst es auf direkte Nachfrage ehrlich zu.",
      "Gebracht hat es dir zwei Kilo weniger und besseren Schlaf. Mehr behauptest du nicht.",
    ],
    askables: [
      {
        de: "Seit wann machst du das?",
        en: "How long have you been doing this?",
        answer: "Seit drei Jahren, seit der Diagnose meiner Mutter.",
      },
      {
        de: "Wie viel Zeit kostet dich das am Tag?",
        en: "How much time does that cost you a day?",
        answer: "Etwa 40 Minuten, mit dem Wiegen und dem Ernährungstagebuch.",
      },
      {
        de: "Was ist heute genau auf dem Tisch?",
        en: "What exactly is on the table today?",
        answer: "Linsensalat mit Ziegenkäse, 520 Kalorien. Dazu Brot vom Bäcker nebenan und Eier vom Hof im Nachbardorf.",
      },
      {
        de: "Machst du das wirklich jeden Tag?",
        en: "Do you really do this every day?",
        answer: "Gib zu, dass du einmal im Monat ohne Wiegen isst, meistens sonntags. Sag es ehrlich, aber ungern.",
      },
      {
        de: "Und was hat es dir gebracht?",
        en: "And what has it done for you?",
        answer: "Zwei Kilo weniger und besseren Schlaf. Mehr behaupte ich nicht.",
      },
    ],

    system: `Du bist Barbara, eine Freundin des Nutzers, und du hast ihn zum Abendessen eingeladen.
Der Nutzer übt Deutsch und sitzt mit dir am Tisch.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Du hast dein Essen total im Griff: du wiegst die Zutaten, zählst Kalorien, kennst jeden Nährwert
und kaufst nur bio, fair und regional. Du bist warmherzig und völlig überzeugt, nie aggressiv.
Erzähle stolz, was auf dem Tisch steht ("Der Tisch ist schon gedeckt.", "Die Eier sind von
glücklichen Hühnern gelegt.", "Das Brot ist mit viel Liebe gebacken."), damit der Nutzer
auf Zustandspassiv und Passiv mit von und durch trifft.
Frag den Nutzer früh, welcher Esstyp er ist: Genießer, Zweckesser, Frustesser oder Gesundesser.
Vertritt klare Thesen ("Wer seinen Körper kennt, lebt länger." / "Bauchgefühl ist keine Ernährung."),
damit der Nutzer Argumente nennen, einschränken, zustimmen oder widersprechen muss.
Nimm ein bloßes "ja, stimmt" nicht an: frag dann nach ("Und was spricht dagegen?").
Wie viel Zeit dich das kostet, seit wann du es machst, was es gebracht hat und dass du
einmal im Monat aussetzt, erzählst du nicht von selbst. Antworte darauf erst auf Nachfrage,
und dann ehrlich. Fragt der Nutzer nie nach, sag einmal: "Du fragst gar nicht, was mich das
eigentlich kostet."
Das Gespräch läuft auf B2-Niveau: Verlange differenzierte, gut begründete Antworten und gib dich nie mit einem Satz zufrieden.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zu seinem klaren Urteil.`,
  },
  {
    id: "restaurant",
    category: "Essen",
    level: "A2",
    locked: true,
    photo: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=70",
    title: "Im Restaurant bestellen",
    desc: "Bestelle Essen und Getränke bei der Bedienung.",
    place: "Du bist in einem Restaurant in Deutschland.",
    placeEn: "You are in a restaurant in Germany.",
    goal: "Bekomme einen Tisch, wähle Essen und Getränke und verlange am Ende die Rechnung.",
    goalEn: "Get a table, choose food and drinks, and ask for the bill at the end.",
    // Transactional like fahrkarte, not a Kursbuch lesson: `phrases` here are useful
    // sentences rather than Kommunikation boxes, so the questions go in and are measured.
    tasks: [
      "Frag nach einem Tisch",
      "Frag nach der Karte: Empfehlung, Tagesgericht oder was es vegetarisch gibt",
      "Bestelle Essen und Getränke",
      "Frag nach dem Preis oder danach, wie du zahlen kannst",
      "Verlange die Rechnung",
    ],
    tasksEn: [
      "Ask for a table",
      "Ask about the menu: a recommendation, the dish of the day, or what is vegetarian",
      "Order food and drinks",
      "Ask what it costs, or how you can pay",
      "Ask for the bill",
    ],
    vocab: [
      { de: "die Speisekarte", en: "the menu" },
      { de: "die Vorspeise", en: "the starter" },
      { de: "das Hauptgericht", en: "the main course" },
      { de: "die Nachspeise", en: "the dessert" },
      { de: "die Rechnung", en: "the bill" },
      { de: "das Trinkgeld", en: "the tip" },
      { de: "die Bedienung", en: "the waiter/waitress" },
      { de: "reserviert", en: "reserved" },
      { de: "das Tagesgericht", en: "the dish of the day" },
      { de: "vegetarisch", en: "vegetarian" },
    ],
    phrases: [
      { de: "Einen Tisch für zwei, bitte.", en: "A table for two, please." },
      { de: "Ich hätte gern …", en: "I would like …" },
      { de: "Was können Sie empfehlen?", en: "What can you recommend?" },
      { de: "Zum Trinken nehme ich …", en: "To drink I'll have …" },
      { de: "Die Rechnung, bitte.", en: "The bill, please." },
      { de: "Was ist das Tagesgericht?", en: "What is the dish of the day?" },
      { de: "Haben Sie etwas Vegetarisches?", en: "Do you have anything vegetarian?" },
      { de: "Was kostet das?", en: "How much is that?" },
      { de: "Kann ich mit Karte zahlen?", en: "Can I pay by card?" },
    ],

    // The menu, so the waiter cannot invent a different price two turns later.
    facts: [
      "Tagesgericht: Rinderroulade mit Rotkohl und Klößen, 14,50 Euro.",
      "Vorspeisen: Tomatensuppe 4,50 Euro, gemischter Salat 5,90 Euro.",
      "Hauptgerichte: Schnitzel mit Pommes 12,90 Euro, Maultaschen 11,50 Euro, Gemüsepfanne 10,90 Euro.",
      "Nachspeisen: Apfelstrudel 5,50 Euro, Eis mit Sahne 4,20 Euro.",
      "Getränke: Apfelschorle 3,20 Euro, Bier 0,5 l 4,10 Euro, Wasser 2,50 Euro.",
      "Vegetarisch ist nur die Gemüsepfanne. Die Maultaschen enthalten Fleisch — sag das, wenn jemand sie für vegetarisch hält.",
      "Die Küche schließt um 22 Uhr. Karte und bar werden akzeptiert.",
    ],
    askables: [
      {
        de: "Was können Sie empfehlen?",
        en: "What can you recommend?",
        answer: "Das Tagesgericht: Rinderroulade mit Rotkohl und Klößen.",
      },
      {
        de: "Was ist das Tagesgericht?",
        en: "What is the dish of the day?",
        answer: "Rinderroulade mit Rotkohl und Klößen, 14,50 Euro.",
      },
      {
        de: "Haben Sie etwas Vegetarisches?",
        en: "Do you have anything vegetarian?",
        answer: "Die Gemüsepfanne für 10,90 Euro. Die Maultaschen sind leider mit Fleisch.",
      },
      {
        de: "Was kostet das?",
        en: "How much is that?",
        answer: "Nenne den Preis des Gerichts, nach dem gefragt wurde, genau wie in der Karte.",
      },
      {
        de: "Kann ich mit Karte zahlen?",
        en: "Can I pay by card?",
        answer: "Ja, Karte und bar gehen beide.",
      },
    ],

    system: `Du bist eine Bedienung in einem Restaurant in Deutschland.
Der Nutzer übt Deutsch und will einen Tisch, Essen und Getränke bestellen und am Ende zahlen.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Passe dein Niveau leicht an den Nutzer an, aber vereinfache nicht zu sehr.

Du kennst die Karte, der Gast nicht. Lies sie nie von dir aus vor und nenne keinen Preis,
nach dem niemand gefragt hat. Sag höchstens: "Hier ist die Karte. Was möchten Sie wissen?"
Beantworte immer nur die Frage, die gestellt wurde.
Bestellt der Gast, ohne nach irgendetwas gefragt zu haben, frag einmal zurück:
"Möchten Sie wissen, was wir heute empfehlen?" Bleibt er dabei, nimm die Bestellung auf.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zur Bezahlung.`,
  },
  {
    id: "arzt",
    category: "Gesundheit",
    level: "B1",
    locked: true,
    photo: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=70",
    title: "Beim Arzt",
    desc: "Beschreibe deine Beschwerden in der Arztpraxis.",
    place: "Du bist bei einem Arztbesuch in Deutschland.",
    placeEn: "You are at a doctor's appointment in Germany.",
    goal: "Beschreibe deine Symptome, beantworte die Fragen des Arztes und verstehe den Rat.",
    goalEn: "Describe your symptoms, answer the doctor's questions, and understand the advice.",
    // Transactional like fahrkarte: `phrases` are useful sentences, not Kommunikation
    // boxes, so the questions go in and the measured vocabulary score rewards asking.
    tasks: [
      "Beschreibe deine Symptome",
      "Beantworte die Fragen des Arztes",
      "Frag nach der Diagnose",
      "Frag nach der Behandlung: Medikament, Dosierung oder Krankschreibung",
      "Fass den Rat am Ende in eigenen Worten zusammen",
    ],
    tasksEn: [
      "Describe your symptoms",
      "Answer the doctor's questions",
      "Ask what the diagnosis is",
      "Ask about the treatment: medication, dosage, or being signed off sick",
      "Sum the advice back up in your own words at the end",
    ],
    vocab: [
      { de: "die Beschwerden", en: "the symptoms/complaints" },
      { de: "die Schmerzen", en: "the pain" },
      { de: "das Fieber", en: "the fever" },
      { de: "die Erkältung", en: "the cold" },
      { de: "das Rezept", en: "the prescription" },
      { de: "die Krankenkasse", en: "the health insurance" },
      { de: "die Überweisung", en: "the referral" },
      { de: "krankgeschrieben", en: "signed off sick" },
      { de: "die Diagnose", en: "the diagnosis" },
      { de: "die Tablette", en: "the tablet" },
    ],
    phrases: [
      { de: "Ich fühle mich nicht gut.", en: "I don't feel well." },
      { de: "Ich habe seit gestern Schmerzen.", en: "I've had pain since yesterday." },
      { de: "Es tut hier weh.", en: "It hurts here." },
      { de: "Müssen Sie mir etwas verschreiben?", en: "Do you need to prescribe me something?" },
      { de: "Wie oft soll ich das nehmen?", en: "How often should I take this?" },
      { de: "Was habe ich denn?", en: "So what is wrong with me?" },
      { de: "Schreiben Sie mich krank?", en: "Are you signing me off sick?" },
      { de: "Was soll ich sonst noch beachten?", en: "What else should I be careful about?" },
    ],

    // The diagnosis and everything after it. A doctor who invents a different dosage on the
    // second telling is teaching the patient not to listen.
    facts: [
      "Die Untersuchung ergibt einen grippalen Infekt, keine Grippe. Ein Antibiotikum ist nicht nötig.",
      "Du verschreibst ein Schmerzmittel: dreimal täglich eine Tablette nach dem Essen, höchstens fünf Tage.",
      "Du schreibst den Patienten drei Tage krank. Auf Nachfrage gehen auch fünf Tage.",
      "Eine Überweisung zum HNO-Arzt gibt es nur, wenn es nach einer Woche nicht besser ist.",
      "Das Rezept kostet 5 Euro Zuzahlung in der Apotheke.",
      "Dein Rat: viel trinken, mindestens zwei Liter am Tag, und diese Woche keinen Sport.",
    ],
    askables: [
      {
        de: "Was habe ich denn?",
        en: "So what is wrong with me?",
        answer: "Ein grippaler Infekt, keine Grippe. Ein Antibiotikum brauchen Sie nicht.",
      },
      {
        de: "Müssen Sie mir etwas verschreiben?",
        en: "Do you need to prescribe me something?",
        answer: "Ein Schmerzmittel. Das Rezept kostet 5 Euro Zuzahlung.",
      },
      {
        de: "Wie oft soll ich das nehmen?",
        en: "How often should I take this?",
        answer: "Dreimal täglich eine Tablette nach dem Essen, höchstens fünf Tage.",
      },
      {
        de: "Schreiben Sie mich krank?",
        en: "Are you signing me off sick?",
        answer: "Drei Tage. Wenn der Patient nach mehr fragt, auch fünf.",
      },
      {
        de: "Was soll ich sonst noch beachten?",
        en: "What else should I be careful about?",
        answer: "Viel trinken, mindestens zwei Liter am Tag, und diese Woche keinen Sport.",
      },
    ],

    system: `Du bist ein Arzt/eine Ärztin in einer Praxis in Deutschland.
Der Nutzer übt Deutsch und kommt als Patient mit Beschwerden.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Stelle zuerst Fragen zu den Symptomen: seit wann, wo genau, Fieber.
Passe dein Niveau leicht an den Nutzer an, aber vereinfache nicht zu sehr.

Die Diagnose, das Medikament, die Dosierung und die Krankschreibung kennst nur du.
Nenne sie nicht alle auf einmal und nicht von selbst: sag nach der Untersuchung nur
"Ich habe mir das angesehen." und warte, bis der Patient fragt. Beantworte dann genau
die eine Frage. Fragt er nach nichts, sag einmal: "Möchten Sie wissen, was Sie haben?"
Wenn der Nutzer stockt, hilf freundlich weiter.`,
  },
];

export const byId = (id) => scenarios.find((s) => s.id === id);
