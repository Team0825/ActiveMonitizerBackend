import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js';

import { randomUUID } from 'crypto';

/*
 * ============================================================
 * NOTIFICATION STORAGE SERVICE
 * ============================================================
 *
 * Stores notification/message attachments in Supabase Storage.
 *
 * IMPORTANT:
 *
 * SUPABASE_SERVICE_ROLE_KEY must NEVER be exposed
 * to the frontend.
 *
 * It exists only in the backend environment.
 * ============================================================
 */

@Injectable()
export class NotificationStorageService {
  private readonly supabase:
    SupabaseClient;

  private readonly bucketName:
    string;

  constructor(
    private readonly configService:
      ConfigService,
  ) {
    const supabaseUrl =
      this.configService.get<string>(
        'SUPABASE_URL',
      );

    const serviceRoleKey =
      this.configService.get<string>(
        'SUPABASE_SERVICE_ROLE_KEY',
      );

    this.bucketName =
      this.configService.get<string>(
        'SUPABASE_STORAGE_BUCKET',
      ) ||
      'message-attachments';

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        'Supabase Storage configuration is missing. ' +
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
      );
    }

    this.supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        },
      );
  }

  /*
   * ==========================================================
   * UPLOAD ATTACHMENT
   * ==========================================================
   */

  async uploadAttachment(
    messageId: string,
    file: Express.Multer.File,
  ) {
    const safeFileName =
      file.originalname
        .replace(
          /[^a-zA-Z0-9._-]/g,
          '_',
        );

    const storagePath =
      `messages/${messageId}/` +
      `${randomUUID()}-${safeFileName}`;

    const {
      error,
    } =
      await this.supabase
        .storage
        .from(
          this.bucketName,
        )
        .upload(
          storagePath,
          file.buffer,
          {
            contentType:
              file.mimetype,

            upsert:
              false,
          },
        );

    if (error) {
      throw new InternalServerErrorException(
        `Unable to upload attachment: ${error.message}`,
      );
    }

    /*
     * Store the private Storage path
     * instead of a permanent public URL.
     *
     * We will generate signed URLs
     * when an authorized user requests
     * the attachment.
     */

    return {
      fileName:
        file.originalname,

      fileUrl:
        storagePath,

      mimeType:
        file.mimetype,

      fileSize:
        file.size,
    };
  }

  /*
   * ==========================================================
   * CREATE TEMPORARY DOWNLOAD URL
   * ==========================================================
   */

  async createSignedUrl(
    storagePath: string,
  ) {
    const {
      data,
      error,
    } =
      await this.supabase
        .storage
        .from(
          this.bucketName,
        )
        .createSignedUrl(
          storagePath,
          60 * 5,
        );

    if (
      error ||
      !data?.signedUrl
    ) {
      throw new InternalServerErrorException(
        'Unable to create attachment download URL.',
      );
    }

    return data.signedUrl;
  }

  /*
   * ==========================================================
   * DELETE FILE
   * ==========================================================
   */

  async deleteAttachment(
    storagePath: string,
  ) {
    const {
      error,
    } =
      await this.supabase
        .storage
        .from(
          this.bucketName,
        )
        .remove([
          storagePath,
        ]);

    if (error) {
      throw new InternalServerErrorException(
        `Unable to delete attachment: ${error.message}`,
      );
    }
  }
}