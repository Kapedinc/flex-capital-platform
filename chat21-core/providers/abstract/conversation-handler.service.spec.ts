import { TestBed } from '@angular/core/testing';

import { ConversationHandlerService } from './conversation-handler.service';

describe('ConversationHandlerService', () => {
  beforeEach(() => 
    TestBed.configureTestingModule({
      providers: [ConversationHandlerService]
    })
  );

  it('should be created', () => {
    const service: ConversationHandlerService = TestBed.get(ConversationHandlerService);
    expect(service).toBeTruthy();
  });
});
