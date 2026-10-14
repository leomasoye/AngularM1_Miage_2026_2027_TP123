import { Component, inject, signal, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { AuthService } from '../../shared/services/auth.service';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  imports: [
    ReactiveFormsModule,
    SlicePipe,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    AvatarComponent,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isUploadingAvatar = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  ngOnInit() {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set('');

    this.auth.profile().subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.form.patchValue({ name: user.name });
      },
      error: (err: { error?: { message?: string } }) => {
        this.isLoading.set(false);
        this.error.set(err.error?.message ?? 'Impossible de charger le profil');
      }
    });
  }

  save(): void {
    if (this.form.invalid) return;

    this.isSaving.set(true);
    this.error.set('');
    this.success.set('');

    const newName = this.form.getRawValue().name;
    this.auth.update(newName).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.success.set('Profil mis à jour avec succès.');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSaving.set(false);
        this.error.set(err.error?.message ?? 'Impossible de mettre à jour le profil');
      }
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.error.set("L'image dépasse la taille maximale autorisée de 5 Mo.");
      return;
    }

    this.isUploadingAvatar.set(true);
    this.error.set('');
    this.success.set('');

    this.auth.uploadAvatar(file).subscribe({
      next: () => {
        this.isUploadingAvatar.set(false);
        this.success.set('Photo de profil mise à jour avec succès.');
        setTimeout(() => this.success.set(''), 3000);
        input.value = '';
      },
      error: (err: { error?: { message?: string } }) => {
        this.isUploadingAvatar.set(false);
        this.error.set(err.error?.message ?? "Erreur lors de l'envoi de la photo");
        input.value = '';
      },
    });
  }

  deleteAvatar(): void {
    if (!window.confirm('Voulez-vous vraiment supprimer votre photo de profil ?')) return;

    this.isUploadingAvatar.set(true);
    this.error.set('');
    this.success.set('');

    this.auth.deleteAvatar().subscribe({
      next: () => {
        this.isUploadingAvatar.set(false);
        this.success.set('Photo de profil supprimée.');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isUploadingAvatar.set(false);
        this.error.set(err.error?.message ?? "Erreur lors de la suppression de la photo");
      },
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
