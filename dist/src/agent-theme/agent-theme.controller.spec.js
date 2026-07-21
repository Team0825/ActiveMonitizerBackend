"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const agent_theme_controller_1 = require("./agent-theme.controller");
describe('AgentThemeController', () => {
    let controller;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [agent_theme_controller_1.AgentThemeController],
        }).compile();
        controller = module.get(agent_theme_controller_1.AgentThemeController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
//# sourceMappingURL=agent-theme.controller.spec.js.map