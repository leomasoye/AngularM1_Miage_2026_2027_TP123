import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => {}
    } as any;

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    
    // Nettoyage avant chaque test
    localStorage.removeItem('gpc_token');
    service.token.set(null);
    service.currentUser.set(null);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait envoyer les bons identifiants et sauvegarder le token via POST /api/auth/login', () => {
    const mockResponse = { token: 'mock-jwt-token', user: { id: '1', name: 'Test', email: 'test@example.com' } };

    service.login('test@example.com', 'password123').subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'test@example.com', password: 'password123' });

    req.flush(mockResponse);

    expect(localStorage.getItem('gpc_token')).toBe('mock-jwt-token');
    expect(service.token()).toBe('mock-jwt-token');
    expect(service.currentUser()?.name).toBe('Test');
  });

  it('devrait envoyer le fichier avatar via PUT /api/users/me/avatar et mettre à jour le profil', () => {
    const mockUser = {
      id: '1',
      name: 'Test',
      email: 'test@example.com',
      avatarUrl: '/api/users/avatar/avatar-abc.png',
      createdAt: '2026-01-01',
    };
    const dummyFile = new File(['dummy-content'], 'avatar.png', { type: 'image/png' });

    service.uploadAvatar(dummyFile).subscribe((user) => {
      expect(user.avatarUrl).toBe('/api/users/avatar/avatar-abc.png');
    });

    const req = httpMock.expectOne('/api/users/me/avatar');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body instanceof FormData).toBe(true);

    req.flush(mockUser);
    expect(service.currentUser()?.avatarUrl).toBe('/api/users/avatar/avatar-abc.png');
  });

  it('devrait supprimer l avatar via DELETE /api/users/me/avatar et réinitialiser avatarUrl', () => {
    const mockUser = {
      id: '1',
      name: 'Test',
      email: 'test@example.com',
      avatarUrl: null,
      createdAt: '2026-01-01',
    };

    service.deleteAvatar().subscribe((user) => {
      expect(user.avatarUrl).toBeNull();
    });

    const req = httpMock.expectOne('/api/users/me/avatar');
    expect(req.request.method).toBe('DELETE');

    req.flush(mockUser);
    expect(service.currentUser()?.avatarUrl).toBeNull();
  });
});
