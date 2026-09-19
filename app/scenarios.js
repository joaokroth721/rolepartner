// Single source of truth for practice scenarios, imported by the client (menu + labels)
// and the API route (system prompt). Add a new scenario here and it shows up in both.
export const scenarios = [
  {
    id: "fahrkarte",
    category: "Reisen",
    level: "A2",
    featured: true,
    photo: "https://images.unsplash.com/photo-1775114545176-23a9801c8b9c?w=600&q=70",

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
