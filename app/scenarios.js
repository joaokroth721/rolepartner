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
