import './players';
import { hashFor, labelFor, momentUrl, timeFromUrl } from '../lib/time-link';

const FLAG = '__bcrEpisodeTime';

function episodeAudio(): HTMLAudioElement | null {
  const audio = document.querySelector('article audio.episode-audio');
  return audio instanceof HTMLAudioElement ? audio : null;
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
  const copy = document.querySelector<HTMLButtonElement>('.copy-moment');
  const clock = labelFor(seconds);
  if (button && label) {
    label.textContent = clock;
    button.hidden = false;
    button.dataset.seconds = String(seconds);
  }
  if (copy) {
    copy.hidden = false;
    copy.dataset.seconds = String(seconds);
    copy.textContent = 'Copy link';
    copy.setAttribute('aria-label', `Copy link to ${clock}`);
  }
}

function hidePlayBar() {
  const playFrom = document.querySelector<HTMLButtonElement>('.play-from');
  const copy = document.querySelector<HTMLButtonElement>('.copy-moment');
  if (playFrom) playFrom.hidden = true;
  if (copy) copy.hidden = true;
}

function cue(seconds: number, play: boolean) {
  const audio = episodeAudio();
  if (!audio) return;
  seek(audio, seconds);
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
  if (!audio) return;

  const path = document.querySelector<HTMLElement>('[data-episode-path]')?.dataset.episodePath || location.pathname;

  const playFrom = document.querySelector<HTMLButtonElement>('.play-from');
  playFrom?.addEventListener('click', () => {
    const seconds = Number(playFrom.dataset.seconds);
    if (Number.isNaN(seconds)) return;
    cue(seconds, true);
    hidePlayBar();
  });

  const copyMoment = document.querySelector<HTMLButtonElement>('.copy-moment');
  copyMoment?.addEventListener('click', async () => {
    const seconds = Number(copyMoment.dataset.seconds);
    if (Number.isNaN(seconds)) return;
    const url = momentUrl(location.href, path, seconds);
    const ok = await copyText(url);
    const status = document.querySelector('.play-from-row .copy-status');
    if (status) status.textContent = ok ? `Copied link to ${labelFor(seconds)}.` : 'Could not copy the link.';
    if (!ok) return;
    const previous = 'Copy link';
    copyMoment.textContent = 'Copied';
    copyMoment.removeAttribute('aria-label');
    window.setTimeout(() => {
      if (copyMoment.textContent === 'Copied') {
        copyMoment.textContent = previous;
        copyMoment.setAttribute('aria-label', `Copy link to ${labelFor(seconds)}`);
      }
    }, 2000);
  });

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
