import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionOptionDto {
  @IsString()
  id: string;

  @IsString()
  text: string;
}

export class CreateQuestionDto {
  @IsString()
  questionText: string;

  @IsOptional()
  @IsString()
  questionType?: string = 'MCQ';

  @IsOptional()
  @IsString()
  section?: string = 'General';

  @IsOptional()
  @IsNumber()
  orderIndex?: number = 0;

  @IsArray()
  options: QuestionOptionDto[];

  @IsString()
  correctAnswer: string;

  @IsNumber()
  @Min(0.5)
  marks: number = 1.0;

  @IsOptional()
  @IsNumber()
  negativeMarks?: number = 0.0;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateQuestionPaperDto {
  @IsString()
  title: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  totalMarks?: number = 100.0;

  @IsOptional()
  @IsNumber()
  passingMarks?: number = 40.0;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}

export class UpdateQuestionPaperDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  totalMarks?: number;

  @IsOptional()
  @IsNumber()
  passingMarks?: number;
}

export class CreateExamDto {
  @IsString()
  title: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsString()
  questionPaperId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsNumber()
  @Min(1)
  durationMinutes: number = 60;

  @IsOptional()
  @IsNumber()
  totalMarks?: number;

  @IsOptional()
  @IsNumber()
  passingMarks?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean = false;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean = false;

  @IsOptional()
  @IsBoolean()
  allowReview?: boolean = true;

  @IsOptional()
  @IsBoolean()
  autoSubmitOnTimeUp?: boolean = true;

  @IsOptional()
  @IsString()
  status?: string = 'SCHEDULED';

  @IsOptional()
  @IsString()
  resultVisibility?: string = 'AFTER_PUBLISH';

  @IsOptional()
  startsAt?: string | Date;

  @IsOptional()
  endsAt?: string | Date;
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  questionPaperId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  totalMarks?: number;

  @IsOptional()
  @IsNumber()
  passingMarks?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReview?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSubmitOnTimeUp?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  resultVisibility?: string;

  @IsOptional()
  @IsBoolean()
  resultPublished?: boolean;

  @IsOptional()
  startsAt?: string | Date;

  @IsOptional()
  endsAt?: string | Date;
}

export class StartExamDto {
  @IsString()
  examId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  pcHostname?: string;
}

export class SaveAnswerDto {
  @IsString()
  examId: string;

  @IsString()
  questionId: string;

  @IsOptional()
  @IsString()
  selectedOption?: string;

  @IsOptional()
  @IsString()
  answerText?: string;

  @IsOptional()
  @IsBoolean()
  isMarkedForReview?: boolean;

  @IsOptional()
  @IsNumber()
  timeRemainingSeconds?: number;
}

export class SubmitExamDto {
  @IsString()
  examId: string;

  @IsOptional()
  @IsBoolean()
  isAutoSubmit?: boolean = false;
}

export class RegisterPcDto {
  @IsString()
  cbtCode: string;

  @IsString()
  pcHostname: string;

  @IsOptional()
  @IsString()
  pcId?: string;

  @IsOptional()
  @IsString()
  authorityPassword?: string;
}

export class AuthorityPasswordDto {
  @IsString()
  password: string;
}

export class VerifyAuthorityPasswordDto {
  @IsString()
  password: string;
}

export class CorrectResultDto {
  @IsNumber()
  obtainedMarks: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class GenerateResultsDto {
  @IsString()
  scope: 'ALL' | 'SELECTED';

  @IsOptional()
  @IsArray()
  studentIds?: string[];
}

export class LockPcConfigDto {
  @IsBoolean()
  isLocked: boolean;
}

export class AuthorityLoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  pcHostname?: string;
}

export class ValidateUniqueCodeDto {
  @IsString()
  code: string;

  @IsString()
  pcHostname: string;

  @IsOptional()
  @IsString()
  authorityToken?: string;
}

export class AllocateStudentDto {
  @IsString()
  @IsNotEmpty()
  pcHostname: string;

  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsOptional()
  @IsString()
  pcRegistrationId?: string;

  @IsOptional()
  @IsString()
  examId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  cbtCode?: string;

  @IsOptional()
  @IsString()
  invigilatorId?: string;

  @IsOptional()
  @IsString()
  invigilatorName?: string;
}

export class AutoAllocateStudentDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsOptional()
  @IsString()
  examId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  cbtCode?: string;

  @IsOptional()
  @IsString()
  invigilatorId?: string;

  @IsOptional()
  @IsString()
  invigilatorName?: string;
}

export class DeallocateStudentDto {
  @IsString()
  @IsNotEmpty()
  pcHostname: string;

  @IsOptional()
  @IsString()
  pcRegistrationId?: string;

  @IsOptional()
  @IsString()
  examId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class VerifyDobDto {
  @IsString()
  @IsNotEmpty()
  pcHostname: string;

  @IsString()
  @IsNotEmpty()
  dateOfBirth: string; // e.g. YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY

  @IsOptional()
  @IsString()
  regNumber?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  examId?: string;
}

export class TerminatePcDto {
  @IsString()
  pcHostname: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class EmergencyTerminationToggleDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  adminPassword: string;
}

