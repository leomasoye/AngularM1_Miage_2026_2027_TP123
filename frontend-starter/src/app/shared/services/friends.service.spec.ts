import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FriendsService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(FriendsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait récupérer la liste des amis', () => {
    service.getFriends().subscribe((friends) => {
      expect(friends.length).toBe(1);
      expect(friends[0].friendName).toBe('Alice');
    });

    const req = httpMock.expectOne('/api/friends');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'f1',
        status: 'accepted',
        friendId: 'u2',
        friendName: 'Alice',
        isIncoming: false,
        createdAt: '2026-01-01',
      },
    ]);
  });

  it('devrait envoyer une demande d ami', () => {
    service.addFriend('u2').subscribe((res) => {
      expect(res.status).toBe('pending');
    });

    const req = httpMock.expectOne('/api/friends');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ addresseeId: 'u2' });
    req.flush({ id: 'f2', status: 'pending', requesterId: 'u1', addresseeId: 'u2' });
  });

  it('devrait récupérer les demandes en attente pour le polling', () => {
    service.getPending().subscribe((res) => {
      expect(res.count).toBe(2);
    });

    const req = httpMock.expectOne('/api/friends/pending');
    expect(req.request.method).toBe('GET');
    req.flush({ count: 2, items: [{ id: '1' }, { id: '2' }] });
  });

  it('devrait mettre à jour le statut d une amitié', () => {
    service.updateStatus('f1', 'accepted').subscribe((res) => {
      expect(res.status).toBe('accepted');
    });

    const req = httpMock.expectOne('/api/friends/f1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'accepted' });
    req.flush({ id: 'f1', status: 'accepted' });
  });

  it('devrait supprimer une amitié', () => {
    service.removeFriend('f1').subscribe();

    const req = httpMock.expectOne('/api/friends/f1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
