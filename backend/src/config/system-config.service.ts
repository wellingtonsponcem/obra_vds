import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  // 1. Métodos de Cartões
  async getCards() {
    return this.prisma.card.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async createCard(data: { nome: string; finalCartao: string; limite?: number }) {
    return this.prisma.card.create({
      data,
    });
  }

  async deleteCard(id: string) {
    return this.prisma.card.delete({
      where: { id },
    });
  }

  // 2. Métodos de Chaves de Configuração
  async getKeys() {
    const keys = await this.prisma.systemConfig.findMany();
    // Censura chaves para visualização do frontend
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

  async updateKey(key: string, value: string) {
    const exists = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (exists) {
      return this.prisma.systemConfig.update({
        where: { key },
        data: { value },
      });
    } else {
      return this.prisma.systemConfig.create({
        data: { key, value },
      });
    }
  }

  // 3. Obter fornecedores e cartões já cadastrados em compras anteriores
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
}
