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
import { AdminIcon, AdminIconComponent } from './admin-icon.component';
import { AccountType, AdminService, ConsentStatus, Volunteer } from './admin.service';

type AuthState = 'checking' | 'signedOut' | 'signedIn';
type View = 'home' | 'list';
type StatKey = 'total' | 'students' | 'parents' | 'community' | 'pending' | 'confirmed' | 'notRequired';

export interface NavLink {
  key: string;
  label: string;
  hint: string;
  icon: AdminIcon;
  tone: 'indigo' | 'teal' | 'orange' | 'rose' | 'blue' | 'green' | 'slate';
  stat?: StatKey;
  type?: AccountType;
  consent?: ConsentStatus;
}

export interface NavGroup {
  key: string;
  label: string;
  links: NavLink[];
}

const NAV: NavGroup[] = [
  {
    key: 'volunteers',
    label: 'Volunteers',
    links: [
      { key: 'all', label: 'All volunteers', hint: 'Every registration', icon: 'users', tone: 'indigo', stat: 'total' },
      { key: 'student', label: 'Students', hint: 'Student volunteers', icon: 'student', tone: 'blue', stat: 'students', type: 'student' },
      { key: 'parent', label: 'Parents', hint: 'Parent volunteers', icon: 'parent', tone: 'teal', stat: 'parents', type: 'parent' },
      { key: 'volunteer', label: 'Community', hint: 'Community volunteers', icon: 'heart', tone: 'rose', stat: 'community', type: 'volunteer' },
    ],
  },
  {
    key: 'consent',
    label: 'Parent consent',
    links: [
      { key: 'pending', label: 'Consent pending', hint: 'Waiting on parent/guardian', icon: 'clock', tone: 'orange', stat: 'pending', consent: 'pending' },
      { key: 'confirmed', label: 'Consent confirmed', hint: 'Parent/guardian approved', icon: 'check', tone: 'green', stat: 'confirmed', consent: 'confirmed' },
      { key: 'not_required', label: 'Not required', hint: 'Adult volunteers', icon: 'minus', tone: 'slate', stat: 'notRequired', consent: 'not_required' },
    ],
  },
];

const TIME_ZONE = 'America/New_York';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, AdminIconComponent],
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

  readonly nav = NAV;
  readonly view = signal<View>('home');
  readonly activeKey = signal('home');
  readonly navOpen = signal(typeof window === 'undefined' || window.innerWidth > 960);
  readonly collapsed = signal<ReadonlySet<string>>(new Set());

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
      confirmed: count((v) => v.parentConsentStatus === 'confirmed'),
      notRequired: count((v) => v.parentConsentStatus === 'not_required'),
    };
  });

  readonly activeLink = computed(() =>
    this.nav.flatMap((g) => g.links).find((l) => l.key === this.activeKey()) ?? null);

  readonly pageTitle = computed(() => (this.view() === 'home' ? 'Home' : this.activeLink()?.label ?? 'Volunteers'));

  readonly notice = computed(() => {
    const { pending, total } = this.stats();
    if (pending) {
      return `${pending} student registration${pending === 1 ? ' is' : 's are'} waiting for parent/guardian consent — open "Consent pending" to follow up.`;
    }
    return `${total} volunteer registration${total === 1 ? '' : 's'} so far — no student registrations are waiting for parent consent.`;
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

  goHome(): void {
    this.view.set('home');
    this.activeKey.set('home');
    this.closeNavOnMobile();
  }

  show(link: NavLink): void {
    this.query.set('');
    this.typeFilter.set(link.type ?? '');
    this.consentFilter.set(link.consent ?? '');
    this.activeKey.set(link.key);
    this.view.set('list');
    this.closeNavOnMobile();
  }

  toggleGroup(key: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  statFor(link: NavLink): number {
    return link.stat ? this.stats()[link.stat] : 0;
  }

  syncActiveFromFilters(): void {
    const type = this.typeFilter();
    const consent = this.consentFilter();
    const match = this.nav.flatMap((g) => g.links)
      .find((l) => (l.type ?? '') === type && (l.consent ?? '') === consent);
    this.activeKey.set(match?.key ?? 'all');
  }

  closeNavOnMobile(): void {
    if (window.innerWidth <= 960) this.navOpen.set(false);
  }

  clearFilters(): void {
    this.query.set('');
    this.typeFilter.set('');
    this.consentFilter.set('');
    this.activeKey.set('all');
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
    this.view.set('home');
    this.activeKey.set('home');
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
