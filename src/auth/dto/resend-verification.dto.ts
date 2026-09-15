import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class ResendVerificationDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(320, { message: 'Email address is too long.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Return link is required.' })
  @IsUrl(
    { require_tld: false },
    { message: 'Please provide a valid return link.' },
  )
  @MaxLength(2048, { message: 'Return link is too long.' })
  callbackURL: string;
}
