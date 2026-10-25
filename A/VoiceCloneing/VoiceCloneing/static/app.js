let voiceBlob = null,
  voiceRecorder = null,
  questionRecorder = null,
  timer = null;
const $ = (s) => document.querySelector(s);

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 5000);
}
function showStep(n) {
  document
    .querySelectorAll(".panel")
    .forEach((x) => x.classList.remove("active"));
  $(`#panel-${n}`).classList.add("active");
  document.querySelectorAll(".step").forEach((x, i) => {
    x.classList.toggle("active", i === n - 1);
    x.classList.toggle("done", i < n - 1);
  });
}
function loading(on) {
  $("#loading").classList.toggle("show", on);
}
function errorMessage(e) {
  return e?.detail || e?.message || "Something went wrong. Please try again.";
}
async function jsonOrThrow(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Request failed");
  return body;
}

async function makeRecorder(button, onDone, onTick) {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("Microphone recording is not supported in this browser.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    clearInterval(timer);
    onDone(new Blob(chunks, { type: recorder.mimeType }));
  };
  recorder.start();
  button.classList.add("recording");
  let seconds = 0;
  onTick(seconds);
  timer = setInterval(() => {
    seconds++;
    onTick(seconds);
    if (seconds >= 30) stopRecorder(recorder, button);
  }, 1000);
  return recorder;
}
function stopRecorder(recorder, button) {
  if (recorder?.state === "recording") recorder.stop();
  button.classList.remove("recording");
}
function time(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

$("#voice-record").onclick = async () => {
  try {
    if (voiceRecorder?.state === "recording") {
      stopRecorder(voiceRecorder, $("#voice-record"));
      return;
    }
    voiceRecorder = await makeRecorder(
      $("#voice-record"),
      (blob) => {
        voiceBlob = blob;
        $("#voice-timer").textContent = "Sample recorded ✓";
        updateSave();
      },
      (s) => ($("#voice-timer").textContent = `Recording ${time(s)}`),
    );
  } catch (e) {
    toast(errorMessage(e));
  }
};
$("#voice-file").onchange = (e) => {
  const f = e.target.files[0];
  if (f) {
    voiceBlob = f;
    $(".upload").childNodes[0].textContent = `Selected: ${f.name} `;
    updateSave();
  }
};
$("#consent").onchange = updateSave;
function updateSave() {
  $("#save-voice").disabled = !(voiceBlob && $("#consent").checked);
}
$("#save-voice").onclick = async () => {
  loading(true);
  try {
    const fd = new FormData();
  fd.append("consent", "true");
  fd.append("language", $("#voice-language").value);
  fd.append("audio", voiceBlob, voiceBlob.name || "voice.webm");
    await jsonOrThrow(await fetch("/api/voice", { method: "POST", body: fd }));
    showStep(2);
  } catch (e) {
    toast(errorMessage(e));
  } finally {
    loading(false);
  }
};

$("#question-record").onclick = async () => {
  try {
    if (questionRecorder?.state === "recording") {
      stopRecorder(questionRecorder, $("#question-record"));
      return;
    }
    questionRecorder = await makeRecorder(
      $("#question-record"),
      askAudio,
      (s) => {
        $("#question-label").textContent = "Listening…";
        $("#question-timer").textContent = time(s);
      },
    );
  } catch (e) {
    toast(errorMessage(e));
  }
};
async function askAudio(blob) {
  $("#question-record").classList.remove("recording");
  $("#question-label").textContent = "Tap to ask";
  $("#question-timer").textContent = "Your microphone is ready";
  loading(true);
  try {
    const fd = new FormData();
    fd.append("audio", blob, "question.webm");
    fd.append("language", $("#language").value);
    renderAnswer(
      await jsonOrThrow(
        await fetch("/api/ask-audio", { method: "POST", body: fd }),
      ),
    );
  } catch (e) {
    toast(errorMessage(e));
  } finally {
    loading(false);
  }
}
$("#text-form").onsubmit = async (e) => {
  e.preventDefault();
  const question = $("#question-text").value.trim();
  if (!question) return;
  loading(true);
  try {
    renderAnswer(
      await jsonOrThrow(
        await fetch("/api/ask-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, language: $("#language").value }),
        }),
      ),
    );
  } catch (e) {
    toast(errorMessage(e));
  } finally {
    loading(false);
  }
};
function renderAnswer(data) {
  $("#asked").textContent = data.question;
  $("#answered").textContent = data.answer;
  $("#reply-audio").src = data.audio_url;
  showStep(3);
  $("#reply-audio")
    .play()
    .catch(() => {});
}
$("#ask-again").onclick = () => showStep(2);
document.querySelectorAll(".step").forEach(
  (x) =>
    (x.onclick = () => {
      const n = Number(x.dataset.step);
      if (n === 1 || (n === 2 && voiceBlob)) showStep(n);
    }),
);

const canvas = $("#voice-wave"),
  ctx = canvas.getContext("2d");
function drawWave() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.strokeStyle = "#9bc5a4";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  for (let x = 0; x < w; x += 5) {
    const amp =
      (Math.sin(x * 0.16) + Math.sin(x * 0.043)) * 7 + Math.sin(x * 0.7) * 2;
    ctx.moveTo(x, h / 2 - amp);
    ctx.lineTo(x, h / 2 + amp);
  }
  ctx.stroke();
}
drawWave();
addEventListener("resize", drawWave);
fetch("/api/status")
  .then((r) => r.json())
  .then((s) => {
    if (s.voice_saved) {
      voiceBlob = new Blob(["saved"]);
      showStep(2);
    }
  })
  .catch(() => {});
