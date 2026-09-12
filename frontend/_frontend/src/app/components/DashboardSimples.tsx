'use client';

import {
  Building2,
  FileCheck,
  Wallet,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface DashboardSimplesProps {
  summary: {
    totalOrcado: number;
    totalComprado: number;
    totalPendente: number;
    totalRecebido: number;
    totalComJuros: number;
    totalEconomia: number;
    totalSobrepreco: number;
    progressoPercentual: number;
    alertasDivergencia: {
      catalogItemId: string;
      nome: string;
      orcado: number;
      pago: number;
      diferenca: number;
    }[];
  };
  purchases: {
    id: string;
    fornecedor: string;
    origem: string;
    statusCompra: string;
    totalPago: number;
    dataCompra?: string | null;
    pagamentos: { formaPagamento: string }[];
  }[];
  onVerHistorico?: () => void;
  onVerCompra?: (id: string) => void;
}

export default function DashboardSimples({
  summary,
  purchases,
  onVerHistorico,
  onVerCompra,
}: DashboardSimplesProps) {
  const formatarMoeda = (centavos: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      (Number(centavos) || 0) / 100
    );

  const ultimas3 = purchases.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Banner explicativo visualizador */}
      <div className="bg-emerald-950/30 border border-emerald-900 rounded-xl px-4 py-3 flex items-start gap-3">
        <Eye className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-emerald-200">Visão Financiador — Simplificada</p>
          <p className="text-xs text-emerald-300/80 mt-1 leading-relaxed">
            Apenas o essencial: quanto foi orçado, quanto já foi investido e quanto falta. Sem formulários ou controles técnicos.
          </p>
        </div>
      </div>

      {/* 3 KPIs essenciais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Orçado total</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white tracking-tight">{formatarMoeda(summary.totalOrcado)}</p>
            <p className="text-xs text-slate-500 mt-1">Planejado para a obra inteira</p>
          </div>
        </div>

        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Já investido</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-emerald-400 tracking-tight">{formatarMoeda(summary.totalComprado)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-slate-300">{summary.progressoPercentual}% do orçamento</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Wallet className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Falta investir</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white tracking-tight">{formatarMoeda(summary.totalPendente)}</p>
            <p className="text-xs text-slate-500 mt-1">Saldo pendente do catálogo</p>
          </div>
        </div>
      </div>

      {/* Barra de progresso única e altamente visível */}
      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Progresso da obra</h3>
          <span className="text-lg font-extrabold text-cyan-400">{summary.progressoPercentual}%</span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, summary.progressoPercentual)}%` }}
            aria-valuenow={summary.progressoPercentual}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
            aria-label="Progresso de compras sobre orçamento"
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
          <span>{formatarMoeda(summary.totalComprado)} comprados</span>
          <span>{formatarMoeda(summary.totalPendente)} pendentes</span>
        </div>
      </div>

      {/* Alertas simplificados - só se houver */}
      {summary.alertasDivergencia.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-900/60 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">
              {summary.alertasDivergencia.length} {summary.alertasDivergencia.length === 1 ? 'item acima do orçado' : 'itens acima do orçado'}
            </p>
            <p className="text-xs text-amber-200/70 mt-1">
              Ex: {summary.alertasDivergencia[0].nome} — {formatarMoeda(summary.alertasDivergencia[0].diferenca)} acima do previsto. Detalhes na Prestação de Contas.
            </p>
          </div>
        </div>
      )}

      {/* Últimos lançamentos - cards minimalistas */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Últimos investimentos</h3>
          {onVerHistorico && (
            <button
              onClick={onVerHistorico}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              Ver histórico <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {ultimas3.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">Nenhum lançamento ainda.</p>
            <p className="text-xs text-slate-600 mt-1">Os investimentos aparecerão aqui assim que forem registrados.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {ultimas3.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3 hover:border-slate-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate pr-3">{p.fornecedor}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {p.dataCompra ? new Date(p.dataCompra).toLocaleDateString('pt-BR') : '—'} •{' '}
                    <span className="uppercase">{(p.pagamentos[0]?.formaPagamento || 'pix').replace('_', ' ')}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-white">{formatarMoeda(p.totalPago)}</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      p.statusCompra === 'confirmado'
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900'
                        : p.statusCompra === 'revisar'
                        ? 'bg-amber-950/60 text-amber-400 border-amber-900'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {p.statusCompra}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé de confiança */}
      <p className="text-[11px] text-center text-slate-600">
        Dados atualizados em tempo real • Auditoria completa disponível em Prestação de Contas
      </p>
    </div>
  );
}
