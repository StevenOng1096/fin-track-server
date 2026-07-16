import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { CategoryFlow } from '../generated/prisma/client';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  CreateSubcategoryDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(
    @Session() session: UserSession,
    @Query('flow') flow?: CategoryFlow,
  ) {
    return this.categoriesService.findAll(session.user.id, flow);
  }

  @Post()
  createCategory(
    @Session() session: UserSession,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.createCategory(session.user.id, dto);
  }

  @Patch(':categoryId')
  updateCategory(
    @Session() session: UserSession,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(
      session.user.id,
      categoryId,
      dto,
    );
  }

  @Delete(':categoryId')
  removeCategory(
    @Session() session: UserSession,
    @Param('categoryId') categoryId: string,
  ) {
    return this.categoriesService.removeCategory(session.user.id, categoryId);
  }

  @Post(':categoryId/subcategories')
  createSubcategory(
    @Session() session: UserSession,
    @Param('categoryId') categoryId: string,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.categoriesService.createSubcategory(
      session.user.id,
      categoryId,
      dto,
    );
  }

  @Patch(':categoryId/subcategories/:subcategoryId')
  updateSubcategory(
    @Session() session: UserSession,
    @Param('categoryId') categoryId: string,
    @Param('subcategoryId') subcategoryId: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.categoriesService.updateSubcategory(
      session.user.id,
      categoryId,
      subcategoryId,
      dto,
    );
  }

  @Delete(':categoryId/subcategories/:subcategoryId')
  removeSubcategory(
    @Session() session: UserSession,
    @Param('categoryId') categoryId: string,
    @Param('subcategoryId') subcategoryId: string,
  ) {
    return this.categoriesService.removeSubcategory(
      session.user.id,
      categoryId,
      subcategoryId,
    );
  }
}
