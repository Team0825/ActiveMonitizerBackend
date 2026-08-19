import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateMessageDto, MessageFilterDto, ReplyMessageDto } from './dto/messages.dto';
import { NotificationsService } from './notifications.service';
type AuthenticatedRequest = Request & {
    user: JwtPayload;
};
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    getRecipients(req: AuthenticatedRequest): Promise<{
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
    getInbox(req: AuthenticatedRequest, filter: MessageFilterDto): Promise<({
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
    getSent(req: AuthenticatedRequest): Promise<({
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
    createMessage(req: AuthenticatedRequest, dto: CreateMessageDto): Promise<{
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
    reply(req: AuthenticatedRequest, id: string, dto: ReplyMessageDto): Promise<{
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
    uploadAttachment(req: AuthenticatedRequest, id: string, file?: Express.Multer.File): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        fileName: string;
        fileUrl: string;
        mimeType: string | null;
        fileSize: number | null;
        messageId: string;
    }>;
    getAttachmentDownloadUrl(req: AuthenticatedRequest, messageId: string, attachmentId: string): Promise<{
        id: string;
        fileName: string;
        mimeType: string | null;
        fileSize: number | null;
        downloadUrl: string;
        expiresIn: number;
    }>;
    getMessage(req: AuthenticatedRequest, id: string): Promise<{
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
}
export {};
