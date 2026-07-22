import { TraktService } from './services/trakt';
import { AlloCineService } from './services/allocine';
import { CacheService } from './services/cache';
import { UIBadge } from './ui/badge';

let currentPath = '';

async function processPage() {
  const media = TraktService.getCurrentMediaInfo();
  if (!media) {
    UIBadge.removeExistingBadge();
    return;
  }

  // Check cache first
  const cachedRating = CacheService.get(media.type, media.slug);
  if (cachedRating !== undefined) {
    UIBadge.render(cachedRating);
    return;
  }

  // Show loading state while fetching
  UIBadge.showLoading();

  // Fetch rating from AlloCiné
  const rating = await AlloCineService.fetchRating(media);

  // Store in cache
  CacheService.set(media.type, media.slug, rating);

  // Render final badge
  UIBadge.render(rating);
}

function handleNavigation() {
  const newPath = window.location.pathname;
  if (newPath === currentPath) return;
  currentPath = newPath;

  // Small delay to allow Trakt DOM to finish rendering on SPA page transition
  setTimeout(() => {
    processPage().catch((err) => {
      console.error('[AlloCiné Trakt] Failed processing page:', err);
    });
  }, 300);
}

function init() {
  console.log('[AlloCiné Trakt] Userscript initialized');

  // Initial load
  handleNavigation();

  // Observe URL changes in Trakt SPA
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== currentPath) {
      handleNavigation();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Listen to popstate for browser back/forward navigation
  window.addEventListener('popstate', handleNavigation);
}

// Start script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
} else {
  setTimeout(init, 500);
}
