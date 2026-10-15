import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { FriendsService } from '../../shared/services/friends.service';
import { fromEvent, of, timer } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';

import { PlayerBarComponent } from '../player-bar/player-bar.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { AudioReactiveGlowComponent } from '../audio-reactive-glow/audio-reactive-glow.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    PlayerBarComponent,
    AvatarComponent,
    AudioReactiveGlowComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly friendsService = inject(FriendsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pendingCount = signal(0);

  ngOnInit(): void {
    this.setupPendingPolling();
  }

  private setupPendingPolling(): void {
    timer(0, 30000)
      .pipe(
        filter(
          () =>
            this.auth.isLoggedIn() &&
            typeof document !== 'undefined' &&
            document.visibilityState === 'visible'
        ),
        switchMap(() =>
          this.friendsService.getPending().pipe(catchError(() => of({ count: 0, items: [] })))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        this.pendingCount.set(res.count);
      });

    if (typeof document !== 'undefined') {
      fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.auth.isLoggedIn() && document.visibilityState === 'visible'),
          switchMap(() =>
            this.friendsService.getPending().pipe(catchError(() => of({ count: 0, items: [] })))
          ),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((res) => {
          this.pendingCount.set(res.count);
        });
    }
  }

  logout(): void {
    this.auth.logout();
    this.pendingCount.set(0);
    void this.router.navigateByUrl('/login');
  }
}
