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
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        name: string | null;
        rollNumber: string | null;
        classId: string | null;
    }[]>;
    getClasses(): Promise<string[]>;
    getInbox(req: AuthenticatedRequest, filter: MessageFilterDto): Promise<({
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
    getSent(req: AuthenticatedRequest): Promise<({
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
    createMessage(req: AuthenticatedRequest, dto: CreateMessageDto): Promise<{
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
    reply(req: AuthenticatedRequest, id: string, dto: ReplyMessageDto): Promise<{
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
}
export {};
