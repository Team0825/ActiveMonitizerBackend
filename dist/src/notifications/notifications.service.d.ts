import { PrismaService } from '../prisma/prisma.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
import { NotificationStorageService } from './notification-storage.service';
import { CreateMessageDto, MessageFilterDto, ReplyMessageDto } from './dto/messages.dto';
interface AuthUser {
    sub: string;
    role: string;
    username?: string;
}
export declare class NotificationsService {
    private readonly prisma;
    private readonly sessionRealtimeService;
    private readonly notificationStorageService;
    constructor(prisma: PrismaService, sessionRealtimeService: SessionRealtimeService, notificationStorageService: NotificationStorageService);
    createMessage(currentUser: AuthUser, dto: CreateMessageDto): Promise<{
        sender: {
            id: string;
            username: string;
            role: string;
            name: string | null;
        };
        recipient: {
            id: string;
            username: string;
            regNumber: string | null;
            role: string;
            name: string | null;
            classId: string | null;
        } | null;
        attachments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            fileName: string;
            fileUrl: string;
            mimeType: string | null;
            fileSize: number | null;
            messageId: string;
        }[];
    } & {
        id: string;
        classId: string | null;
        updatedAt: Date;
        sessionId: string | null;
        recipientId: string | null;
        recipientType: string;
        messageType: string;
        subject: string | null;
        body: string;
        allowReply: boolean;
        parentMessageId: string | null;
        sentAt: Date;
        senderId: string;
    }>;
    getInbox(currentUser: AuthUser, filter?: MessageFilterDto): Promise<({
        sender: {
            id: string;
            username: string;
            role: string;
            name: string | null;
        };
        recipient: {
            id: string;
            username: string;
            regNumber: string | null;
            role: string;
            name: string | null;
            classId: string | null;
        } | null;
        replies: ({
            sender: {
                id: string;
                username: string;
                role: string;
                name: string | null;
            };
            attachments: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                fileName: string;
                fileUrl: string;
                mimeType: string | null;
                fileSize: number | null;
                messageId: string;
            }[];
        } & {
            id: string;
            classId: string | null;
            updatedAt: Date;
            sessionId: string | null;
            recipientId: string | null;
            recipientType: string;
            messageType: string;
            subject: string | null;
            body: string;
            allowReply: boolean;
            parentMessageId: string | null;
            sentAt: Date;
            senderId: string;
        })[];
        attachments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            fileName: string;
            fileUrl: string;
            mimeType: string | null;
            fileSize: number | null;
            messageId: string;
        }[];
    } & {
        id: string;
        classId: string | null;
        updatedAt: Date;
        sessionId: string | null;
        recipientId: string | null;
        recipientType: string;
        messageType: string;
        subject: string | null;
        body: string;
        allowReply: boolean;
        parentMessageId: string | null;
        sentAt: Date;
        senderId: string;
    })[]>;
    getSent(currentUser: AuthUser): Promise<({
        recipient: {
            id: string;
            username: string;
            regNumber: string | null;
            role: string;
            name: string | null;
            classId: string | null;
        } | null;
        replies: ({
            sender: {
                id: string;
                username: string;
                role: string;
                name: string | null;
            };
        } & {
            id: string;
            classId: string | null;
            updatedAt: Date;
            sessionId: string | null;
            recipientId: string | null;
            recipientType: string;
            messageType: string;
            subject: string | null;
            body: string;
            allowReply: boolean;
            parentMessageId: string | null;
            sentAt: Date;
            senderId: string;
        })[];
        attachments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            fileName: string;
            fileUrl: string;
            mimeType: string | null;
            fileSize: number | null;
            messageId: string;
        }[];
    } & {
        id: string;
        classId: string | null;
        updatedAt: Date;
        sessionId: string | null;
        recipientId: string | null;
        recipientType: string;
        messageType: string;
        subject: string | null;
        body: string;
        allowReply: boolean;
        parentMessageId: string | null;
        sentAt: Date;
        senderId: string;
    })[]>;
    getMessage(currentUser: AuthUser, messageId: string): Promise<{
        sender: {
            id: string;
            username: string;
            role: string;
            name: string | null;
        };
        recipient: {
            id: string;
            username: string;
            regNumber: string | null;
            role: string;
            name: string | null;
            classId: string | null;
        } | null;
        replies: ({
            sender: {
                id: string;
                username: string;
                role: string;
                name: string | null;
            };
            attachments: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                fileName: string;
                fileUrl: string;
                mimeType: string | null;
                fileSize: number | null;
                messageId: string;
            }[];
        } & {
            id: string;
            classId: string | null;
            updatedAt: Date;
            sessionId: string | null;
            recipientId: string | null;
            recipientType: string;
            messageType: string;
            subject: string | null;
            body: string;
            allowReply: boolean;
            parentMessageId: string | null;
            sentAt: Date;
            senderId: string;
        })[];
        attachments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            fileName: string;
            fileUrl: string;
            mimeType: string | null;
            fileSize: number | null;
            messageId: string;
        }[];
    } & {
        id: string;
        classId: string | null;
        updatedAt: Date;
        sessionId: string | null;
        recipientId: string | null;
        recipientType: string;
        messageType: string;
        subject: string | null;
        body: string;
        allowReply: boolean;
        parentMessageId: string | null;
        sentAt: Date;
        senderId: string;
    }>;
    uploadAttachment(currentUser: AuthUser, messageId: string, file: Express.Multer.File): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        fileName: string;
        fileUrl: string;
        mimeType: string | null;
        fileSize: number | null;
        messageId: string;
    }>;
    getAttachmentDownloadUrl(currentUser: AuthUser, messageId: string, attachmentId: string): Promise<{
        id: string;
        fileName: string;
        mimeType: string | null;
        fileSize: number | null;
        downloadUrl: string;
        expiresIn: number;
    }>;
    reply(currentUser: AuthUser, messageId: string, dto: ReplyMessageDto): Promise<{
        sender: {
            id: string;
            username: string;
            role: string;
            name: string | null;
        };
        recipient: {
            id: string;
            username: string;
            role: string;
            name: string | null;
        } | null;
    } & {
        id: string;
        classId: string | null;
        updatedAt: Date;
        sessionId: string | null;
        recipientId: string | null;
        recipientType: string;
        messageType: string;
        subject: string | null;
        body: string;
        allowReply: boolean;
        parentMessageId: string | null;
        sentAt: Date;
        senderId: string;
    }>;
    getRecipients(currentUser: AuthUser): Promise<{
        id: string;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        name: string | null;
        rollNumber: string | null;
        classId: string | null;
    }[]>;
    getClasses(): Promise<string[]>;
    private canViewMessage;
}
export {};
