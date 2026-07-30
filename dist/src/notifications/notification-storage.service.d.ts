import { ConfigService } from '@nestjs/config';
export declare class NotificationStorageService {
    private readonly configService;
    private readonly supabase;
    private readonly bucketName;
    constructor(configService: ConfigService);
    uploadAttachment(messageId: string, file: Express.Multer.File): Promise<{
        fileName: string;
        fileUrl: string;
        mimeType: string;
        fileSize: number;
    }>;
    createSignedUrl(storagePath: string): Promise<string>;
    deleteAttachment(storagePath: string): Promise<void>;
}
