import { Injectable, Scope } from '@nestjs/common';

import { ConversationService } from '../../core/execution/services/conversation.service';
import { ApiResult, ConversationManager } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class ConversationFacade {
    constructor(private readonly conversationService: ConversationService) {}

    public async createConversationManager(promptId: string): Promise<ApiResult<ConversationManager>> {
        return this.conversationService.createConversationManager(promptId);
    }
}
