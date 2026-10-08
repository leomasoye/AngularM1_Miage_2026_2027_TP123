import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="navbar">
      <a routerLink="/" class="nav-brand">Guitar Amp</a>
      <a routerLink="/login" class="nav-link">Login</a>
      <a routerLink="/register" class="nav-link">Register</a>
      <a routerLink="/profile" class="nav-link">Profile</a>
      <a routerLink="/tracks" class="nav-link">Tracks</a>
    </nav>
  `,
  styles: [`
    .navbar { display: flex; gap: 1rem; padding: 0.5rem 1rem; background: #222; color: #fff; }
    .nav-brand { font-weight: bold; }
    .nav-link { color: #ddd; text-decoration: none; }
    .nav-link:hover { color: #fff; }
  `]
})
export class NavbarComponent {}
