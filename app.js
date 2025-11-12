(() => {
  const API_BASE = "https://kz2pltyay2yrlyh6l6medjnji40sladd.lambda-url.us-east-1.on.aws";
  const PORT_SUFFIX = ":24642";
  const POLL_INTERVAL = 5000;
  const POLL_MAX = 5;

  const passwordInput = document.getElementById("pw");
  const statusEl = document.getElementById("status");
  const ipEl = document.getElementById("ip");
  const startBtn = document.getElementById("start");
  const stopBtn = document.getElementById("stop");
  const refreshBtn = document.getElementById("refresh");
  const launchBtn = document.getElementById("launch");

  const STATUS_PREFIX = {
    info: "",
    success: "[OK]",
    warning: "[ALERTE]",
    error: "[ERREUR]",
  };

  function setStatus(message, tone = "info") {
    const prefix = STATUS_PREFIX[tone] || STATUS_PREFIX.info;
    statusEl.textContent = `>> ${prefix} ${message}`;
    if (tone === "info") {
      delete statusEl.dataset.tone;
      return;
    }
    statusEl.dataset.tone = tone;
  }

  setStatus(statusEl.textContent || "", "info");

  function hasPassword() {
    const pw = passwordInput.value.trim();
    if (!pw) {
      alert("Mot de passe requis");
      passwordInput.focus();
      return false;
    }
    return pw;
  }

  function headers(pw) {
    return { "X-Password": pw };
  }

  async function request(action) {
    const pw = hasPassword();
    if (!pw) {
      return null;
    }

    const url = `${API_BASE}?action=${encodeURIComponent(action)}`;
    try {
      const response = await fetch(url, { method: "GET", headers: headers(pw) });
      const rawText = await response.text();
      try {
        return { ok: response.ok, body: JSON.parse(rawText), status: response.status };
      } catch (parseError) {
        return { ok: response.ok, body: rawText, status: response.status };
      }
    } catch (error) {
      return { ok: false, error: error.toString() };
    }
  }

  async function pollForIP() {
    setStatus("Recherche de l'IP de la ferme distante", "info");

    for (let attempt = 0; attempt < POLL_MAX; attempt += 1) {
      const result = await request("get-ip");
      if (!result) {
        return null;
      }

      if (result.status == 403) {
        setStatus("Mot de passe refusé", "error");
        return null;
      }

      if (!result.ok) {
        setStatus(`Incident réseau (${result.status || result.error})`, "error");
        return null;
      }

      if (result.ok && result.body && result.body.public_ip) {
        const ip = `${result.body.public_ip}${PORT_SUFFIX}`;
        ipEl.textContent = ip;
        setStatus(`Instance ${result.body.instance_state} — adresse récupérée`, "success");
        return ip;
      }

      const state = result.body?.instance_state || "inconnu";
      setStatus(`Lecture ${attempt + 1}/${POLL_MAX} — état actuel: ${state}`, "info");
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }

    setStatus("IP non disponible après plusieurs tentatives", "warning");
    return null;
  }

  startBtn.addEventListener("click", async () => {
    if (!hasPassword()) {
      return;
    }

    setStatus("Démarrage du serveur", "info");
    await request("start");
    await pollForIP();
  });

  stopBtn.addEventListener("click", async () => {
    if (!hasPassword()) {
      return;
    }

    setStatus("Mise en veille du serveur", "warning");
    await request("stop");
    ipEl.textContent = "aucune";
    setStatus("Signal d'extinction envoyé", "warning");
  });

  refreshBtn.addEventListener("click", async () => {
    if (!hasPassword()) {
      return;
    }
    await pollForIP();
  });

  function detectPlatform() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(ua)) {
      return "android";
    }
    if (/iPad|iPhone|iPod/.test(ua)) {
      return "ios";
    }
    return "other";
  }

  async function copyIpToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  function launchStardew(platform) {
    if (platform === "ios") {
      window.location.href = "https://apps.apple.com/app/id1406710800";
    } else if (platform === "android") {
      window.location.href = "https://play.google.com/store/apps/details?id=com.chucklefish.stardewvalley";
    }
  }

  launchBtn.addEventListener("click", async () => {
    const text = ipEl.textContent;
    if (!text || text === "aucune") {
      alert("Aucune IP à copier");
      return;
    }

    await copyIpToClipboard(text);

    const platform = detectPlatform();
    if (platform === "other") {
      return;
    }

    launchStardew(platform);
  });

  passwordInput.addEventListener("keydown", async (event) => {
    if (["Enter", "Go", "Done"].includes(event.key)) {
      event.preventDefault();
      await pollForIP();
    }
  });
})();
