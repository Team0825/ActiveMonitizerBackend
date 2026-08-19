import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ActivateLicenseDto {
  @IsNotEmpty()
  @IsString()
  activationKey: string;

  @IsNotEmpty()
  @IsString()
  machineFingerprint: string;

  @IsOptional()
  @IsString()
  machineName?: string;

  @IsOptional()
  @IsString()
  institutionId?: string;
}

export class ValidateLicenseDto {
  @IsNotEmpty()
  @IsString()
  machineFingerprint: string;

  @IsOptional()
  @IsString()
  activationKey?: string;
}

export class CreateLicenseDto {
  @IsNotEmpty()
  @IsString()
  licenseNumber: string;

  @IsNotEmpty()
  @IsString()
  activationKey: string;

  @IsNotEmpty()
  @IsString()
  institutionId: string;

  @IsOptional()
  @IsString()
  licenseType?: string;

  @IsOptional()
  maxPcs?: number;

  @IsOptional()
  expiresAt?: string;
}
