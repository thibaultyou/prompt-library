import { Injectable, Scope } from '@nestjs/common';

import { CategoryService } from '../../core/prompt/services/category.service';
import { ApiResult, CategoryItem } from '../../shared/types';

@Injectable({ scope: Scope.DEFAULT })
export class CategoryFacade {
    constructor(private readonly categoryService: CategoryService) {}

    public async getAllCategories(): Promise<ApiResult<Record<string, CategoryItem[]>>> {
        return this.categoryService.getAllCategories();
    }

    public async getCategoryNames(): Promise<ApiResult<string[]>> {
        return this.categoryService.getCategoryNames();
    }

    public async getCategoryByName(categoryName: string): Promise<ApiResult<CategoryItem[]>> {
        return this.categoryService.getCategoryByName(categoryName);
    }

    public getCategoryOptions(): Array<{ name: string; value: string; description: string }> {
        return this.categoryService.getAllCategoryOptions();
    }

    public categoryExists(category: string): boolean {
        return this.categoryService.categoryExists(category);
    }

    public getCategoryName(categorySlug: string): string {
        return this.categoryService.getCategoryName(categorySlug);
    }

    public getCategoryDescription(category: string): string {
        return this.categoryService.getCategoryDescription(category);
    }
}
