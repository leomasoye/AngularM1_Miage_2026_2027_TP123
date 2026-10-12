import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivityService } from './activity.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ActivityService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ActivityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait récupérer le fil d activité avec pagination curseur', () => {
    const beforeDate = '2026-10-12T18:00:00.000Z';

    service.getActivity(beforeDate, 10).subscribe((res) => {
      expect(res.items.length).toBe(1);
      expect(res.hasMore).toBe(false);
    });

    const req = httpMock.expectOne((r) => r.url === '/api/activity');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('before')).toBe(beforeDate);
    expect(req.request.params.get('limit')).toBe('10');

    req.flush({
      items: [
        {
          id: 'track1',
          title: 'Song',
          originalName: 'song.mp3',
          mimeType: 'audio/mpeg',
          size: 1000,
          visibility: 'public',
          ownerId: 'friend1',
          ownerName: 'Alice',
          likes: [],
          createdAt: beforeDate,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
  });
});
