import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { AuthResponse } from '../models/auth-response.model';
import { User } from '../models/user.model';

/** Handles authentication and the current user's profile. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('gpc_token') : null
  );
  readonly currentUser = signal<User | null>(this.loadInitialUser());
  readonly isLoggedIn = computed(() => !!this.token());

  private loadInitialUser(): User | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const token = localStorage.getItem('gpc_token');
    if (!token) {
      return null;
    }
    const saved = localStorage.getItem('gpc_user');
    if (!saved) {
      return null;
    }
    try {
      return JSON.parse(saved) as User;
    } catch {
      return null;
    }
  }

  private setCurrentUser(user: User | null): void {
    this.currentUser.set(user);
    if (typeof localStorage !== 'undefined') {
      if (user) {
        localStorage.setItem('gpc_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('gpc_user');
      }
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  register(name: string, email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/register', { name, email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  profile() {
    return this.http
      .get<User>('/api/users/me')
      .pipe(tap((user) => this.setCurrentUser(user)));
  }

  update(name: string) {
    return this.http
      .put<User>('/api/users/me', { name })
      .pipe(tap((user) => this.setCurrentUser(user)));
  }

  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http
      .put<User>('/api/users/me/avatar', formData)
      .pipe(tap((user) => this.setCurrentUser(user)));
  }

  deleteAvatar() {
    return this.http
      .delete<User>('/api/users/me/avatar')
      .pipe(tap((user) => this.setCurrentUser(user)));
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('gpc_token');
      localStorage.removeItem('gpc_user');
    }
    this.token.set(null);
    this.currentUser.set(null);
  }

  private storeAuthentication(response: AuthResponse): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gpc_token', response.token);
    }
    this.token.set(response.token);
    this.setCurrentUser(response.user);
  }
}
