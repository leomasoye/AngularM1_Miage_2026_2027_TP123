import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TrackService } from './track.service';
import { HttpEventType } from '@angular/common/http';

describe('TrackService', () => {
  let service: TrackService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TrackService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait uploader un fichier avec suivi de progression', () => {
    const file = new File([''], 'test.mp3', { type: 'audio/mpeg' });
    const title = 'Test Track';

    let progressEventCount = 0;
    let completed = false;

    service.upload(file, title).subscribe((event) => {
      if (event.type === HttpEventType.UploadProgress) {
        progressEventCount++;
      } else if (event.type === HttpEventType.Response) {
        completed = true;
      }
    });

    const req = httpMock.expectOne('/api/tracks');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    
    // Simuler la progression
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 } as any);
    req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 } as any);
    
    // Finaliser la réponse
    req.flush({ id: '1', title: 'Test Track' });

    expect(progressEventCount).toBe(2);
    expect(completed).toBe(true);
  });
});
