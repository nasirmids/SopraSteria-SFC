import { Injectable } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Params, PRIMARY_OUTLET, Router } from '@angular/router';
import { find } from 'lodash';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface IRoute {
  title: string;
  params: Params;
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class NestedRoutesService {
  private readonly _routes$: BehaviorSubject<IRoute[]> = new BehaviorSubject<IRoute[]>(null);
  public readonly routes$: Observable<IRoute[]> = this._routes$.asObservable();

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.activatedRoute)
      )
      .subscribe(route => {
        this._routes$.next(this.getNestedRoutes(route));
      });
  }

  private getNestedRoutes(route: ActivatedRoute, url: string = '', routes: IRoute[] = []): IRoute[] {
    const ROUTE_DATA_BREADCRUMB = 'title';
    const children = route.children;

    if (children.length === 0) {
      return routes;
    }

    for (const child of children) {
      if (child.outlet !== PRIMARY_OUTLET) {
        continue;
      }

      if (!child.snapshot.data.hasOwnProperty(ROUTE_DATA_BREADCRUMB)) {
        return this.getNestedRoutes(child, url, routes);
      }

      const routeURL = child.snapshot.url.map(segment => segment.path).join('/');

      url += `/${routeURL}`;

      if (!find(routes, ['label', child.snapshot.data[ROUTE_DATA_BREADCRUMB]])) {
        routes.push({
          title: child.snapshot.data[ROUTE_DATA_BREADCRUMB],
          params: child.snapshot.params,
          url: url,
        });
      }

      return this.getNestedRoutes(child, url, routes);
    }
  }
}
