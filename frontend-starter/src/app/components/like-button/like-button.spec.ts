import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LikeButton } from './like-button';

describe('LikeButton', () => {
  let component: LikeButton;
  let fixture: ComponentFixture<LikeButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LikeButton]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LikeButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
