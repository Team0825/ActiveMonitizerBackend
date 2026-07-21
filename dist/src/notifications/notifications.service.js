"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const session_realtime_service_1 = require("../realtime/session-realtime.service");
let NotificationsService = class NotificationsService {
    constructor(prisma, sessionRealtimeService) {
        this.prisma = prisma;
        this.sessionRealtimeService = sessionRealtimeService;
    }
    async createMessage(currentUser, dto) {
        const sender = await this.prisma.user.findUnique({
            where: {
                id: currentUser.sub,
            },
        });
        if (!sender) {
            throw new common_1.NotFoundException('Sender account not found');
        }
        if (!sender.isActive) {
            throw new common_1.ForbiddenException('Your account is inactive');
        }
        if (sender.role !== 'ADMIN' &&
            sender.role !== 'TEACHER') {
            throw new common_1.ForbiddenException('You do not have permission to compose messages');
        }
        const recipientType = dto.recipientType.toUpperCase();
        const messageType = dto.messageType.toUpperCase();
        if (recipientType === 'USER') {
            if (!dto.recipientId) {
                throw new common_1.BadRequestException('recipientId is required when recipientType is USER');
            }
            const recipient = await this.prisma.user.findUnique({
                where: {
                    id: dto.recipientId,
                },
            });
            if (!recipient) {
                throw new common_1.NotFoundException('Recipient not found');
            }
            if (!recipient.isActive) {
                throw new common_1.BadRequestException('Recipient account is inactive');
            }
            if (sender.id ===
                recipient.id) {
                throw new common_1.BadRequestException('You cannot send a message to yourself');
            }
        }
        if (recipientType === 'CLASS') {
            if (!dto.classId) {
                throw new common_1.BadRequestException('classId is required when recipientType is CLASS');
            }
            const studentCount = await this.prisma.user.count({
                where: {
                    role: 'STUDENT',
                    classId: dto.classId,
                    isActive: true,
                },
            });
            if (studentCount === 0) {
                throw new common_1.NotFoundException('No active students found in this class');
            }
        }
        if (sender.role === 'TEACHER' &&
            (recipientType ===
                'ALL_STUDENTS' ||
                recipientType ===
                    'BROADCAST')) {
            throw new common_1.ForbiddenException('Teachers cannot send system-wide broadcasts');
        }
        if (dto.sessionId) {
            const session = await this.prisma.classSession.findUnique({
                where: {
                    id: dto.sessionId,
                },
            });
            if (!session) {
                throw new common_1.NotFoundException('Session not found');
            }
        }
        const createdMessage = await this.prisma.message.create({
            data: {
                senderId: sender.id,
                recipientId: dto.recipientId ||
                    null,
                recipientType,
                classId: dto.classId ||
                    null,
                sessionId: dto.sessionId ||
                    null,
                messageType,
                subject: dto.subject?.trim() ||
                    null,
                body: dto.body.trim(),
                allowReply: dto.allowReply ??
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
                attachments: true,
            },
        });
        const studentWhereConditions = [];
        if (recipientType ===
            'USER' &&
            createdMessage
                .recipient?.role ===
                'STUDENT' &&
            createdMessage
                .recipientId) {
            studentWhereConditions.push({
                id: createdMessage
                    .recipientId,
            });
        }
        if (recipientType ===
            'CLASS' &&
            dto.classId) {
            studentWhereConditions.push({
                role: 'STUDENT',
                classId: dto.classId,
                isActive: true,
            });
        }
        if (recipientType ===
            'ALL_STUDENTS') {
            studentWhereConditions.push({
                role: 'STUDENT',
                isActive: true,
            });
        }
        if (recipientType ===
            'BROADCAST') {
            studentWhereConditions.push({
                role: 'STUDENT',
                isActive: true,
            });
        }
        if (studentWhereConditions
            .length >
            0) {
            const students = await this.prisma.user
                .findMany({
                where: {
                    OR: studentWhereConditions,
                },
                select: {
                    id: true,
                },
            });
            const studentIds = students.map((student) => student.id);
            if (studentIds.length >
                0) {
                const activePcs = await this.prisma.pc
                    .findMany({
                    where: {
                        currentStudentId: {
                            in: studentIds,
                        },
                        status: {
                            not: 'OFFLINE',
                        },
                        currentSessionId: {
                            not: null,
                        },
                    },
                    select: {
                        hostname: true,
                        currentStudentId: true,
                        currentSessionId: true,
                    },
                });
                for (const pc of activePcs) {
                    this.sessionRealtimeService
                        .emitToPc(pc.hostname, 'student:message', {
                        id: createdMessage.id,
                        messageType: createdMessage
                            .messageType,
                        subject: createdMessage
                            .subject,
                        body: createdMessage
                            .body,
                        allowReply: createdMessage
                            .allowReply,
                        sender: {
                            id: createdMessage
                                .sender.id,
                            username: createdMessage
                                .sender
                                .username,
                            name: createdMessage
                                .sender.name,
                            role: createdMessage
                                .sender.role,
                        },
                        recipientType: createdMessage
                            .recipientType,
                        sessionId: pc.currentSessionId,
                        sentAt: createdMessage
                            .sentAt,
                    });
                }
            }
        }
        return createdMessage;
    }
    async getInbox(currentUser, filter) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: currentUser.sub,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const recipientConditions = [
            {
                recipientId: user.id,
            },
            {
                recipientType: 'BROADCAST',
            },
        ];
        if (user.role === 'TEACHER') {
            recipientConditions.push({
                recipientType: 'ALL_TEACHERS',
            });
        }
        if (user.role === 'STUDENT') {
            recipientConditions.push({
                recipientType: 'ALL_STUDENTS',
            });
            if (user.classId) {
                recipientConditions.push({
                    recipientType: 'CLASS',
                    classId: user.classId,
                });
            }
        }
        return this.prisma.message.findMany({
            where: {
                OR: recipientConditions,
                ...(filter?.messageType
                    ? {
                        messageType: filter.messageType,
                    }
                    : {}),
                ...(filter?.classId
                    ? {
                        classId: filter.classId,
                    }
                    : {}),
                ...(filter?.sessionId
                    ? {
                        sessionId: filter.sessionId,
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
                        sentAt: 'asc',
                    },
                },
            },
            orderBy: {
                sentAt: 'desc',
            },
        });
    }
    async getSent(currentUser) {
        return this.prisma.message.findMany({
            where: {
                senderId: currentUser.sub,
                parentMessageId: null,
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
                        sentAt: 'asc',
                    },
                },
            },
            orderBy: {
                sentAt: 'desc',
            },
        });
    }
    async getMessage(currentUser, messageId) {
        const message = await this.prisma.message.findUnique({
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
                        attachments: true,
                    },
                    orderBy: {
                        sentAt: 'asc',
                    },
                },
            },
        });
        if (!message) {
            throw new common_1.NotFoundException('Message not found');
        }
        const canView = await this.canViewMessage(currentUser.sub, message);
        if (!canView) {
            throw new common_1.ForbiddenException('You do not have permission to view this message');
        }
        return message;
    }
    async reply(currentUser, messageId, dto) {
        const parent = await this.prisma.message.findUnique({
            where: {
                id: messageId,
            },
            include: {
                sender: true,
                recipient: true,
            },
        });
        if (!parent) {
            throw new common_1.NotFoundException('Message not found');
        }
        const replyingUser = await this.prisma.user.findUnique({
            where: {
                id: currentUser.sub,
            },
        });
        if (!replyingUser) {
            throw new common_1.NotFoundException('User not found');
        }
        const canView = await this.canViewMessage(replyingUser.id, parent);
        if (!canView) {
            throw new common_1.ForbiddenException('You cannot reply to this message');
        }
        if (replyingUser.role ===
            'STUDENT' &&
            !parent.allowReply) {
            throw new common_1.ForbiddenException('Replies are disabled for this message');
        }
        let recipientId = parent.senderId;
        if (replyingUser.id ===
            parent.senderId) {
            recipientId =
                parent.recipientId;
        }
        if (!recipientId) {
            recipientId =
                parent.senderId;
        }
        return this.prisma.message.create({
            data: {
                senderId: replyingUser.id,
                recipientId,
                recipientType: 'USER',
                sessionId: parent.sessionId,
                messageType: 'MESSAGE',
                subject: parent.subject
                    ? `Re: ${parent.subject}`
                    : null,
                body: dto.body.trim(),
                allowReply: true,
                parentMessageId: parent.id,
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
    async getRecipients(currentUser) {
        const current = await this.prisma.user.findUnique({
            where: {
                id: currentUser.sub,
            },
        });
        if (!current) {
            throw new common_1.NotFoundException('User not found');
        }
        const allowedRoles = current.role === 'ADMIN'
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
                    not: current.id,
                },
                role: {
                    in: allowedRoles,
                },
                isActive: true,
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
                    role: 'asc',
                },
                {
                    username: 'asc',
                },
            ],
        });
    }
    async getClasses() {
        const students = await this.prisma.user.findMany({
            where: {
                role: 'STUDENT',
                isActive: true,
                classId: {
                    not: null,
                },
            },
            select: {
                classId: true,
            },
        });
        return Array.from(new Set(students
            .map((student) => student.classId)
            .filter((classId) => Boolean(classId)))).sort();
    }
    async canViewMessage(userId, message) {
        if (message.senderId ===
            userId) {
            return true;
        }
        if (message.recipientId ===
            userId) {
            return true;
        }
        const user = await this.prisma.user.findUnique({
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
        if (message.recipientType ===
            'BROADCAST') {
            return true;
        }
        if (message.recipientType ===
            'ALL_TEACHERS' &&
            user.role ===
                'TEACHER') {
            return true;
        }
        if (message.recipientType ===
            'ALL_STUDENTS' &&
            user.role ===
                'STUDENT') {
            return true;
        }
        if (message.recipientType ===
            'CLASS' &&
            user.role ===
                'STUDENT' &&
            Boolean(message.classId) &&
            user.classId ===
                message.classId) {
            return true;
        }
        return false;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        session_realtime_service_1.SessionRealtimeService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map