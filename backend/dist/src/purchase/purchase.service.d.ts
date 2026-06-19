import { PrismaService } from '../prisma/prisma.service';
export declare class PurchaseService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(filters: {
        fornecedor?: string;
        formaPagamento?: string;
        statusCompra?: string;
        cardId?: string;
    }): Promise<({
        itens: ({
            catalogItem: {
                id: string;
                nome: string;
                createdAt: Date;
                updatedAt: Date;
                categoria: string;
                quantidadePlanejada: number;
                unidade: string;
                precoOrcadoUnitario: number;
                custoOrcadoTotal: number;
                localCompraPlanejado: string;
                prioridade: string | null;
                statusCatalogo: string;
                fornecedorPlanejado: string | null;
                origemPlanilha: string;
                projectId: string;
            } | null;
        } & {
            id: string;
            nome: string;
            createdAt: Date;
            updatedAt: Date;
            quantidade: number;
            valorUnitario: number | null;
            valorTotal: number | null;
            purchaseId: string;
            vinculoCatalogoId: string | null;
        })[];
        pagamentos: ({
            card: {
                id: string;
                nome: string;
                createdAt: Date;
                updatedAt: Date;
                finalCartao: string;
                limite: number | null;
            } | null;
            installmentPlans: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                paymentId: string;
                numeroParcela: number;
                valor: number;
                dataVencimento: Date;
                pago: boolean;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            purchaseId: string;
            formaPagamento: string;
            parcelas: number | null;
            valorParcela: number | null;
            juros: number | null;
            comJuros: boolean | null;
            cardId: string | null;
        })[];
        entregas: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            purchaseId: string;
            status: string | null;
            codigoEnvio: number | null;
            prazo: string;
        }[];
        anexos: {
            url: string;
            id: string;
            nome: string;
            createdAt: Date;
            updatedAt: Date;
            ocrJobId: string | null;
            purchaseId: string | null;
            tipoMime: string;
            tamanhoBytes: number;
        }[];
        auditorias: {
            id: string;
            createdAt: Date;
            purchaseId: string | null;
            usuario: string;
            acao: string;
            detalhes: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        origem: string;
        fornecedor: string;
        statusCompra: string;
        statusEntrega: string;
        compradorNome: string | null;
        compradorCpf: string | null;
        enderecoEntrega: string | null;
        subtotalProdutos: number;
        frete: number;
        desconto: number;
        totalPago: number;
        dataCompra: Date | null;
        observacao: string | null;
        ocrJobId: string | null;
    })[]>;
    findOne(id: string): Promise<{
        itens: ({
            catalogItem: {
                id: string;
                nome: string;
                createdAt: Date;
                updatedAt: Date;
                categoria: string;
                quantidadePlanejada: number;
                unidade: string;
                precoOrcadoUnitario: number;
                custoOrcadoTotal: number;
                localCompraPlanejado: string;
                prioridade: string | null;
                statusCatalogo: string;
                fornecedorPlanejado: string | null;
                origemPlanilha: string;
                projectId: string;
            } | null;
        } & {
            id: string;
            nome: string;
            createdAt: Date;
            updatedAt: Date;
            quantidade: number;
            valorUnitario: number | null;
            valorTotal: number | null;
            purchaseId: string;
            vinculoCatalogoId: string | null;
        })[];
        pagamentos: ({
            card: {
                id: string;
                nome: string;
                createdAt: Date;
                updatedAt: Date;
                finalCartao: string;
                limite: number | null;
            } | null;
            installmentPlans: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                paymentId: string;
                numeroParcela: number;
                valor: number;
                dataVencimento: Date;
                pago: boolean;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            purchaseId: string;
            formaPagamento: string;
            parcelas: number | null;
            valorParcela: number | null;
            juros: number | null;
            comJuros: boolean | null;
            cardId: string | null;
        })[];
        entregas: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            purchaseId: string;
            status: string | null;
            codigoEnvio: number | null;
            prazo: string;
        }[];
        anexos: {
            url: string;
            id: string;
            nome: string;
            createdAt: Date;
            updatedAt: Date;
            ocrJobId: string | null;
            purchaseId: string | null;
            tipoMime: string;
            tamanhoBytes: number;
        }[];
        auditorias: {
            id: string;
            createdAt: Date;
            purchaseId: string | null;
            usuario: string;
            acao: string;
            detalhes: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        origem: string;
        fornecedor: string;
        statusCompra: string;
        statusEntrega: string;
        compradorNome: string | null;
        compradorCpf: string | null;
        enderecoEntrega: string | null;
        subtotalProdutos: number;
        frete: number;
        desconto: number;
        totalPago: number;
        dataCompra: Date | null;
        observacao: string | null;
        ocrJobId: string | null;
    }>;
    create(data: {
        id: string;
        fornecedor: string;
        origem: string;
        statusCompra: string;
        statusEntrega: string;
        compradorNome?: string;
        compradorCpf?: string;
        enderecoEntrega?: string;
        subtotalProdutos: number;
        frete: number;
        desconto: number;
        totalPago: number;
        dataCompra?: string;
        observacao?: string;
        ocrJobId?: string;
        usuarioResponsavel: string;
        itens: {
            nome: string;
            quantidade: number;
            valorUnitario: number;
            valorTotal: number;
            vinculoCatalogoId?: string;
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
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        origem: string;
        fornecedor: string;
        statusCompra: string;
        statusEntrega: string;
        compradorNome: string | null;
        compradorCpf: string | null;
        enderecoEntrega: string | null;
        subtotalProdutos: number;
        frete: number;
        desconto: number;
        totalPago: number;
        dataCompra: Date | null;
        observacao: string | null;
        ocrJobId: string | null;
    }>;
    updateStatus(id: string, statusCompra: string, usuario: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        origem: string;
        fornecedor: string;
        statusCompra: string;
        statusEntrega: string;
        compradorNome: string | null;
        compradorCpf: string | null;
        enderecoEntrega: string | null;
        subtotalProdutos: number;
        frete: number;
        desconto: number;
        totalPago: number;
        dataCompra: Date | null;
        observacao: string | null;
        ocrJobId: string | null;
    }>;
    remove(id: string, usuario: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        origem: string;
        fornecedor: string;
        statusCompra: string;
        statusEntrega: string;
        compradorNome: string | null;
        compradorCpf: string | null;
        enderecoEntrega: string | null;
        subtotalProdutos: number;
        frete: number;
        desconto: number;
        totalPago: number;
        dataCompra: Date | null;
        observacao: string | null;
        ocrJobId: string | null;
    }>;
}
