import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { readFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { calcularSimilaridade } from '../common/string-utils';

type OcrFile = {
  filename: string;
  originalname?: string;
  path: string;
  mimetype: string;
  size?: number;
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private prisma: PrismaService) {}

  async processOcr(file: OcrFile) {
    if (!file) {
      throw new BadRequestException('Arquivo de imagem não fornecido');
    }

    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Apenas imagens são aceitas no OCR');
    }

    this.logger.log(`Iniciando OCR real para o arquivo: ${file.originalname || file.filename}`);

    const job = await this.prisma.ocrJob.create({
      data: {
        status: 'processando',
        imagemUrl: `/ocr/uploads/${file.filename}`,
      },
    });

    await this.prisma.attachment.create({
      data: {
        ocrJobId: job.id,
        nome: file.originalname || file.filename,
        url: `/ocr/uploads/${file.filename}`,
        tipoMime: file.mimetype,
        tamanhoBytes: file.size || 0,
      },
    });

    try {
      const apiKey = await this.getGeminiApiKey();

      if (!apiKey) {
        await this.prisma.ocrJob.update({
          where: { id: job.id },
          data: {
            status: 'erro',
            jsonBruto: JSON.stringify({ erro: 'Chave GEMINI_API_KEY não configurada.' }),
          },
        });

        throw new HttpException(
          'Chave GEMINI_API_KEY não configurada. Cadastre a chave em config keys ou defina GEMINI_API_KEY no ambiente do backend.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const imageBuffer = await readFile(file.path);
      const ai = new GoogleGenAI({ apiKey });
      const prompt = this.buildPrompt();

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: imageBuffer.toString('base64'),
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);
      const jsonResult = this.normalizeOcrData(parsed);
      const validation = this.validatePurchaseEvidence(jsonResult);

      if (!validation.ok) {
        await this.prisma.ocrJob.update({
          where: { id: job.id },
          data: {
            status: 'erro',
            jsonBruto: JSON.stringify({
              ...jsonResult,
              erro: validation.message,
            }),
          },
        });

        throw new HttpException(
          {
            message: validation.message,
            data: jsonResult,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const itensComVinculo = await this.linkCatalogItems(jsonResult.itens || []);
      jsonResult.itens = itensComVinculo;
      jsonResult.alertas = [
        ...(jsonResult.alertas || []),
        ...validation.alertas,
      ];

      await this.prisma.ocrJob.update({
        where: { id: job.id },
        data: {
          status: 'sucesso',
          jsonBruto: JSON.stringify(jsonResult),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          acao: 'OCR_PROCESSAR',
          usuario: 'sistema',
          detalhes: JSON.stringify({
            jobId: job.id,
            arquivo: file.originalname || file.filename,
            fornecedor: jsonResult.fornecedor,
            total: jsonResult.resumo.total,
          }),
        },
      });

      return {
        jobId: job.id,
        status: 'sucesso',
        data: jsonResult,
        attachment: {
          nome: file.originalname || file.filename,
          url: `/ocr/uploads/${file.filename}`,
          tipoMime: file.mimetype,
          tamanhoBytes: file.size || 0,
        },
      };
    } catch (error) {
      this.logger.error('Erro ao processar OCR real:', error);

      if (error instanceof HttpException || error instanceof BadRequestException) {
        await this.prisma.ocrJob.update({
          where: { id: job.id },
          data: {
            status: 'erro',
            jsonBruto: JSON.stringify({ erro: error.message }),
          },
        }).catch(() => undefined);
        throw error;
      }

      await this.prisma.ocrJob.update({
        where: { id: job.id },
        data: {
          status: 'erro',
          jsonBruto: JSON.stringify({ erro: error.message || 'Erro desconhecido no OCR' }),
        },
      });

      throw error;
    }
  }

  private async getGeminiApiKey() {
    const geminiConfig = await this.prisma.systemConfig.findUnique({
      where: { key: 'gemini_api_key' },
    });

    return (geminiConfig?.value || process.env.GEMINI_API_KEY || '').trim();
  }

  private buildPrompt() {
    return `
Você é um extrator estrito de dados de compras para prestação de contas de obra.

Analise a imagem e extraia somente informações visíveis. Não invente dados. Não use compras anteriores. Não preencha com exemplos.

Se a imagem não parecer um comprovante, nota, boleto, checkout, pedido, recibo ou confirmação de compra, retorne:
{
  "is_compra": false,
  "motivo_recusa": "Imagem não parece ser uma compra ou comprovante.",
  "texto_bruto": "",
  "alertas": ["Imagem rejeitada: sem evidência de compra."]
}

Se for compra, retorne JSON válido com esta estrutura:
{
  "is_compra": true,
  "fornecedor": "",
  "tipo_documento": "",
  "comprador": { "nome": "", "cpf": "" },
  "entrega": { "endereco": "", "descricao": "", "previsoes": [] },
  "pagamento": {
    "metodo": "pix|cartao_credito|cartao_debito|boleto|dinheiro|transferencia",
    "cartao": "",
    "final_cartao": "",
    "parcelas": null,
    "valor_parcela": null,
    "juros": null,
    "sem_juros": null,
    "texto_pagamento_bruto": ""
  },
  "resumo": {
    "quantidade_itens": null,
    "valor_produtos": null,
    "desconto": null,
    "frete": null,
    "subtotal": null,
    "total": null,
    "economia": null
  },
  "itens": [
    { "nome": "", "quantidade": null, "valor_unitario": null, "valor_total": null }
  ],
  "observacoes": [],
  "texto_bruto": "",
  "confianca": { "fornecedor": 0, "pagamento": 0, "total": 0, "itens": 0 },
  "alertas": []
}

Regras:
- Valores monetários devem ser decimais em BRL, sem R$, usando ponto decimal. Exemplo: 123.45.
- Se houver ambiguidade, use null e registre em alertas.
- Se houver mais de uma opção de parcelamento, não escolha uma; registre em alertas.
- Só preencha fornecedor, total e itens se houver evidência clara na imagem.
- Se não houver itens individuais, mas houver total e fornecedor, retorne itens vazios.
`;
  }

  private normalizeOcrData(data: any) {
    const pagamentoMetodo = this.normalizePaymentMethod(data.pagamento?.metodo || data.pagamento?.formaPagamento || '');
    const itens = Array.isArray(data.itens) ? data.itens : [];
    const previsoes = Array.isArray(data.entrega?.previsoes) ? data.entrega.previsoes : [];
    const alertas = Array.isArray(data.alertas) ? data.alertas : [];
    const observacoes = Array.isArray(data.observacoes) ? data.observacoes : [];

    return {
      is_compra: data.is_compra === true,
      motivo_recusa: data.motivo_recusa || '',
      fornecedor: this.cleanText(data.fornecedor),
      tipo_documento: this.cleanText(data.tipo_documento),
      comprador: {
        nome: this.cleanText(data.comprador?.nome),
        cpf: this.cleanText(data.comprador?.cpf),
      },
      entrega: {
        endereco: this.cleanText(data.entrega?.endereco),
        descricao: this.cleanText(data.entrega?.descricao),
        previsoes: previsoes.map((p: any) => ({
          codigoEnvio: p.codigoEnvio || p.codigo_envio || null,
          status: this.cleanText(p.status),
          prazo: this.cleanText(p.prazo || p.descricao),
        })),
      },
      pagamento: {
        metodo: pagamentoMetodo,
        cartao: this.cleanText(data.pagamento?.cartao),
        final_cartao: this.cleanText(data.pagamento?.final_cartao || data.pagamento?.finalCartao),
        parcelas: this.toNullableNumber(data.pagamento?.parcelas),
        valor_parcela: this.toNullableDecimal(data.pagamento?.valor_parcela ?? data.pagamento?.valorParcela),
        juros: this.toNullableDecimal(data.pagamento?.juros),
        sem_juros: this.toNullableBoolean(data.pagamento?.sem_juros ?? data.pagamento?.semJuros),
        texto_pagamento_bruto: this.cleanText(data.pagamento?.texto_pagamento_bruto || data.pagamento?.textoPagamentoBruto),
      },
      resumo: {
        quantidade_itens: this.toNullableNumber(data.resumo?.quantidade_itens ?? data.resumo?.quantidadeItens ?? itens.length),
        valor_produtos: this.toNullableDecimal(data.resumo?.valor_produtos ?? data.resumo?.valorProdutos),
        desconto: this.toNullableDecimal(data.resumo?.desconto) || 0,
        frete: this.toNullableDecimal(data.resumo?.frete) || 0,
        subtotal: this.toNullableDecimal(data.resumo?.subtotal),
        total: this.toNullableDecimal(data.resumo?.total),
        economia: this.toNullableDecimal(data.resumo?.economia) || 0,
      },
      itens: itens.map((item: any) => ({
        nome: this.cleanText(item.nome),
        quantidade: this.toNullableNumber(item.quantidade) || 1,
        valor_unitario: this.toNullableDecimal(item.valor_unitario ?? item.valorUnitario),
        valor_total: this.toNullableDecimal(item.valor_total ?? item.valorTotal),
      })),
      observacoes,
      texto_bruto: this.cleanText(data.texto_bruto || data.textoBruto),
      confianca: {
        fornecedor: this.toConfidence(data.confianca?.fornecedor),
        pagamento: this.toConfidence(data.confianca?.pagamento),
        total: this.toConfidence(data.confianca?.total),
        itens: this.toConfidence(data.confianca?.itens),
      },
      alertas,
    };
  }

  private validatePurchaseEvidence(data: any) {
    const alertas: string[] = [];
    const hasFornecedor = !!data.fornecedor;
    const hasTotal = typeof data.resumo?.total === 'number';
    const hasItems = Array.isArray(data.itens) && data.itens.length > 0;

    if (data.is_compra === false) {
      return {
        ok: false,
        message: data.motivo_recusa || 'Imagem não parece ser uma compra ou comprovante.',
        alertas,
      };
    }

    if (!hasFornecedor && !hasTotal && !hasItems) {
      return {
        ok: false,
        message: 'Não foi possível identificar fornecedor, valor total ou itens de compra na imagem.',
        alertas: ['Imagem rejeitada: sem evidência de compra.'],
      };
    }

    if (!hasFornecedor) {
      alertas.push('Fornecedor não identificado com clareza. Revise antes de salvar.');
    }

    if (!hasTotal) {
      alertas.push('Valor total não identificado com clareza. Revise antes de salvar.');
    }

    if (!hasItems) {
      alertas.push('Nenhum item individual identificado. A compra pode ser salva como item avulso se o total estiver correto.');
    }

    if (data.pagamento?.parcelas === null && data.pagamento?.texto_pagamento_bruto?.includes('|')) {
      alertas.push('Ambiguidade no parcelamento detectada. Revise antes de salvar.');
    }

    return { ok: true, message: '', alertas };
  }

  private async linkCatalogItems(itens: any[]) {
    const catalogo = await this.prisma.catalogItem.findMany({
      where: { projectId: 'obra_vds_001' },
    });

    return itens.map((item) => {
      let melhorMatchId: string | null = null;
      let maiorSimilaridade = 0;

      for (const cat of catalogo) {
        const sim = calcularSimilaridade(item.nome || '', cat.nome);
        if (sim > maiorSimilaridade) {
          maiorSimilaridade = sim;
          melhorMatchId = cat.id;
        }
      }

      return {
        ...item,
        vinculoCatalogoId: maiorSimilaridade > 0.35 ? melhorMatchId : null,
        similaridade: maiorSimilaridade,
      };
    });
  }

  private cleanText(value: unknown) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private toNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNullableDecimal(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).replace(/[^\d,-]/g, '');
    const normalized = raw.includes(',') && !raw.includes('.') ? raw.replace(',', '.') : raw.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNullableBoolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined || value === '') return null;
    return ['true', 'sim', 's', '1'].includes(String(value).toLowerCase());
  }

  private toConfidence(value: unknown) {
    const parsed = this.toNullableNumber(value);
    if (parsed === null) return 0;
    return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
  }

  private normalizePaymentMethod(value: string) {
    const normalized = this.cleanText(value).toLowerCase();

    if (['pix', 'boleto', 'dinheiro', 'transferencia', 'cartao_debito', 'cartao_credito'].includes(normalized)) {
      return normalized;
    }

    if (normalized.includes('crédito') || normalized.includes('credito') || normalized.includes('credit card') || normalized.includes('cartão')) {
      return 'cartao_credito';
    }

    if (normalized.includes('débito') || normalized.includes('debito') || normalized.includes('debit card')) {
      return 'cartao_debito';
    }

    return 'pix';
  }
}
