import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsIn(['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'])
  expectedRole?: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';

  // Session ID is NOT required during authentication.
  // Students enter the Session Code after successful login.
  @IsOptional()
  @IsString()
  sessionId?: string;

  // Optional during browser login.
  // Later the Windows PC Agent can provide
  // the real computer hostname.
  @IsOptional()
  @IsString()
  pcHostname?: string;

  @IsOptional()
  forceLogin?: boolean;

  @IsOptional()
  @IsString()
  challengeId?: string;
}