import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateTeacherProfileDto {
  /*
   * Teacher can update their own full name.
   */
  @IsOptional()
  @IsString()
  name?: string;

  /*
   * Teacher can update their own mobile number.
   */
  @IsOptional()
  @IsString()
  mobile?: string;

  /*
   * Teacher can update their own email address.
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /*
   * Password is optional.
   *
   * If supplied, it must contain at least
   * 4 characters, matching the current
   * authentication password rules.
   */
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}