import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/*
 * ============================================================
 * CREATE MESSAGE DTO
 * ============================================================
 *
 * Used by:
 *
 * ADMIN
 * TEACHER
 *
 * Supported recipient types:
 *
 * USER
 * CLASS
 * ALL_TEACHERS
 * ALL_STUDENTS
 * BROADCAST
 *
 * Supported message types:
 *
 * MESSAGE
 * QUESTION
 * PRACTICE
 * VIVA
 * NOTIFICATION
 * ============================================================
 */

export class CreateMessageDto {
  /*
   * Optional direct recipient User ID.
   *
   * Required when:
   * recipientType = USER
   *
   * Example:
   * Admin -> Teacher
   * Teacher -> Teacher
   * Teacher -> Student
   */

  @IsOptional()
  @IsString()
  recipientId?: string;

  /*
   * Defines who receives the message.
   */

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'USER',
    'CLASS',
    'ALL_TEACHERS',
    'ALL_STUDENTS',
    'BROADCAST',
  ])
  recipientType: string;

  /*
   * Required when:
   * recipientType = CLASS
   *
   * Example:
   * CSE
   * CSE-SEM-4
   */

  @IsOptional()
  @IsString()
  classId?: string;

  /*
   * Optional Session UUID.
   *
   * Used when a message or question
   * belongs to a particular laboratory session.
   */

  @IsOptional()
  @IsString()
  sessionId?: string;

  /*
   * Message category.
   *
   * MESSAGE:
   * Normal internal message.
   *
   * QUESTION:
   * General question.
   *
   * PRACTICE:
   * Practice activity/question.
   *
   * VIVA:
   * Viva question.
   *
   * NOTIFICATION:
   * General announcement.
   */

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'MESSAGE',
    'QUESTION',
    'PRACTICE',
    'VIVA',
    'NOTIFICATION',
  ])
  messageType: string;

  /*
   * Optional subject/title.
   */

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  /*
   * Main message content.
   */

  @IsString()
  @IsNotEmpty()
  body: string;

  /*
   * Controls whether recipients
   * are allowed to reply.
   *
   * Important for Student messages.
   *
   * Example:
   *
   * Admin sends question:
   * allowReply = true
   *
   * Admin sends announcement:
   * allowReply = false
   */

  @IsOptional()
  @IsBoolean()
  allowReply?: boolean;

  /*
   * Parent Message ID.
   *
   * Normally this should NOT be supplied
   * for a new message.
   *
   * Replies should use ReplyMessageDto.
   */

  @IsOptional()
  @IsString()
  parentMessageId?: string;
}

/*
 * ============================================================
 * REPLY MESSAGE DTO
 * ============================================================
 *
 * Used when replying to an existing message.
 *
 * Backend will verify:
 *
 * 1. Parent message exists.
 * 2. User has permission to reply.
 * 3. allowReply is enabled when required.
 * ============================================================
 */

export class ReplyMessageDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}

/*
 * ============================================================
 * MESSAGE FILTER DTO
 * ============================================================
 *
 * Used for Inbox / Sent / Filtering.
 *
 * Example:
 *
 * GET /notifications?messageType=VIVA
 *
 * GET /notifications?classId=CSE
 * ============================================================
 */

export class MessageFilterDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'MESSAGE',
    'QUESTION',
    'PRACTICE',
    'VIVA',
    'NOTIFICATION',
  ])
  messageType?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

/*
 * ============================================================
 * UPDATE MESSAGE DTO
 * ============================================================
 *
 * Initially used for limited message updates.
 *
 * This can later support:
 *
 * - Editing drafts
 * - Updating subject
 * - Changing reply permission
 *
 * We should NOT allow editing sent message content
 * without keeping an audit trail.
 * ============================================================
 */

export class UpdateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsBoolean()
  allowReply?: boolean;
}

/*
 * ============================================================
 * ATTACHMENT DTO
 * ============================================================
 *
 * This stores attachment metadata.
 *
 * Actual file upload handling will be connected
 * separately using Multer/local or cloud storage.
 * ============================================================
 */

export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}