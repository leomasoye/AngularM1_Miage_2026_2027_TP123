---
name: angular-best-practices
description: >
  Bonnes pratiques Angular 17+ (Standalone Components, Signals, inject(),
  lazy-loading, functional guards/interceptors, reactive forms). A utiliser
  systematiquement lors de la creation ou modification de composants, services
  ou routes dans ce projet Angular.
---

# Angular Best Practices - TP MIAGE 2026/2027

## Stack & Version
- Angular version courante (voir package.json)
- Mode : Standalone Components uniquement, pas de NgModule
- State : signal() / computed() / effect() (pas de NgRx sauf demande)
- HTTP : HttpClient injecte via inject() dans les services
- Styling : SCSS scope par composant + variables CSS globales dans styles.scss

## Architecture des dossiers
`
src/app/
+-- components/          # Pages et composants presentationnels
|   +-- <feature>/
|       +-- <feature>.ts
|       +-- <feature>.html
|       +-- <feature>.scss
+-- shared/
    +-- models/          # Interfaces TypeScript pures
    +-- services/        # Services injectables (@Injectable root)
    +-- guards/          # Guards fonctionnels (canActivateFn)
    +-- interceptors/    # HttpInterceptorFn (functional style)
    +-- pipes/           # Pipes pures (standalone: true)
+-- routes.ts            # Configuration des routes centralisee
`

## Regles de composants

### 1. Toujours Standalone
`	ypescript
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './example.html',
  styleUrl: './example.scss',
})
export class ExampleComponent { }
`

### 2. Injection via inject() (pas de constructeur)
`	ypescript
export class MyComponent {
  private myService = inject(MyService);
  private router = inject(Router);
}
`

### 3. State reactif avec Signals
`	ypescript
export class TracksService {
  private _tracks = signal<Track[]>([]);
  readonly tracks = this._tracks.asReadonly();
  readonly totalCount = computed(() => this._tracks().length);
}
`

### 4. Template avec @for / @if (Angular 17+ control flow)
`html
@for (track of tracks(); track track.id) {
  <app-track-card [track]="track" />
}
@if (isLoading()) {
  <app-spinner />
}
`

## Services - Pattern signal + loading
`	ypescript
@Injectable({ providedIn: 'root' })
export class FriendsService {
  private http = inject(HttpClient);
  private _friends = signal<User[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  readonly friends = this._friends.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
}
`

## Routing - Lazy loading obligatoire
`	ypescript
export const routes: Routes = [
  {
    path: 'friends',
    loadComponent: () =>
      import('./components/friends-page/friends-page')
        .then(m => m.FriendsPageComponent),
    canActivate: [authGuard],
  },
];
`

## Guards fonctionnels
`	ypescript
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.parseUrl('/login');
};
`

## Interceptor fonctionnel JWT
`	ypescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (!token) return next(req);
  return next(req.clone({
    setHeaders: { Authorization: Bearer +""+${token}+""+ }
  }));
};
`

## Reactive Forms
`	ypescript
private fb = inject(FormBuilder);
form = this.fb.nonNullable.group({
  title: ['', [Validators.required, Validators.minLength(2)]],
  email: ['', [Validators.required, Validators.email]],
});
`

## Regles imperatifs
- @defer pour les composants lourds (lecteur audio, modals)
- Eviter les subscriptions manuelles : prefer toSignal() ou async pipe
- trackBy sur tous les @for avec id stable
- Pas d'appels HTTP dans les composants, toujours via un service
- ChangeDetectionStrategy.OnPush sur tous les composants presentationnels
