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
    goal: "Kaufe eine Zugfahrkarte in eine Stadt deiner Wahl.",
    goalEn: "Buy a train ticket to a city of your choice.",
    tasks: ["Sag, wohin du willst", "Frag nach Uhrzeit und Preis", "Schließe den Kauf ab"],
    tasksEn: ["Say where you want to go", "Ask about time and price", "Complete the purchase"],
    vocab: [
      { de: "die Fahrkarte", en: "the ticket" },
      { de: "der Bahnsteig", en: "the platform" },
      { de: "die Hinfahrt", en: "the outbound trip" },
      { de: "die Rückfahrt", en: "the return trip" },
      { de: "einfach", en: "one-way" },
      { de: "hin und zurück", en: "round trip" },
      { de: "der Zuschlag", en: "the surcharge" },
      { de: "umsteigen", en: "to change trains" },
    ],
    phrases: [
      { de: "Ich möchte eine Fahrkarte nach …", en: "I would like a ticket to …" },
      { de: "Einfach oder hin und zurück?", en: "One-way or round trip?" },
      { de: "Wann fährt der nächste Zug?", en: "When does the next train leave?" },
      { de: "Was kostet das?", en: "How much is it?" },
      { de: "Muss ich umsteigen?", en: "Do I have to change trains?" },
    ],
    system: `Du bist ein Schalterbeamter am Bahnhof in Deutschland.
Der Nutzer übt Deutsch und will eine Zugfahrkarte kaufen.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Passe dein Niveau leicht an den Nutzer an, aber vereinfache nicht zu sehr.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zum Kauf.`,
  },
  {
    id: "coaching",
    category: "Beruf",
    level: "B1",
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
      "Erzähle, woran du beruflich gescheitert bist",
      "Wäge eine Eigenschaft ab: einerseits eine Stärke, andererseits eine Schwäche",
      "Widersprich Milo höflich und schränke sein Argument ein",
      "Fasse einen Entschluss und nenne ein neues Ziel",
    ],
    tasksEn: [
      "Say what you failed at professionally",
      "Weigh up one trait: a strength on one hand, a weakness on the other",
      "Disagree with Milo politely and qualify his argument",
      "Make a decision and name a new goal",
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
    // The "Argumente einschränken" set: qualifying an argument instead of flatly agreeing
    // or disagreeing. Saying these is what the challenge is for, so they are also the
    // target phrases the score measures against the transcript.
    phrases: [
      { de: "Einerseits ist es positiv, dass …, andererseits ist es problematisch, wenn …", en: "On the one hand it is good that …, on the other hand it is a problem when …" },
      { de: "Man kann zwar sagen, dass …, allerdings muss man auch bedenken, dass …", en: "You can certainly say that …, however you also have to consider that …" },
      { de: "Im Prinzip ist es von Vorteil, dass …, trotzdem darf man nicht vergessen, dass …", en: "In principle it is an advantage that …, still you must not forget that …" },
      { de: "Das stimmt schon, aber so einfach ist das leider nicht.", en: "That is true, but unfortunately it is not that simple." },
      { de: "Kritisch wird es aber, wenn …", en: "It gets critical though when …" },
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
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zu einem neuen Ziel.`,
  },
  {
    id: "minimalismus",
    category: "Konsum",
    level: "B1",
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
      "Sag, wie du dich in einer fast leeren Wohnung fühlen würdest, und warum",
      "Nenne drei Dinge, auf die du verzichten könntest, und begründe es",
      "Schränke Sabrinas Argument ein, statt einfach zuzustimmen",
      "Entscheide dich für eine Entrümpelungsmethode und begründe die Wahl",
    ],
    tasksEn: [
      "Say how you would feel in an almost empty flat, and why",
      "Name three things you could do without, and say why",
      "Qualify Sabrina's argument instead of simply agreeing",
      "Choose a decluttering method and justify the choice",
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
    // The three Kommunikation boxes of the lesson, in the order the tasks ask for them.
    // These are also the target phrases the score measures against the transcript, so
    // saying them is worth points and not only style.
    phrases: [
      { de: "Ich persönlich würde mich wohlfühlen, weil …", en: "Personally I would feel comfortable, because …" },
      { de: "Was mir auf jeden Fall fehlen würde, wäre …", en: "What I would definitely miss would be …" },
      { de: "Also, ich könnte auf … verzichten. Den brauche ich sowieso nicht.", en: "Well, I could do without … I do not need it anyway." },
      { de: "Die Anzahl meiner … könnte ich reduzieren.", en: "I could reduce the number of my …" },
      { de: "Ich denke zwar auch, dass …, das heißt jedoch nicht, dass …", en: "I do think as well that …, that does not mean however that …" },
      { de: "Es stimmt zwar, dass …, aber entscheidend ist für mich, dass …", en: "It is true that …, but what is decisive for me is that …" },
    ],

    system: `Du bist Sabrina Krause, Minimalismus-Bloggerin und Hostin des Podcasts „so einfach“.
Der Nutzer übt Deutsch und ist heute dein Gast im Podcast.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Du bist locker, konkret und neugierig, und du fragst wie im Podcast: erst das Gefühl, dann die Dinge, dann die Methode.
Frag nach Gegenständen, nicht nach Theorie ("Was liegt bei dir seit Jahren ungenutzt herum?").
Widersprich dem Nutzer mindestens einmal freundlich ("Aber Dinge erzählen doch Geschichten." / "Ohne Auto geht es nicht."),
damit er sein Argument einschränken muss statt nur zuzustimmen.
Stell am Ende die drei Methoden vor: Korb-Methode, Karton-Methode, Drei-Kisten-Methode.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zu einer Entscheidung.`,
  },
  {
    id: "innereuhr",
    category: "Wissenschaft",
    level: "B1",
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
      "Beschreibe deine Tageskurve: wo das größte Hoch liegt und wann die Kurve sinkt",
      "Sag, was dich an der Forschung zur inneren Uhr überrascht hat",
      "Gib dein Wissen über Schlaftypen wieder und vergleiche dich mit anderen",
      "Vermute, welche der drei Meldungen eine Falschmeldung ist, und begründe es",
      "Stell ein Problem der Schichtarbeit dar und dann eine Erfindung dagegen",
    ],
    tasksEn: [
      "Describe your daily curve: where the biggest peak is and when the curve falls",
      "Say what surprised you about the research on the body clock",
      "Relay what you know about sleep types and compare yourself with others",
      "Guess which of the three news items is fake, and say why",
      "Present a problem of shift work, then an invention that answers it",
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
    // The four Kommunikation boxes of the lesson, in the order the tasks ask for them.
    // These are also the target phrases the score measures against the transcript, so
    // saying them is worth points and not only style.
    phrases: [
      { de: "Wie das Schaubild zeigt, …", en: "As the chart shows, …" },
      { de: "Mein größtes Hoch habe ich am …", en: "My biggest peak is in the …" },
      { de: "Ab … sinkt die Kurve, und das größte Tief kommt am …", en: "From … the curve falls, and the biggest low comes in the …" },
      { de: "Überraschend war für mich vor allem, dass …", en: "What surprised me most was that …" },
      { de: "Mich hat überrascht, dass …", en: "It surprised me that …" },
      { de: "Soviel ich weiß, hängt das mit … zusammen.", en: "As far as I know, that has to do with …" },
      { de: "Unbestritten ist auf jeden Fall, dass …", en: "What is undisputed in any case is that …" },
      { de: "Ich könnte mir vorstellen, dass …, weil …", en: "I could imagine that …, because …" },
      { de: "Das kommt mir unglaubwürdig vor. Ich würde vermuten, dass …", en: "That seems implausible to me. I would guess that …" },
      { de: "Für viele ist es problematisch, wenn …", en: "For many people it is a problem when …" },
      { de: "… macht vielen Menschen große Schwierigkeiten.", en: "… causes many people big difficulties." },
      { de: "Bei … handelt es sich um …", en: "… is a …" },
      { de: "Ein besonderes Merkmal ist, dass …", en: "A special feature is that …" },
    ],

    system: `Du bist Jule Bergmann, Moderatorin der Radiosendung „Neues aus der Forschung“ auf @radio9.
Der Nutzer übt Deutsch und ist heute dein Studiogast zum Thema innere Uhr.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Du bist wach, freundlich und neugierig und moderierst zügig: eine Frage, dann Nachhaken.
Führe die Sendung in dieser Reihenfolge:
1. die Tageskurve des Gastes (frag nach Uhrzeiten: "Wann genau steigt Ihre Kurve?"),
2. die Studie von Dr. Sabine Möllenkamp über Licht und Schlaftypen (frag, was überrascht hat),
3. Schlaftypen: Frühaufsteher, Langschläfer, Normaltyp (verlange einen Vergleich mit anderen Menschen),
4. drei Meldungen aus der Wissenschaft, die du selbst vorliest: ein Haus aus Glas auf Island,
   eine Spezialbrille gegen blaues Licht, eine Pille gegen Müdigkeit statt Schlafmittel.
   Sag, eine davon sei erfunden, und lass den Gast vermuten und begründen.
5. Schichtarbeit: frag nach dem Problem und danach nach einer eigenen Erfindung dagegen.
Akzeptiere kein bloßes "morgens bin ich fit": frag nach Hoch, Tief und Uhrzeit.
Widersprich dem Gast mindestens einmal freundlich ("Licht ändert doch nichts an den Genen."),
damit er sein Wissen begründet statt nur zuzustimmen.
Wenn der Nutzer stockt, hilf freundlich weiter. Führe das Gespräch bis zur Erfindung.`,
  },
  {
    id: "esstyp",
    category: "Essen",
    level: "B1",
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
      "Sag, welcher Esstyp du bist, und beschreibe deine Essgewohnheiten",
      "Drück Verständnis für Barbaras Kontrolle aus",
      "Drück an einer Stelle Unverständnis oder Gleichgültigkeit aus",
      "Nenne ein Argument und ein Gegenargument zum Kontrollieren des Essverhaltens",
      "Schränke Barbaras Argument ein und sag klar, ob du zustimmst oder widersprichst",
    ],
    tasksEn: [
      "Say which eating type you are, and describe your eating habits",
      "Express understanding for Barbara's control",
      "At some point express a lack of understanding, or indifference",
      "Name an argument and a counter-argument about controlling what you eat",
      "Qualify Barbara's argument and say clearly whether you agree or disagree",
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
    // The Kommunikation boxes of the lesson: Verständnis, Unverständnis, Gleichgültigkeit
    // (S. 40) and the argument set of the Kommentar (S. 41). These are the target phrases
    // the score measures against the transcript, so saying them is worth points.
    phrases: [
      { de: "Bis zu einem gewissen Grad kann ich verstehen, dass …", en: "Up to a point I can understand that …" },
      { de: "Ich habe Verständnis dafür, dass …", en: "I do have sympathy for the fact that …" },
      { de: "Das geht einfach zu weit.", en: "That simply goes too far." },
      { de: "Man kann es auch übertreiben.", en: "You can also overdo it." },
      { de: "Wenn ich ehrlich bin, ist mir das ziemlich egal.", en: "If I am honest, I do not really care." },
      { de: "Wenn sie es glücklich macht!", en: "If it makes her happy!" },
      { de: "Ein wichtiges Argument dafür ist, dass …", en: "An important argument for it is that …" },
      { de: "Ein weiteres Argument dagegen ist, dass …", en: "A further argument against it is that …" },
      { de: "Zwar hat sie recht, wenn sie sagt, dass …", en: "She is right when she says that …" },
      { de: "Das ist allerdings nicht ganz richtig, denn …", en: "That is however not quite right, because …" },
      { de: "Stimme voll und ganz zu.", en: "I agree completely." },
      { de: "Bin komplett dagegen.", en: "I am completely against it." },
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
    tasks: ["Frag nach einem Tisch", "Bestelle Essen und Getränke", "Verlange die Rechnung"],
    tasksEn: ["Ask for a table", "Order food and drinks", "Ask for the bill"],
    vocab: [
      { de: "die Speisekarte", en: "the menu" },
      { de: "die Vorspeise", en: "the starter" },
      { de: "das Hauptgericht", en: "the main course" },
      { de: "die Nachspeise", en: "the dessert" },
      { de: "die Rechnung", en: "the bill" },
      { de: "das Trinkgeld", en: "the tip" },
      { de: "die Bedienung", en: "the waiter/waitress" },
      { de: "reserviert", en: "reserved" },
    ],
    phrases: [
      { de: "Einen Tisch für zwei, bitte.", en: "A table for two, please." },
      { de: "Ich hätte gern …", en: "I would like …" },
      { de: "Was können Sie empfehlen?", en: "What can you recommend?" },
      { de: "Zum Trinken nehme ich …", en: "To drink I'll have …" },
      { de: "Die Rechnung, bitte.", en: "The bill, please." },
    ],
    system: `Du bist eine Bedienung in einem Restaurant in Deutschland.
Der Nutzer übt Deutsch und will einen Tisch, Essen und Getränke bestellen und am Ende zahlen.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Passe dein Niveau leicht an den Nutzer an, aber vereinfache nicht zu sehr.
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
    tasks: ["Beschreibe deine Symptome", "Beantworte die Fragen", "Verstehe den Rat"],
    tasksEn: ["Describe your symptoms", "Answer the questions", "Understand the advice"],
    vocab: [
      { de: "die Beschwerden", en: "the symptoms/complaints" },
      { de: "die Schmerzen", en: "the pain" },
      { de: "das Fieber", en: "the fever" },
      { de: "die Erkältung", en: "the cold" },
      { de: "das Rezept", en: "the prescription" },
      { de: "die Krankenkasse", en: "the health insurance" },
      { de: "die Überweisung", en: "the referral" },
      { de: "krankgeschrieben", en: "signed off sick" },
    ],
    phrases: [
      { de: "Ich fühle mich nicht gut.", en: "I don't feel well." },
      { de: "Ich habe seit gestern Schmerzen.", en: "I've had pain since yesterday." },
      { de: "Es tut hier weh.", en: "It hurts here." },
      { de: "Müssen Sie mir etwas verschreiben?", en: "Do you need to prescribe me something?" },
      { de: "Wie oft soll ich das nehmen?", en: "How often should I take this?" },
    ],
    system: `Du bist ein Arzt/eine Ärztin in einer Praxis in Deutschland.
Der Nutzer übt Deutsch und kommt als Patient mit Beschwerden.
Bleib immer in der Rolle. Sprich nur Deutsch, in kurzen, natürlichen Sätzen (max. 2 Sätze).
Stelle Fragen zu den Symptomen und gib am Ende einen einfachen Rat.
Passe dein Niveau leicht an den Nutzer an, aber vereinfache nicht zu sehr.
Wenn der Nutzer stockt, hilf freundlich weiter.`,
  },
];

export const byId = (id) => scenarios.find((s) => s.id === id);
