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
exports.NotificationStorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_js_1 = require("@supabase/supabase-js");
const crypto_1 = require("crypto");
let NotificationStorageService = class NotificationStorageService {
    constructor(configService) {
        this.configService = configService;
        const supabaseUrl = this.configService.get('SUPABASE_URL');
        const serviceRoleKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY');
        this.bucketName =
            this.configService.get('SUPABASE_STORAGE_BUCKET') ||
                'message-attachments';
        if (!supabaseUrl ||
            !serviceRoleKey) {
            throw new Error('Supabase Storage configuration is missing. ' +
                'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
        }
        this.supabase =
            (0, supabase_js_1.createClient)(supabaseUrl, serviceRoleKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });
    }
    async uploadAttachment(messageId, file) {
        const safeFileName = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `messages/${messageId}/` +
            `${(0, crypto_1.randomUUID)()}-${safeFileName}`;
        const { error, } = await this.supabase
            .storage
            .from(this.bucketName)
            .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });
        if (error) {
            throw new common_1.InternalServerErrorException(`Unable to upload attachment: ${error.message}`);
        }
        return {
            fileName: file.originalname,
            fileUrl: storagePath,
            mimeType: file.mimetype,
            fileSize: file.size,
        };
    }
    async createSignedUrl(storagePath) {
        const { data, error, } = await this.supabase
            .storage
            .from(this.bucketName)
            .createSignedUrl(storagePath, 60 * 5);
        if (error ||
            !data?.signedUrl) {
            throw new common_1.InternalServerErrorException('Unable to create attachment download URL.');
        }
        return data.signedUrl;
    }
    async deleteAttachment(storagePath) {
        const { error, } = await this.supabase
            .storage
            .from(this.bucketName)
            .remove([
            storagePath,
        ]);
        if (error) {
            throw new common_1.InternalServerErrorException(`Unable to delete attachment: ${error.message}`);
        }
    }
};
exports.NotificationStorageService = NotificationStorageService;
exports.NotificationStorageService = NotificationStorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NotificationStorageService);
//# sourceMappingURL=notification-storage.service.js.map