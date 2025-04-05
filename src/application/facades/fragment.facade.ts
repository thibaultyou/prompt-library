import { Injectable, Scope } from '@nestjs/common';

import { FragmentService } from '../../core/fragment/services/fragment.service';
import { TableRenderer } from '../../infrastructure/ui/components/table.renderer';
import { ApiResult, PromptFragment, TableFormatResult } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class FragmentFacade {
    constructor(
        private readonly fragmentService: FragmentService,
        private readonly tableRenderer: TableRenderer
    ) {}

    async getAllFragments(): Promise<ApiResult<PromptFragment[]>> {
        return this.fragmentService.getAllFragments();
    }
    async getFragmentContent(category: string, name: string): Promise<ApiResult<string>> {
        return this.fragmentService.getFragmentContent(category, name);
    }
    async createFragment(category: string, name: string, content: string): Promise<ApiResult<boolean>> {
        return this.fragmentService.createFragment(category, name, content);
    }
    async updateFragment(category: string, name: string, content: string): Promise<ApiResult<boolean>> {
        return this.fragmentService.updateFragment(category, name, content);
    }
    async deleteFragment(category: string, name: string): Promise<ApiResult<boolean>> {
        return this.fragmentService.deleteFragment(category, name);
    }
    async getCategories(): Promise<ApiResult<string[]>> {
        return this.fragmentService.getCategories();
    }
    async getFragmentsByCategory(category: string): Promise<ApiResult<PromptFragment[]>> {
        return this.fragmentService.getFragmentsByCategory(category);
    }
    async searchFragments(keyword: string): Promise<ApiResult<PromptFragment[]>> {
        return this.fragmentService.searchFragments(keyword);
    }
    formatFragmentDisplay(fragment: PromptFragment): string {
        return this.fragmentService.formatFragmentDisplay(fragment);
    }
    formatFragmentPath(fragment: PromptFragment): string {
        return this.fragmentService.formatFragmentPath(fragment);
    }
    formatFragmentsTable(fragments: PromptFragment[]): TableFormatResult<PromptFragment> {
        return this.tableRenderer.formatFragmentsTable(fragments);
    }
}
