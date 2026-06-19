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
exports.SystemConfigService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SystemConfigService = class SystemConfigService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCards() {
        return this.prisma.card.findMany({
            orderBy: { nome: 'asc' },
        });
    }
    async createCard(data) {
        return this.prisma.card.create({
            data,
        });
    }
    async deleteCard(id) {
        return this.prisma.card.delete({
            where: { id },
        });
    }
    async getKeys() {
        const keys = await this.prisma.systemConfig.findMany();
        return keys.map((cfg) => {
            if (cfg.key.includes('key') && cfg.value) {
                return {
                    key: cfg.key,
                    value: cfg.value.substring(0, 4) + '...' + cfg.value.substring(cfg.value.length - 4),
                };
            }
            return cfg;
        });
    }
    async updateKey(key, value) {
        const exists = await this.prisma.systemConfig.findUnique({
            where: { key },
        });
        if (exists) {
            return this.prisma.systemConfig.update({
                where: { key },
                data: { value },
            });
        }
        else {
            return this.prisma.systemConfig.create({
                data: { key, value },
            });
        }
    }
    async getSuppliersAndCardsSuggestions() {
        const purchases = await this.prisma.purchase.findMany({
            select: { fornecedor: true },
            distinct: ['fornecedor'],
        });
        const cards = await this.getCards();
        return {
            fornecedores: purchases.map((p) => p.fornecedor),
            cartoes: cards,
        };
    }
};
exports.SystemConfigService = SystemConfigService;
exports.SystemConfigService = SystemConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SystemConfigService);
//# sourceMappingURL=system-config.service.js.map