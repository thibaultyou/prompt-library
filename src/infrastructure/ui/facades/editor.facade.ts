import { Injectable, Scope } from '@nestjs/common';

import { ApiResult } from '../../../shared/types';
import { EditorService } from '../services/editor.service';

@Injectable({ scope: Scope.DEFAULT })
export class EditorFacade {
    constructor(private readonly editorService: EditorService) {}

    public async editInEditor(content: string, options: { message?: string; postfix?: string } = {}): Promise<string> {
        const result = await this.editorService.editInEditor(content, options);
        return result.success && result.data !== undefined ? result.data : content;
    }

    public async editInEditorWithResult(
        content: string,
        options: { message?: string; postfix?: string } = {}
    ): Promise<ApiResult<string>> {
        return this.editorService.editInEditor(content, options);
    }
}
