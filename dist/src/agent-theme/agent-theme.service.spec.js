"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const agent_theme_service_1 = require("./agent-theme.service");
describe('AgentThemeService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [agent_theme_service_1.AgentThemeService],
        }).compile();
        service = module.get(agent_theme_service_1.AgentThemeService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=agent-theme.service.spec.js.map