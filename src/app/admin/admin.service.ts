import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type AccountType = 'student' | 'parent' | 'volunteer';
export type ConsentStatus = 'not_required' | 'pending' | 'confirmed';

export interface Volunteer {
  id: number;
  accountType: AccountType;
  accountTypeLabel: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
  interests: string[];
  availability: string[];
  notes: string | null;
  disclaimerVersion: string;
  disclaimerAcceptedAt: string;
  acceptedIp: string | null;
  userAgent: string | null;
  parentConsentStatus: ConsentStatus;
  parentConsentAt: string | null;
  parentConsentIp: string | null;
  createdAt: string;
}

const BASE = '/api/admin';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  readonly csvUrl = `${BASE}/volunteers.csv`;

  me(): Observable<{ user: string }> {
    return this.http.get<{ user: string }>(`${BASE}/me`);
  }

  login(username: string, password: string): Observable<{ user: string }> {
    return this.http.post<{ user: string }>(`${BASE}/login`, { username, password });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${BASE}/logout`, {});
  }

  volunteers(): Observable<{ volunteers: Volunteer[] }> {
    return this.http.get<{ volunteers: Volunteer[] }>(`${BASE}/volunteers`);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/volunteers/${id}`);
  }
}
