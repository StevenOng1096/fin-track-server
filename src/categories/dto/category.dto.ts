import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CategoryFlow } from '@prisma/client';

export class CreateCategoryDto {
  @IsString({ message: 'Category name must be text.' })
  @IsNotEmpty({ message: 'Category name is required.' })
  @MaxLength(80, { message: 'Name must be 80 characters or less.' })
  name: string;

  @IsEnum(CategoryFlow, { message: 'Please select income or expense.' })
  flow: CategoryFlow;
}

export class UpdateCategoryDto {
  @IsString({ message: 'Category name must be text.' })
  @IsNotEmpty({ message: 'Category name is required.' })
  @MaxLength(80, { message: 'Name must be 80 characters or less.' })
  name: string;
}

export class CreateSubcategoryDto {
  @IsString({ message: 'Subcategory name must be text.' })
  @IsNotEmpty({ message: 'Subcategory name is required.' })
  @MaxLength(80, { message: 'Name must be 80 characters or less.' })
  name: string;
}

export class UpdateSubcategoryDto {
  @IsString({ message: 'Subcategory name must be text.' })
  @IsNotEmpty({ message: 'Subcategory name is required.' })
  @MaxLength(80, { message: 'Name must be 80 characters or less.' })
  name: string;
}
