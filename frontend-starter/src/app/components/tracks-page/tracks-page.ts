import {
  Component,
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
import { MatFormFieldModule, MatMenuModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { TrackUploadComponent } from './track-upload/track-upload.component';
import { LikeButtonComponent } from '../like-button/like-button';
import { TrackCardComponent } from './track-card/track-card.component';
import { TrackPaginationComponent } from './track-pagination/track-pagination.component';

@Component({
  imports: [
    ReactiveFormsModule, 
    DatePipe, 
    TrackUploadComponent, 
    TrackCardComponent, 
    TrackPaginationComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSelectModule,
    MatFormFieldModule, MatMenuModule
  ],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
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

  // Signaux pour l'upload (Mission 3)
  readonly uploading = signal(false);
  readonly uploadProgress = signal<number | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<string | null>(null);

  // Signaux pour la suppression et le snackbar
  readonly deletingTrackId = signal<string | null>(null);
  readonly snackBarMessage = signal<{text: string, type: 'success' | 'error'} | null>(null);

  // Signaux pour le lecteur audio (Mission 3)
  readonly audioUrl = signal('');
  readonly playingTrack = signal<Track | null>(null);
  readonly loadingAudioId = signal<string | null>(null);
  readonly audioError = signal<string | null>(null);

  // Formulaire d'upload
  readonly title = new FormControl('', { nonNullable: true });
  file?: File;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    // Libération de la mémoire : révocation de l'ObjectURL à la destruction du composant
    const currentUrl = this.audioUrl();
    if (currentUrl) {
      console.debug('[TracksPage] Nettoyage : révocation de l\'URL audio');
      URL.revokeObjectURL(currentUrl);
    }
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

    // Validation taille (<= 25 Mo) côté client
    if (selectedFile.size > this.MAX_FILE_SIZE) {
      const sizeMo = (selectedFile.size / (1024 * 1024)).toFixed(1);
      this.uploadError.set(
        `Fichier trop volumineux (${sizeMo} Mo). La taille maximale autorisée est de 25 Mo.`
      );
      this.file = undefined;
      input.value = '';
      return;
    }

    // Validation format audio côté client
    const isMimeAllowed = this.ALLOWED_MIME_TYPES.has(selectedFile.type);
    const hasAudioExt = /\.(mp3|wav|ogg|m4a|mp4)$/i.test(selectedFile.name);

    if (!isMimeAllowed && !hasAudioExt) {
      this.uploadError.set(
        'Format non accepté. Formats autorisés : MP3, WAV, OGG, M4A.'
      );
      this.file = undefined;
      input.value = '';
      return;
    }

    this.file = selectedFile;
    console.debug('[TracksPage] Fichier sélectionné valide :', this.file.name);

    // Pré-remplir le titre si non renseigné
    if (!this.title.value.trim()) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      this.title.setValue(nameWithoutExt);
    }
  }

  load(): void {
    this.loading.set(true);
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
        this.error.set(error?.error?.message || 'Impossible de charger la bibliothèque audio.');
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

    // Double vérification frontend de sécurité
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

          // Effacer le message de succès après 5 secondes
          setTimeout(() => this.uploadSuccess.set(null), 5000);

          // Réinitialiser le formulaire
          this.title.setValue('');
          this.file = undefined;
          const input = this.fileInputRef()?.nativeElement;
          if (input) {
            input.value = '';
          }

          // Recharger la première page pour voir le nouveau morceau en haut
          this.page.set(1);
          this.load();
        }
      },
      error: (error) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.uploadProgress.set(null);
        const message =
          error?.error?.message ||
          'Une erreur est survenue lors de l\'envoi du fichier audio.';
        this.uploadError.set(message);
      },
    });
  }

  toggleVisibility(track: Track): void {
    const newVisibility = track.visibility === 'public' ? 'private' : 'public';
    this.trackService.updateVisibility(track.id, newVisibility).subscribe({
      next: (updatedTrack) => {
        this.tracks.update(tracks => tracks.map(t => t.id === updatedTrack.id ? updatedTrack : t));
        this.showSnackBar(`La piste est maintenant ${newVisibility === 'public' ? 'publique' : 'privée'}.`, 'success');
      },
      error: () => this.showSnackBar('Erreur lors de la modification de la visibilité.', 'error')
    });
  }

  deleteTrack(track: Track): void {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la piste "${track.title}" ?`)) return;

    this.deletingTrackId.set(track.id);
    this.service.delete(track.id).subscribe({
      next: () => {
        this.deletingTrackId.set(null);
        this.showSnackBar(`Piste "${track.title}" supprimée avec succès.`, 'success');

        if (this.playingTrack()?.id === track.id) {
          this.stop();
        }

        // Check if we need to go to previous page (if it was the last element on the current page)
        if (this.tracks().length === 1 && this.page() > 1) {
          this.page.set(this.page() - 1);
        }
        
        this.load();
      },
      error: (error) => {
        this.deletingTrackId.set(null);
        const message = error?.error?.message || 'Erreur lors de la suppression de la piste.';
        this.showSnackBar(message, 'error');
        
        if (error.status === 404 || error.status === 403) {
          this.load();
        }
      }
    });
  }

  private snackBar = inject(MatSnackBar);

  private showSnackBar(text: string, type: 'success' | 'error'): void {
    this.snackBar.open(text, 'Fermer', {
      duration: 4000,
      panelClass: type === 'error' ? ['snackbar-error'] : ['snackbar-success'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  play(track: Track): void {
    // Si la piste est déjà en cours de lecture, un second clic coupe l'écoute
    if (this.playingTrack()?.id === track.id && this.audioUrl()) {
      this.stop();
      return;
    }

    this.audioError.set(null);
    this.loadingAudioId.set(track.id);

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé avec succès', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }

        this.audioUrl.set(URL.createObjectURL(blob));
        this.playingTrack.set(track);
        this.loadingAudioId.set(null);
      },
      error: (error) => {
        console.error('[TracksPage] Lecture impossible', error);
        this.audioError.set(
          error?.error?.message || `Impossible de lire la piste "${track.title}".`
        );
        this.loadingAudioId.set(null);
      },
    });
  }

  stop(): void {
    const currentUrl = this.audioUrl();
    if (currentUrl) {
      console.debug('[TracksPage] Arrêt de la lecture et révocation de l\'URL');
      URL.revokeObjectURL(currentUrl);
      this.audioUrl.set('');
    }
    this.playingTrack.set(null);
    this.loadingAudioId.set(null);
  }

  formatSize(bytes: number): string {
    if (!bytes && bytes !== 0) return '0 Ko';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} Ko`;
    }
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
}


