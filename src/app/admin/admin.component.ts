import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountType, AdminService, ConsentStatus, Volunteer } from './admin.service';

type AuthState = 'checking' | 'signedOut' | 'signedIn';

const TIME_ZONE = 'America/New_York';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit {
  private readonly api = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly csvUrl = this.api.csvUrl;
  readonly auth = signal<AuthState>('checking');
  readonly user = signal('');
  readonly signingIn = signal(false);
  readonly loginError = signal('');

  readonly volunteers = signal<Volunteer[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly selected = signal<Volunteer | null>(null);
  readonly deleting = signal(false);

  readonly query = signal('');
  readonly typeFilter = signal<AccountType | ''>('');
  readonly consentFilter = signal<ConsentStatus | ''>('');

  readonly loginForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  readonly stats = computed(() => {
    const list = this.volunteers();
    const count = (fn: (v: Volunteer) => boolean) => list.filter(fn).length;
    return {
      total: list.length,
      students: count((v) => v.accountType === 'student'),
      parents: count((v) => v.accountType === 'parent'),
      community: count((v) => v.accountType === 'volunteer'),
      pending: count((v) => v.parentConsentStatus === 'pending'),
    };
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    const consent = this.consentFilter();
    return this.volunteers().filter((v) => {
      if (type && v.accountType !== type) return false;
      if (consent && v.parentConsentStatus !== consent) return false;
      if (!q) return true;
      return [this.fullName(v), v.email, v.phone, v.parentEmail, v.parentPhone]
        .some((field) => field?.toLowerCase().includes(q));
    });
  });

  constructor() {
    document.title = 'Volunteer Admin · Florida Sankranti Utsav';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);

    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.selected() && !dialog.open) dialog.showModal();
      if (!this.selected() && dialog.open) dialog.close();
    });
  }

  ngOnInit(): void {
    this.api.me().subscribe({
      next: ({ user }) => this.signedIn(user),
      error: () => this.auth.set('signedOut'),
    });
  }

  signIn(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { username, password } = this.loginForm.getRawValue();
    this.signingIn.set(true);
    this.loginError.set('');
    this.api.login(username.trim(), password).subscribe({
      next: ({ user }) => {
        this.signingIn.set(false);
        this.loginForm.reset();
        this.signedIn(user);
      },
      error: (err: HttpErrorResponse) => {
        this.signingIn.set(false);
        this.loginError.set(err.error?.message ?? 'Could not sign in. Please try again.');
      },
    });
  }

  signOut(): void {
    this.api.logout().subscribe({ complete: () => this.signedOut(), error: () => this.signedOut() });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.volunteers().subscribe({
      next: ({ volunteers }) => {
        this.volunteers.set(volunteers);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => this.handleError(err, 'Could not load volunteers.'),
    });
  }

  open(v: Volunteer): void {
    this.selected.set(v);
  }

  close(): void {
    this.selected.set(null);
  }

  onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.close();
  }

  remove(v: Volunteer): void {
    if (!confirm(`Delete the registration for ${this.fullName(v)} (${v.email})? This cannot be undone.`)) return;
    this.deleting.set(true);
    this.api.remove(v.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.volunteers.update((list) => list.filter((x) => x.id !== v.id));
        this.close();
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.handleError(err, 'Could not delete the registration.');
      },
    });
  }

  clearFilters(): void {
    this.query.set('');
    this.typeFilter.set('');
    this.consentFilter.set('');
  }

  fullName(v: Volunteer): string {
    return [v.firstName, v.middleName, v.lastName].filter(Boolean).join(' ');
  }

  consentLabel(status: ConsentStatus): string {
    return { not_required: 'Not required', pending: 'Pending', confirmed: 'Confirmed' }[status];
  }

  formatDate(value: string | null, withTime = true): string {
    if (!value) return '—';
    const date = new Date(`${value.replace(' ', 'T')}Z`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-US', {
      timeZone: TIME_ZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } : {}),
    });
  }

  private signedIn(user: string): void {
    this.user.set(user);
    this.auth.set('signedIn');
    this.load();
  }

  private signedOut(): void {
    this.close();
    this.volunteers.set([]);
    this.user.set('');
    this.auth.set('signedOut');
  }

  private handleError(err: HttpErrorResponse, fallback: string): void {
    this.loading.set(false);
    if (err.status === 401) {
      this.signedOut();
      this.loginError.set('Your session has expired. Please sign in again.');
      return;
    }
    this.loadError.set(err.error?.message ?? fallback);
  }
}
