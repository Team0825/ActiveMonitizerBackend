export declare class CreateMessageDto {
    recipientId?: string;
    recipientType: string;
    classId?: string;
    sessionId?: string;
    messageType: string;
    subject?: string;
    body: string;
    allowReply?: boolean;
    parentMessageId?: string;
}
export declare class ReplyMessageDto {
    body: string;
}
export declare class MessageFilterDto {
    messageType?: string;
    classId?: string;
    sessionId?: string;
}
export declare class UpdateMessageDto {
    subject?: string;
    allowReply?: boolean;
}
export declare class CreateAttachmentDto {
    fileName: string;
    fileUrl: string;
    mimeType?: string;
}
