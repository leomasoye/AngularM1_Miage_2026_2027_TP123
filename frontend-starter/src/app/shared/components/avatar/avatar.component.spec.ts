import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait créer le composant avatar', () => {
    expect(component).toBeTruthy();
  });

  it('devrait calculer les initiales à partir du nom', () => {
    fixture.componentRef.setInput('name', 'Chester Bennington');
    fixture.detectChanges();
    expect(component.initials()).toBe('CB');

    fixture.componentRef.setInput('name', 'Mike');
    fixture.detectChanges();
    expect(component.initials()).toBe('MI');

    fixture.componentRef.setInput('name', '');
    fixture.detectChanges();
    expect(component.initials()).toBe('?');
  });

  it('devrait basculer sur les initiales si l image échoue à charger', () => {
    fixture.componentRef.setInput('name', 'Joe Hahn');
    fixture.componentRef.setInput('avatarUrl', '/api/users/avatar/does-not-exist.png');
    fixture.detectChanges();

    expect(component.effectiveAvatarUrl()).toBe('/api/users/avatar/does-not-exist.png');

    component.onImageError();
    fixture.detectChanges();

    expect(component.effectiveAvatarUrl()).toBeNull();
    expect(component.initials()).toBe('JH');
  });
});
