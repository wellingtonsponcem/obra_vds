import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularEconomiaOuSobrepreco,
  calcularPercentualProgresso,
} from '../common/finance-utils';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    categoria?: string;
    statusCatalogo?: string;
    prioridade?: string;
    localCompraPlanejado?: string;
    search?: string;
  }) {
    const where: any = { projectId: 'obra_vds_001' };

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

    // Calcula acumulados e saldos em runtime para garantir precisão e tempo real
    return items.map((item) => {
      const purchaseItemsValidos = item.purchaseItems.filter(
        (pi) => pi.purchase.statusCompra !== 'rascunho',
      );

      const precoPagoAcumulado = purchaseItemsValidos.reduce(
        (acc, curr) => acc + (curr.valorTotal ?? 0),
        0,
      );

      const quantidadeComprada = purchaseItemsValidos.reduce(
        (acc, curr) => acc + curr.quantidade,
        0,
      );

      const saldoPendente = Math.max(0, item.custoOrcadoTotal - precoPagoAcumulado);
      const { economia, sobrepreco } = calcularEconomiaOuSobrepreco(
        item.custoOrcadoTotal,
        precoPagoAcumulado,
      );

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
    
    // Total comprado real é o total pago acumulado nas compras efetivas
    const totalComprado = purchases.reduce((acc, curr) => acc + curr.totalPago, 0);

    // Total pendente: itens de catálogo com status 'pendente' ou saldo pendente
    const totalPendente = items
      .filter((i) => i.statusCatalogo === 'pendente')
      .reduce((acc, curr) => acc + curr.saldoPendente, 0);

    // Total recebido: custo orçado total dos itens com status 'recebido'
    const totalRecebido = items
      .filter((i) => i.statusCatalogo === 'recebido')
      .reduce((acc, curr) => acc + curr.custoOrcadoTotal, 0);

    // Total com juros: somatória de juros nas compras
    const totalComJuros = purchases.reduce(
      (acc, curr) => acc + curr.pagamentos.reduce((pAcc, p) => pAcc + (p.juros ?? 0), 0),
      0,
    );

    // Economias e sobrepreços consolidados dos itens do catálogo
    let totalEconomia = 0;
    let totalSobrepreco = 0;

    items.forEach((item) => {
      totalEconomia += item.economia;
      totalSobrepreco += item.sobrepreco;
    });

    const progressoPercentual = calcularPercentualProgresso(totalComprado, totalOrcado);

    // Buscar alertas de divergência (onde o valor pago é maior que o orçado)
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

  async findOne(id: string) {
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
      throw new NotFoundException(`Item do catálogo com ID ${id} não encontrado`);
    }

    const purchaseItemsValidos = item.purchaseItems.filter(
      (pi) => pi.purchase.statusCompra !== 'rascunho',
    );

    const precoPagoAcumulado = purchaseItemsValidos.reduce(
      (acc, curr) => acc + (curr.valorTotal ?? 0),
      0,
    );

    const saldoPendente = Math.max(0, item.custoOrcadoTotal - precoPagoAcumulado);
    const { economia, sobrepreco } = calcularEconomiaOuSobrepreco(
      item.custoOrcadoTotal,
      precoPagoAcumulado,
    );

    return {
      ...item,
      precoPagoAcumulado,
      saldoPendente,
      economia,
      sobrepreco,
    };
  }

  async create(data: any) {
    return this.prisma.catalogItem.create({
      data: {
        ...data,
        projectId: 'obra_vds_001',
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.catalogItem.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.catalogItem.delete({
      where: { id },
    });
  }
}
