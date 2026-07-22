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

    // 2. Try ratings summary parent wrapper
    const summaryRatings = document.querySelector('.trakt-summary-ratings, [class*="trakt-summary-ratings"]');
    if (summaryRatings && summaryRatings.parentElement) {
      return summaryRatings.parentElement as HTMLElement;
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
      <span class="allocine-trakt-badge">AlloCiné</span>
      <div class="allocine-trakt-loading">
        <div class="allocine-trakt-spinner"></div>
        <span>Loading ratings...</span>
      </div>
    `;

    target.insertAdjacentElement('afterend', container);
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
        <span class="allocine-trakt-badge">AlloCiné</span>
        <span class="allocine-trakt-label">No ratings found</span>
      `;
      target.insertAdjacentElement('afterend', container);
      return;
    }

    const container = document.createElement('a');
    container.id = this.CONTAINER_ID;
    container.className = 'allocine-trakt-container';
    container.href = rating.url;
    container.target = '_blank';
    container.rel = 'noopener noreferrer';
    container.title = `View "${rating.title}" on AlloCiné`;

    let html = `<span class="allocine-trakt-badge">AlloCiné</span><div class="allocine-trakt-ratings">`;

    const parts: string[] = [];

    if (rating.pressRating !== undefined) {
      parts.push(`
        <div class="allocine-trakt-item">
          <span class="allocine-trakt-star">★</span>
          <span class="allocine-trakt-label">Presse</span>
          <span class="allocine-trakt-score">${rating.pressRating.toFixed(1)}/5</span>
        </div>
      `);
    }

    if (rating.spectatorRating !== undefined) {
      parts.push(`
        <div class="allocine-trakt-item">
          <span class="allocine-trakt-star">★</span>
          <span class="allocine-trakt-label">Spectateurs</span>
          <span class="allocine-trakt-score">${rating.spectatorRating.toFixed(1)}/5</span>
        </div>
      `);
    }

    html += parts.join('<div class="allocine-trakt-divider"></div>');
    html += `</div>`;

    container.innerHTML = html;
    target.insertAdjacentElement('afterend', container);
  }
}
