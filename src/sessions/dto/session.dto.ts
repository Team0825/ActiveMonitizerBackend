import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  classTitle: string;

  @IsInt()
  @Min(5)
  durationMinutes: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  joinWindowMinutes?: number;

  /*
   * ===========================
   * SESSION MODE
   * ===========================
   */

  @IsString()
  @IsIn(['LAB', 'EXAM', 'VIVA'])
  @IsOptional()
  sessionMode?: 'LAB' | 'EXAM' | 'VIVA';

  /*
   * ===========================
   * SECURITY POLICY
   * ===========================
   */

  @IsBoolean()
  @IsOptional()
  allowInternet?: boolean;

  @IsBoolean()
  @IsOptional()
  allowClipboard?: boolean;

  @IsBoolean()
  @IsOptional()
  allowUsb?: boolean;

  @IsBoolean()
  @IsOptional()
  allowTaskManager?: boolean;

  @IsBoolean()
  @IsOptional()
  allowAltTab?: boolean;

  @IsBoolean()
  @IsOptional()
  allowWindowsKey?: boolean;

  @IsBoolean()
  @IsOptional()
  allowPrintScreen?: boolean;

  @IsBoolean()
  @IsOptional()
  allowOffline?: boolean;

  @IsBoolean()
  @IsOptional()
  restrictExistingFiles?: boolean;

  @IsBoolean()
  @IsOptional()
  restrictUnauthorizedApps?: boolean;

  @IsBoolean()
  @IsOptional()
  freezeOnEnd?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  warningMinutes?: number;

  @IsInt()
  @Min(5)
  @IsOptional()
  screenshotInterval?: number;

  @IsString()
  @IsOptional()
  instructions?: string;

  /*
   * ===========================
   * QUESTION MODE
   * ===========================
   */

  @IsString()
  @IsIn([
    'COMMON',
    'INDIVIDUAL',
    'GROUP',
  ])
  @IsOptional()
  questionMode?:
    | 'COMMON'
    | 'INDIVIDUAL'
    | 'GROUP';

  /*
   * ===========================
   * WEBSITE POLICY
   * ===========================
   */

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedWebsites?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockedWebsites?: string[];

  /*
   * ===========================
   * APPLICATION POLICY
   * ===========================
   */

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedApplications?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockedApplications?: string[];
}

export class JoinSessionDto {
  @IsString()
  sessionId: string;

  @IsString()
  regNumber: string;

  @IsString()
  @IsOptional()
  pcHostname?: string;
}

export class RequestSpecialAccessDto {
  @IsString()
  sessionId: string;
}

export class HandleAccessRequestDto {
  @IsString()
  requestId: string;

  @IsBoolean()
  approve: boolean;
}