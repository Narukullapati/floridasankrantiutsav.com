import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, ViewEncapsulation, signal } from '@angular/core';

export const CONTACT_EMAIL = 'info@floridasankrantiutsav.com';

@Component({
  selector: 'fsu-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent implements OnDestroy {
  readonly menuOpen = signal(false);
  readonly modalOpen = signal(false);
  readonly copied = signal(false);
  private copyTimer?: ReturnType<typeof setTimeout>;

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  openModal(event: Event): void {
    event.preventDefault();
    this.menuOpen.set(false);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalOpen()) {
      this.closeModal();
    }
  }

  copyEmail(): void {
    navigator.clipboard
      .writeText(CONTACT_EMAIL)
      .then(() => {
        this.copied.set(true);
        clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => this.copied.set(false), 2000);
      })
      .catch((err) => console.error('Could not copy email: ', err));
  }

  ngOnDestroy(): void {
    clearTimeout(this.copyTimer);
  }
}
