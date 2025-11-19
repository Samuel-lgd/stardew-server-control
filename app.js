// Configuration
const LAMBDA_URL = "https://kz2pltyay2yrlyh6l6medjnji40sladd.lambda-url.us-east-1.on.aws";

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainInterface = document.getElementById('main-interface');
const ipCard = document.getElementById('ip-card');
const passwordInput = document.getElementById('password-input');
const consoleOutput = document.getElementById('console-output');
const ipDisplay = document.getElementById('ip-address');

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnRefresh = document.getElementById('btn-refresh');
const btnCopyLaunch = document.getElementById('btn-copy-launch');

let currentPassword = "";
let pollInterval = null;

// Logger
function log(message, type = "info") {
  consoleOutput.textContent = message;
  // Reset tone
  consoleOutput.removeAttribute('data-tone');

  if (type === "success") consoleOutput.setAttribute('data-tone', 'success');
  else if (type === "error") consoleOutput.setAttribute('data-tone', 'error');
  else if (type === "warning") consoleOutput.setAttribute('data-tone', 'warning');
}

// API Call
async function callApi(action) {
  if (!LAMBDA_URL) {
    log("Error: Lambda URL not configured", "error");
    return null;
  }

  try {
    const response = await fetch(`${LAMBDA_URL}?action=${action}`, {
      method: 'GET',
      headers: {
        'X-Password': currentPassword
      }
    });

    if (response.status === 403) {
      log("Mot de passe incorrect !", "error");
      return null;
    }

    if (!response.ok) {
      log(`Erreur API: ${response.status}`, "error");
      return null;
    }

    return await response.json();
  } catch (e) {
    log(`Erreur Réseau: ${e.message}`, "error");
    return null;
  }
}

// UI Updates
function updateStatusUI(data) {
  if (!data) return;

  // IP
  if (data.public_ip) {
    ipDisplay.textContent = data.public_ip;
  } else {
    ipDisplay.textContent = "---.---.---.---";
  }

  // Buttons Logic
  btnStart.classList.add('hidden');
  btnStop.classList.add('hidden');

  let statusMsg = "";
  let statusType = "info";

  if (data.ec2_status === 'running') {
    if (data.server_status === 'online') {
      btnStop.classList.remove('hidden');
      statusMsg = "Serveur EN LIGNE. Prêt à jouer !";
      statusType = "success";
    } else {
      btnStart.classList.remove('hidden');
      statusMsg = "Instance démarrée. Serveur de jeu éteint.";
      statusType = "warning";
    }
  } else {
    // EC2 Stopped or Pending
    btnStart.classList.remove('hidden');
    statusMsg = `Instance ${data.ec2_status}. Serveur éteint.`;
    statusType = "warning";
  }

  log(statusMsg, statusType);
}

// Actions
async function checkStatus() {
  log("Vérification du statut...", "info");
  const data = await callApi('get-status');
  if (data) {
    updateStatusUI(data);
    return true; // Success
  }
  return false;
}

// Remember Me Logic
const rememberMeCheckbox = document.getElementById('remember-me');
// Check for saved password on load
window.addEventListener('DOMContentLoaded', () => {
  const savedPassword = localStorage.getItem('stardew_password');
  if (savedPassword) {
    passwordInput.value = savedPassword;
    rememberMeCheckbox.checked = true;
    // Optional: Auto-login if desired, but user might want to just have it filled
    // Let's just fill it for now, or maybe auto-focus the button?
    // User asked for "se souvenir", usually implies pre-filling.
  }
});
async function handleLogin() {
  const pwd = passwordInput.value.trim();
  if (!pwd) return;
  currentPassword = pwd;
  log("Authentification...", "info");
  const success = await checkStatus();
  if (success) {
    // Handle Remember Me
    if (rememberMeCheckbox.checked) {
      localStorage.setItem('stardew_password', pwd);
    } else {
      localStorage.removeItem('stardew_password');
    }
    // Show controls and IP card
    mainInterface.classList.remove('hidden');
    ipCard.classList.remove('hidden');
    // Hide login input to clean up UI? Or keep it? 
    // User said "reprends l'UI de old_app", old_app has input visible.
    // But we want to prevent re-typing. Let's keep it but maybe blur it.
    passwordInput.blur();
  } else {
    passwordInput.value = "";
    passwordInput.focus();
  }
}

async function startServer() {
  log("Démarrage en cours...", "info");
  const data = await callApi('start');
  if (data) {
    log("Commande envoyée. Démarrage...", "warning");
    startPolling();
  }
}

async function stopServer() {
  log("Arrêt en cours...", "info");
  const data = await callApi('stop');
  if (data) {
    log("Commande envoyée. Arrêt...", "warning");
    startPolling();
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  // Poll every 5 seconds for 2 minutes
  let count = 0;
  pollInterval = setInterval(async () => {
    count++;
    await checkStatus();
    if (count > 24) clearInterval(pollInterval); // Stop after 2 mins
  }, 5000);
}

// Copy and Launch Logic
function copyAndLaunch() {
  const ip = ipDisplay.textContent;
  if (!ip || ip.includes("---")) {
    log("Pas d'adresse IP à copier", "error");
    return;
  }

  navigator.clipboard.writeText(ip).then(() => {
    log("IP Copiée ! Lancement...", "success");

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      window.location.href = "https://apps.apple.com/us/app/stardew-valley/id1406710800";
    } else if (isAndroid) {
      window.location.href = "https://play.google.com/store/apps/details?id=com.chucklefish.stardewvalley";
    }
  });
}

// Event Listeners
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin();
});

btnRefresh.addEventListener('click', checkStatus);
btnStart.addEventListener('click', startServer);
btnStop.addEventListener('click', stopServer);
btnCopyLaunch.addEventListener('click', copyAndLaunch);
