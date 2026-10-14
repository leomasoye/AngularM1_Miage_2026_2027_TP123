import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ActivityService } from "../../shared/services/activity.service";
import { TrackService } from "../../shared/services/track.service";
import { PlayerService } from "../../shared/services/player.service";
import { ActivityTrack } from "../../shared/models/activity.model";
import { LikeButtonComponent } from "../like-button/like-button";
import { AvatarComponent } from "../../shared/components/avatar/avatar.component";
import { fromEvent, timer } from "rxjs";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-activity-feed",
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LikeButtonComponent,
    AvatarComponent,
  ],
  templateUrl: "./activity-feed.component.html",
  styleUrl: "./activity-feed.component.css",
})
export class ActivityFeedComponent implements OnInit {
  private readonly activityService = inject(ActivityService);
  private readonly trackService = inject(TrackService);
  readonly player = inject(PlayerService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly activities = signal<ActivityTrack[]>([]);
  readonly hasMore = signal(false);
  readonly nextCursor = signal<string | null>(null);

  // Audio player state unifié
  readonly playingTrack = computed(() => this.player.currentTrack());
  readonly loadingAudioId = computed(() =>
    this.player.isLoading() && this.player.currentTrack()
      ? this.player.currentTrack()!.id
      : null
  );

  ngOnInit(): void {
    this.loadInitialActivity();
    this.setupPolling();
  }

  loadInitialActivity(): void {
    const cached = this.activityService.getCachedActivity();
    if (cached) {
      this.activities.set(cached.items);
      this.hasMore.set(cached.hasMore);
      this.nextCursor.set(cached.nextCursor);
      this.loading.set(false);
    } else {
      this.loading.set(true);
    }

    this.activityService.getActivity().subscribe({
      next: (res) => {
        this.activities.set(res.items);
        this.hasMore.set(res.hasMore);
        this.nextCursor.set(res.nextCursor);
        this.loading.set(false);
      },
      error: () => {
        if (!cached) {
          this.snackBar.open("Erreur lors du chargement du fil d'activité", "Fermer", {
            duration: 3000,
          });
        }
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.activityService.getActivity(cursor).subscribe({
      next: (res) => {
        this.activities.update((current) => [...current, ...res.items]);
        this.hasMore.set(res.hasMore);
        this.nextCursor.set(res.nextCursor);
        this.loadingMore.set(false);
      },
      error: () => {
        this.snackBar.open("Erreur lors du chargement des activités suivantes", "Fermer", {
          duration: 3000,
        });
        this.loadingMore.set(false);
      },
    });
  }

  private setupPolling(): void {
    // Polling toutes les 30s suspendu si onglet inactif
    timer(30000, 30000)
      .pipe(
        filter(() => typeof document !== "undefined" && document.visibilityState === "visible"),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.pollUpdates();
      });

    // Re-check dès que l'onglet redevient visible
    if (typeof document !== "undefined") {
      fromEvent(document, "visibilitychange")
        .pipe(
          filter(() => document.visibilityState === "visible"),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          this.pollUpdates();
        });
    }
  }

  private pollUpdates(): void {
    this.activityService.getActivity().subscribe({
      next: (res) => {
        const currentIds = new Set(this.activities().map((a) => a.id));
        const newItems = res.items.filter((item) => !currentIds.has(item.id));

        if (newItems.length > 0) {
          this.activities.update((current) => [...newItems, ...current]);
          this.snackBar.open(
            `${newItems.length} nouvelle${newItems.length > 1 ? "s" : ""} activité${newItems.length > 1 ? "s" : ""} de vos amis !`,
            "Voir",
            { duration: 4000 }
          );
        }
      },
      error: () => {
        // En cas d'erreur de polling silencieuse, ne pas spammer
      },
    });
  }

  play(track: ActivityTrack): void {
    if (this.player.currentTrack()?.id === track.id) {
      void this.player.togglePlay();
    } else {
      void this.player.playTrack(track as any);
    }
  }

  addToQueue(track: ActivityTrack): void {
    this.player.addToQueue(track as any);
    this.snackBar.open(`"${track.title}" ajouté à la file d'attente.`, 'Fermer', {
      duration: 3000,
      panelClass: ['snackbar-success'],
    });
  }

  stop(): void {
    this.player.stop();
  }

  onTrackLiked(updated: any): void {
    this.activities.update((items) =>
      items.map((item) => (item.id === updated.id ? { ...item, likes: updated.likes } : item))
    );
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
}
