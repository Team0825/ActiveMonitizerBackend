import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * =========================================================
 * CREATE STUDENT DTO
 * =========================================================
 *
 * Used by:
 * POST /admin/users/students
 *
 * Student account fields:
 * - username
 * - password
 * - regNumber
 * - mobile
 * - email
 * - classId
 */
export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @IsString()
  @IsNotEmpty()
  regNumber: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}

/**
 * =========================================================
 * CREATE TEACHER DTO
 * =========================================================
 *
 * Used by:
 * POST /admin/users/teachers
 *
 * Teacher account fields:
 * - name
 * - username
 * - password
 * - mobile
 * - email
 */
export class CreateTeacherDto {
  /**
   * Teacher full name.
   */
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

/**
 * =========================================================
 * CREATE ADMIN DTO
 * =========================================================
 */
export class CreateAdminDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

/**
 * =========================================================
 * UPDATE USER DTO
 * =========================================================
 *
 * Used by:
 * PATCH /admin/users/:id
 *
 * Works for both:
 * - STUDENT
 * - TEACHER
 *
 * Every field is optional because PATCH should
 * only modify the fields supplied by the frontend.
 */
export class UpdateUserDto {
  /**
   * Teacher/student display name.
   */
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * Account username.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  /**
   * New password.
   *
   * If omitted, the existing password remains.
   */
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  /**
   * Student registration number.
   *
   * Normally used only for STUDENT accounts.
   */
  @IsOptional()
  @IsString()
  regNumber?: string;

  /**
   * Mobile number.
   */
  @IsOptional()
  @IsString()
  mobile?: string;

  /**
   * Email address.
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * Student class identifier.
   */
  @IsOptional()
  @IsString()
  classId?: string;

  /**
   * Controls whether the account
   * can currently be used.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}