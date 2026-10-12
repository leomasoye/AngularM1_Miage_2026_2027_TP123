import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ShareService } from './share.service';

describe('ShareService', () => {
  let service: ShareService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ShareService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ShareService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait partager une piste avec un utilisateur', () => {
    const trackId = 'track123';
    const userId = 'user456';

    service.shareTrack(trackId, userId).subscribe((res) => {
      expect(res.trackId).toBe(trackId);
      expect(res.sharedWithId).toBe(userId);
    });

    const req = httpMock.expectOne(`/api/tracks/${trackId}/share/${userId}`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'share1', trackId, ownerId: 'me', sharedWithId: userId });
  });

  it('devrait supprimer le partage d une piste', () => {
    const trackId = 'track123';
    const userId = 'user456';

    service.unshareTrack(trackId, userId).subscribe();

    const req = httpMock.expectOne(`/api/tracks/${trackId}/share/${userId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
