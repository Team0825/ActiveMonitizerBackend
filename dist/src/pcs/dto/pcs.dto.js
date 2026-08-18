"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRegisterPcPayload = assertRegisterPcPayload;
exports.assertTeacherCommandPayload = assertTeacherCommandPayload;
exports.assertPcCommandAckPayload = assertPcCommandAckPayload;
exports.assertPcActivityPayload = assertPcActivityPayload;
function assertRegisterPcPayload(p) {
    if (!p ||
        typeof p.hostname !==
            'string' ||
        !p.hostname.trim()) {
        throw new Error('hostname is required');
    }
}
function assertTeacherCommandPayload(p) {
    if (!p ||
        typeof p.sessionId !==
            'string' ||
        !p.sessionId.trim()) {
        throw new Error('sessionId is required');
    }
    const validActions = [
        'LOCK',
        'UNLOCK',
        'FREEZE',
        'UNFREEZE',
        'SHUTDOWN',
        'RESTART',
        'MESSAGE',
        'WARNING',
        'CAPTURE',
        'SIMULATION_START',
        'SIMULATION_STOP',
        'CHATBOT_ENABLE',
        'CHATBOT_DISABLE',
    ];
    if (!validActions.includes(p.action)) {
        throw new Error(`action must be one of ${validActions.join(', ')}`);
    }
    if (p.action ===
        'MESSAGE' &&
        (typeof p.message !==
            'string' ||
            !p.message.trim())) {
        throw new Error('message is required for the MESSAGE action');
    }
}
function assertPcCommandAckPayload(p) {
    if (!p ||
        typeof p.commandId !==
            'string' ||
        !p.commandId.trim()) {
        throw new Error('commandId is required');
    }
    if (typeof p.hostname !==
        'string' ||
        !p.hostname.trim()) {
        throw new Error('hostname is required');
    }
    if (typeof p.success !==
        'boolean') {
        throw new Error('success must be a boolean');
    }
    const validActions = [
        'LOCK',
        'UNLOCK',
        'FREEZE',
        'UNFREEZE',
        'SHUTDOWN',
        'MESSAGE',
        'CAPTURE',
    ];
    if (!validActions.includes(p.action)) {
        throw new Error('Invalid command action');
    }
}
function assertPcActivityPayload(p) {
    if (!p ||
        typeof p.hostname !==
            'string' ||
        !p.hostname.trim()) {
        throw new Error('hostname is required');
    }
    if (typeof p.sessionId !==
        'string' ||
        !p.sessionId.trim()) {
        throw new Error('sessionId is required');
    }
    if (typeof p.active !==
        'boolean') {
        throw new Error('active must be a boolean');
    }
    if (typeof p.sampleSeconds !==
        'number' ||
        !Number.isFinite(p.sampleSeconds) ||
        p.sampleSeconds <= 0) {
        throw new Error('sampleSeconds must be a positive number');
    }
    if (p.sampleSeconds > 60) {
        throw new Error('sampleSeconds cannot exceed 60 seconds');
    }
    if (p.recordedAt !==
        undefined) {
        if (typeof p.recordedAt !==
            'string' ||
            Number.isNaN(Date.parse(p.recordedAt))) {
            throw new Error('recordedAt must be a valid date string');
        }
    }
}
//# sourceMappingURL=pcs.dto.js.map