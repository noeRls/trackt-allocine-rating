import { AlloCineRating } from '../types';
import allocineIcon from '../../assets/allocine_icon.png';
import './style.css';

export class UIBadge {
  private static CONTAINER_ID = 'allocine-trakt-rating-badge';


  /**
   * Find target container on Trakt page to inject our badge into.
   * Target parent wrapper to be 100% safe from Svelte hydration reconciliation.
   */
  public static getTargetElement(): HTMLElement | null {
    // 1. Try ratings summary div (.trakt-summary-ratings)
    const summaryRatings = document.querySelector('.trakt-summary-ratings, [class*="trakt-summary-ratings"]');
    if (summaryRatings) {
      return summaryRatings as HTMLElement;
    }

    // 2. Fallback: action buttons / media actions bar
    const actionButtons = document.querySelector('.action-buttons, .media-actions, .trakt-summary-actions-bar, .actions-bar');
    if (actionButtons) return actionButtons as HTMLElement;

    // 3. Fallback: sidebar stats or sidebar
    const sidebar = document.querySelector('.sidebar .stats, .sidebar-stats, .sidebar');
    if (sidebar) return sidebar as HTMLElement;

    // 4. Ultimate fallback: header title parent
    const mobileTitle = document.querySelector('.mobile-title, .title-container, h1');
    if (mobileTitle && mobileTitle.parentElement) {
      return mobileTitle.parentElement as HTMLElement;
    }

    return null;
  }

  /**
   * Helper to safely inject the container into the target.
   * Special case for the .trakt-summary-ratings row to insert before the drilldown arrow.
   */
  private static injectIntoTarget(target: HTMLElement, container: HTMLElement): void {
    if (target.classList.contains('trakt-summary-ratings') || target.className.includes('trakt-summary-ratings')) {
      const drilldownButton = target.querySelector('.trakt-tooltip-trigger, .trakt-ratings-drilldown-button, [data-tooltip-trigger]');
      if (drilldownButton) {
        target.insertBefore(container, drilldownButton);
        return;
      }
    }
    target.appendChild(container);
  }

  /**
   * Remove any existing badge element.
   */
  public static removeExistingBadge(): void {
    const existing = document.getElementById(this.CONTAINER_ID);
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Inject loading placeholder.
   */
  public static showLoading(): void {
    this.removeExistingBadge();
    const target = this.getTargetElement();
    if (!target) return;

    const container = document.createElement('rating');
    container.id = this.CONTAINER_ID;
    container.className = 'allocine-trakt-rating svelte-n4uq8h';
    container.setAttribute('data-layout', 'row');
    container.innerHTML = `
      <div class="rating-item svelte-n4uq8h has-valid-rating" data-layout="row">
        <span class="allocine-trakt-sr-only">Allociné</span>
        <div class="allocine-trakt-icon">
          <img src="${allocineIcon}" alt="Allociné" width="18" height="18" class="allocine-trakt-icon-img">
        </div>
        <div class="rating-info svelte-n4uq8h">
          <div class="rating-value svelte-n4uq8h">
            <p class="bold svelte-n4uq8h allocine-trakt-text">
              <span class="allocine-trakt-subtitle">Loading...</span>
            </p>
          </div>
        </div>
      </div>
    `;

    this.injectIntoTarget(target, container);
  }

  /**
   * Inject AlloCiné ratings badge.
   */
  public static render(rating: AlloCineRating | null): void {
    this.removeExistingBadge();
    const target = this.getTargetElement();
    if (!target) return;

    const isNA = !rating || (rating.pressRating === undefined && rating.spectatorRating === undefined);

    const container = document.createElement('rating');
    container.id = this.CONTAINER_ID;
    container.className = 'allocine-trakt-rating svelte-n4uq8h';
    container.setAttribute('data-layout', 'row');

    if (isNA) {
      container.innerHTML = `
        <div class="rating-item svelte-n4uq8h has-valid-rating" data-layout="row" style="opacity: 0.6;">
          <span class="allocine-trakt-sr-only">Allociné</span>
          <div class="allocine-trakt-icon">
            <img src="${allocineIcon}" alt="Allociné" width="18" height="18" class="allocine-trakt-icon-img">
          </div>
          <div class="rating-info svelte-n4uq8h">
            <div class="rating-value svelte-n4uq8h">
              <p class="bold svelte-n4uq8h allocine-trakt-text">
                <span class="allocine-trakt-subtitle">N/A</span>
              </p>
            </div>
          </div>
        </div>
      `;
      this.injectIntoTarget(target, container);
      return;
    }

    const parts: string[] = [];

    if (rating.pressRating !== undefined) {
      parts.push(`<span class="allocine-trakt-score">${rating.pressRating.toFixed(1)}</span> <span class="allocine-trakt-subtitle">Presse</span>`);
    }

    if (rating.spectatorRating !== undefined) {
      parts.push(`<span class="allocine-trakt-score">${rating.spectatorRating.toFixed(1)}</span> <span class="allocine-trakt-subtitle">Public</span>`);
    }

    const contentHtml = parts.join('<span class="allocine-trakt-dot">·</span>');

    container.innerHTML = `
      <a target="_blank" rel="noopener noreferrer" title="View &quot;${rating.title || 'Movie'}&quot; on AlloCiné" class="allocine-trakt-link" href="${rating.url}">
        <div class="rating-item svelte-n4uq8h has-valid-rating" data-layout="row">
          <span class="allocine-trakt-sr-only">Allociné</span>
          <div class="allocine-trakt-icon">
            <img src="${allocineIcon}" alt="Allociné" width="18" height="18" class="allocine-trakt-icon-img">
          </div>
          <div class="rating-info svelte-n4uq8h">
            <div class="rating-value svelte-n4uq8h">
              <p class="bold svelte-n4uq8h allocine-trakt-text">
                ${contentHtml}
              </p>
            </div>
          </div>
        </div>
      </a>
    `;

    this.injectIntoTarget(target, container);
  }
}

