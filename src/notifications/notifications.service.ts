import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
import { NotificationStorageService } from './notification-storage.service';

import {
  CreateMessageDto,
  MessageFilterDto,
  ReplyMessageDto,
} from './dto/messages.dto';

/*
 * ============================================================
 * AUTHENTICATED USER
 * ============================================================
 */

interface AuthUser {
  sub: string;
  role: string;
  username?: string;
}

/*
 * ============================================================
 * NOTIFICATIONS SERVICE
 * ============================================================
 */

@Injectable()
export class NotificationsService {
  constructor(
  private readonly prisma: PrismaService,

  private readonly sessionRealtimeService:
    SessionRealtimeService,

  private readonly notificationStorageService:
    NotificationStorageService,
) {}

  /*
   * ==========================================================
   * CREATE MESSAGE
   * ==========================================================
   */

  async createMessage(
    currentUser: AuthUser,
    dto: CreateMessageDto,
  ) {
    const sender =
      await this.prisma.user.findUnique({
        where: {
          id: currentUser.sub,
        },
      });

    if (!sender) {
      throw new NotFoundException(
        'Sender account not found',
      );
    }

    if (!sender.isActive) {
      throw new ForbiddenException(
        'Your account is inactive',
      );
    }

    /*
     * Only Admin and Teacher can currently
     * compose new messages.
     *
     * Students will later be allowed to reply
     * when allowReply = true.
     */

    if (
      sender.role !== 'ADMIN' &&
      sender.role !== 'TEACHER'
    ) {
      throw new ForbiddenException(
        'You do not have permission to compose messages',
      );
    }

    const recipientType =
      dto.recipientType.toUpperCase();

    const messageType =
      dto.messageType.toUpperCase();

    /*
     * ========================================================
     * DIRECT USER MESSAGE
     * ========================================================
     */

    if (recipientType === 'USER') {
      if (!dto.recipientId) {
        throw new BadRequestException(
          'recipientId is required when recipientType is USER',
        );
      }

      const recipient =
        await this.prisma.user.findUnique({
          where: {
            id: dto.recipientId,
          },
        });

      if (!recipient) {
        throw new NotFoundException(
          'Recipient not found',
        );
      }

      if (!recipient.isActive) {
        throw new BadRequestException(
          'Recipient account is inactive',
        );
      }

      /*
       * Teacher permissions:
       *
       * Teacher -> Admin
       * Teacher -> Teacher
       * Teacher -> Student
       *
       * Allowed.
       *
       * Teacher cannot message themselves.
       */

      if (
        sender.id ===
        recipient.id
      ) {
        throw new BadRequestException(
          'You cannot send a message to yourself',
        );
      }
    }

    /*
     * ========================================================
     * CLASS MESSAGE
     * ========================================================
     */

    if (recipientType === 'CLASS') {
      if (!dto.classId) {
        throw new BadRequestException(
          'classId is required when recipientType is CLASS',
        );
      }

      const studentCount =
        await this.prisma.user.count({
          where: {
            role: 'STUDENT',
            classId: dto.classId,
            isActive: true,
          },
        });

      if (studentCount === 0) {
        throw new NotFoundException(
          'No active students found in this class',
        );
      }
    }

    /*
     * ========================================================
     * ALL STUDENTS / BROADCAST PERMISSIONS
     * ========================================================
     *
     * Admin:
     * Can send system-wide broadcasts.
     *
     * Teacher:
     * Can send to a selected class,
     * selected student,
     * Admin or another Teacher.
     *
     * For safety, ALL_STUDENTS and BROADCAST
     * remain Admin-only.
     */

    if (
      sender.role === 'TEACHER' &&
      (
        recipientType ===
          'ALL_STUDENTS' ||
        recipientType ===
          'BROADCAST'
      )
    ) {
      throw new ForbiddenException(
        'Teachers cannot send system-wide broadcasts',
      );
    }

    /*
     * ========================================================
     * ALL TEACHERS
     * ========================================================
     *
     * Both Admin and Teacher can send
     * messages to all Teachers.
     */

    /*
     * ========================================================
     * OPTIONAL SESSION VALIDATION
     * ========================================================
     */

    if (dto.sessionId) {
      const session =
        await this.prisma.classSession.findUnique({
          where: {
            id: dto.sessionId,
          },
        });

      if (!session) {
        throw new NotFoundException(
          'Session not found',
        );
      }
    }

    /*
     * ========================================================
     * CREATE MESSAGE
     * ========================================================
     */

    const createdMessage =
  await this.prisma.message.create({
    data: {
      senderId:
        sender.id,

      recipientId:
        dto.recipientId ||
        null,

      recipientType,

      classId:
        dto.classId ||
        null,

      sessionId:
        dto.sessionId ||
        null,

      messageType,

      subject:
        dto.subject?.trim() ||
        null,

      body:
        dto.body.trim(),

      allowReply:
        dto.allowReply ??
        false,
    },

    include: {
      sender: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
        },
      },

      recipient: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          regNumber: true,
          classId: true,
        },
      },

      attachments:
        true,
    },
  });

/*
 * ========================================================
 * REALTIME STUDENT MESSAGE DELIVERY
 * ========================================================
 *
 * Database message creation and realtime delivery
 * are separate responsibilities.
 *
 * The message is always saved first.
 *
 * If an intended Student recipient currently has
 * an active PC Session, the message is also pushed
 * immediately to the Student Agent.
 */

const studentWhereConditions:
  Record<string, unknown>[] =
  [];

if (
  recipientType ===
    'USER' &&
  createdMessage
    .recipient?.role ===
    'STUDENT' &&
  createdMessage
    .recipientId
) {
  studentWhereConditions.push({
    id:
      createdMessage
        .recipientId,
  });
}

if (
  recipientType ===
    'CLASS' &&
  dto.classId
) {
  studentWhereConditions.push({
    role:
      'STUDENT',

    classId:
      dto.classId,

    isActive:
      true,
  });
}

if (
  recipientType ===
  'ALL_STUDENTS'
) {
  studentWhereConditions.push({
    role:
      'STUDENT',

    isActive:
      true,
  });
}

if (
  recipientType ===
  'BROADCAST'
) {
  studentWhereConditions.push({
    role:
      'STUDENT',

    isActive:
      true,
  });
}

/*
 * Only attempt Student realtime delivery
 * when the message targets Students.
 */

if (
  studentWhereConditions
    .length >
  0
) {
  const students =
    await this.prisma.user
      .findMany({
        where: {
          OR:
            studentWhereConditions,
        },

        select: {
          id:
            true,
        },
      });

  const studentIds =
    students.map(
      (student) =>
        student.id,
    );

  if (
    studentIds.length >
    0
  ) {
    /*
     * Find PCs currently assigned
     * to the target Students.
     *
     * currentSessionId contains the
     * internal ClassSession UUID.
     */

    const activePcs =
      await this.prisma.pc
        .findMany({
          where: {
            currentStudentId: {
              in:
                studentIds,
            },

            status: {
              not:
                'OFFLINE',
            },

            currentSessionId: {
              not:
                null,
            },
          },

          select: {
            hostname:
              true,

            currentStudentId:
              true,

            currentSessionId:
              true,
          },
        });

    /*
     * Push the message to each
     * connected Student PC.
     */

    for (
      const pc
      of activePcs
    ) {
      this.sessionRealtimeService
        .emitToPc(
          pc.hostname,
          'student:message',
          {
            id:
              createdMessage.id,

            messageType:
              createdMessage
                .messageType,

            subject:
              createdMessage
                .subject,

            body:
              createdMessage
                .body,

            allowReply:
              createdMessage
                .allowReply,

            sender: {
              id:
                createdMessage
                  .sender.id,

              username:
                createdMessage
                  .sender
                  .username,

              name:
                createdMessage
                  .sender.name,

              role:
                createdMessage
                  .sender.role,
            },

            recipientType:
              createdMessage
                .recipientType,

            sessionId:
              pc.currentSessionId,

            sentAt:
              createdMessage
                .sentAt,
          },
        );
    }
  }
}

return createdMessage;
  }

  /*
   * ==========================================================
   * GET INBOX
   * ==========================================================
   *
   * A user receives a message when:
   *
   * 1. recipientId = their User ID
   * 2. recipientType = BROADCAST
   * 3. recipientType = ALL_TEACHERS and they are Teacher
   * 4. recipientType = ALL_STUDENTS and they are Student
   * 5. recipientType = CLASS and classId matches Student class
   */

  async getInbox(
    currentUser: AuthUser,
    filter?: MessageFilterDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: currentUser.sub,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const recipientConditions:
      Record<string, unknown>[] = [
        {
          recipientId:
            user.id,
        },

        {
          recipientType:
            'BROADCAST',
        },
      ];

    if (
      user.role === 'TEACHER'
    ) {
      recipientConditions.push({
        recipientType:
          'ALL_TEACHERS',
      });
    }

    if (
      user.role === 'STUDENT'
    ) {
      recipientConditions.push({
        recipientType:
          'ALL_STUDENTS',
      });

      if (user.classId) {
        recipientConditions.push({
          recipientType:
            'CLASS',

          classId:
            user.classId,
        });
      }
    }

    return this.prisma.message.findMany({
      where: {
        OR:
          recipientConditions,

        ...(filter?.messageType
          ? {
              messageType:
                filter.messageType,
            }
          : {}),

        ...(filter?.classId
          ? {
              classId:
                filter.classId,
            }
          : {}),

        ...(filter?.sessionId
          ? {
              sessionId:
                filter.sessionId,
            }
          : {}),
      },

      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },

        recipient: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            regNumber: true,
            classId: true,
          },
        },

        attachments: true,

        replies: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                role: true,
              },
            },

            attachments: true,
          },

          orderBy: {
            sentAt:
              'asc',
          },
        },
      },

      orderBy: {
        sentAt:
          'desc',
      },
    });
  }

  /*
   * ==========================================================
   * GET SENT MESSAGES
   * ==========================================================
   */

  async getSent(
    currentUser: AuthUser,
  ) {
    return this.prisma.message.findMany({
      where: {
        senderId:
          currentUser.sub,

        /*
         * Replies are displayed inside
         * their parent conversation.
         */

        parentMessageId:
          null,
      },

      include: {
        recipient: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            regNumber: true,
            classId: true,
          },
        },

        attachments: true,

        replies: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                role: true,
              },
            },
          },

          orderBy: {
            sentAt:
              'asc',
          },
        },
      },

      orderBy: {
        sentAt:
          'desc',
      },
    });
  }

  /*
   * ==========================================================
   * GET ONE MESSAGE
   * ==========================================================
   */

  async getMessage(
    currentUser: AuthUser,
    messageId: string,
  ) {
    const message =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
            },
          },

          recipient: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
              regNumber: true,
              classId: true,
            },
          },

          attachments: true,

          replies: {
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  role: true,
                },
              },

              attachments:
                true,
            },

            orderBy: {
              sentAt:
                'asc',
            },
          },
        },
      });

    if (!message) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    const canView =
      await this.canViewMessage(
        currentUser.sub,
        message,
      );

    if (!canView) {
      throw new ForbiddenException(
        'You do not have permission to view this message',
      );
    }

    return message;
  }
  /*
 * ==========================================================
 * UPLOAD MESSAGE ATTACHMENT
 * ==========================================================
 *
 * The message must already exist.
 *
 * For now, only the original sender can add attachments
 * to the message.
 *
 * Flow:
 *
 * 1. Verify message exists.
 * 2. Verify current user is original sender.
 * 3. Upload file to private Supabase Storage.
 * 4. Save attachment metadata in Prisma.
 * 5. Return attachment metadata.
 * ==========================================================
 */

async uploadAttachment(
  currentUser: AuthUser,
  messageId: string,
  file: Express.Multer.File,
) {
  const message =
    await this.prisma.message.findUnique({
      where: {
        id: messageId,
      },

      select: {
        id: true,
        senderId: true,
      },
    });

  if (!message) {
    throw new NotFoundException(
      'Message not found',
    );
  }

  /*
   * Only the original sender can upload
   * an attachment to an existing message.
   *
   * This prevents recipients from modifying
   * another user's original message.
   */

  if (
    message.senderId !==
    currentUser.sub
  ) {
    throw new ForbiddenException(
      'You do not have permission to add attachments to this message',
    );
  }

  if (!file) {
    throw new BadRequestException(
      'Attachment file is required',
    );
  }

  /*
   * Upload file to private
   * Supabase Storage.
   */

  const uploaded =
    await this.notificationStorageService
      .uploadAttachment(
        messageId,
        file,
      );

  try {
    /*
     * Store attachment metadata
     * in PostgreSQL through Prisma.
     */

    return await this.prisma
      .messageAttachment
      .create({
        data: {
          messageId:
            messageId,

          fileName:
            uploaded.fileName,

          fileUrl:
            uploaded.fileUrl,

          mimeType:
            uploaded.mimeType,

          fileSize:
            uploaded.fileSize,
        },
      });
  } catch (error) {
    /*
     * Database creation failed after
     * Supabase upload.
     *
     * Remove the uploaded file so we
     * do not leave orphaned files.
     */

    try {
      await this.notificationStorageService
        .deleteAttachment(
          uploaded.fileUrl,
        );
    } catch {
      /*
       * Do not replace the original
       * database error if cleanup fails.
       */
    }

    throw error;
  }
}

/*
 * ==========================================================
 * GET ATTACHMENT DOWNLOAD URL
 * ==========================================================
 *
 * Files are stored privately.
 *
 * An authorized user requests an attachment.
 * We verify that the user can view the parent message,
 * then generate a temporary Supabase signed URL.
 * ==========================================================
 */

async getAttachmentDownloadUrl(
  currentUser: AuthUser,
  messageId: string,
  attachmentId: string,
) {
  /*
   * Reuse the existing message authorization.
   *
   * getMessage() throws automatically if:
   *
   * - Message does not exist.
   * - User cannot view the message.
   */

  await this.getMessage(
    currentUser,
    messageId,
  );

  const attachment =
    await this.prisma
      .messageAttachment
      .findFirst({
        where: {
          id:
            attachmentId,

          messageId:
            messageId,
        },
      });

  if (!attachment) {
    throw new NotFoundException(
      'Attachment not found',
    );
  }

  const downloadUrl =
    await this.notificationStorageService
      .createSignedUrl(
        attachment.fileUrl,
      );

  return {
    id:
      attachment.id,

    fileName:
      attachment.fileName,

    mimeType:
      attachment.mimeType,

    fileSize:
      attachment.fileSize,

    downloadUrl,

    expiresIn:
      300,
  };
}

  /*
   * ==========================================================
   * REPLY TO MESSAGE
   * ==========================================================
   */

  async reply(
    currentUser: AuthUser,
    messageId: string,
    dto: ReplyMessageDto,
  ) {
    const parent =
      await this.prisma.message.findUnique({
        where: {
          id: messageId,
        },

        include: {
          sender: true,
          recipient: true,
        },
      });

    if (!parent) {
      throw new NotFoundException(
        'Message not found',
      );
    }

    const replyingUser =
      await this.prisma.user.findUnique({
        where: {
          id: currentUser.sub,
        },
      });

    if (!replyingUser) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const canView =
      await this.canViewMessage(
        replyingUser.id,
        parent,
      );

    if (!canView) {
      throw new ForbiddenException(
        'You cannot reply to this message',
      );
    }

    /*
     * Admin and Teacher can reply to messages
     * they have access to.
     *
     * Students can only reply when
     * allowReply = true.
     */

    if (
      replyingUser.role ===
        'STUDENT' &&
      !parent.allowReply
    ) {
      throw new ForbiddenException(
        'Replies are disabled for this message',
      );
    }

    /*
     * Determine reply recipient.
     *
     * If current user is original sender,
     * reply goes to original direct recipient.
     *
     * Otherwise reply goes back to original sender.
     */

    let recipientId:
      string | null =
      parent.senderId;

    if (
      replyingUser.id ===
      parent.senderId
    ) {
      recipientId =
        parent.recipientId;
    }

    /*
     * Broadcast/Class messages may not have
     * a direct recipient.
     *
     * A recipient replying to a broadcast
     * sends the reply directly to the
     * original sender.
     */

    if (!recipientId) {
      recipientId =
        parent.senderId;
    }

    return this.prisma.message.create({
      data: {
        senderId:
          replyingUser.id,

        recipientId,

        recipientType:
          'USER',

        sessionId:
          parent.sessionId,

        messageType:
          'MESSAGE',

        subject:
          parent.subject
            ? `Re: ${parent.subject}`
            : null,

        body:
          dto.body.trim(),

        allowReply:
          true,

        parentMessageId:
          parent.id,
      },

      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },

        recipient: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

  /*
   * ==========================================================
   * GET AVAILABLE RECIPIENTS
   * ==========================================================
   *
   * Used by the frontend Compose Message screen.
   *
   * Admin sees:
   * Teachers + Students
   *
   * Teacher sees:
   * Admins + Teachers + Students
   *
   * Current user is excluded.
   */

  async getRecipients(
    currentUser: AuthUser,
  ) {
    const current =
      await this.prisma.user.findUnique({
        where: {
          id: currentUser.sub,
        },
      });

    if (!current) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const allowedRoles =
      current.role === 'ADMIN'
        ? [
            'TEACHER',
            'STUDENT',
          ]
        : [
            'ADMIN',
            'TEACHER',
            'STUDENT',
          ];

    return this.prisma.user.findMany({
      where: {
        id: {
          not:
            current.id,
        },

        role: {
          in:
            allowedRoles,
        },

        isActive:
          true,
      },

      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        regNumber: true,
        rollNumber: true,
        classId: true,
        email: true,
      },

      orderBy: [
        {
          role:
            'asc',
        },

        {
          username:
            'asc',
        },
      ],
    });
  }

  /*
   * ==========================================================
   * GET AVAILABLE CLASSES
   * ==========================================================
   *
   * Used by:
   *
   * Send to Whole Class
   */

  async getClasses() {
    const students =
      await this.prisma.user.findMany({
        where: {
          role:
            'STUDENT',

          isActive:
            true,

          classId: {
            not:
              null,
          },
        },

        select: {
          classId:
            true,
        },
      });

    return Array.from(
      new Set(
        students
          .map(
            (student) =>
              student.classId,
          )
          .filter(
            (
              classId,
            ): classId is string =>
              Boolean(
                classId,
              ),
          ),
      ),
    ).sort();
  }

  /*
   * ==========================================================
   * CAN VIEW MESSAGE
   * ==========================================================
   */

  private async canViewMessage(
    userId: string,
    message: {
      senderId: string;
      recipientId: string | null;
      recipientType: string;
      classId: string | null;
    },
  ) {
    /*
     * Sender can always view.
     */

    if (
      message.senderId ===
      userId
    ) {
      return true;
    }

    /*
     * Direct recipient.
     */

    if (
      message.recipientId ===
      userId
    ) {
      return true;
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          role: true,
          classId: true,
        },
      });

    if (!user) {
      return false;
    }

    /*
     * Broadcast.
     */

    if (
      message.recipientType ===
      'BROADCAST'
    ) {
      return true;
    }

    /*
     * All Teachers.
     */

    if (
      message.recipientType ===
        'ALL_TEACHERS' &&
      user.role ===
        'TEACHER'
    ) {
      return true;
    }

    /*
     * All Students.
     */

    if (
      message.recipientType ===
        'ALL_STUDENTS' &&
      user.role ===
        'STUDENT'
    ) {
      return true;
    }

    /*
     * Whole Class.
     */

    if (
      message.recipientType ===
        'CLASS' &&
      user.role ===
        'STUDENT' &&
      Boolean(
        message.classId,
      ) &&
      user.classId ===
        message.classId
    ) {
      return true;
    }

    return false;
  }
}