import { PrismaService } from '../prisma/prisma.service';
export declare class SystemConfigService {
    private prisma;
    constructor(prisma: PrismaService);
    getCards(): Promise<{
        id: string;
        nome: string;
        createdAt: Date;
        updatedAt: Date;
        finalCartao: string;
        limite: number | null;
    }[]>;
    createCard(data: {
        nome: string;
        finalCartao: string;
        limite?: number;
    }): Promise<{
        id: string;
        nome: string;
        createdAt: Date;
        updatedAt: Date;
        finalCartao: string;
        limite: number | null;
    }>;
    deleteCard(id: string): Promise<{
        id: string;
        nome: string;
        createdAt: Date;
        updatedAt: Date;
        finalCartao: string;
        limite: number | null;
    }>;
    getKeys(): Promise<({
        createdAt: Date;
        updatedAt: Date;
        key: string;
        value: string;
    } | {
        key: string;
        value: string;
    })[]>;
    updateKey(key: string, value: string): Promise<{
        createdAt: Date;
        updatedAt: Date;
        key: string;
        value: string;
    }>;
    getSuppliersAndCardsSuggestions(): Promise<{
        fornecedores: string[];
        cartoes: {
            id: string;
            nome: string;
            createdAt: Date;
            updatedAt: Date;
            finalCartao: string;
            limite: number | null;
        }[];
    }>;
}
