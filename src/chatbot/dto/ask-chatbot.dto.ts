import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AskChatbotDto {
  @IsString()
  @MaxLength(8000)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  errorMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string; // free-text question if there's no hard error, e.g. "why is this slow?"

  @IsOptional()
  @IsString()
  @MaxLength(30)
  language?: string; // e.g. "python", "java" — helps the model, purely informational
}
