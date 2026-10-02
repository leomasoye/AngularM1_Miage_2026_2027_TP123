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
});
