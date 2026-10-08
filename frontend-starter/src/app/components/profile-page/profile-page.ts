import { Component, inject, signal, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
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
    
    this.auth.refreshProfile().subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.form.patchValue({ name: user.name });
      },
      error: (err) => {
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
    this.auth.updateProfile(newName).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.success.set('Profil mis à jour avec succès.');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.error.set(err.error?.message ?? 'Impossible de mettre à jour le profil');
      }
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
