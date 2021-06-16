import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Articles } from '@core/model/article.model';
import { Pages } from '@core/model/page.model';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { MockActivatedRoute } from '@core/test-utils/MockActivatedRoute';
import { MockBreadcrumbService } from '@core/test-utils/MockBreadcrumbService';
import { MockFeatureFlagsService } from '@core/test-utils/MockFeatureFlagService';
import { FeatureFlagsService } from '@shared/services/feature-flags.service';
import { SharedModule } from '@shared/shared.module';
import { getByText, render } from '@testing-library/angular';
import { of } from 'rxjs';

import { AboutUsComponent } from './about-us.component';

describe('AboutUsComponent', () => {
  const pages = {
    data: [
      {
        title: 'About the ASC-WDS',
        content: 'Testing',
        id: 1,
        date_created: new Date(),
        date_updated: new Date(),
        user_created: 'duhefwiuh',
        user_updated: 'fhewoihf',
      },
    ],
  } as Pages;
  const articleList = {
    data: [
      { title: 'test', slug: 'test-slug' },
      { title: 'test2', slug: 'test2-slug' },
      { title: 'test3', slug: 'test3-slug' },
    ],
  } as Articles;

  async function setup() {
    const { fixture, getByText } = await render(AboutUsComponent, {
      imports: [SharedModule, RouterModule, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: BreadcrumbService, useClass: MockBreadcrumbService },
        { provide: FeatureFlagsService, useClass: MockFeatureFlagsService },
        {
          provide: ActivatedRoute,
          useValue: new MockActivatedRoute({
            params: [],
            url: of(['testUrl']),
            snapshot: {
              data: {
                pages,
                articleList,
              },
            },
          }),
        },
      ],
    });

    const component = fixture.componentInstance;
    return {
      component,
      fixture,
      getByText,
    };
  }

  it('should create', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('should show an article list when there are articles', async () => {
    const { getByText } = await setup();

    expect(getByText(articleList.data[0].title)).toBeTruthy();
    expect(getByText(articleList.data[1].title)).toBeTruthy();
    expect(getByText(articleList.data[2].title)).toBeTruthy();
  });

  it('should display title from the pages data', async () => {
    const { getByText } = await setup();
    expect(getByText(pages.data[0].title)).toBeTruthy();
  });

  it('should display content from the pages data', async () => {
    const { getByText } = await setup();
    expect(getByText(pages.data[0].content)).toBeTruthy();
  });
});
