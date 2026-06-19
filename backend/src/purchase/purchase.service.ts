import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcularJurosEfetivos } from '../common/finance-utils';

@Injectable()
export class PurchaseService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    fornecedor?: string;
    formaPagamento?: string;
    statusCompra?: string;
    cardId?: string;
  }) {
    const where: any = { projectId: 'obra_vds_001' };

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

  async findOne(id: string) {
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
      throw new NotFoundException(`Compra com ID ${id} não encontrada`);
    }

    return purchase;
  }

  /**
   * Cria uma compra de forma transacional (ACID).
   * Se o banco cair no meio do request, toda a operação sofre rollback.
   */
  async create(data: {
    id: string;
    fornecedor: string;
    origem: string;
    statusCompra: string;
    statusEntrega: string;
    compradorNome?: string;
    compradorCpf?: string;
    enderecoEntrega?: string;
    subtotalProdutos: number; // em centavos
    frete: number; // em centavos
    desconto: number; // em centavos
    totalPago: number; // em centavos
    dataCompra?: string;
    observacao?: string;
    ocrJobId?: string;
    usuarioResponsavel: string; // para o log de auditoria
    
    itens: {
      nome: string;
      quantidade: number;
      valorUnitario: number;
      valorTotal: number;
      vinculoCatalogoId?: string; // item do catálogo associado
    }[];

    pagamentos: {
      formaPagamento: string;
      cardId?: string;
      parcelas?: number;
      valorParcela?: number;
      comJuros?: boolean;
    }[];

    entregas?: {
      codigoEnvio?: number;
      status?: string;
      prazo: string;
    }[];

    anexos?: {
      nome: string;
      url: string;
      tipoMime: string;
      tamanhoBytes: number;
    }[];
  }) {
    // Validação básica de consistência de valores
    if (data.totalPago < 0 || data.subtotalProdutos < 0 || data.frete < 0 || data.desconto < 0) {
      throw new BadRequestException('Valores financeiros não podem ser negativos');
    }

    // Executa a transação ACID do Prisma
    return this.prisma.$transaction(async (tx) => {
      // 1. Cria a compra
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

      // 2. Cria os itens da compra e atualiza os status no catálogo
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

        // Se o item estiver vinculado a um item do catálogo, atualizamos seu status e acumulado
        if (item.vinculoCatalogoId) {
          const catalogItem = await tx.catalogItem.findUnique({
            where: { id: item.vinculoCatalogoId },
            include: { purchaseItems: true },
          });

          if (catalogItem) {
            // Calcula o total que já foi pago acumulado para esse item
            // (contando com o item atual que acabamos de cadastrar na transação)
            const outrosItens = await tx.purchaseItem.findMany({
              where: {
                vinculoCatalogoId: item.vinculoCatalogoId,
                purchaseId: { not: purchase.id },
                purchase: { statusCompra: { not: 'rascunho' } },
              },
            });
            const totalPagoAcumulado = outrosItens.reduce((sum, curr) => sum + (curr.valorTotal ?? 0), 0) + item.valorTotal;

            // Determinar o novo status do catálogo
            let novoStatus = 'comprado';
            if (data.statusEntrega === 'entregue') {
              novoStatus = 'recebido';
            }
            if (totalPagoAcumulado > catalogItem.custoOrcadoTotal) {
              novoStatus = 'divergente'; // Sobrepreço!
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

      // 3. Cria as formas de pagamento e gera o plano de parcelas
      for (const pg of data.pagamentos) {
        let jurosCalculado = 0;
        
        if (pg.formaPagamento === 'cartao_credito' && pg.parcelas && pg.valorParcela) {
          jurosCalculado = calcularJurosEfetivos(pg.valorParcela, pg.parcelas, data.totalPago);
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

        // Gera as parcelas (InstallmentPlan)
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

      // 4. Cria as previsões de entrega
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

      // 5. Cria os anexos
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

      // 6. Registra log de auditoria
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

  async updateStatus(id: string, statusCompra: string, usuario: string) {
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

  async remove(id: string, usuario: string) {
    const purchase = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Guarda log de auditoria antes da exclusão (desvinculado da compra excluída, ou com log órfão)
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

      // Se havia itens vinculados ao catálogo, podemos resetar o status do item de catálogo correspondente
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
}
