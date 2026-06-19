import { OcrService } from './ocr.service';
import type { Response } from 'express';
export declare class OcrController {
    private readonly ocrService;
    constructor(ocrService: OcrService);
    uploadFile(file: Express.Multer.File): Promise<{
        jobId: string;
        status: string;
        data: {
            is_compra: boolean;
            motivo_recusa: any;
            fornecedor: string;
            tipo_documento: string;
            comprador: {
                nome: string;
                cpf: string;
            };
            entrega: {
                endereco: string;
                descricao: string;
                previsoes: any;
            };
            pagamento: {
                metodo: string;
                cartao: string;
                final_cartao: string;
                parcelas: number | null;
                valor_parcela: number | null;
                juros: number | null;
                sem_juros: boolean | null;
                texto_pagamento_bruto: string;
            };
            resumo: {
                quantidade_itens: number | null;
                valor_produtos: number | null;
                desconto: number;
                frete: number;
                subtotal: number | null;
                total: number | null;
                economia: number;
            };
            itens: any;
            observacoes: any;
            texto_bruto: string;
            confianca: {
                fornecedor: number;
                pagamento: number;
                total: number;
                itens: number;
            };
            alertas: any;
        };
        attachment: {
            nome: string;
            url: string;
            tipoMime: string;
            tamanhoBytes: number;
        };
    }>;
    serveFile(filename: string, res: Response): void;
}
