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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedSites?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockedSites?: string[];

  /*
   * LAB
   * EXAM
   * VIVA
   */
  @IsString()
  @IsIn(['LAB', 'EXAM', 'VIVA'])
  @IsOptional()
  sessionMode?: 'LAB' | 'EXAM' | 'VIVA';

  /*
   * Allow session to continue locally
   * when server/internet connection is lost.
   *
   * LAB / EXAM can support offline mode.
   * VIVA will be forced online by the service.
   */
  @IsBoolean()
  @IsOptional()
  allowOffline?: boolean;

  /*
   * Prevent opening existing files
   * during restricted sessions.
   */
  @IsBoolean()
  @IsOptional()
  restrictExistingFiles?: boolean;

  /*
   * Prevent unauthorized applications
   * from running during the session.
   */
  @IsBoolean()
  @IsOptional()
  restrictUnauthorizedApps?: boolean;

  /*
   * Freeze student environment
   * automatically when session ends.
   */
  @IsBoolean()
  @IsOptional()
  freezeOnEnd?: boolean;

  /*
   * Warning before session ends.
   * Default will be 5 minutes.
   */
  @IsInt()
  @Min(1)
  @IsOptional()
  warningMinutes?: number;

  /*
   * Questions or instructions
   * displayed to students.
   */
  @IsString()
  @IsOptional()
  instructions?: string;

  /*
   * COMMON
   * INDIVIDUAL
   * GROUP
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