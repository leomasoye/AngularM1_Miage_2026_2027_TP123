import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FriendsPage } from './friends-page';

describe('FriendsPage', () => {
  let component: FriendsPage;
  let fixture: ComponentFixture<FriendsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendsPage]
    })
      .compileComponents();

    fixture = TestBed.createComponent(FriendsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
