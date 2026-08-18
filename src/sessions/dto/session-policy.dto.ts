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
  allowAiAssistant?: boolean;

  @IsBoolean()
  @IsOptional()
  freezeOnEnd?: boolean;

  @IsBoolean()
  @IsOptional()
  allowOffline?: boolean;

  @IsString()
  @IsOptional()
  connectivityMode?: 'ONLINE_ONLY' | 'OFFLINE_ONLY' | 'HYBRID';

  @IsString()
  @IsOptional()
  websiteAccessMode?: 'NORMAL' | 'ALLOWED_ONLY' | 'BLOCKED';

  @IsBoolean()
  @IsOptional()
  restrictExistingFiles?: boolean;

  @IsBoolean()
  @IsOptional()
  restrictUnauthorizedApps?: boolean;

  @IsBoolean()
  @IsOptional()
  activityMonitoring?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  activityUpdateInterval?: number;

  @IsString()
  @IsOptional()
  activitySensitivity?: 'LOW' | 'NORMAL' | 'HIGH';

  @IsInt()
  @Min(1)
  @IsOptional()
  idleThresholdSeconds?: number;

  @IsString()
  @IsOptional()
  violationSensitivity?: 'LOW' | 'NORMAL' | 'HIGH';

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