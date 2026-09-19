import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  imports: [ReactiveFormsModule],
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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set('');

    this.auth.profile().subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.form.setValue({ name: user.name });
      },
      error: (err: { error?: { message?: string } }) => {
        this.isLoading.set(false);
        this.error.set(err.error?.message ?? 'Impossible de charger le profil');
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.error.set('');
    this.success.set('');

    const newName = this.form.getRawValue().name;
    this.auth.update(newName).subscribe({
      next: (user) => {
        this.isSaving.set(false);
        this.form.setValue({ name: user.name });
        this.success.set('Nom mis à jour avec succès !');
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSaving.set(false);
        this.error.set(err.error?.message ?? 'Impossible de modifier le nom');
      },
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
