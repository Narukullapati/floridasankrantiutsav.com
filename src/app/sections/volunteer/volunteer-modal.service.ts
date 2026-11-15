import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VolunteerModalService {
  readonly isOpen = signal(false);

  open(event?: Event): void {
    event?.preventDefault();
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
