import '@videojs/html/audio/player';
import '@videojs/html/audio/skin';
import { labelFor, momentUrl } from '../lib/time-link';

const FLAG = '__bcrPlayers';

function audioFor(button: Element): HTMLAudioElement | null {
  const block = button.closest('.episode-player-block');
  const audio = block?.querySelector('audio.episode-audio');
  return audio instanceof HTMLAudioElement ? audio : null;
}

function announce(button: Element, message: string, copied: boolean) {
  const status = button.closest('.episode-player-block, .transcript')?.querySelector('.copy-status');
  if (status) status.textContent = message;
  if (!copied || !(button instanceof HTMLButtonElement)) return;
  const previous = button.textContent;
  button.textContent = 'Copied';
  window.setTimeout(() => {
    if (button.textContent === 'Copied') button.textContent = previous;
  }, 2000);
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function setupPlayers() {
  const windowRecord = window as Window & { [FLAG]?: boolean };
  if (windowRecord[FLAG]) return;
  windowRecord[FLAG] = true;

  document.querySelectorAll<HTMLButtonElement>('.copy-now').forEach((button) => {
    button.addEventListener('click', async () => {
      const audio = audioFor(button);
      const path = button.dataset.episodePath;
      if (!audio || !path) return;
      const seconds = Math.floor(audio.currentTime || 0);
      const url = momentUrl(location.href, path, seconds);
      const ok = await copyText(url);
      announce(button, ok ? `Copied link to ${labelFor(seconds)}.` : 'Could not copy the link.', ok);
    });
  });
}

setupPlayers();
