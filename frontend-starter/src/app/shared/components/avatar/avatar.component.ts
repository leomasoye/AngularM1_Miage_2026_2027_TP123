import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
})
export class AvatarComponent {
  readonly user = input<User | null | undefined>(null);
  readonly avatarUrl = input<string | null | undefined>(null);
  readonly name = input<string | null | undefined>('');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  readonly imageError = signal(false);

  readonly effectiveAvatarUrl = computed(() => {
    if (this.imageError()) return null;
    return this.avatarUrl() || this.user()?.avatarUrl || null;
  });

  readonly effectiveName = computed(() => {
    return this.name() || this.user()?.name || '';
  });

  readonly initials = computed(() => {
    const raw = this.effectiveName().trim();
    if (!raw) return '?';
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  });

  onImageError(): void {
    this.imageError.set(true);
  }
}
