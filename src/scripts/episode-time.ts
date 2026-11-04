import './players';
import { hashFor, labelFor, momentUrl, timeFromUrl } from '../lib/time-link';

const FLAG = '__bcrEpisodeTime';

function episodeAudio(): HTMLAudioElement | null {
  const audio = document.querySelector('article audio.episode-audio');
  return audio instanceof HTMLAudioElement ? audio : null;
}

function turns(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.transcript-turn')];
}

function turnAt(seconds: number): HTMLElement | null {
  const list = turns();
  let match: HTMLElement | null = null;
  for (const turn of list) {
    const start = Number(turn.dataset.start);
    if (Number.isNaN(start)) continue;
    if (start <= seconds) match = turn;
    else break;
  }
  return match ?? list[0] ?? null;
}

function announce(node: Element | null, message: string, copied: boolean) {
  const status = document.querySelector('.transcript .copy-status') ?? document.querySelector('.copy-status');
  if (status) status.textContent = message;
  if (!copied || !(node instanceof HTMLButtonElement)) return;
  const previous = node.dataset.label || node.textContent || '';
  node.dataset.label = previous;
  node.textContent = 'Copied';
  window.setTimeout(() => {
    if (node.textContent === 'Copied') node.textContent = previous;
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

function seek(audio: HTMLAudioElement, seconds: number) {
  const apply = () => {
    audio.currentTime = seconds;
  };
  if (audio.readyState >= 1) apply();
  else audio.addEventListener('loadedmetadata', apply, { once: true });
}

function showPlayFrom(seconds: number) {
  const button = document.querySelector<HTMLButtonElement>('.play-from');
  const label = button?.querySelector('.play-from-label');
  if (!button || !label) return;
  label.textContent = labelFor(seconds);
  button.hidden = false;
  button.dataset.seconds = String(seconds);
}

let active: HTMLElement | null = null;

function highlight(seconds: number, scroll: boolean) {
  const turn = turnAt(seconds);
  if (active && active !== turn) {
    active.classList.remove('is-current');
    active.removeAttribute('aria-current');
  }
  active = turn;
  if (!active) return;
  active.classList.add('is-current');
  active.setAttribute('aria-current', 'true');
  if (!scroll) return;
  const details = document.querySelector('details.transcript');
  if (details instanceof HTMLDetailsElement) details.open = true;
  active.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function cue(seconds: number, play: boolean) {
  const audio = episodeAudio();
  if (!audio) return;
  seek(audio, seconds);
  highlight(seconds, true);
  if (!play) {
    if (audio.paused) showPlayFrom(seconds);
    return;
  }
  const pending = audio.play();
  if (pending && typeof pending.catch === 'function') {
    pending.catch(() => showPlayFrom(seconds));
  }
}

function setupEpisodeTime() {
  const windowRecord = window as Window & { [FLAG]?: boolean };
  if (windowRecord[FLAG]) return;
  windowRecord[FLAG] = true;

  const audio = episodeAudio();
  const list = turns();
  if (!audio || list.length === 0) return;

  const path = document.querySelector<HTMLElement>('[data-episode-path]')?.dataset.episodePath || location.pathname;

  document.querySelectorAll<HTMLButtonElement>('.transcript-copy').forEach((button) => {
    button.addEventListener('click', async () => {
      const seconds = Number(button.dataset.seconds);
      const url = momentUrl(location.href, path, seconds);
      const ok = await copyText(url);
      announce(button, ok ? `Copied link to ${labelFor(seconds)}.` : 'Could not copy the link.', ok);
    });
  });

  document.querySelectorAll<HTMLAnchorElement>('a.transcript-time').forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.hash.startsWith('#') ? link.hash.slice(1) : link.hash;
      if (!hash.startsWith('t=')) return;
      event.preventDefault();
      const url = new URL(location.href);
      url.searchParams.delete('t');
      url.hash = hash;
      history.pushState(null, '', url);
      const seconds = Number(link.closest<HTMLElement>('.transcript-turn')?.dataset.start);
      if (!Number.isNaN(seconds)) cue(seconds, true);
    });
  });

  const playFrom = document.querySelector<HTMLButtonElement>('.play-from');
  playFrom?.addEventListener('click', () => {
    const seconds = Number(playFrom.dataset.seconds);
    if (Number.isNaN(seconds)) return;
    cue(seconds, true);
    playFrom.hidden = true;
  });

  audio.addEventListener('timeupdate', () => highlight(audio.currentTime, false));
  audio.addEventListener('seeked', () => highlight(audio.currentTime, false));

  const onHistory = () => {
    const seconds = timeFromUrl(new URL(location.href));
    if (seconds == null) return;
    cue(seconds, false);
  };
  window.addEventListener('hashchange', onHistory);
  window.addEventListener('popstate', onHistory);

  const requested = timeFromUrl(new URL(location.href));
  if (requested == null) return;
  const canonical = new URL(location.href);
  canonical.searchParams.delete('t');
  canonical.hash = `t=${hashFor(requested)}`;
  if (`${location.pathname}${location.search}${location.hash}` !== `${canonical.pathname}${canonical.search}${canonical.hash}`) {
    history.replaceState(null, '', canonical);
  }
  cue(requested, false);
  playFrom?.focus({ preventScroll: true });
}

setupEpisodeTime();
