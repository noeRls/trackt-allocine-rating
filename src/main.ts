import { TraktService } from './services/trakt';
import { AlloCineService } from './services/allocine';
import { CacheService } from './services/cache';
import { UIBadge } from './ui/badge';

let currentPath = '';
let isProcessing = false;

async function processPage() {
  const media = TraktService.getCurrentMediaInfo();
  if (!media) {
    UIBadge.removeExistingBadge();
    return;
  }

  const target = UIBadge.getTargetElement();
  if (!target) {
    return; // Wait for target container to render
  }

  if (document.getElementById('allocine-trakt-rating-badge')) {
    return; // Badge already rendered
  }

  // Check cache first
  const cachedRating = CacheService.get(media.type, media.slug);
  if (cachedRating !== undefined) {
    UIBadge.render(cachedRating);
    return;
  }

  if (isProcessing) return;
  isProcessing = true;

  UIBadge.showLoading();

  try {
    const rating = await AlloCineService.fetchRating(media);
    CacheService.set(media.type, media.slug, rating);
    UIBadge.render(rating);
  } catch (err) {
    console.error('[AlloCiné Trakt] Failed fetching rating:', err);
  } finally {
    isProcessing = false;
  }
}

function handleNavigation() {
  const newPath = window.location.pathname;
  if (newPath !== currentPath) {
    currentPath = newPath;
    isProcessing = false;
    UIBadge.removeExistingBadge();
  }

  processPage().catch((err) => {
    console.error('[AlloCiné Trakt] Failed processing page:', err);
  });
}

function init() {
  console.log('[AlloCiné Trakt] Userscript initialized');
  handleNavigation();

  // MutationObserver to retry processPage when Svelte renders the DOM components or when SPA navigation occurs
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== currentPath) {
      handleNavigation();
    } else if (window.location.pathname.match(/^\/(movies|shows)\/([^/]+)/)) {
      if (!document.getElementById('allocine-trakt-rating-badge')) {
        processPage().catch(console.error);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('popstate', handleNavigation);

  // Modern browser navigation API support
  if ('navigation' in window && (window as any).navigation) {
    (window as any).navigation.addEventListener('navigate', () => {
      setTimeout(handleNavigation, 50);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
} else {
  setTimeout(init, 300);
}
