import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivateLicenseDto, ValidateLicenseDto, CreateLicenseDto } from './dto/license.dto';
import * as crypto from 'crypto';

@Injectable()
export class LicensingService {
  private readonly logger = new Logger(LicensingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a tamper-evident server signature for the activated license
   */
  private generateSignature(licenseNumber: string, machineFingerprint: string, institutionId: string): string {
    const payload = `${licenseNumber}:${machineFingerprint}:${institutionId}:${process.env.JWT_SECRET || 'am-enterprise-key'}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Retrieves the current licensing status for the given machine / institution
   */
  async getStatus(machineFingerprint?: string, institutionId?: string) {
    let license = null;

    if (machineFingerprint) {
      license = await this.prisma.license.findFirst({
        where: {
          machineFingerprint,
          status: 'ACTIVE',
        },
        include: {
          institution: true,
        },
      });
    }

    if (!license && institutionId) {
      license = await this.prisma.license.findFirst({
        where: {
          institutionId,
          status: 'ACTIVE',
        },
        include: {
          institution: true,
        },
      });
    }

    // Fallback: check any active license in system
    if (!license) {
      license = await this.prisma.license.findFirst({
        where: {
          status: 'ACTIVE',
          isActivated: true,
        },
        include: {
          institution: true,
        },
      });
    }

    if (!license) {
      return {
        isActivated: false,
        status: 'NOT_ACTIVATED',
        licenseNumber: null,
        activationKey: null,
        institution: null,
        machineFingerprint: null,
        machineName: null,
        activationDate: null,
        expiryDate: null,
        licenseType: null,
        serverStatus: 'CONNECTED',
      };
    }

    const isExpired = license.expiresAt ? new Date(license.expiresAt) < new Date() : false;
    const finalStatus = isExpired ? 'EXPIRED' : license.status;

    return {
      isActivated: license.isActivated && !isExpired && license.status === 'ACTIVE',
      status: finalStatus,
      licenseNumber: license.licenseNumber,
      activationKey: license.activationKey,
      activationKeyMasked: license.activationKey
        ? `ACT-••••-••••-${license.activationKey.slice(-4)}`
        : null,
      activationKeyFull: license.activationKey,
      institutionId: license.institution?.id || null,
      institutionName: license.institution?.name || null,
      institutionCode: license.institution?.code || null,
      institutionBoard: license.institution?.board || null,
      institutionLocation: license.institution?.location || null,
      institutionLogoUrl: license.institution?.logoUrl || null,
      institution: license.institution
        ? {
            id: license.institution.id,
            name: license.institution.name,
            code: license.institution.code,
            board: license.institution.board,
            location: license.institution.location,
            logoUrl: license.institution.logoUrl,
          }
        : null,
      machineFingerprint: license.machineFingerprint,
      deviceName: license.machineName || 'Registered Machine',
      machineName: license.machineName || 'Registered Machine',
      activatedAt: license.activatedAt ? license.activatedAt.toISOString() : null,
      activationDate: license.activatedAt ? license.activatedAt.toISOString() : null,
      expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
      expiryDate: license.expiresAt ? license.expiresAt.toISOString() : 'Never',
      licenseType: license.licenseType,
      maxPcs: license.maxPcs,
      canDeactivate: true,
      serverStatus: 'CONNECTED',
    };
  }

  /**
   * Activates a license with strict machine binding
   */
  async activate(dto: ActivateLicenseDto) {
    const cleanKey = dto.activationKey.trim().toUpperCase();
    const cleanFingerprint = dto.machineFingerprint.trim();

    if (!cleanKey) {
      throw new BadRequestException('Activation key is required.');
    }
    if (!cleanFingerprint) {
      throw new BadRequestException('Machine hardware fingerprint is required.');
    }

    const license = await this.prisma.license.findFirst({
      where: {
        activationKey: { equals: cleanKey, mode: 'insensitive' },
      },
      include: {
        institution: true,
      },
    });

    if (!license) {
      throw new NotFoundException('Invalid activation key. Please check your license credentials.');
    }

    if (license.status === 'REVOKED') {
      throw new ForbiddenException('This license has been revoked by the system administrator.');
    }

    if (license.status === 'EXPIRED' || (license.expiresAt && new Date(license.expiresAt) < new Date())) {
      throw new ForbiddenException('This license has expired. Please contact support to renew.');
    }

    // Section 5: ONE LICENSE = ONE INSTITUTION MACHINE
    if (license.isActivated && license.machineFingerprint && license.machineFingerprint !== cleanFingerprint) {
      this.logger.warn(
        `Blocked duplicate license activation attempt for key ${cleanKey}. Existing machine: ${license.machineName || license.machineFingerprint}, New attempted: ${dto.machineName || cleanFingerprint}`,
      );
      throw new ForbiddenException(
        'This license is already activated on another registered machine. Each license is bound to one authorized institution installation. Please contact Super Admin for license reassignment.',
      );
    }

    const serverSignature = this.generateSignature(license.licenseNumber, cleanFingerprint, license.institutionId);

    const updatedLicense = await this.prisma.license.update({
      where: { id: license.id },
      data: {
        isActivated: true,
        machineFingerprint: cleanFingerprint,
        machineName: dto.machineName?.trim() || license.machineName || 'Authorized Enterprise Machine',
        status: 'ACTIVE',
        activatedAt: license.activatedAt || new Date(),
        lastValidatedAt: new Date(),
        serverSignature,
      },
      include: {
        institution: true,
      },
    });

    return {
      success: true,
      message: 'APPLICATION ACTIVATED SUCCESSFULLY',
      license: {
        licenseNumber: updatedLicense.licenseNumber,
        activationKey: updatedLicense.activationKey,
        institution: updatedLicense.institution ? {
          id: updatedLicense.institution.id,
          name: updatedLicense.institution.name,
          code: updatedLicense.institution.code,
          board: updatedLicense.institution.board,
          location: updatedLicense.institution.location,
        } : null,
        machineFingerprint: updatedLicense.machineFingerprint,
        machineName: updatedLicense.machineName,
        activationDate: updatedLicense.activatedAt?.toISOString(),
        expiryDate: updatedLicense.expiresAt ? updatedLicense.expiresAt.toISOString() : 'Never',
        licenseType: updatedLicense.licenseType,
        status: 'ACTIVATED',
      },
    };
  }

  /**
   * Refreshes license validation
   */
  async refresh(activationKey: string, machineFingerprint: string) {
    const cleanKey = (activationKey || '').trim();
    const cleanFingerprint = (machineFingerprint || '').trim();

    const license = await this.prisma.license.findFirst({
      where: {
        OR: [
          { activationKey: { equals: cleanKey, mode: 'insensitive' } },
          { machineFingerprint: cleanFingerprint },
        ],
      },
      include: { institution: true },
    });

    if (!license) {
      return {
        valid: false,
        status: 'NOT_FOUND',
        message: 'No license found matching provided credentials.',
      };
    }

    if (license.machineFingerprint && cleanFingerprint && license.machineFingerprint !== cleanFingerprint) {
      return {
        valid: false,
        status: 'MACHINE_MISMATCH',
        message: 'License is bound to another machine.',
      };
    }

    const isExpired = license.expiresAt ? new Date(license.expiresAt) < new Date() : false;
    const isValid = license.isActivated && license.status === 'ACTIVE' && !isExpired;

    await this.prisma.license.update({
      where: { id: license.id },
      data: { lastValidatedAt: new Date() },
    });

    return {
      valid: isValid,
      status: isExpired ? 'EXPIRED' : license.status,
      licenseNumber: license.licenseNumber,
      activationKey: license.activationKey,
      institution: license.institution?.name,
      machineName: license.machineName,
      lastValidatedAt: new Date().toISOString(),
    };
  }

  /**
   * Super Admin: Deactivate / Reset machine binding
   */
  async deactivate(identifier: string, resetMachineBinding: boolean, user: any) {
    if (!user?.isSuperAdmin && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can deactivate or reassign licenses.');
    }

    const license = await this.prisma.license.findFirst({
      where: {
        OR: [{ id: identifier }, { licenseNumber: identifier }],
      },
    });
    if (!license) throw new NotFoundException('License not found.');

    return this.prisma.license.update({
      where: { id: license.id },
      data: {
        isActivated: false,
        status: resetMachineBinding ? 'ACTIVE' : 'INACTIVE',
        machineFingerprint: resetMachineBinding ? null : license.machineFingerprint,
        machineName: resetMachineBinding ? null : license.machineName,
        serverSignature: null,
      },
    });
  }

  /**
   * List all licenses (Super Admin: all; Admin: scoped to institution)
   */
  async listAll(user: any) {
    if (user?.isSuperAdmin || user?.role === 'SUPER_ADMIN') {
      return this.prisma.license.findMany({
        include: { institution: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user?.institutionId) {
      return this.prisma.license.findMany({
        where: { institutionId: user.institutionId },
        include: { institution: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  /**
   * Create a new license (Super Admin only)
   */
  async create(dto: CreateLicenseDto, user: any) {
    if (!user?.isSuperAdmin && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can create licenses.');
    }

    return this.prisma.license.create({
      data: {
        licenseNumber: dto.licenseNumber.trim().toUpperCase(),
        activationKey: dto.activationKey.trim().toUpperCase(),
        institutionId: dto.institutionId,
        licenseType: dto.licenseType || 'PRO',
        maxPcs: dto.maxPcs || 100,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: 'ACTIVE',
        isActivated: false,
      },
      include: { institution: true },
    });
  }
}
