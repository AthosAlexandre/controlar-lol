declare global {
  interface Window {
    banheiro: {
      enable(): Promise<{ url: string; qr: string }>;
      disable(): Promise<void>;
      lolStatus(): Promise<boolean>;
    };
  }
}

const toggle = document.getElementById("toggle") as HTMLButtonElement;
const painel = document.getElementById("painel") as HTMLDivElement;
const linkInput = document.getElementById("link") as HTMLInputElement;
const copiarBtn = document.getElementById("copiar") as HTMLButtonElement;
const qrImg = document.getElementById("qr") as HTMLImageElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

let ligado = false;

async function atualizarStatus() {
  // Enquanto o modo está ligado, o status reflete a conexão com o LoL.
  const on = await window.banheiro.lolStatus();
  statusEl.textContent = on ? "LoL detectado ✅" : "Abra o cliente do LoL";
  statusEl.className = "status " + (on ? "on" : "off");
}

toggle.addEventListener("click", async () => {
  if (!ligado) {
    try {
      const { url, qr } = await window.banheiro.enable();
      linkInput.value = url;
      qrImg.src = qr;
      painel.classList.add("show");
      toggle.textContent = "Desligar modo remoto";
      toggle.classList.add("ligado");
      ligado = true;
    } catch {
      // Ex.: porta 3000 já em uso.
      statusEl.textContent = "Erro ao ligar (a porta 3000 já está em uso?)";
      statusEl.className = "status off";
    }
  } else {
    await window.banheiro.disable();
    painel.classList.remove("show");
    toggle.textContent = "Habilitar modo remoto";
    toggle.classList.remove("ligado");
    ligado = false;
  }
});

copiarBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(linkInput.value);
  copiarBtn.textContent = "Copiado!";
  setTimeout(() => (copiarBtn.textContent = "Copiar"), 1500);
});

void atualizarStatus();
setInterval(() => void atualizarStatus(), 4000);

export {};
