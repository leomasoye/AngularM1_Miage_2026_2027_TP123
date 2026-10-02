import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { signal } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { EnvironmentInjector } from '@angular/core';

describe('authGuard', () => {
  let routerMock: any;
  let authServiceMock: any;
  let injector: EnvironmentInjector;

  beforeEach(() => {
    routerMock = {
      createUrlTree: (commands: any[]) => ({ commands } as unknown as UrlTree)
    };
    
    authServiceMock = {
      token: signal<string | null>(null)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
    });
    
    injector = TestBed.inject(EnvironmentInjector);
  });

  it('devrait retourner true si le token existe', () => {
    authServiceMock.token = signal('un-vrai-token');

    let result: any;
    runInInjectionContext(injector, () => {
      result = authGuard({} as any, {} as any);
    });

    expect(result).toBe(true);
  });

  it('devrait rediriger vers /login si aucun token', () => {
    authServiceMock.token = signal(null);

    let result: any;
    runInInjectionContext(injector, () => {
      result = authGuard({} as any, {} as any);
    });

    expect(result.commands).toEqual(['/login']);
  });
});
