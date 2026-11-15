import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AdminIcon =
  | 'home' | 'users' | 'student' | 'parent' | 'heart' | 'clock' | 'check' | 'minus'
  | 'download' | 'refresh' | 'logout' | 'menu' | 'close' | 'search' | 'megaphone';

@Component({
  selector: 'fsu-admin-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display:inline-flex' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      @switch (name()) {
        @case ('home') { <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/> }
        @case ('users') { <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/> }
        @case ('student') { <path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v6"/> }
        @case ('parent') { <circle cx="8" cy="6" r="2.5"/><circle cx="17" cy="9" r="2"/><path d="M4 21v-6a4 4 0 0 1 8 0v6"/><path d="M14 21v-4a3 3 0 0 1 6 0v4"/> }
        @case ('heart') { <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z"/> }
        @case ('clock') { <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/> }
        @case ('check') { <circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16 9.8"/> }
        @case ('minus') { <circle cx="12" cy="12" r="9"/><path d="M8 12h8"/> }
        @case ('download') { <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/> }
        @case ('refresh') { <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/> }
        @case ('logout') { <path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/> }
        @case ('menu') { <path d="M4 6h16M4 12h16M4 18h16"/> }
        @case ('close') { <path d="M6 6l12 12M18 6 6 18"/> }
        @case ('search') { <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/> }
        @case ('megaphone') { <path d="M3 10v4h3l7 4V6L6 10Z"/><path d="M16.5 9a4 4 0 0 1 0 6"/> }
      }
    </svg>
  `,
})
export class AdminIconComponent {
  readonly name = input.required<AdminIcon>();
  readonly size = input(20);
}
