// English Club 8 – komplettes Rollenspiel: hören → antworten → hören → antworten …
// Konfiguration im HTML:
//   window.ROLEPLAY = { mount: "#roleplay", role: "Waiter", turns: [ { say, hint, model } ] }
// Es wird nichts verschickt und nichts gespeichert; Aufnahmen bleiben nur im Arbeitsspeicher.
(function () {
  const R = window.ROLEPLAY;
  if (!R || !Array.isArray(R.turns) || !R.turns.length) return;
  const mount = document.querySelector(R.mount || "#roleplay");
  if (!mount) return;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const shuffle = (a) => { const b = a.slice(); for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; } return b; };
  const canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const total = R.turns.length;
  const roleName = R.role || "Waiter";
  const audioDir = R.audioDir || "";

  // ---------- Vorlesen (Gerätestimme, offline) ----------
  function enVoices() {
    if (!("speechSynthesis" in window)) return [];
    const vs = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    return vs.sort((a, b) => {
      const pref = (x) => (/en[-_]US/i.test(x.lang) ? 0 : 1) + (/Samantha|Google US|Aria|Jenny/i.test(x.name) ? -1 : 0);
      return pref(a) - pref(b);
    });
  }
  let noTts = false;
  function noteNoTts() {
    if (noTts) return;
    noTts = true;
    mount.prepend(el("p", "hint", "Dein Gerät kann leider nicht vorlesen. Lies die Sätze mit einem Partner laut."));
  }
  // parts: "Satz" oder [["A","Satz"],["B","Satz"], …] – A = Kellner, B = du
  function speak(parts, rate) {
    if (!("speechSynthesis" in window)) { noteNoTts(); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    const vs = enVoices();
    (Array.isArray(parts) ? parts : [["A", parts]]).forEach(([who, line]) => {
      const u = new SpeechSynthesisUtterance(line);
      const v = who === "B"
        ? (vs.find((x) => vs[0] && x.name !== vs[0].name && /en[-_]US/i.test(x.lang)) || vs[1] || vs[0])
        : vs[0];
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
      u.rate = rate || 0.9;
      u.pitch = who === "B" && (!v || !vs[0] || v.name === vs[0].name) ? 1.35 : 1;
      synth.speak(u);
    });
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  // ---------- Audiodateien (edge-tts) mit Gerätestimme als Fallback ----------
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  let currentAudio = null;

  function fileFor(i, who) {
    return audioDir ? audioDir + pad2(i + 1) + "-" + who + ".mp3" : null;
  }

  function stopAudio() {
    if (!currentAudio) return;
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) {}
    currentAudio = null;
  }

  function playFile(url, rate) {
    return new Promise((resolve, reject) => {
      if (!url || typeof Audio !== "function") { reject(new Error("kein Audio")); return; }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      stopAudio();
      let a;
      try { a = new Audio(url); } catch (e) { reject(e); return; }
      currentAudio = a;
      a.playbackRate = rate || 1;
      if ("preservesPitch" in a) a.preservesPitch = true;
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        if (currentAudio === a) currentAudio = null;
        if (ok) resolve(true); else reject(new Error("Audio nicht abspielbar"));
      };
      a.onended = () => done(true);
      a.onerror = () => done(false);
      const p = a.play();
      if (p && typeof p.catch === "function") p.catch(() => done(false));
    });
  }

  function playSay(i, rate) {
    return playFile(fileFor(i, "waiter"), rate).catch(() => {
      speak([["A", R.turns[i].say]], rate && rate < 1 ? 0.6 : 0.9);
    });
  }

  function playModel(i) {
    return playFile(fileFor(i, "du"), 1).catch(() => speak([["B", R.turns[i].model]], 0.9));
  }

  function playDialog() {
    const all = [];
    R.turns.forEach((t) => { all.push(["A", t.say], ["B", t.model]); });
    if (!audioDir) { speak(all, 0.9); return; }
    let first = true;
    (async () => {
      for (let i = 0; i < total; i++) {
        try {
          await playFile(fileFor(i, "waiter"), 1);
          await playFile(fileFor(i, "du"), 1);
          first = false;
        } catch (e) {
          if (first) speak(all, 0.9);
          return;
        }
      }
    })();
  }

  // ---------- Aufnahme ----------
  let rec = null, stream = null, url = null;
  function stopRec() {
    try { if (rec && rec.state !== "inactive") rec.stop(); } catch (e) {}
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    if (url) URL.revokeObjectURL(url);
    rec = null; stream = null; url = null;
  }

  // ---------- Runden ----------
  let turn = 0;

  // Nur nach oben nachziehen, wenn die Runden-Überschrift schon aus dem Bild ist.
  // Sonst bleibt die Seite genau da stehen, wo geklickt wurde.
  function keepTurnVisible() {
    const head = mount.querySelector(".rp-head");
    if (!head || typeof head.getBoundingClientRect !== "function") return;
    if (head.getBoundingClientRect().top < 0 && typeof head.scrollIntoView === "function") {
      head.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  function render(autoPlay) {
    stopRec();
    stopAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    mount.innerHTML = "";
    const t = R.turns[turn];

    const head = el("div", "rp-head");
    head.append(el("span", "rp-step", "Runde " + (turn + 1) + " von " + total), el("span", "rp-role", roleName));

    const bubble = el("div", "rp-bubble");
    bubble.append(el("span", "rp-bubble-ic", "👨‍🍳"));
    const line = el("p", "rp-line", "🎧 Hör zu und antworte …");
    line.setAttribute("aria-live", "polite");
    bubble.append(line);

    const listen = el("div", "actions");
    const b1 = el("button", "btn listen", "🔊 Anhören"); b1.onclick = () => playSay(turn, 1);
    const b2 = el("button", "btn secondary", "🐢 Langsam"); b2.onclick = () => playSay(turn, 0.75);
    listen.append(b1, b2);

    const hint = el("p", "hint", "Du: " + t.hint);

    // Steuerung „Musterantwort“ und „Weiter“ früh anlegen, damit die Aufnahme sie freischalten kann
    const modelBtn = el("button", "btn secondary", "👀 Musterantwort zeigen");
    const rowModel = el("div", "actions");
    rowModel.append(modelBtn);

    const next = el("button", "btn", turn + 1 === total ? "Rollenspiel abschließen" : "Weiter →");
    next.hidden = true;
    const rowNext = el("div", "actions");
    rowNext.append(next);

    // Aufnahmebox
    const recBox = el("div", "rp-rec");
    if (canRec) {
      const status = el("p", "hint rp-status", "Tippe auf ● und sprich deine Antwort. Tippe auf ■, wenn du fertig bist.");
      const recBtn = el("button", "btn rec", "● Aufnehmen");
      const playBtn = el("button", "btn secondary", "▶ Meine Aufnahme");
      playBtn.disabled = true;
      const audio = el("audio");
      audio.hidden = true;
      const row = el("div", "actions");
      row.append(recBtn, playBtn);
      recBox.append(status, row, audio);

      recBtn.onclick = async () => {
        if (rec && rec.state === "recording") { rec.stop(); return; }
        stopAudio();
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        stopRec();
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          status.textContent = "Das Mikrofon ist nicht erlaubt. Sprich deine Antwort einfach laut.";
          modelBtn.disabled = false;
          return;
        }
        const chunks = [];
        const myRec = new window.MediaRecorder(stream);
        rec = myRec;
        myRec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        myRec.onstop = () => {
          if (stream) stream.getTracks().forEach((tr) => tr.stop());
          stream = null;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(new Blob(chunks, { type: myRec.mimeType || "audio/mp4" }));
          audio.src = url;
          playBtn.disabled = false;
          recBtn.textContent = "● Nochmal aufnehmen";
          recBtn.classList.remove("on");
          status.textContent = "Hör dir deine Aufnahme an und vergleiche mit der Musterantwort.";
          modelBtn.disabled = false;
        };
        myRec.start();
        recBtn.textContent = "■ Stopp";
        recBtn.classList.add("on");
        status.textContent = "Aufnahme läuft … sprich jetzt!";
      };
      playBtn.onclick = () => { audio.currentTime = 0; audio.play(); };
    } else {
      recBox.append(el("p", "hint", "Aufnehmen geht auf diesem Gerät nicht. Sprich deine Antwort einfach laut."));
    }

    // Multiple Choice als Hilfe – erst auf Wunsch sichtbar, damit zuerst gesprochen wird
    let shown = false;
    let choiceBox = null;
    if (Array.isArray(t.options) && t.options.length) {
      choiceBox = el("div", "rp-choice");
      const reveal = el("button", "linkbtn", "Keine Aufnahme? Antwortmöglichkeiten anzeigen");
      const q = el("p", "rp-choice-q", "Wähle die richtige Antwort – nur eine ist fehlerfrei:");
      q.hidden = true;
      const list = el("div", "rp-options");
      list.hidden = true;
      const fb = el("p", "rp-choice-fb");
      fb.hidden = true;
      reveal.onclick = () => {
        reveal.hidden = true;
        q.hidden = false;
        list.hidden = false;
      };
      shuffle([t.model].concat(t.options)).forEach((text) => {
        const b = el("button", "rp-option", text);
        b.onclick = () => {
          if (shown) return;
          if (text === t.model) {
            b.classList.add("right");
            list.querySelectorAll("button").forEach((x) => (x.disabled = true));
            fb.hidden = false;
            fb.className = "rp-choice-fb right";
            fb.textContent = "Richtig!";
            showModel();
          } else {
            b.classList.add("wrong");
            b.disabled = true;
            fb.hidden = false;
            fb.className = "rp-choice-fb wrong";
            fb.textContent = "Noch nicht. Lies die Antwort noch einmal genau.";
          }
        };
        list.append(b);
      });
      choiceBox.append(reveal, q, list, fb);
    }

    // Musterantwort
    const modelBox = el("div", "rp-model");
    modelBox.hidden = true;
    modelBox.append(el("div", "label", "Musterantwort"), el("p", "rp-model-text", t.model));
    const mb = el("button", "btn listen", "🔊 Musterantwort anhören");
    mb.onclick = () => playModel(turn);
    const mActions = el("div", "actions");
    mActions.append(mb);
    modelBox.append(mActions);

    function showModel() {
      if (shown) return;
      shown = true;
      stopRec();
      stopAudio();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      line.textContent = t.say;
      modelBox.hidden = false;
      modelBtn.hidden = true;
      if (choiceBox) choiceBox.hidden = true;
      next.hidden = false;
      next.focus({ preventScroll: true });
    }
    modelBtn.onclick = showModel;
    modelBtn.disabled = canRec; // erst sprechen, dann vergleichen

    next.onclick = () => {
      stopRec();
      turn++;
      if (turn >= total) { renderEnd(); return; }
      render(true);
      keepTurnVisible();
    };

    mount.append(head, bubble, listen, hint, recBox, rowModel);
    if (choiceBox) mount.appendChild(choiceBox);
    mount.append(modelBox, rowNext);
    if (autoPlay) playSay(turn, 1);
  }

  function dialogRow(who, text) {
    const row = el("div", "rp-dialog-row");
    row.append(el("span", "rp-who", who), el("span", null, text));
    return row;
  }

  function renderEnd() {
    stopRec();
    stopAudio();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    mount.innerHTML = "";
    const box = el("div", "rp-end");
    box.append(el("div", "label", "Rollenspiel geschafft"));
    box.append(el("p", "rp-end-title", "Du hast alle " + total + " Runden gesprochen."));

    const dlg = el("div", "rp-dialog");
    R.turns.forEach((t) => {
      dlg.append(dialogRow(roleName, t.say), dialogRow("Du", t.model));
    });
    box.append(dlg);

    const playAll = el("button", "btn listen", "🔊 Ganzen Dialog anhören");
    playAll.onclick = playDialog;
    const rowAll = el("div", "actions");
    rowAll.append(playAll);
    box.append(rowAll);

    const self = el("div", "rp-self");
    self.append(el("p", "rp-self-q", "Wie gut hat es geklappt?"));
    const faces = el("div", "rp-faces");
    [["☺", "Gut! Ich habe alle Runden gesprochen."], ["😐", "Geht so. Ich übe noch einmal."], ["☹", "Schwierig. Ich höre mir den Dialog noch einmal an."]].forEach(([face, label]) => {
      const b = el("button", "btn rp-face", face);
      b.setAttribute("aria-label", label);
      b.onclick = () => {
        faces.querySelectorAll("button").forEach((x) => (x.disabled = true));
        b.classList.add("picked");
        const msg = el("p", "rp-self-msg", label);
        self.append(msg);
        const again = el("button", "btn", "Nochmal spielen");
        again.onclick = () => { turn = 0; render(false); keepTurnVisible(); };
        const row = el("div", "actions");
        row.append(again);
        self.append(row);
      };
      faces.append(b);
    });
    self.append(faces);
    box.append(self);

    mount.append(box);
  }

  render(false);
})();
