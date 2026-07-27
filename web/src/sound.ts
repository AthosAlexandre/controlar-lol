let ctx: AudioContext | null = null;

/** Cria/religa o áudio no primeiro gesto do usuário (política de autoplay). */
export function unlockAudio(): void {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null; // sem áudio disponível — segue sem som
  }
}

function beep(freq: number, durationMs: number, when = 0, gain = 0.14): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

/** "Ding" de duas notas quando fica a sua vez. */
export function playTurn(): void {
  beep(880, 120, 0);
  beep(1320, 170, 0.12);
}

/** Bip do timer nos segundos finais (mais agudo nos últimos 3s). */
export function playTick(secondsLeft: number): void {
  beep(secondsLeft <= 3 ? 1245 : 700, 90);
}
