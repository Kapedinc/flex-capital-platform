import { TranslateModule } from '@ngx-translate/core';
import { TestBed } from '@angular/core/testing';

import { CustomTranslateService } from './custom-translate.service';

describe('CustomTranslateService', () => {
  beforeEach(() => 
    TestBed.configureTestingModule({
      imports: [ TranslateModule.forRoot()],
      providers: [CustomTranslateService]
    })
  );

  it('should be created', () => {
    const service: CustomTranslateService = TestBed.get(CustomTranslateService);
    expect(service).toBeTruthy();
  });
});
