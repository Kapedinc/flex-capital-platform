import { TestBed } from '@angular/core/testing';

import { GroupsHandlerService } from './groups-handler.service';

describe('GroupsHandlerService', () => {
  beforeEach(() => 
    TestBed.configureTestingModule({
      providers: [GroupsHandlerService]
    })
  );

  it('should be created', () => {
    const service: GroupsHandlerService = TestBed.get(GroupsHandlerService);
    expect(service).toBeTruthy();
  });
});
