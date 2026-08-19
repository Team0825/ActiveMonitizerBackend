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
            name: string | null;
            username: string;
            role: string;
        };
        recipient: {
            id: string;
            name: string | null;
            username: string;
            regNumber: string | null;
            role: string;
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
        updatedAt: Date;
        classId: string | null;
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
            name: string | null;
            username: string;
            role: string;
        };
        recipient: {
            id: string;
            name: string | null;
            username: string;
            regNumber: string | null;
            role: string;
            classId: string | null;
        } | null;
        replies: ({
            sender: {
                id: string;
                name: string | null;
                username: string;
                role: string;
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
            updatedAt: Date;
            classId: string | null;
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
        updatedAt: Date;
        classId: string | null;
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
            name: string | null;
            username: string;
            regNumber: string | null;
            role: string;
            classId: string | null;
        } | null;
        replies: ({
            sender: {
                id: string;
                name: string | null;
                username: string;
                role: string;
            };
        } & {
            id: string;
            updatedAt: Date;
            classId: string | null;
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
        updatedAt: Date;
        classId: string | null;
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
            name: string | null;
            username: string;
            role: string;
        };
        recipient: {
            id: string;
            name: string | null;
            username: string;
            regNumber: string | null;
            role: string;
            classId: string | null;
        } | null;
        replies: ({
            sender: {
                id: string;
                name: string | null;
                username: string;
                role: string;
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
            updatedAt: Date;
            classId: string | null;
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
        updatedAt: Date;
        classId: string | null;
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
            name: string | null;
            username: string;
            role: string;
        };
        recipient: {
            id: string;
            name: string | null;
            username: string;
            role: string;
        } | null;
    } & {
        id: string;
        updatedAt: Date;
        classId: string | null;
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
        name: string | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        rollNumber: string | null;
        classId: string | null;
    }[]>;
    getClasses(): Promise<string[]>;
    private canViewMessage;
}
export {};
