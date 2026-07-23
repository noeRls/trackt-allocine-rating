import { AlloCineRating } from '../types';
import './style.css';

export class UIBadge {
  private static CONTAINER_ID = 'allocine-trakt-rating-badge';

  /**
   * Find target container on Trakt page to inject our badge into.
   * Target parent wrapper to be 100% safe from Svelte hydration reconciliation.
   */
  public static getTargetElement(): HTMLElement | null {
    // 1. Try action buttons / media actions bar
    const actionButtons = document.querySelector('.action-buttons, .media-actions, .trakt-summary-actions-bar, .actions-bar');
    if (actionButtons) return actionButtons as HTMLElement;

    // 2. Try ratings summary parent wrapper (or the row itself)
    const summaryRatings = document.querySelector('.trakt-summary-ratings, [class*="trakt-summary-ratings"]');
    if (summaryRatings) {
      return summaryRatings as HTMLElement;
    }

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

    const container = document.createElement('div');
    container.id = this.CONTAINER_ID;
    container.className = 'allocine-trakt-container';
    container.innerHTML = `
      <div class="allocine-trakt-badge">
        <div class="allocine-trakt-col">
          <span class="allocine-trakt-title">Allociné</span>
          <span class="allocine-trakt-subtitle">Loading</span>
        </div>
        <div class="allocine-trakt-loading">
          <div class="allocine-trakt-spinner"></div>
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

    if (!rating || (!rating.pressRating && !rating.spectatorRating)) {
      const container = document.createElement('div');
      container.id = this.CONTAINER_ID;
      container.className = 'allocine-trakt-container';
      container.style.opacity = '0.6';
      container.innerHTML = `
        <div class="allocine-trakt-badge">
          <div class="allocine-trakt-col">
            <span class="allocine-trakt-title">Allociné</span>
            <span class="allocine-trakt-subtitle">N/A</span>
          </div>
        </div>
      `;
      this.injectIntoTarget(target, container);
      return;
    }

    const container = document.createElement('a');
    container.id = this.CONTAINER_ID;
    container.className = 'allocine-trakt-container';
    container.href = rating.url;
    container.target = '_blank';
    container.rel = 'noopener noreferrer';
    container.title = `View "${rating.title}" on AlloCiné`;

    let html = '';

    if (rating.pressRating !== undefined) {
      html += `
        <div class="allocine-trakt-badge">
          <div class="allocine-trakt-col">
            <span class="allocine-trakt-title">Allociné</span>
            <span class="allocine-trakt-subtitle">Presse</span>
          </div>
          <span class="allocine-trakt-score">${rating.pressRating.toFixed(1)}</span>
        </div>
      `;
    }

    if (rating.spectatorRating !== undefined) {
      html += `
        <div class="allocine-trakt-badge">
          <div class="allocine-trakt-col">
            <span class="allocine-trakt-title">Allociné</span>
            <span class="allocine-trakt-subtitle">Public</span>
          </div>
          <span class="allocine-trakt-score">${rating.spectatorRating.toFixed(1)}</span>
        </div>
      `;
    }

    container.innerHTML = html;
    this.injectIntoTarget(target, container);
  }
}
