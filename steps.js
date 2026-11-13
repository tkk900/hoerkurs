/* What a lesson says, in order. Shared by the app (listen/app.html) and tools/record-listen.js,
   so the recorded clips always match the lines the app plays. Do not add page code here. */
(function (root) {
  "use strict";
  const words = (s) => s.trim().split(/\s+/).length;
  const same = (a, b) => a.toLowerCase().replace(/[^\p{L}\d]/gu, "") === b.toLowerCase().replace(/[^\p{L}\d]/gu, "");
  const NUM = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig", "einundzwanzig", "zweiundzwanzig", "dreiundzwanzig", "vierundzwanzig", "fünfundzwanzig", "sechsundzwanzig", "siebenundzwanzig", "achtundzwanzig"];

  /* set: { rate, gaps, words, review }. Each spoken step has k ("de" or "en"), text, and f, its pace
     compared with the chosen speed (0.8 = slower); rate = set.rate × f. */
  function buildSteps(lesson, set) {
    const r = set.rate, steps = [];
    const repeatGap = (text) => Math.min(7000, Math.max(1600, words(text) * 600)) * set.gaps / r;
    const add = (s) => steps.push(s.k === "de" || s.k === "en" ? { ...s, rate: r * s.f } : s);
    add({ k: "tone", t: "new", it: -1, label: "Lesson start" });
    add({ k: "de", text: `Lektion ${NUM[lesson.n] || lesson.n}. ${lesson.t}.`, f: 0.95, it: -1, label: lesson.t });
    add({ k: "en", text: `Lesson ${lesson.n}. ${lesson.te}.`, f: 1, it: -1, label: lesson.te });
    add({ k: "gap", ms: 700, it: -1, label: lesson.te });
    lesson.items.forEach((item, it) => {
      add({ k: "tone", t: "new", it, label: "New word" });
      add({ k: "de", text: item.w, f: 0.9, it, label: "New word" });
      add({ k: "gap", ms: 450, it, label: "New word" });
      add({ k: "en", text: item.m, f: 1, it, label: "Meaning" });
      add({ k: "gap", ms: 450, it, label: "Meaning" });
      add({ k: "de", text: item.w, f: 0.9, it, label: "Say it" });
      add({ k: "gap", ms: repeatGap(item.w), it, label: "Your turn: say the word" });
      if (set.words && item.p) {
        item.p.forEach(([de, en], j) => {
          const label = `Word by word · ${j + 1} of ${item.p.length}`;
          add({ k: "de", text: de, f: 0.85, it, label });
          if (!same(de, en)) { add({ k: "gap", ms: 250, it, label }); add({ k: "en", text: en, f: 1.05, it, label }); }
          add({ k: "gap", ms: 400, it, label });
        });
      }
      add({ k: "de", text: item.x, f: 0.8, it, label: "Whole sentence, slowly" });
      if (item.xe) { add({ k: "gap", ms: 400, it, label: "In English" }); add({ k: "en", text: item.xe, f: 1, it, label: "In English" }); }
      add({ k: "gap", ms: 600, it, label: "Whole sentence" });
      add({ k: "de", text: item.x, f: 1, it, label: "Whole sentence" });
      add({ k: "gap", ms: repeatGap(item.x), it, label: "Your turn: say the sentence" });
    });
    if (set.review) {
      const it = lesson.items.length;
      add({ k: "tone", t: "review", it, label: "Review" });
      add({ k: "en", text: "Review. You hear the English. Say the German word before you hear it.", f: 1, it, label: "Review" });
      add({ k: "gap", ms: 800, it, label: "Review" });
      lesson.items.forEach((item, i) => {
        const label = `Review · ${i + 1} of ${lesson.items.length}`;
        add({ k: "en", text: item.m, f: 1, it, label, ri: i });
        add({ k: "gap", ms: 3200 * set.gaps / r, it, label: "Say it in German", ri: i });
        add({ k: "de", text: item.w, f: 0.9, it, label, ri: i });
        add({ k: "gap", ms: 900, it, label, ri: i });
      });
    }
    add({ k: "tone", t: "done", it: lesson.items.length + 1, label: "Lesson complete" });
    add({ k: "de", text: "Sehr gut! Die Lektion ist fertig.", f: 0.95, it: lesson.items.length + 1, label: "Lesson complete" });
    return steps;
  }

  /* Recorded clips. German is recorded at its own pace (f), so slow sentences sound natural rather than
     stretched; English is recorded at normal pace and sped up slightly where f is above 1.
     A clip's file name comes from the voice, the pace and the text, so a new voice or wording gives new files. */
  const recPace = (k, f) => (k === "de" ? f : 1);
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  /* audio: { voices: { de, en }, ext }. Returns the clip's path, for example "audio/de/1x2y3z.ogg". */
  function clipPath(audio, step) {
    const pace = recPace(step.k, step.f);
    return `audio/${step.k}/${hash(`${audio.voices[step.k]}|${pace}|${step.text}`)}.${audio.ext}`;
  }
  /* Every clip a lesson can play, whatever the learner's settings. */
  function lessonClips(lesson) {
    return buildSteps(lesson, { rate: 1, gaps: 1, words: true, review: true }).filter((s) => s.k === "de" || s.k === "en");
  }

  root.HK = { buildSteps, recPace, clipPath, lessonClips, words };
})(typeof window !== "undefined" ? window : globalThis);
