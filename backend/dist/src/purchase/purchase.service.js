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
exports.PurchaseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const finance_utils_1 = require("../common/finance-utils");
let PurchaseService = class PurchaseService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(filters) {
        const where = { projectId: 'obra_vds_001' };
        if (filters.fornecedor) {
            where.fornecedor = {
                contains: filters.fornecedor,
                mode: 'insensitive',
            };
        }
        if (filters.formaPagamento) {
            where.pagamentos = {
                some: {
                    formaPagamento: filters.formaPagamento,
                },
            };
        }
        if (filters.statusCompra) {
            where.statusCompra = filters.statusCompra;
        }
        if (filters.cardId) {
            where.pagamentos = {
                some: {
                    cardId: filters.cardId,
                },
            };
        }
        return this.prisma.purchase.findMany({
            where,
            include: {
                itens: {
                    include: {
                        catalogItem: true,
                    },
                },
                pagamentos: {
                    include: {
                        card: true,
                        installmentPlans: true,
                    },
                },
                entregas: true,
                anexos: true,
                auditorias: true,
            },
            orderBy: { dataCompra: 'desc' },
        });
    }
    async findOne(id) {
        const purchase = await this.prisma.purchase.findUnique({
            where: { id },
            include: {
                itens: {
                    include: {
                        catalogItem: true,
                    },
                },
                pagamentos: {
                    include: {
                        card: true,
                        installmentPlans: true,
                    },
                },
                entregas: true,
                anexos: true,
                auditorias: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!purchase) {
            throw new common_1.NotFoundException(`Compra com ID ${id} não encontrada`);
        }
        return purchase;
    }
    async create(data) {
        if (data.totalPago < 0 || data.subtotalProdutos < 0 || data.frete < 0 || data.desconto < 0) {
            throw new common_1.BadRequestException('Valores financeiros não podem ser negativos');
        }
        return this.prisma.$transaction(async (tx) => {
            const purchase = await tx.purchase.create({
                data: {
                    id: data.id,
                    projectId: 'obra_vds_001',
                    fornecedor: data.fornecedor,
                    origem: data.origem,
                    statusCompra: data.statusCompra,
                    statusEntrega: data.statusEntrega,
                    compradorNome: data.compradorNome,
                    compradorCpf: data.compradorCpf,
                    enderecoEntrega: data.enderecoEntrega,
                    subtotalProdutos: data.subtotalProdutos,
                    frete: data.frete,
                    desconto: data.desconto,
                    totalPago: data.totalPago,
                    dataCompra: data.dataCompra ? new Date(data.dataCompra) : new Date(),
                    observacao: data.observacao,
                    ocrJobId: data.ocrJobId,
                },
            });
            for (const item of data.itens) {
                await tx.purchaseItem.create({
                    data: {
                        purchaseId: purchase.id,
                        nome: item.nome,
                        quantidade: item.quantidade,
                        valorUnitario: item.valorUnitario,
                        valorTotal: item.valorTotal,
                        vinculoCatalogoId: item.vinculoCatalogoId || null,
                    },
                });
                if (item.vinculoCatalogoId) {
                    const catalogItem = await tx.catalogItem.findUnique({
                        where: { id: item.vinculoCatalogoId },
                        include: { purchaseItems: true },
                    });
                    if (catalogItem) {
                        const outrosItens = await tx.purchaseItem.findMany({
                            where: {
                                vinculoCatalogoId: item.vinculoCatalogoId,
                                purchaseId: { not: purchase.id },
                                purchase: { statusCompra: { not: 'rascunho' } },
                            },
                        });
                        const totalPagoAcumulado = outrosItens.reduce((sum, curr) => sum + (curr.valorTotal ?? 0), 0) + item.valorTotal;
                        let novoStatus = 'comprado';
                        if (data.statusEntrega === 'entregue') {
                            novoStatus = 'recebido';
                        }
                        if (totalPagoAcumulado > catalogItem.custoOrcadoTotal) {
                            novoStatus = 'divergente';
                        }
                        await tx.catalogItem.update({
                            where: { id: item.vinculoCatalogoId },
                            data: {
                                statusCatalogo: novoStatus,
                            },
                        });
                    }
                }
            }
            for (const pg of data.pagamentos) {
                let jurosCalculado = 0;
                if (pg.formaPagamento === 'cartao_credito' && pg.parcelas && pg.valorParcela) {
                    jurosCalculado = (0, finance_utils_1.calcularJurosEfetivos)(pg.valorParcela, pg.parcelas, data.totalPago);
                }
                const payment = await tx.payment.create({
                    data: {
                        purchaseId: purchase.id,
                        formaPagamento: pg.formaPagamento,
                        cardId: pg.cardId || null,
                        parcelas: pg.parcelas || null,
                        valorParcela: pg.valorParcela || null,
                        juros: jurosCalculado || 0,
                        comJuros: pg.comJuros || jurosCalculado > 0,
                    },
                });
                if (pg.parcelas && pg.valorParcela) {
                    const parcelasData = [];
                    const dataInicial = data.dataCompra ? new Date(data.dataCompra) : new Date();
                    for (let i = 1; i <= pg.parcelas; i++) {
                        const dataVencimento = new Date(dataInicial);
                        dataVencimento.setMonth(dataVencimento.getMonth() + i);
                        parcelasData.push({
                            paymentId: payment.id,
                            numeroParcela: i,
                            valor: pg.valorParcela,
                            dataVencimento,
                            pago: false,
                        });
                    }
                    await tx.installmentPlan.createMany({
                        data: parcelasData,
                    });
                }
            }
            if (data.entregas && data.entregas.length > 0) {
                for (const ent of data.entregas) {
                    await tx.deliveryForecast.create({
                        data: {
                            purchaseId: purchase.id,
                            codigoEnvio: ent.codigoEnvio,
                            status: ent.status,
                            prazo: ent.prazo,
                        },
                    });
                }
            }
            if (data.anexos && data.anexos.length > 0) {
                for (const anexo of data.anexos) {
                    await tx.attachment.create({
                        data: {
                            purchaseId: purchase.id,
                            nome: anexo.nome,
                            url: anexo.url,
                            tipoMime: anexo.tipoMime,
                            tamanhoBytes: anexo.tamanhoBytes,
                        },
                    });
                }
            }
            await tx.auditLog.create({
                data: {
                    purchaseId: purchase.id,
                    usuario: data.usuarioResponsavel,
                    acao: 'CRIAR',
                    detalhes: JSON.stringify({
                        mensagem: `Compra criada via ${data.origem} por ${data.usuarioResponsavel}`,
                        totalPago: data.totalPago,
                        fornecedor: data.fornecedor,
                    }),
                },
            });
            return purchase;
        });
    }
    async updateStatus(id, statusCompra, usuario) {
        const purchase = await this.findOne(id);
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.purchase.update({
                where: { id },
                data: { statusCompra },
            });
            await tx.auditLog.create({
                data: {
                    purchaseId: id,
                    usuario,
                    acao: 'EDITAR',
                    detalhes: JSON.stringify({
                        campo: 'statusCompra',
                        de: purchase.statusCompra,
                        para: statusCompra,
                    }),
                },
            });
            return updated;
        });
    }
    async remove(id, usuario) {
        const purchase = await this.findOne(id);
        return this.prisma.$transaction(async (tx) => {
            await tx.auditLog.create({
                data: {
                    usuario,
                    acao: 'DELETAR',
                    detalhes: JSON.stringify({
                        mensagem: `Compra ${id} excluída por ${usuario}`,
                        fornecedor: purchase.fornecedor,
                        totalPago: purchase.totalPago,
                    }),
                },
            });
            for (const item of purchase.itens) {
                if (item.vinculoCatalogoId) {
                    const outrosItens = await tx.purchaseItem.findMany({
                        where: {
                            vinculoCatalogoId: item.vinculoCatalogoId,
                            purchaseId: { not: id },
                            purchase: { statusCompra: { not: 'rascunho' } },
                        },
                    });
                    let novoStatus = 'pendente';
                    if (outrosItens.length > 0) {
                        novoStatus = 'comprado';
                    }
                    await tx.catalogItem.update({
                        where: { id: item.vinculoCatalogoId },
                        data: { statusCatalogo: novoStatus },
                    });
                }
            }
            return tx.purchase.delete({
                where: { id },
            });
        });
    }
};
exports.PurchaseService = PurchaseService;
exports.PurchaseService = PurchaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PurchaseService);
//# sourceMappingURL=purchase.service.js.map