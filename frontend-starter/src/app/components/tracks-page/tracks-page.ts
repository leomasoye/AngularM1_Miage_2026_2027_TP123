import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { TrackUploadComponent } from './track-upload/track-upload.component';
import { LikeButtonComponent } from '../like-button/like-button';
import { ShareModalComponent } from '../share-modal/share-modal.component';
import { AddToPlaylistModalComponent } from '../add-to-playlist-modal/add-to-playlist-modal.component';
import { PlayerService } from '../../shared/services/player.service';

@Component({
  imports: [
    ReactiveFormsModule,
    DatePipe,
    TrackUploadComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDialogModule,
    LikeButtonComponent,
  ],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  readonly player = inject(PlayerService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // Limite et formats autorisés (alignés sur le backend)
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo
  private readonly ALLOWED_MIME_TYPES = new Set([
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a',
  ]);

  // Signaux pour la liste et la pagination
  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly limit = signal(5);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Signaux pour l'upload
  readonly uploading = signal(false);
  readonly uploadProgress = signal<number | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<string | null>(null);

  // Signaux pour la suppression
  readonly deletingTrackId = signal<string | null>(null);

  // Signaux pour le lecteur audio unifié
  readonly playingTrack = computed(() => this.player.currentTrack());
  readonly loadingAudioId = computed(() =>
    this.player.isLoading() && this.player.currentTrack()
      ? this.player.currentTrack()!.id
      : null
  );
  readonly audioError = computed(() => this.player.error());

  // Formulaire d'upload
  readonly title = new FormControl('', { nonNullable: true });
  file?: File;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    // Nettoyage si nécessaire
  }

  choose(event: Event): void {
    this.uploadError.set(null);
    this.uploadSuccess.set(null);
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0];

    if (!selectedFile) {
      this.file = undefined;
      return;
    }

    if (selectedFile.size > this.MAX_FILE_SIZE) {
      const sizeMo = (selectedFile.size / (1024 * 1024)).toFixed(1);
      this.uploadError.set(
        `Fichier trop volumineux (${sizeMo} Mo). La taille maximale autorisée est de 25 Mo.`
      );
      this.file = undefined;
      input.value = '';
      return;
    }

    const isMimeAllowed = this.ALLOWED_MIME_TYPES.has(selectedFile.type);
    const hasAudioExt = /\.(mp3|wav|ogg|m4a|mp4)$/i.test(selectedFile.name);

    if (!isMimeAllowed && !hasAudioExt) {
      this.uploadError.set('Format non accepté. Formats autorisés : MP3, WAV, OGG, M4A.');
      this.file = undefined;
      input.value = '';
      return;
    }

    this.file = selectedFile;
    console.debug('[TracksPage] Fichier sélectionné valide :', this.file.name);

    if (!this.title.value.trim()) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      this.title.setValue(nameWithoutExt);
    }
  }

  load(): void {
    const cached = this.service.getCached(this.page(), this.limit());
    if (cached) {
      this.tracks.set(cached.items);
      this.pages.set(cached.pages);
      this.total.set(cached.total);
      this.loading.set(false);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('[TracksPage] Chargement impossible', error);
        if (!cached) {
          this.error.set(error?.error?.message || 'Impossible de charger la bibliothèque audio.');
        }
        this.loading.set(false);
      },
    });
  }

  go(page: number): void {
    if (page < 1 || (this.pages() > 0 && page > this.pages())) return;
    this.page.set(page);
    this.load();
  }

  changeLimit(newLimit: number): void {
    this.limit.set(newLimit);
    this.page.set(1);
    this.load();
  }

  upload(): void {
    if (!this.file || this.uploading()) return;

    if (this.file.size > this.MAX_FILE_SIZE) {
      this.uploadError.set('Le fichier dépasse la limite autorisée de 25 Mo.');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    const trackTitle = this.title.value.trim() || this.file.name;

    this.service.upload(this.file, trackTitle).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const percentDone = Math.round(100 * event.loaded / event.total);
          this.uploadProgress.set(percentDone);
        } else if (event.type === HttpEventType.Response) {
          const track = event.body!;
          console.debug('[TracksPage] Piste envoyée avec succès', track.id);
          this.uploading.set(false);
          this.uploadProgress.set(null);
          this.uploadSuccess.set(`Piste "${track.title}" importée avec succès !`);
          setTimeout(() => this.uploadSuccess.set(null), 5000);
          this.title.setValue('');
          this.file = undefined;
          const input = this.fileInputRef()?.nativeElement;
          if (input) input.value = '';
          this.page.set(1);
          this.load();
        }
      },
      error: (error) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.uploadProgress.set(null);
        const message = error?.error?.message || 'Une erreur est survenue lors de l\'envoi du fichier audio.';
        this.uploadError.set(message);
      },
    });
  }

  toggleVisibility(track: Track): void {
    const oldVisibility = track.visibility;
    const newVisibility = oldVisibility === 'public' ? 'private' : 'public';

    // ⚡ Optimistic Update : retour visuel instantané
    this.tracks.update(tracks => tracks.map(t => t.id === track.id ? { ...t, visibility: newVisibility } : t));
    this.showSnackBar(`La piste est maintenant ${newVisibility === 'public' ? 'publique' : 'privée'}.`, 'success');

    this.service.updateVisibility(track.id, newVisibility).subscribe({
      next: (updatedTrack) => {
        this.tracks.update(tracks => tracks.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      },
      error: () => {
        // Rollback si échec
        this.tracks.update(tracks => tracks.map(t => t.id === track.id ? { ...t, visibility: oldVisibility } : t));
        this.showSnackBar('Erreur lors de la modification de la visibilité.', 'error');
      }
    });
  }

  onTrackLiked(updatedTrack: Track): void {
    this.tracks.update(tracks => tracks.map(t => t.id === updatedTrack.id ? updatedTrack : t));
  }

  deleteTrack(track: Track): void {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la piste "${track.title}" ?`)) return;

    const previousTracks = this.tracks();
    // ⚡ Optimistic Update : suppression immédiate de l'écran
    this.tracks.update(tracks => tracks.filter(t => t.id !== track.id));
    this.total.update(tot => Math.max(0, tot - 1));
    this.showSnackBar(`Piste "${track.title}" supprimée avec succès.`, 'success');
    if (this.playingTrack()?.id === track.id) this.stop();

    this.service.delete(track.id).subscribe({
      next: () => {
        if (this.tracks().length === 0 && this.page() > 1) {
          this.page.set(this.page() - 1);
          this.load();
        }
      },
      error: (error) => {
        // Rollback
        this.tracks.set(previousTracks);
        this.total.update(tot => tot + 1);
        const message = error?.error?.message || 'Erreur lors de la suppression de la piste.';
        this.showSnackBar(message, 'error');
        if (error.status === 404 || error.status === 403) this.load();
      }
    });
  }

  private showSnackBar(text: string, type: 'success' | 'error'): void {
    this.snackBar.open(text, 'Fermer', {
      duration: 4000,
      panelClass: type === 'error' ? ['snackbar-error'] : ['snackbar-success'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  play(track: Track): void {
    if (this.player.currentTrack()?.id === track.id) {
      void this.player.togglePlay();
    } else {
      void this.player.playTrack(track);
    }
  }

  addToQueue(track: Track): void {
    this.player.addToQueue(track);
    this.showSnackBar(`"${track.title}" ajouté à la file d'attente.`, 'success');
  }

  stop(): void {
    this.player.stop();
  }

  formatSize(bytes: number): string {
    if (!bytes && bytes !== 0) return '0 Ko';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  }

  formatAudioType(mimeType: string, filename: string): string {
    if (mimeType?.includes('mpeg') || filename?.toLowerCase().endsWith('.mp3')) return 'MP3';
    if (mimeType?.includes('wav') || filename?.toLowerCase().endsWith('.wav')) return 'WAV';
    if (mimeType?.includes('ogg') || filename?.toLowerCase().endsWith('.ogg')) return 'OGG';
    if (mimeType?.includes('m4a') || filename?.toLowerCase().endsWith('.m4a')) return 'M4A';
    if (mimeType?.includes('mp4') || filename?.toLowerCase().endsWith('.mp4')) return 'MP4';
    return mimeType?.replace('audio/', '').toUpperCase() || 'AUDIO';
  }

  openShareModal(track: Track): void {
    this.dialog.open(ShareModalComponent, {
      data: { track },
      width: '480px',
    });
  }

  openAddToPlaylist(track: Track): void {
    this.dialog.open(AddToPlaylistModalComponent, {
      data: { track },
      width: '460px',
    });
  }
}
