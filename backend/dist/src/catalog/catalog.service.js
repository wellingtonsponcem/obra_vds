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
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const finance_utils_1 = require("../common/finance-utils");
let CatalogService = class CatalogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(filters) {
        const where = { projectId: 'obra_vds_001' };
        if (filters.categoria) {
            where.categoria = filters.categoria;
        }
        if (filters.statusCatalogo) {
            where.statusCatalogo = filters.statusCatalogo;
        }
        if (filters.prioridade) {
            where.prioridade = filters.prioridade === 'null' ? null : filters.prioridade;
        }
        if (filters.localCompraPlanejado) {
            where.localCompraPlanejado = filters.localCompraPlanejado;
        }
        if (filters.search) {
            where.nome = {
                contains: filters.search,
                mode: 'insensitive',
            };
        }
        const items = await this.prisma.catalogItem.findMany({
            where,
            orderBy: { nome: 'asc' },
            include: {
                purchaseItems: {
                    include: {
                        purchase: true,
                    },
                },
            },
        });
        return items.map((item) => {
            const purchaseItemsValidos = item.purchaseItems.filter((pi) => pi.purchase.statusCompra !== 'rascunho');
            const precoPagoAcumulado = purchaseItemsValidos.reduce((acc, curr) => acc + (curr.valorTotal ?? 0), 0);
            const quantidadeComprada = purchaseItemsValidos.reduce((acc, curr) => acc + curr.quantidade, 0);
            const saldoPendente = Math.max(0, item.custoOrcadoTotal - precoPagoAcumulado);
            const { economia, sobrepreco } = (0, finance_utils_1.calcularEconomiaOuSobrepreco)(item.custoOrcadoTotal, precoPagoAcumulado);
            return {
                ...item,
                precoPagoAcumulado,
                quantidadeComprada,
                saldoPendente,
                economia,
                sobrepreco,
            };
        });
    }
    async getSummary() {
        const items = await this.findAll({});
        const purchases = await this.prisma.purchase.findMany({
            where: {
                projectId: 'obra_vds_001',
                statusCompra: { not: 'rascunho' },
            },
            include: {
                pagamentos: true,
            },
        });
        const totalOrcado = items.reduce((acc, curr) => acc + curr.custoOrcadoTotal, 0);
        const totalComprado = purchases.reduce((acc, curr) => acc + curr.totalPago, 0);
        const totalPendente = items
            .filter((i) => i.statusCatalogo === 'pendente')
            .reduce((acc, curr) => acc + curr.saldoPendente, 0);
        const totalRecebido = items
            .filter((i) => i.statusCatalogo === 'recebido')
            .reduce((acc, curr) => acc + curr.custoOrcadoTotal, 0);
        const totalComJuros = purchases.reduce((acc, curr) => acc + curr.pagamentos.reduce((pAcc, p) => pAcc + (p.juros ?? 0), 0), 0);
        let totalEconomia = 0;
        let totalSobrepreco = 0;
        items.forEach((item) => {
            totalEconomia += item.economia;
            totalSobrepreco += item.sobrepreco;
        });
        const progressoPercentual = (0, finance_utils_1.calcularPercentualProgresso)(totalComprado, totalOrcado);
        const alertasDivergencia = items
            .filter((item) => item.sobrepreco > 0)
            .map((item) => ({
            catalogItemId: item.id,
            nome: item.nome,
            orcado: item.custoOrcadoTotal,
            pago: item.precoPagoAcumulado,
            diferenca: item.sobrepreco,
        }));
        return {
            totalOrcado,
            totalComprado,
            totalPendente,
            totalRecebido,
            totalComJuros,
            totalEconomia,
            totalSobrepreco,
            progressoPercentual,
            alertasDivergencia,
        };
    }
    async findOne(id) {
        const item = await this.prisma.catalogItem.findUnique({
            where: { id },
            include: {
                purchaseItems: {
                    include: {
                        purchase: true,
                    },
                },
            },
        });
        if (!item) {
            throw new common_1.NotFoundException(`Item do catálogo com ID ${id} não encontrado`);
        }
        const purchaseItemsValidos = item.purchaseItems.filter((pi) => pi.purchase.statusCompra !== 'rascunho');
        const precoPagoAcumulado = purchaseItemsValidos.reduce((acc, curr) => acc + (curr.valorTotal ?? 0), 0);
        const saldoPendente = Math.max(0, item.custoOrcadoTotal - precoPagoAcumulado);
        const { economia, sobrepreco } = (0, finance_utils_1.calcularEconomiaOuSobrepreco)(item.custoOrcadoTotal, precoPagoAcumulado);
        return {
            ...item,
            precoPagoAcumulado,
            saldoPendente,
            economia,
            sobrepreco,
        };
    }
    async create(data) {
        return this.prisma.catalogItem.create({
            data: {
                ...data,
                projectId: 'obra_vds_001',
            },
        });
    }
    async update(id, data) {
        return this.prisma.catalogItem.update({
            where: { id },
            data,
        });
    }
    async remove(id) {
        return this.prisma.catalogItem.delete({
            where: { id },
        });
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map