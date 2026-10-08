import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-track-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './track-upload.component.html',
  styleUrl: './track-upload.component.css',
})
export class TrackUploadComponent {
  @Input() title!: FormControl<string>;
  @Input() uploading = false;
  @Input() uploadProgress: number | null = null;
  @Input() uploadError: string | null = null;
  @Input() uploadSuccess: string | null = null;

  @Output() choose = new EventEmitter<Event>();
  @Output() upload = new EventEmitter<void>();
}
