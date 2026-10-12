import { Component, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSnackBar } from "@angular/material/snack-bar";
import { FriendsService } from "../../shared/services/friends.service";
import { ShareService } from "../../shared/services/share.service";
import { Track } from "../../shared/models/track.model";
import { forkJoin } from "rxjs";

export interface ShareModalData {
  track: Track;
}

interface FriendItem {
  friendId: string;
  friendName: string;
}

@Component({
  selector: "app-share-modal",
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: "./share-modal.component.html",
  styleUrl: "./share-modal.component.css",
})
export class ShareModalComponent implements OnInit {
  readonly data: ShareModalData = inject(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ShareModalComponent>);
  private readonly friendsService = inject(FriendsService);
  private readonly shareService = inject(ShareService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly savingUserId = signal<string | null>(null);
  readonly friends = signal<FriendItem[]>([]);
  readonly sharedUserIds = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      friendships: this.friendsService.getFriends(),
      shares: this.shareService.getSharesForTrack(this.data.track.id),
    }).subscribe({
      next: ({ friendships, shares }) => {
        const acceptedFriends: FriendItem[] = friendships
          .filter((f) => f.status === "accepted")
          .map((f) => ({ friendId: f.friendId, friendName: f.friendName }));

        const sharedSet = new Set<string>(shares.map((s) => s.userId));

        this.friends.set(acceptedFriends);
        this.sharedUserIds.set(sharedSet);
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open("Erreur de chargement des partages", "Fermer", {
          duration: 3000,
        });
        this.loading.set(false);
      },
    });
  }

  isShared(friendId: string): boolean {
    return this.sharedUserIds().has(friendId);
  }

  toggleShare(friend: FriendItem): void {
    const friendId = friend.friendId;
    const currentlyShared = this.isShared(friendId);
    this.savingUserId.set(friendId);

    if (currentlyShared) {
      this.shareService.unshareTrack(this.data.track.id, friendId).subscribe({
        next: () => {
          this.sharedUserIds.update((set) => {
            const next = new Set(set);
            next.delete(friendId);
            return next;
          });
          this.savingUserId.set(null);
          this.snackBar.open(`Partage retiré pour ${friend.friendName}`, "Fermer", {
            duration: 2500,
          });
        },
        error: () => {
          this.savingUserId.set(null);
          this.snackBar.open("Erreur lors du retrait du partage", "Fermer", {
            duration: 3000,
          });
        },
      });
    } else {
      this.shareService.shareTrack(this.data.track.id, friendId).subscribe({
        next: () => {
          this.sharedUserIds.update((set) => {
            const next = new Set(set);
            next.add(friendId);
            return next;
          });
          this.savingUserId.set(null);
          this.snackBar.open(`Morceau partagé avec ${friend.friendName}`, "Fermer", {
            duration: 2500,
          });
        },
        error: () => {
          this.savingUserId.set(null);
          this.snackBar.open("Erreur lors du partage", "Fermer", {
            duration: 3000,
          });
        },
      });
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
