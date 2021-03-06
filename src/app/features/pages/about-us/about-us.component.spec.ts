import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { MockActivatedRoute } from '@core/test-utils/MockActivatedRoute';
import { MockArticlesService } from '@core/test-utils/MockArticlesService';
import { MockBreadcrumbService } from '@core/test-utils/MockBreadcrumbService';
import { MockFeatureFlagsService } from '@core/test-utils/MockFeatureFlagService';
import { MockPagesService } from '@core/test-utils/MockPagesService';
import { FeatureFlagsService } from '@shared/services/feature-flags.service';
import { SharedModule } from '@shared/shared.module';
import { getByText, render } from '@testing-library/angular';
import { of } from 'rxjs';

import { AboutUsComponent } from './about-us.component';

describe('AboutUsComponent', () => {
  const pages = MockPagesService.pagesFactory();
  const articleList = MockArticlesService.articleListFactory();

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
