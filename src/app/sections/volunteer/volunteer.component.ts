import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import disclaimer from './disclaimer.json';
import options from './volunteer-options.json';
import { VolunteerModalService } from './volunteer-modal.service';

const HASH = '#volunteer';

type AccountType = 'student' | 'volunteer';
type Status = 'idle' | 'submitting' | 'success';

interface ApiError {
  message?: string;
  errors?: Record<string, string>;
}

const PHONE_PATTERN = /^\+?[\d\s().-]{10,20}$/;

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return PHONE_PATTERN.test(value) && digits.length >= 10 && digits.length <= 15 ? null : { phone: true };
}

@Component({
  selector: 'fsu-volunteer',
  imports: [ReactiveFormsModule],
  templateUrl: './volunteer.component.html',
  styleUrl: './volunteer.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VolunteerComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly modal = inject(VolunteerModalService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private returnFocus: HTMLElement | null = null;
  private shown = false;

  readonly disclaimer = disclaimer;
  readonly accountTypes = options.accountTypes;
  readonly interestOptions = options.interests;
  readonly availabilityOptions = options.availability;

  readonly status = signal<Status>('idle');
  readonly errorMessage = signal('');
  readonly serverErrors = signal<Record<string, string>>({});
  readonly submitted = signal(false);
  readonly result = signal<{ name: string; parentEmail: string; student: boolean; emailSent: boolean } | null>(null);

  readonly form = this.fb.group({
    accountType: this.fb.control<AccountType>('student', Validators.required),
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    middleName: ['', Validators.maxLength(80)],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    parentName: ['', [Validators.required, Validators.maxLength(160)]],
    parentEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    parentPhone: ['', [Validators.required, phoneValidator]],
    phone: ['', phoneValidator],
    interests: this.fb.control<string[]>([]),
    availability: this.fb.control<string[]>([]),
    notes: ['', Validators.maxLength(1000)],
    disclaimerAccepted: [false, Validators.requiredTrue],
    website: [''],
  });

  readonly accountType = toSignal(this.form.controls.accountType.valueChanges, {
    initialValue: this.form.controls.accountType.value,
  });

  constructor() {
    effect(() => (this.modal.isOpen() ? this.showDialog() : this.hideDialog()));
    afterNextRender(() => {
      if (location.hash === HASH) this.modal.open();
    });
    inject(DestroyRef).onDestroy(() => document.documentElement.classList.remove('fsu-modal-open'));
    this.form.controls.accountType.valueChanges.subscribe((type) => this.applyAccountType(type));
    this.form.valueChanges.subscribe(() => {
      if (Object.keys(this.serverErrors()).length) this.serverErrors.set({});
      if (this.errorMessage() && this.form.valid) this.errorMessage.set('');
    });
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    if (location.hash === HASH) this.modal.open();
  }

  close(): void {
    this.modal.close();
  }

  onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.close();
  }

  onDialogClose(): void {
    this.modal.close();
  }

  private showDialog(): void {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || this.shown) return;
    this.shown = true;
    this.returnFocus = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add('fsu-modal-open');
    dialog.showModal();
    dialog.querySelector<HTMLElement>('select, input, button.fsu-vol-btn')?.focus();
  }

  private hideDialog(): void {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || !this.shown) return;
    this.shown = false;
    document.documentElement.classList.remove('fsu-modal-open');
    if (location.hash === HASH) history.replaceState(null, '', location.pathname + location.search);
    if (dialog.open) dialog.close();
    if (this.status() === 'success') this.reset();
    this.returnFocus?.focus();
    this.returnFocus = null;
  }

  isStudent(): boolean {
    return this.accountType() === 'student';
  }

  private applyAccountType(type: AccountType): void {
    const { parentName, parentEmail, parentPhone, phone } = this.form.controls;
    if (type === 'student') {
      parentName.enable({ emitEvent: false });
      parentEmail.enable({ emitEvent: false });
      parentPhone.enable({ emitEvent: false });
      phone.setValidators(phoneValidator);
    } else {
      parentName.disable({ emitEvent: false });
      parentEmail.disable({ emitEvent: false });
      parentPhone.disable({ emitEvent: false });
      phone.setValidators([Validators.required, phoneValidator]);
    }
    phone.updateValueAndValidity({ emitEvent: false });
  }

  toggle(controlName: 'interests' | 'availability', value: string, checked: boolean): void {
    const control = this.form.controls[controlName];
    const next = new Set(control.value);
    if (checked) next.add(value);
    else next.delete(value);
    control.setValue([...next]);
  }

  error(name: keyof typeof this.form.controls): string {
    const server = this.serverErrors()[name];
    if (server) return server;
    const control = this.form.controls[name];
    if (control.disabled || !control.errors || !(control.touched || this.submitted())) return '';
    const e = control.errors;
    if (e['required']) {
      if (name === 'disclaimerAccepted') return 'You must agree to the disclaimer and waiver.';
      return name.toLowerCase().includes('phone') ? 'Phone number is required.' : 'This field is required.';
    }
    if (e['email']) return 'Enter a valid email address.';
    if (e['phone']) return 'Enter a valid phone number.';
    if (e['minlength']) return `Must be at least ${e['minlength'].requiredLength} characters.`;
    if (e['maxlength']) return `Must be ${e['maxlength'].requiredLength} characters or fewer.`;
    return 'Please check this field.';
  }

  submit(): void {
    this.submitted.set(true);
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please correct the highlighted fields.');
      this.focusFirstInvalid();
      return;
    }

    const value = this.form.getRawValue();
    const student = value.accountType === 'student';
    this.status.set('submitting');
    this.http
      .post('/api/volunteers', {
        ...value,
        parentName: student ? value.parentName : undefined,
        parentEmail: student ? value.parentEmail : undefined,
        parentPhone: student ? value.parentPhone : undefined,
        disclaimerVersion: disclaimer.version,
      })
      .subscribe({
        next: (res) => {
          const emailSent = !!(res as { emailSent?: boolean }).emailSent;
          this.result.set({ name: value.firstName, parentEmail: value.parentEmail, student, emailSent });
          this.status.set('success');
        },
        error: (err: HttpErrorResponse) => {
          const body = (err.error ?? {}) as ApiError;
          this.serverErrors.set(body.errors ?? {});
          this.errorMessage.set(
            body.message ?? 'We could not submit your registration. Please check your connection and try again.',
          );
          this.status.set('idle');
          this.focusFirstInvalid();
        },
      });
  }

  private focusFirstInvalid(): void {
    setTimeout(() => this.dialog()?.nativeElement.querySelector<HTMLElement>('.is-invalid')?.focus());
  }

  reset(): void {
    this.form.reset();
    this.submitted.set(false);
    this.serverErrors.set({});
    this.errorMessage.set('');
    this.result.set(null);
    this.status.set('idle');
    this.body()?.nativeElement.scrollTo({ top: 0 });
  }
}
