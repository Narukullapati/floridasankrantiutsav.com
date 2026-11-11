import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import disclaimer from './disclaimer.json';
import options from './volunteer-options.json';

type AccountType = 'student' | 'parent' | 'volunteer';
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

  readonly disclaimer = disclaimer;
  readonly accountTypes = options.accountTypes;
  readonly interestOptions = options.interests;
  readonly availabilityOptions = options.availability;

  readonly status = signal<Status>('idle');
  readonly errorMessage = signal('');
  readonly serverErrors = signal<Record<string, string>>({});
  readonly submitted = signal(false);
  readonly result = signal<{ name: string; parentEmail: string; student: boolean } | null>(null);

  readonly form = this.fb.group({
    accountType: this.fb.control<AccountType>('student', Validators.required),
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    middleName: ['', Validators.maxLength(80)],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
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
    this.form.controls.accountType.valueChanges.subscribe((type) => this.applyAccountType(type));
    this.form.valueChanges.subscribe(() => {
      if (Object.keys(this.serverErrors()).length) this.serverErrors.set({});
      if (this.errorMessage() && this.form.valid) this.errorMessage.set('');
    });
  }

  isStudent(): boolean {
    return this.accountType() === 'student';
  }

  private applyAccountType(type: AccountType): void {
    const { parentEmail, parentPhone, phone } = this.form.controls;
    if (type === 'student') {
      parentEmail.enable({ emitEvent: false });
      parentPhone.enable({ emitEvent: false });
      phone.setValidators(phoneValidator);
    } else {
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
    if (e['maxlength']) return `Must be ${e['maxlength'].requiredLength} characters or fewer.`;
    return 'Please check this field.';
  }

  submit(): void {
    this.submitted.set(true);
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please correct the highlighted fields.');
      queueMicrotask(() => document.querySelector<HTMLElement>('.fsu-vol-form .is-invalid')?.focus());
      return;
    }

    const value = this.form.getRawValue();
    const student = value.accountType === 'student';
    this.status.set('submitting');
    this.http
      .post('/api/volunteers', {
        ...value,
        parentEmail: student ? value.parentEmail : undefined,
        parentPhone: student ? value.parentPhone : undefined,
        disclaimerVersion: disclaimer.version,
      })
      .subscribe({
        next: () => {
          this.result.set({ name: value.firstName, parentEmail: value.parentEmail, student });
          this.status.set('success');
          document.getElementById('volunteer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        error: (err: HttpErrorResponse) => {
          const body = (err.error ?? {}) as ApiError;
          this.serverErrors.set(body.errors ?? {});
          this.errorMessage.set(
            body.message ?? 'We could not submit your registration. Please check your connection and try again.',
          );
          this.status.set('idle');
        },
      });
  }

  reset(): void {
    this.form.reset();
    this.submitted.set(false);
    this.serverErrors.set({});
    this.errorMessage.set('');
    this.result.set(null);
    this.status.set('idle');
  }
}
