import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AskChatbotDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  errorMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
