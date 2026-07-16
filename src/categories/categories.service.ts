import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CategoryFlow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoryDto,
  CreateSubcategoryDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, flow?: CategoryFlow) {
    const categories = await this.prisma.transactionCategory.findMany({
      where: {
        ...(flow ? { flow } : {}),
        OR: [{ userId: null }, { userId }],
      },
      orderBy: [{ flow: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        subcategories: {
          where: {
            OR: [{ userId: null }, { userId }],
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    const usedSubcategoryIds = await this.findUsedSubcategoryIds(
      userId,
      categories.flatMap((category) =>
        category.subcategories.map((subcategory) => subcategory.id),
      ),
    );

    return categories.map((category) =>
      this.toCategoryResponse(category, usedSubcategoryIds),
    );
  }

  async createCategory(userId: string, dto: CreateCategoryDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const duplicate = await this.prisma.transactionCategory.findFirst({
      where: {
        userId,
        flow: dto.flow,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new BadRequestException('You already have a category with this name');
    }

    const sortAggregate = await this.prisma.transactionCategory.aggregate({
      where: { userId, flow: dto.flow },
      _max: { sortOrder: true },
    });

    const category = await this.prisma.transactionCategory.create({
      data: {
        id: randomUUID(),
        userId,
        name,
        flow: dto.flow,
        sortOrder: (sortAggregate._max.sortOrder ?? 99) + 1,
      },
      include: {
        subcategories: true,
      },
    });

    return this.toCategoryResponse(category, new Set());
  }

  async updateCategory(
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    const category = await this.ensureCustomCategory(userId, categoryId);
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const duplicate = await this.prisma.transactionCategory.findFirst({
      where: {
        userId,
        flow: category.flow,
        id: { not: categoryId },
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new BadRequestException('You already have a category with this name');
    }

    const updated = await this.prisma.transactionCategory.update({
      where: { id: categoryId },
      data: { name },
      include: {
        subcategories: {
          where: {
            OR: [{ userId: null }, { userId }],
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    const usedSubcategoryIds = await this.findUsedSubcategoryIds(
      userId,
      updated.subcategories.map((subcategory) => subcategory.id),
    );

    return this.toCategoryResponse(updated, usedSubcategoryIds);
  }

  async removeCategory(userId: string, categoryId: string) {
    const category = await this.ensureCustomCategory(userId, categoryId);

    const subcategories = await this.prisma.transactionSubcategory.findMany({
      where: { categoryId },
      select: { id: true, name: true },
    });

    const usedSubcategoryIds = await this.findUsedSubcategoryIds(
      userId,
      subcategories.map((subcategory) => subcategory.id),
    );

    if (usedSubcategoryIds.size > 0) {
      const usedNames = subcategories
        .filter((subcategory) => usedSubcategoryIds.has(subcategory.id))
        .map((subcategory) => subcategory.name);

      throw new ConflictException(
        `Cannot delete category while subcategories are used in transactions: ${usedNames.join(', ')}`,
      );
    }

    await this.prisma.transactionCategory.delete({
      where: { id: category.id },
    });

    return { message: 'Category deleted successfully' };
  }

  async createSubcategory(
    userId: string,
    categoryId: string,
    dto: CreateSubcategoryDto,
  ) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Subcategory name is required');
    }

    const category = await this.prisma.transactionCategory.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const duplicate = await this.prisma.transactionSubcategory.findFirst({
      where: {
        categoryId,
        userId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        'You already have this subcategory in the selected category',
      );
    }

    const sortAggregate = await this.prisma.transactionSubcategory.aggregate({
      where: { categoryId, userId },
      _max: { sortOrder: true },
    });

    const subcategory = await this.prisma.transactionSubcategory.create({
      data: {
        id: randomUUID(),
        userId,
        categoryId,
        name,
        sortOrder: (sortAggregate._max.sortOrder ?? 99) + 1,
      },
    });

    const inUse = await this.isSubcategoryInUse(userId, subcategory.id);

    return {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      isCustom: true,
      inUse,
    };
  }

  async updateSubcategory(
    userId: string,
    categoryId: string,
    subcategoryId: string,
    dto: UpdateSubcategoryDto,
  ) {
    const subcategory = await this.ensureCustomSubcategory(
      userId,
      categoryId,
      subcategoryId,
    );
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Subcategory name is required');
    }

    const duplicate = await this.prisma.transactionSubcategory.findFirst({
      where: {
        categoryId,
        userId,
        id: { not: subcategoryId },
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        'You already have this subcategory in the selected category',
      );
    }

    const updated = await this.prisma.transactionSubcategory.update({
      where: { id: subcategory.id },
      data: { name },
    });

    const inUse = await this.isSubcategoryInUse(userId, updated.id);

    return {
      id: updated.id,
      name: updated.name,
      categoryId: updated.categoryId,
      isCustom: true,
      inUse,
    };
  }

  async removeSubcategory(
    userId: string,
    categoryId: string,
    subcategoryId: string,
  ) {
    const subcategory = await this.ensureCustomSubcategory(
      userId,
      categoryId,
      subcategoryId,
    );

    if (await this.isSubcategoryInUse(userId, subcategory.id)) {
      throw new ConflictException(
        'Cannot delete subcategory because it is used in existing transactions',
      );
    }

    await this.prisma.transactionSubcategory.delete({
      where: { id: subcategory.id },
    });

    return { message: 'Subcategory deleted successfully' };
  }

  private async ensureCustomCategory(userId: string, categoryId: string) {
    const category = await this.prisma.transactionCategory.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) {
      const exists = await this.prisma.transactionCategory.findFirst({
        where: { id: categoryId },
      });

      if (!exists) {
        throw new NotFoundException('Category not found');
      }

      throw new BadRequestException('Default categories cannot be changed');
    }

    return category;
  }

  private async ensureCustomSubcategory(
    userId: string,
    categoryId: string,
    subcategoryId: string,
  ) {
    const subcategory = await this.prisma.transactionSubcategory.findFirst({
      where: {
        id: subcategoryId,
        categoryId,
        userId,
      },
    });

    if (!subcategory) {
      const exists = await this.prisma.transactionSubcategory.findFirst({
        where: { id: subcategoryId, categoryId },
      });

      if (!exists) {
        throw new NotFoundException('Subcategory not found');
      }

      throw new BadRequestException('Default subcategories cannot be changed');
    }

    return subcategory;
  }

  private async findUsedSubcategoryIds(
    userId: string,
    subcategoryIds: string[],
  ) {
    if (!subcategoryIds.length) {
      return new Set<string>();
    }

    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        subcategoryId: { in: subcategoryIds },
      },
      select: { subcategoryId: true },
      distinct: ['subcategoryId'],
    });

    return new Set(
      rows
        .map((row) => row.subcategoryId)
        .filter((id): id is string => Boolean(id)),
    );
  }

  private async isSubcategoryInUse(userId: string, subcategoryId: string) {
    const count = await this.prisma.transaction.count({
      where: { userId, subcategoryId },
    });

    return count > 0;
  }

  private toCategoryResponse(
    category: {
      id: string;
      userId: string | null;
      name: string;
      flow: CategoryFlow;
      subcategories: Array<{
        id: string;
        userId: string | null;
        name: string;
        categoryId: string;
      }>;
    },
    usedSubcategoryIds: Set<string>,
  ) {
    const subcategories = category.subcategories.map((subcategory) => ({
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      isCustom: subcategory.userId !== null,
      inUse: usedSubcategoryIds.has(subcategory.id),
    }));

    return {
      id: category.id,
      name: category.name,
      flow: category.flow,
      isCustom: category.userId !== null,
      inUse: subcategories.some((subcategory) => subcategory.inUse),
      subcategories,
    };
  }
}
