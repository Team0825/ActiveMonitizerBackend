import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateSessionPolicyDto {

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
  freezeOnEnd?: boolean;

  @IsBoolean()
  @IsOptional()
  allowOffline?: boolean;

  @IsBoolean()
  @IsOptional()
  restrictExistingFiles?: boolean;

  @IsBoolean()
  @IsOptional()
  restrictUnauthorizedApps?: boolean;

  @IsString()
  @IsOptional()
  sessionMode?: 'LAB' | 'EXAM' | 'VIVA';

  @IsString()
  @IsOptional()
  questionMode?: 'COMMON' | 'INDIVIDUAL' | 'GROUP';

  @IsInt()
  @Min(5)
  @IsOptional()
  screenshotInterval?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  warningMinutes?: number;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsOptional()
@IsString()
startupUrl?: string;

  @IsArray()
  @IsOptional()
  allowedWebsites?: string[];

  @IsArray()
  @IsOptional()
  blockedWebsites?: string[];

  @IsArray()
  @IsOptional()
  allowedApplications?: string[];

  @IsArray()
  @IsOptional()
  blockedApplications?: string[];
}