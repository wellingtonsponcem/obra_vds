'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  FileSpreadsheet,
  FileSearch,
  ScanQrCode,
  Settings,
  Shield,
  Eye,
  PlusCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Building2,
  FileCheck,
  AlertTriangle,
  UploadCloud,
  CheckCircle,
  Copy,
  Download,
  Trash2,
  HelpCircle,
  Info,
} from 'lucide-react';

// Interfaces de Tipo
type StatusItem = 'pendente' | 'comprado' | 'recebido' | 'cancelado' | 'divergente' | 'avulso';

interface CatalogItem {
  id: string;
  nome: string;
  categoria: string;
  quantidadePlanejada: number;
  unidade: string;
  precoOrcadoUnitario: number;
  custoOrcadoTotal: number;
  localCompraPlanejado: 'Online' | 'Loja Física';
  prioridade?: 'Alta' | 'Media' | 'Baixa' | null;
  statusCatalogo: StatusItem;
  fornecedorPlanejado?: string | null;
  precoPagoAcumulado: number;
  saldoPendente: number;
  economia: number;
  sobrepreco: number;
  quantidadeComprada: number;
}

interface Purchase {
  id: string;
  fornecedor: string;
  origem: string;
  statusCompra: 'rascunho' | 'confirmado' | 'revisar';
  statusEntrega: 'aguardando_entrega' | 'entregue' | 'cancelado';
  compradorNome?: string;
  compradorCpf?: string;
  enderecoEntrega?: string;
  subtotalProdutos: number;
  frete: number;
  desconto: number;
  totalPago: number;
  dataCompra?: string;
  observacao?: string;
  itens: PurchaseItem[];
  pagamentos: Payment[];
  entregas: DeliveryForecast[];
  anexos: Attachment[];
  auditorias?: AuditLog[];
}

interface AuditLog {
  id?: string;
  purchaseId?: string | null;
  usuario: string;
  acao: string;
  detalhes: string;
  createdAt: string;
}

interface PurchaseItem {
  id?: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  vinculoCatalogoId?: string | null;
  catalogItem?: CatalogItem | null;
}

interface Payment {
  id?: string;
  formaPagamento: string;
  cardId?: string | null;
  card?: { nome: string; finalCartao: string } | null;
  parcelas?: number | null;
  valorParcela?: number | null;
  juros?: number | null;
  comJuros?: boolean | null;
}

interface DeliveryForecast {
  codigoEnvio?: number;
  status?: string;
  prazo: string;
}

interface Attachment {
  nome: string;
  url: string;
  tipoMime: string;
  tamanhoBytes: number;
}

interface DashboardSummary {
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
}

// Configuração da API Backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function Home() {
  // Estado Global do Perfil
  const [perfil, setPerfil] = useState<'admin' | 'visualizador'>('admin');
  
  // Abas de navegação
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'catalogo' | 'lancamentos' | 'prestacao' | 'ocr' | 'configuracoes'>('dashboard');

  // Estado dos Dados
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    totalOrcado: 1475382,
    totalComprado: 355091,
    totalPendente: 1120291,
    totalRecebido: 0,
    totalComJuros: 24004,
    totalEconomia: 0,
    totalSobrepreco: 0,
    progressoPercentual: 24.07,
    alertasDivergencia: [],
  });

  // Estado de Cartões e Sugestões
  const [cards, setCards] = useState<{ id: string; nome: string; finalCartao: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Estados de Operação / UI
  const [carregando, setCarregando] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);

  // Estados específicos para formulários e OCR
  const [ocrFila, setOcrFila] = useState<{ id: string; nome: string; progresso: number; previewUrl?: string; file?: File; status: 'uploading' | 'parsing' | 'ready' | 'error' }[]>([]);
  const [ocrRascunhoRevisao, setOcrRascunhoRevisao] = useState<any | null>(null);
  const [modoVisualizacaoCompra, setModoVisualizacaoCompra] = useState<Purchase | null>(null);
  const [notificacao, setNotificacao] = useState<{ texto: string; tipo: 'sucesso' | 'erro' | 'info' } | null>(null);

  // Estados do Catálogo Inteligente
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'comprado'>('todos');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Estado do formulário manual
  const [novaCompraForm, setNovaCompraForm] = useState({
    id: '',
    fornecedor: '',
    dataCompra: new Date().toISOString().substring(0, 10),
    formaPagamento: 'pix',
    cardId: '',
    parcelas: 1,
    valorParcela: 0,
    comJuros: false,
    frete: 0,
    desconto: 0,
    subtotalProdutos: 0,
    totalPago: 0,
    observacao: '',
    compradorNome: '',
    compradorCpf: '',
    enderecoEntrega: '',
  });
  const [novaCompraItens, setNovaCompraItens] = useState<PurchaseItem[]>([
    { nome: '', quantidade: 1, valorUnitario: 0, valorTotal: 0, vinculoCatalogoId: '' },
  ]);

  // Carregamento de Dados da API
  const fetchData = async () => {
    setCarregando(true);
    setErroApi(null);
    try {
      // 1. Carrega Resumo Financeiro
      const resSummary = await fetch(`${API_BASE_URL}/catalog/summary`);
      if (resSummary.ok) {
        const dataSummary = await resSummary.json();
        setSummary(dataSummary);
      }

      // 2. Carrega Catálogo
      const resCatalog = await fetch(`${API_BASE_URL}/catalog`);
      if (resCatalog.ok) {
        const dataCatalog = await resCatalog.json();
        setCatalog(dataCatalog);
      }

      // 3. Carrega Compras
      const resPurchases = await fetch(`${API_BASE_URL}/purchase`);
      if (resPurchases.ok) {
        const dataPurchases = await resPurchases.json();
        setPurchases(dataPurchases);
      }

      // 4. Carrega Cartões
      const resCards = await fetch(`${API_BASE_URL}/config/cards`);
      if (resCards.ok) {
        const dataCards = await resCards.json();
        setCards(dataCards);
      }

      // 5. Carrega Sugestões
      const resSugg = await fetch(`${API_BASE_URL}/config/suggestions`);
      if (resSugg.ok) {
        const dataSugg = await resSugg.json();
        setSuggestions(dataSugg.fornecedores || []);
      }

    } catch (err: any) {
      console.error('Erro ao conectar com API do Backend.', err);
      setErroApi('Backend não pôde ser alcançado. Verifique se a API está rodando e se NEXT_PUBLIC_API_BASE_URL está configurado corretamente.');
      setSummary({
        totalOrcado: 0,
        totalComprado: 0,
        totalPendente: 0,
        totalRecebido: 0,
        totalComJuros: 0,
        totalEconomia: 0,
        totalSobrepreco: 0,
        progressoPercentual: 0,
        alertasDivergencia: [],
      });
      setCatalog([]);
      setPurchases([]);
      setCards([]);
      setSuggestions([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const exibirNotificacao = (texto: string, tipo: 'sucesso' | 'erro' | 'info') => {
    setNotificacao({ texto, tipo });
    setTimeout(() => setNotificacao(null), 4000);
  };

  // Helper de Moeda BRL
  const formatarMoeda = (centavos: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(centavos / 100);
  };

  // Envio de nova compra manual/confirmada
  const handleSaveCompra = async (compraData: any, itens: PurchaseItem[], pagamentos: Payment[], entregas: any[] = []) => {
    if (perfil === 'visualizador') {
      exibirNotificacao('Apenas perfil Admin pode salvar compras.', 'erro');
      return;
    }

    try {
      const payload = {
        ...compraData,
        itens,
        pagamentos,
        entregas,
        origem: compraData.origem || (compraData.ocrJobId ? 'ocr_checkout' : 'manual'),
        statusCompra: compraData.statusCompra || (compraData.ocrJobId ? 'revisar' : 'confirmado'),
        statusEntrega: compraData.statusEntrega || 'aguardando_entrega',
      };

      const res = await fetch(`${API_BASE_URL}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario': perfil,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        exibirNotificacao('Lançamento de compra realizado com sucesso!', 'sucesso');
        fetchData();
        setAbaAtiva('dashboard');
        // Reset form
        resetForm();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao salvar a compra.');
      }
    } catch (err: any) {
      console.error(err);
      exibirNotificacao(err.message || 'Erro de conexão com o servidor ao salvar compra.', 'erro');
    }
  };

  const resetForm = () => {
    setNovaCompraForm({
      id: '',
      fornecedor: '',
      dataCompra: new Date().toISOString().substring(0, 10),
      formaPagamento: 'pix',
      cardId: '',
      parcelas: 1,
      valorParcela: 0,
      comJuros: false,
      frete: 0,
      desconto: 0,
      subtotalProdutos: 0,
      totalPago: 0,
      observacao: '',
      compradorNome: '',
      compradorCpf: '',
      enderecoEntrega: '',
    });
    setNovaCompraItens([{ nome: '', quantidade: 1, valorUnitario: 0, valorTotal: 0, vinculoCatalogoId: '' }]);
    setOcrRascunhoRevisao(null);
  };

  // Exclusão de Compra
  const handleDeleteCompra = async (id: string) => {
    if (perfil === 'visualizador') {
      exibirNotificacao('Apenas Admin pode excluir lançamentos.', 'erro');
      return;
    }
    
    if (!confirm('Deseja realmente deletar esta compra? Essa ação reverterá o status do catálogo.')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/purchase/${id}`, {
        method: 'DELETE',
        headers: { 'x-usuario': perfil },
      });

      if (res.ok) {
        exibirNotificacao('Compra deletada com sucesso.', 'sucesso');
        fetchData();
      } else {
        throw new Error();
      }
    } catch (err: any) {
      console.error(err);
      exibirNotificacao('Falha ao deletar compra no servidor.', 'erro');
    }
  };

  // Conciliação de Item do Catálogo
  const handleAtualizarStatusCatalogo = async (itemId: string, novoStatus: StatusItem) => {
    if (perfil === 'visualizador') {
      exibirNotificacao('Apenas Admin pode alterar status do catálogo.', 'erro');
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/catalog/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusCatalogo: novoStatus }),
      });
      if (res.ok) {
        exibirNotificacao('Status do catálogo atualizado!', 'sucesso');
        fetchData();
      } else {
        throw new Error();
      }
    } catch (err: any) {
      console.error(err);
      exibirNotificacao('Falha ao atualizar status no servidor.', 'erro');
    }
  };

  // Upload e OCR real
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (perfil === 'visualizador') {
      exibirNotificacao('Apenas Admin pode realizar OCR de comprovantes.', 'erro');
      return;
    }
    
    const files = Array.from(e.dataTransfer.files);
    processarArquivosOcr(files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (perfil === 'visualizador') {
      exibirNotificacao('Apenas Admin pode realizar OCR de comprovantes.', 'erro');
      return;
    }
    
    if (e.target.files) {
      processarArquivosOcr(Array.from(e.target.files));
    }
  };

  // Captura do clipboard (Colar imagem diretamente!)
  const handlePaste = (e: React.ClipboardEvent) => {
    if (perfil === 'visualizador') {
      exibirNotificacao('Apenas Admin pode realizar OCR de comprovantes.', 'erro');
      return;
    }

    const items = Array.from(e.clipboardData.items);
    const files: File[] = [];

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      exibirNotificacao('Imagem detectada na área de transferência (Clipboard)! Processando...', 'info');
      processarArquivosOcr(files);
    }
  };

  const processarArquivosOcr = async (files: File[]) => {
    const novosJobs = files.map(file => ({
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      nome: file.name || 'imagem_clipboard.png',
      progresso: 10,
      previewUrl: URL.createObjectURL(file),
      file,
      status: 'uploading' as const,
    }));

    setOcrFila(prev => [...prev, ...novosJobs]);

    for (const job of novosJobs) {
      // Progresso real do upload/OCR
      setOcrFila(prev => prev.map(j => j.id === job.id ? { ...j, progresso: 40, status: 'parsing' } : j));

      try {
        const formData = new FormData();
        formData.append('file', job.file);

        // Chamada real da API
        const res = await fetch(`${API_BASE_URL}/ocr/parse`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const result = await res.json();
          setOcrFila(prev => prev.map(j => j.id === job.id ? { ...j, progresso: 100, status: 'ready' } : j));
          abrirRevisaoOcr(result.data, job.previewUrl, result.jobId);
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Erro no servidor ao ler OCR: ${res.status} ${res.statusText}`);
        }
      } catch (err: any) {
        console.error('Erro ao processar OCR real.', err);
        setOcrFila(prev => prev.map(j => j.id === job.id ? { ...j, progresso: 100, status: 'error' } : j));
        exibirNotificacao(err.message || 'Falha ao processar OCR. Verifique se a imagem é um comprovante e se a API do Gemini está configurada.', 'erro');
      }
    }
  };

  const abrirRevisaoOcr = (ocrData: any, previewUrl?: string, ocrJobId?: string) => {
    const formaPagamento = ocrData.pagamento?.metodo || 'pix';
    const cardMatch = cards.find(card => ocrData.pagamento?.final_cartao && card.finalCartao === ocrData.pagamento.final_cartao);

    setOcrRascunhoRevisao({
      ocrRaw: ocrData,
      previewUrl,
      ocrJobId,
      form: {
        id: `cmp_${Date.now().toString().substring(8)}`,
        fornecedor: ocrData.fornecedor || '',
        dataCompra: new Date().toISOString().substring(0, 10),
        formaPagamento,
        cardId: cardMatch?.id || '',
        parcelas: ocrData.pagamento?.parcelas || 1,
        valorParcela: Math.round((ocrData.pagamento?.valor_parcela || 0) * 100),
        comJuros: Boolean(ocrData.pagamento?.juros || ocrData.pagamento?.juros === 0),
        frete: Math.round((ocrData.resumo?.frete || 0) * 100),
        desconto: Math.round((ocrData.resumo?.desconto || 0) * 100),
        subtotalProdutos: Math.round((ocrData.resumo?.valor_produtos || ocrData.resumo?.subtotal || 0) * 100),
        totalPago: Math.round((ocrData.resumo?.total || 0) * 100),
        observacao: ocrData.alertas?.length ? `Atenção OCR: ${ocrData.alertas.join(' ')}` : (ocrData.observacoes?.join(', ') || ''),
        compradorNome: ocrData.comprador?.nome || '',
        compradorCpf: ocrData.comprador?.cpf || '',
        enderecoEntrega: ocrData.entrega?.endereco || '',
      },
      itens: (ocrData.itens || []).map((it: any) => ({
        nome: it.nome || 'Item avulso',
        quantidade: it.quantidade || 1,
        valorUnitario: Math.round((it.valor_unitario || 0) * 100),
        valorTotal: Math.round((it.valor_total || it.valor_unitario || 0) * 100),
        vinculoCatalogoId: it.vinculoCatalogoId || '',
      })),
      entregas: ocrData.entrega?.previsoes || [],
    });

    setAbaAtiva('lancamentos');
    exibirNotificacao('Dados do OCR carregados para revisão side-by-side!', 'info');
  };

  const handleConfirmarRevisaoOcr = () => {
    if (!ocrRascunhoRevisao) return;
    
    const pagamentosPayload = [
      {
        formaPagamento: ocrRascunhoRevisao.form.formaPagamento,
        cardId: ocrRascunhoRevisao.form.cardId || null,
        parcelas: Number(ocrRascunhoRevisao.form.parcelas),
        valorParcela: Number(ocrRascunhoRevisao.form.valorParcela),
        comJuros: ocrRascunhoRevisao.form.comJuros,
      },
    ];

    handleSaveCompra(
      {
        ...ocrRascunhoRevisao.form,
        ocrJobId: ocrRascunhoRevisao.ocrJobId,
      },
      ocrRascunhoRevisao.itens,
      pagamentosPayload,
      ocrRascunhoRevisao.entregas,
    );
  };

  // Exportadores
  const exportarJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ summary, catalog, purchases }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `prestacao_contas_obra_vds_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    exibirNotificacao('JSON exportado com sucesso!', 'sucesso');
  };

  const exportarCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID Compra;Fornecedor;Data;Subtotal BRL;Frete BRL;Desconto BRL;Total Pago BRL;Forma Pagamento;Status\n';

    purchases.forEach(p => {
      const formPg = p.pagamentos[0]?.formaPagamento || 'N/A';
      csvContent += `${p.id};${p.fornecedor};${p.dataCompra || ''};${(p.subtotalProdutos/100).toFixed(2)};${(p.frete/100).toFixed(2)};${(p.desconto/100).toFixed(2)};${(p.totalPago/100).toFixed(2)};${formPg};${p.statusCompra}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodedUri);
    downloadAnchor.setAttribute('download', `prestacao_contas_compras_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    exibirNotificacao('CSV exportado com sucesso!', 'sucesso');
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const catalogFiltered = catalog.filter(item => {
    if (filterStatus !== 'todos' && item.statusCatalogo !== filterStatus) return false;
    if (searchTerm && !item.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const catalogGroups: Record<string, CatalogItem[]> = {};
  catalogFiltered.forEach(item => {
    if (!catalogGroups[item.categoria]) catalogGroups[item.categoria] = [];
    catalogGroups[item.categoria].push(item);
  });

  const catalogGroupEntries = Object.entries(catalogGroups).sort(([a], [b]) => a.localeCompare(b));

  const activeCategories = searchTerm
    ? new Set(catalogGroupEntries.map(([cat]) => cat))
    : expandedCategories;

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-900 text-slate-100 min-h-screen font-sans" onPaste={handlePaste}>
      
      {/* Toast Notificação */}
      {notificacao && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border transition-all duration-300 transform translate-y-0 ${
          notificacao.tipo === 'sucesso' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500' :
          notificacao.tipo === 'erro' ? 'bg-rose-950/90 text-rose-300 border-rose-500' :
          'bg-slate-800/90 text-cyan-300 border-cyan-500'
        }`}>
          {notificacao.tipo === 'sucesso' && <CheckCircle className="w-5 h-5" />}
          {notificacao.tipo === 'erro' && <AlertTriangle className="w-5 h-5" />}
          {notificacao.tipo === 'info' && <Info className="w-5 h-5" />}
          <span className="text-sm font-semibold">{notificacao.texto}</span>
        </div>
      )}

      {/* Sidebar de Navegação Premium */}
      <aside className="w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo / Título */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3 bg-gradient-to-r from-slate-950 to-slate-900">
            <ScanQrCode className="w-8 h-8 text-cyan-400 animate-pulse" />
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wide text-white">Obra VDS</h1>
              <p className="text-xs text-slate-400">Prestação de Contas</p>
            </div>
          </div>

          {/* Perfis de Usuário */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/50">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Perfil de Visualização</label>
            <div className="flex bg-slate-900 rounded-lg p-1 gap-1 border border-slate-800">
              <button
                onClick={() => { setPerfil('admin'); exibirNotificacao('Perfil alterado para Administrador (Edição Ativa)', 'info'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                  perfil === 'admin' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </button>
              <button
                onClick={() => { setPerfil('visualizador'); exibirNotificacao('Perfil alterado para Financiador (Modo Transparência/Leitura)', 'info'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                  perfil === 'visualizador' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Financiador
              </button>
            </div>
          </div>

          {/* Menus */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setAbaAtiva('dashboard'); setModoVisualizacaoCompra(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === 'dashboard' ? 'bg-slate-800/80 text-white border-l-4 border-cyan-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => { setAbaAtiva('catalogo'); setModoVisualizacaoCompra(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === 'catalogo' ? 'bg-slate-800/80 text-white border-l-4 border-cyan-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              Catálogo de Materiais
            </button>
            <button
              onClick={() => { setAbaAtiva('lancamentos'); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === 'lancamentos' ? 'bg-slate-800/80 text-white border-l-4 border-cyan-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Lançar Compras
            </button>
            <button
              onClick={() => { setAbaAtiva('ocr'); setModoVisualizacaoCompra(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === 'ocr' ? 'bg-slate-800/80 text-white border-l-4 border-cyan-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <ScanQrCode className="w-4 h-4" />
              Importar com OCR
            </button>
            <button
              onClick={() => { setAbaAtiva('prestacao'); setModoVisualizacaoCompra(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === 'prestacao' ? 'bg-slate-800/80 text-white border-l-4 border-cyan-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Prestação de Contas
            </button>
            <button
              onClick={() => { setAbaAtiva('configuracoes'); setModoVisualizacaoCompra(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === 'configuracoes' ? 'bg-slate-800/80 text-white border-l-4 border-cyan-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              Configurações
            </button>
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-cyan-900 flex items-center justify-center text-cyan-400 text-xs font-bold">W</div>
            <div>
              <p className="text-xs font-semibold text-white truncate">Wellington Poncem</p>
              <p className="text-[10px] text-slate-500">Engenheiro / Gestor</p>
            </div>
          </div>
          <div className="text-[10px] text-slate-600 flex items-center justify-between">
            <span>Versão 1.0.0</span>
            <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> 2026</span>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-y-auto">
        
        {/* Banner de Visualizador / Transparência */}
        {perfil === 'visualizador' && (
          <div className="bg-emerald-950 text-emerald-300 border-b border-emerald-800 px-6 py-2 text-xs font-bold flex items-center gap-2">
            <Eye className="w-4 h-4 animate-pulse text-emerald-400" />
            <span>Modo Transparência Total: Você está visualizando as contas como Financiador. Ações de alteração estão desabilitadas.</span>
          </div>
        )}

        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white capitalize">{abaAtiva === 'ocr' ? 'OCR Inteligente Gemini' : abaAtiva === 'prestacao' ? 'Prestação de Contas' : abaAtiva}</h2>
            {erroApi && (
              <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Demonstração Local
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-md transition-all border border-slate-700"
            >
              Sincronizar Banco
            </button>
            <button
              onClick={exportarJSON}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-md transition-all border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
          </div>
        </header>

        {/* Área Principal de Abas */}
        <div className="p-6 space-y-6 max-w-7xl w-full mx-auto flex-1">
          
          {/* TAB 1: DASHBOARD */}
          {abaAtiva === 'dashboard' && !modoVisualizacaoCompra && (
            <div className="space-y-6">
              
              {/* Cards de Métricas Finanças */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all hover:scale-[1.01] shadow-lg">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Custo Orçado Total</span>
                    <Building2 className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white leading-none">{formatarMoeda(summary.totalOrcado)}</h3>
                    <p className="text-[10px] text-slate-500 mt-1">Orçamento Planejado</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all hover:scale-[1.01] shadow-lg">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total Comprado</span>
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-emerald-400 leading-none">{formatarMoeda(summary.totalComprado)}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span>{summary.progressoPercentual}% do orçamento total</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all hover:scale-[1.01] shadow-lg">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Economia Acumulada</span>
                    <TrendingDown className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-cyan-400 leading-none">{formatarMoeda(summary.totalEconomia)}</h3>
                    <p className="text-[10px] text-slate-500 mt-1">Economia em relação ao orçado</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all hover:scale-[1.01] shadow-lg">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Sobrepreço (Divergências)</span>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-amber-500 leading-none">{formatarMoeda(summary.totalSobrepreco)}</h3>
                    <p className="text-[10px] text-rose-400 mt-1">Compras acima do planejado</p>
                  </div>
                </div>

              </div>

              {/* Linha 2 do Dashboard: Progresso e Juros */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Progresso de Compras */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 lg:col-span-2 shadow-lg space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Evolução de Compras da Obra</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-end text-xs">
                      <span className="text-slate-400">Progresso Percentual das Compras</span>
                      <span className="text-cyan-400 font-bold text-base">{summary.progressoPercentual}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${summary.progressoPercentual}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-900 text-xs">
                    <div>
                      <p className="text-slate-500">Total Recebido</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{formatarMoeda(summary.totalRecebido)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Saldo Pendente</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{formatarMoeda(summary.totalPendente)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Financiamento com Juros</p>
                      <p className="text-sm font-semibold text-amber-400 mt-0.5">{formatarMoeda(summary.totalComJuros)}</p>
                    </div>
                  </div>
                </div>

                {/* Grafico por Categoria Simplificado em SVG */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-lg space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Gastos por Categoria</h3>
                  
                  <div className="h-44 flex items-center justify-center">
                    {/* Renderizamos um gráfico de rosca nativo usando SVG */}
                    <svg className="w-36 h-36 transform -rotate-90">
                      <circle
                        cx="72"
                        cy="72"
                        r="55"
                        fill="transparent"
                        stroke="#1e293b"
                        strokeWidth="18"
                      />
                      <circle
                        cx="72"
                        cy="72"
                        r="55"
                        fill="transparent"
                        stroke="#06b6d4"
                        strokeWidth="18"
                        strokeDasharray={2 * Math.PI * 55}
                        strokeDashoffset={2 * Math.PI * 55 * (1 - (summary.progressoPercentual / 100))}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-xl font-extrabold text-white">{summary.progressoPercentual}%</span>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Comprado</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] justify-center text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-cyan-500 rounded-full inline-block"></span> Comprado ({formatarMoeda(summary.totalComprado)})</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-800 rounded-full inline-block"></span> Pendente ({formatarMoeda(summary.totalPendente)})</span>
                  </div>
                </div>

              </div>

              {/* Alertas de Divergência de Preço */}
              {summary.alertasDivergencia.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-5 shadow-lg space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-bold text-sm uppercase tracking-wider">Alertas de Divergência Detectadas (Sobrepreço)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {summary.alertasDivergencia.map((a, idx) => (
                      <div key={idx} className="bg-slate-950/70 border border-amber-900/50 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white">{a.nome}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5">Orçado: {formatarMoeda(a.orcado)} | Pago: {formatarMoeda(a.pago)}</p>
                        </div>
                        <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-1 rounded border border-rose-900">+{formatarMoeda(a.diferenca)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Últimas Compras Lançadas */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-lg p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Últimas Compras Lançadas</h3>
                  <button onClick={() => setAbaAtiva('prestacao')} className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">Ver Histórico Completo <ArrowRight className="w-3 h-3" /></button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-semibold">
                        <th className="pb-3 font-semibold">ID</th>
                        <th className="pb-3 font-semibold">Fornecedor</th>
                        <th className="pb-3 font-semibold">Origem</th>
                        <th className="pb-3 font-semibold">Valor Total</th>
                        <th className="pb-3 font-semibold">Forma de Pagamento</th>
                        <th className="pb-3 font-semibold">Status de Compra</th>
                        <th className="pb-3 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {purchases.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-500">Nenhuma compra cadastrada no banco.</td>
                        </tr>
                      ) : (
                        purchases.slice(0, 5).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-900/40 transition-all">
                            <td className="py-3.5 font-mono text-cyan-400">{p.id}</td>
                            <td className="py-3.5 font-semibold text-white">{p.fornecedor}</td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.origem === 'ocr_checkout' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                                {p.origem === 'ocr_checkout' ? 'OCR' : 'Manual'}
                              </span>
                            </td>
                            <td className="py-3.5 font-bold text-white">{formatarMoeda(p.totalPago)}</td>
                            <td className="py-3.5 uppercase font-semibold text-slate-400">
                              {p.pagamentos[0]?.formaPagamento.replace('_', ' ') || 'Pix'}
                            </td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                p.statusCompra === 'confirmado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                p.statusCompra === 'revisar' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {p.statusCompra}
                              </span>
                            </td>
                            <td className="py-3.5 text-right space-x-2">
                              <button onClick={() => setModoVisualizacaoCompra(p)} className="text-cyan-400 hover:text-cyan-300 font-semibold">Revisar</button>
                              {perfil === 'admin' && (
                                <button onClick={() => handleDeleteCompra(p.id)} className="text-rose-400 hover:text-rose-300">Excluir</button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* SUB-TELA: DETALHE / REVISÃO DE COMPRA DO DASHBOARD */}
          {abaAtiva === 'dashboard' && modoVisualizacaoCompra && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Identificador único</span>
                  <h3 className="text-lg font-bold text-white font-mono text-cyan-400">{modoVisualizacaoCompra.id}</h3>
                </div>
                <button
                  onClick={() => setModoVisualizacaoCompra(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold px-3 py-1.5 rounded border border-slate-700 text-xs"
                >
                  Voltar ao Dashboard
                </button>
              </div>

              {/* Informações de Cabeçalho da Compra */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs border-b border-slate-800 pb-6">
                <div>
                  <h4 className="text-slate-500 uppercase font-semibold tracking-wider">Fornecedor & Comprador</h4>
                  <p className="text-sm font-bold text-white mt-1">{modoVisualizacaoCompra.fornecedor}</p>
                  <p className="text-slate-400 mt-1">{modoVisualizacaoCompra.compradorNome || 'Não registrado'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">CPF: {modoVisualizacaoCompra.compradorCpf || 'Não registrado'}</p>
                </div>
                <div>
                  <h4 className="text-slate-500 uppercase font-semibold tracking-wider">Financeiro da Compra</h4>
                  <p className="text-sm font-bold text-white mt-1">Total Pago: {formatarMoeda(modoVisualizacaoCompra.totalPago)}</p>
                  <p className="text-slate-400 mt-0.5">Produtos: {formatarMoeda(modoVisualizacaoCompra.subtotalProdutos)} | Frete: {formatarMoeda(modoVisualizacaoCompra.frete)}</p>
                  <p className="text-emerald-400 mt-0.5">Desconto: -{formatarMoeda(modoVisualizacaoCompra.desconto)}</p>
                </div>
                <div>
                  <h4 className="text-slate-500 uppercase font-semibold tracking-wider">Método & Status</h4>
                  <p className="text-sm font-bold text-white mt-1 uppercase">
                    {modoVisualizacaoCompra.pagamentos[0]?.formaPagamento.replace('_', ' ') || 'Pix'}
                  </p>
                  {modoVisualizacaoCompra.pagamentos[0]?.card && (
                    <p className="text-slate-400">Cartão: {modoVisualizacaoCompra.pagamentos[0].card.nome} **** {modoVisualizacaoCompra.pagamentos[0].card.finalCartao}</p>
                  )}
                  {modoVisualizacaoCompra.pagamentos[0]?.parcelas && (
                    <p className="text-slate-400">Parcelas: {modoVisualizacaoCompra.pagamentos[0].parcelas}x de {formatarMoeda(modoVisualizacaoCompra.pagamentos[0].valorParcela ?? 0)} ({modoVisualizacaoCompra.pagamentos[0].comJuros ? 'Com Juros' : 'Sem Juros'})</p>
                  )}
                </div>
              </div>

              {/* Alerta de Ambiguidade no Banco / OCR */}
              {modoVisualizacaoCompra.statusCompra === 'revisar' && (
                <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-4 flex gap-3 text-xs text-amber-300">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-bold">Aviso de Auditoria: Status REVISAR</p>
                    <p className="mt-1">Essa compra foi importada via OCR com ambiguidade nos dados de parcelamento (ex: opções de 4x ou 5x detectadas). O administrador precisa confirmar ou corrigir as informações antes de oficializar o financeiro.</p>
                    {perfil === 'admin' && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE_URL}/purchase/${modoVisualizacaoCompra.id}/status`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', 'x-usuario': perfil },
                              body: JSON.stringify({ statusCompra: 'confirmado' }),
                            });
                            if (res.ok) {
                              exibirNotificacao('Lançamento confirmado com sucesso!', 'sucesso');
                              setModoVisualizacaoCompra({ ...modoVisualizacaoCompra, statusCompra: 'confirmado' });
                              fetchData();
                            }
                          } catch (err: any) {
                            console.error(err);
                            exibirNotificacao('Falha ao confirmar lançamento no servidor.', 'erro');
                          }
                        }}
                        className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded transition-all"
                      >
                        Aprovar e Confirmar Lançamento
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Itens Comprados */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Produtos Comprados</h4>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-slate-500 font-semibold">
                        <th className="p-3">Nome do Produto</th>
                        <th className="p-3">Quantidade</th>
                        <th className="p-3">Valor Unitário</th>
                        <th className="p-3">Valor Total</th>
                        <th className="p-3">Mapeamento Catálogo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {modoVisualizacaoCompra.itens.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/20">
                          <td className="p-3 font-semibold text-white">{it.nome}</td>
                          <td className="p-3">{it.quantidade}</td>
                          <td className="p-3">{formatarMoeda(it.valorUnitario)}</td>
                          <td className="p-3 font-bold text-white">{formatarMoeda(it.valorTotal)}</td>
                          <td className="p-3">
                            {it.catalogItem ? (
                              <span className="bg-emerald-950/70 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900 font-semibold">{it.catalogItem.nome}</span>
                            ) : (
                              <span className="bg-rose-950/60 text-rose-400 px-2 py-0.5 rounded border border-rose-900 font-semibold">Item Avulso</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detalhes de Entrega */}
              {modoVisualizacaoCompra.entregas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Rastreamento e Entrega</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {modoVisualizacaoCompra.entregas.map((ent, idx) => (
                      <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-white">Pacote {ent.codigoEnvio || idx + 1}</p>
                          <p className="text-slate-400 mt-1">{ent.prazo}</p>
                        </div>
                        {ent.status && (
                          <span className="bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-900 font-bold text-[10px] uppercase">{ent.status}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: CATÁLOGO INTELIGENTE DE MATERIAIS */}
          {abaAtiva === 'catalogo' && (
            <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-lg">
              
              {/* Sticky Search & Filter Bar */}
              <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 rounded-t-xl">
                <div className="p-4 space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar material..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {(['todos', 'pendente', 'comprado'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                          filterStatus === status
                            ? status === 'todos'
                              ? 'bg-slate-700 text-white border-slate-600'
                              : status === 'pendente'
                                ? 'bg-amber-900/40 text-amber-300 border-amber-700'
                                : 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {status === 'todos' ? 'Todos' : status === 'pendente' ? 'Pendentes' : 'Comprados'}
                      </button>
                    ))}
                    {searchTerm && (
                      <button
                        onClick={() => { setSearchTerm(''); setFilterStatus('todos'); }}
                        className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-rose-900/30 text-rose-400 border border-rose-800 hover:bg-rose-900/50"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Accordions */}
              <div className="p-4 space-y-3">
                {catalogGroupEntries.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 space-y-2">
                    <svg className="w-10 h-10 mx-auto text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm font-semibold">Nenhum material encontrado</p>
                    <p className="text-xs">Tente ajustar os filtros ou o termo de busca</p>
                  </div>
                ) : (
                  catalogGroupEntries.map(([categoria, itens]) => {
                    const isExpanded = activeCategories.has(categoria);
                    return (
                      <div key={categoria}>
                        <button
                          onClick={() => toggleCategory(categoria)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg
                              className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-bold text-white">{categoria}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 pl-3 border-l-2 border-slate-800 ml-[7px]">
                            {itens.map(item => (
                              <div
                                key={item.id}
                                className="bg-slate-900/60 rounded-lg border border-slate-800/50 p-4 flex items-center justify-between hover:border-slate-700 transition-all"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate max-w-[220px] sm:max-w-xs">{item.nome}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {item.quantidadePlanejada} {item.unidade}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 ml-3 flex flex-col items-end gap-1.5">
                                  <p className="text-sm font-bold text-white">{formatarMoeda(item.precoOrcadoUnitario)}</p>
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.statusCatalogo === 'comprado'
                                      ? 'bg-emerald-900/30 text-emerald-400'
                                      : item.statusCatalogo === 'recebido'
                                        ? 'bg-emerald-900/30 text-emerald-400'
                                        : item.statusCatalogo === 'cancelado'
                                          ? 'bg-slate-800 text-slate-400'
                                          : item.statusCatalogo === 'divergente'
                                            ? 'bg-rose-900/30 text-rose-400'
                                            : 'bg-amber-900/30 text-amber-400'
                                  }`}>
                                    {item.statusCatalogo === 'comprado' ? 'Comprado' :
                                     item.statusCatalogo === 'recebido' ? 'Recebido' :
                                     item.statusCatalogo === 'cancelado' ? 'Cancelado' :
                                     item.statusCatalogo === 'divergente' ? 'Divergente' :
                                     'Pendente'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* TAB 3: LANÇAR COMPRAS (MANUAL E SIDE-BY-SIDE OCR) */}
          {abaAtiva === 'lancamentos' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* Lado Esquerdo: Formulário de Lançamento */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {ocrRascunhoRevisao ? 'Revisar Rascunho Extraído por OCR' : 'Lançamento Manual de Compra'}
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-500 font-semibold block mb-1">Fornecedor</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white"
                      value={ocrRascunhoRevisao ? ocrRascunhoRevisao.form.fornecedor : novaCompraForm.fornecedor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (ocrRascunhoRevisao) {
                          setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, fornecedor: val } });
                        } else {
                          setNovaCompraForm({ ...novaCompraForm, fornecedor: val });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold block mb-1">Identificador Compra (ID)</label>
                    <input
                      type="text"
                      placeholder="Ex: cmp_0002"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                      value={ocrRascunhoRevisao ? ocrRascunhoRevisao.form.id : novaCompraForm.id}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (ocrRascunhoRevisao) {
                          setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, id: val } });
                        } else {
                          setNovaCompraForm({ ...novaCompraForm, id: val });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-500 font-semibold block mb-1">Data da Compra</label>
                    <input
                      type="date"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white"
                      value={ocrRascunhoRevisao ? ocrRascunhoRevisao.form.dataCompra : novaCompraForm.dataCompra}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (ocrRascunhoRevisao) {
                          setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, dataCompra: val } });
                        } else {
                          setNovaCompraForm({ ...novaCompraForm, dataCompra: val });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold block mb-1">Forma de Pagamento</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-300"
                      value={ocrRascunhoRevisao ? ocrRascunhoRevisao.form.formaPagamento : novaCompraForm.formaPagamento}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (ocrRascunhoRevisao) {
                          setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, formaPagamento: val } });
                        } else {
                          setNovaCompraForm({ ...novaCompraForm, formaPagamento: val });
                        }
                      }}
                    >
                      <option value="pix">Pix</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="boleto">Boleto</option>
                      <option value="dinheiro">Dinheiro em Espécie</option>
                    </select>
                  </div>
                </div>

                {/* Campos Específicos se for Cartão de Crédito */}
                {((ocrRascunhoRevisao ? ocrRascunhoRevisao.form.formaPagamento : novaCompraForm.formaPagamento) === 'cartao_credito') && (
                  <div className="grid grid-cols-3 gap-4 text-xs bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div>
                      <label className="text-slate-500 font-semibold block mb-1">Cartão Cadastrado</label>
                      <select
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-300"
                        value={ocrRascunhoRevisao ? ocrRascunhoRevisao.form.cardId : novaCompraForm.cardId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (ocrRascunhoRevisao) {
                            setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, cardId: val } });
                          } else {
                            setNovaCompraForm({ ...novaCompraForm, cardId: val });
                          }
                        }}
                      >
                        <option value="">Selecione...</option>
                        {cards.map(c => <option key={c.id} value={c.id}>{c.nome} (**** {c.finalCartao})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold block mb-1">Parcelas</label>
                      <input
                        type="number"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white"
                        value={ocrRascunhoRevisao ? ocrRascunhoRevisao.form.parcelas : novaCompraForm.parcelas}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (ocrRascunhoRevisao) {
                            setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, parcelas: val } });
                          } else {
                            setNovaCompraForm({ ...novaCompraForm, parcelas: val });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-semibold block mb-1">Valor da Parcela (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 688.19"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white"
                        value={ocrRascunhoRevisao ? (ocrRascunhoRevisao.form.valorParcela/100) : (novaCompraForm.valorParcela/100)}
                        onChange={(e) => {
                          const val = Math.round(Number(e.target.value) * 100);
                          if (ocrRascunhoRevisao) {
                            setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, valorParcela: val } });
                          } else {
                            setNovaCompraForm({ ...novaCompraForm, valorParcela: val });
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Produtos da Compra */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-500 font-semibold text-xs block">Itens da Compra</label>
                    {!ocrRascunhoRevisao && (
                      <button
                        onClick={() => setNovaCompraItens([...novaCompraItens, { nome: '', quantidade: 1, valorUnitario: 0, valorTotal: 0 }])}
                        className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 font-bold px-2 py-1 rounded"
                      >
                        + Adicionar Item
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {(ocrRascunhoRevisao ? ocrRascunhoRevisao.itens : novaCompraItens).map((item: any, idx: number) => (
                      <div key={idx} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Nome do produto"
                            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white col-span-2"
                            value={item.nome}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (ocrRascunhoRevisao) {
                                const newItens = [...ocrRascunhoRevisao.itens];
                                newItens[idx].nome = val;
                                setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, itens: newItens });
                              } else {
                                const newItens = [...novaCompraItens];
                                newItens[idx].nome = val;
                                setNovaCompraItens(newItens);
                              }
                            }}
                          />
                          <input
                            type="number"
                            placeholder="Qtd"
                            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                            value={item.quantidade}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (ocrRascunhoRevisao) {
                                const newItens = [...ocrRascunhoRevisao.itens];
                                newItens[idx].quantidade = val;
                                newItens[idx].valorTotal = val * newItens[idx].valorUnitario;
                                setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, itens: newItens });
                              } else {
                                const newItens = [...novaCompraItens];
                                newItens[idx].quantidade = val;
                                newItens[idx].valorTotal = val * newItens[idx].valorUnitario;
                                setNovaCompraItens(newItens);
                              }
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Preço Unitário (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white"
                              value={item.valorUnitario / 100}
                              onChange={(e) => {
                                const val = Math.round(Number(e.target.value) * 100);
                                if (ocrRascunhoRevisao) {
                                  const newItens = [...ocrRascunhoRevisao.itens];
                                  newItens[idx].valorUnitario = val;
                                  newItens[idx].valorTotal = val * newItens[idx].quantidade;
                                  setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, itens: newItens });
                                } else {
                                  const newItens = [...novaCompraItens];
                                  newItens[idx].valorUnitario = val;
                                  newItens[idx].valorTotal = val * newItens[idx].quantidade;
                                  setNovaCompraItens(newItens);
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Vincular Material Catálogo</label>
                            <select
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300"
                              value={item.vinculoCatalogoId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (ocrRascunhoRevisao) {
                                  const newItens = [...ocrRascunhoRevisao.itens];
                                  newItens[idx].vinculoCatalogoId = val;
                                  setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, itens: newItens });
                                } else {
                                  const newItens = [...novaCompraItens];
                                  newItens[idx].vinculoCatalogoId = val;
                                  setNovaCompraItens(newItens);
                                }
                              }}
                            >
                              <option value="">(Nenhum - Avulso)</option>
                              {catalog.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.categoria})</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal Produtos</span>
                    <span>{formatarMoeda(ocrRascunhoRevisao ? ocrRascunhoRevisao.form.subtotalProdutos : (novaCompraItens.reduce((sum, i) => sum + i.valorTotal, 0)))}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-800">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Frete (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white"
                        value={ocrRascunhoRevisao ? (ocrRascunhoRevisao.form.frete/100) : (novaCompraForm.frete/100)}
                        onChange={(e) => {
                          const val = Math.round(Number(e.target.value) * 100);
                          if (ocrRascunhoRevisao) {
                            setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, frete: val } });
                          } else {
                            setNovaCompraForm({ ...novaCompraForm, frete: val });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Desconto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white"
                        value={ocrRascunhoRevisao ? (ocrRascunhoRevisao.form.desconto/100) : (novaCompraForm.desconto/100)}
                        onChange={(e) => {
                          const val = Math.round(Number(e.target.value) * 100);
                          if (ocrRascunhoRevisao) {
                            setOcrRascunhoRevisao({ ...ocrRascunhoRevisao, form: { ...ocrRascunhoRevisao.form, desconto: val } });
                          } else {
                            setNovaCompraForm({ ...novaCompraForm, desconto: val });
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-white text-sm pt-2">
                    <span>Total a Pagar</span>
                    <span className="text-cyan-400">
                      {formatarMoeda(
                        ocrRascunhoRevisao
                          ? ocrRascunhoRevisao.form.totalPago
                          : (novaCompraItens.reduce((sum, i) => sum + i.valorTotal, 0) + novaCompraForm.frete - novaCompraForm.desconto)
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (ocrRascunhoRevisao) {
                        handleConfirmarRevisaoOcr();
                      } else {
                        const total = novaCompraItens.reduce((sum, i) => sum + i.valorTotal, 0) + novaCompraForm.frete - novaCompraForm.desconto;
                        handleSaveCompra(
                          { ...novaCompraForm, subtotalProdutos: total - novaCompraForm.frete + novaCompraForm.desconto, totalPago: total, statusCompra: 'confirmado', statusEntrega: 'entregue' },
                          novaCompraItens,
                          [{ formaPagamento: novaCompraForm.formaPagamento, cardId: novaCompraForm.cardId || null, parcelas: novaCompraForm.parcelas, valorParcela: novaCompraForm.valorParcela }],
                        );
                      }
                    }}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar e Salvar Lançamento
                  </button>
                  <button
                    onClick={resetForm}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2.5 rounded-lg border border-slate-700 text-xs"
                  >
                    Descartar
                  </button>
                </div>

              </div>

              {/* Lado Direito: Visual de Revisão Side-by-Side (OCR Preview e JSON Bruto) */}
              <div className="space-y-6">
                
                {ocrRascunhoRevisao ? (
                  <>
                    {/* Imagem do Comprovante */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><Eye className="w-4 h-4 text-cyan-400" /> Imagem Digitalizada</h4>
                      <div className="w-full h-64 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                        {ocrRascunhoRevisao.previewUrl ? (
                          <img src={ocrRascunhoRevisao.previewUrl} alt="Comprovante" className="object-contain w-full h-full" />
                        ) : (
                          <span className="text-slate-500 text-xs">Sem visualização de imagem</span>
                        )}
                      </div>
                    </div>

                    {/* Alertas extraídos pelo Gemini */}
                    {ocrRascunhoRevisao.ocrRaw.alertas && ocrRascunhoRevisao.ocrRaw.alertas.length > 0 && (
                      <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4 text-xs text-amber-300 space-y-2">
                        <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-400" /> Alertas da Inteligência Gemini:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {ocrRascunhoRevisao.ocrRaw.alertas.map((a: string, idx: number) => <li key={idx}>{a}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* JSON Retornado do OCR */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">JSON Extraído (Gemini API)</h4>
                      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-56">
                        {JSON.stringify(ocrRascunhoRevisao.ocrRaw, null, 2)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center py-20 text-center text-slate-500 space-y-4">
                    <HelpCircle className="w-12 h-12 text-slate-600" />
                    <div>
                      <p className="font-bold text-slate-400 text-sm">Pronto para lançar compras</p>
                      <p className="text-xs max-w-xs mt-1">Você pode preencher o formulário à esquerda manualmente ou utilizar o OCR na aba de importação para ler prints de comprovantes automaticamente.</p>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 4: PRESTAÇÃO DE CONTAS (AUDITORIA, EXPORTADORES) */}
          {abaAtiva === 'prestacao' && (
            <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-lg p-6 space-y-6">
              
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">Trilha de Auditoria e Transparência</h3>
                  <p className="text-xs text-slate-400 mt-1">Todo lançamento, revisão, edição ou confirmação de compras gera um registro de auditoria imutável.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportarCSV}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded border border-slate-700 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              {/* Linha do tempo interativa */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-4 h-4 text-cyan-400" /> Histórico de Ações da Obra</h4>
                
                <div className="relative border-l border-slate-800 pl-6 ml-3 space-y-6 text-xs">
                  
                  {purchases.flatMap(p => p.auditorias || []).length === 0 ? (
                    <div className="text-slate-500">Nenhum evento registrado na trilha de auditoria.</div>
                  ) : (
                    purchases.flatMap(p => (p.auditorias || []).map(a => ({ ...a, purchase: p }))).map((audit, idx) => {
                      const det = JSON.parse(audit.detalhes || '{}');
                      return (
                        <div key={idx} className="relative">
                          {/* Marcador na linha */}
                          <span className="absolute -left-[30px] top-0 bg-slate-900 border border-slate-700 w-4 h-4 rounded-full flex items-center justify-center">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                          </span>
                          
                          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg space-y-1 max-w-2xl shadow">
                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                              <span className="font-semibold text-cyan-400 uppercase">{audit.acao}</span>
                              <span>{new Date(audit.createdAt).toLocaleString('pt-BR')}</span>
                            </div>
                            <p className="font-bold text-white text-xs mt-1">Lançamento ID: <span className="font-mono text-cyan-300">{audit.purchaseId}</span> ({audit.purchase.fornecedor})</p>
                            <p className="text-slate-400 mt-1">{det.mensagem || `Alteração realizada por ${audit.usuario}`}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Usuário Responsável: <span className="font-semibold text-slate-300">{audit.usuario}</span></p>
                          </div>
                        </div>
                      );
                    })
                  )}

                </div>
              </div>

            </div>
          )}

          {/* TAB 5: OCR IMPORT (UPLOAD, CLIPBOARD) */}
          {abaAtiva === 'ocr' && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              {/* Área de Drag and Drop / Paste */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="bg-slate-950 border-2 border-dashed border-slate-800 hover:border-cyan-500 rounded-xl p-10 shadow-lg text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4"
              >
                <UploadCloud className="w-16 h-16 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Arraste e solte o comprovante aqui</h3>
                  <p className="text-xs text-slate-500 mt-1">Compatível com PNG, JPEG, WEBP ou prints de checkout da tela.</p>
                  <p className="text-xs text-cyan-400 font-semibold mt-3">Dica Premium: Você pode colar imagens (Ctrl+V) diretamente do clipboard nesta tela!</p>
                </div>
                
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  multiple
                />
                <label
                  htmlFor="file-upload"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-all shadow cursor-pointer block"
                >
                  Selecionar Imagem do Computador
                </label>
              </div>

              {/* Fila de Processamento de OCR */}
              {ocrFila.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Fila de Digitalização</h4>
                  
                  <div className="space-y-3 text-xs">
                    {ocrFila.map((job) => (
                      <div key={job.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3 shrink-0">
                          {job.previewUrl ? (
                            <img src={job.previewUrl} className="w-10 h-10 object-cover rounded border border-slate-800" alt="Preview" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-800 rounded border border-slate-700 flex items-center justify-center text-slate-500">Img</div>
                          )}
                          <div className="max-w-[200px]">
                            <p className="font-semibold text-white truncate">{job.nome}</p>
                            <p className="text-[10px] text-slate-500 uppercase mt-0.5">{job.status}</p>
                          </div>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="flex-1 max-w-xs">
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                            <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${job.progresso}%` }}></div>
                          </div>
                        </div>

                        {job.status === 'ready' ? (
                          <span className="text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-900 px-2 py-0.5 rounded text-[10px]">CONCLUÍDO</span>
                        ) : job.status === 'error' ? (
                          <span className="text-rose-400 font-bold bg-rose-950/70 border border-rose-900 px-2 py-0.5 rounded text-[10px]">ERRO</span>
                        ) : (
                          <span className="text-slate-400 animate-pulse font-semibold">Lendo...</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 6: CONFIGURAÇÕES */}
          {abaAtiva === 'configuracoes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Cadastro de Cartões */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><CreditCard className="w-5 h-5 text-cyan-400" /> Gerenciar Cartões de Crédito</h3>
                
                {/* Lista de cartões */}
                <div className="space-y-2 text-xs">
                  {cards.length === 0 ? (
                    <div className="text-slate-500">Nenhum cartão cadastrado.</div>
                  ) : (
                    cards.map(c => (
                      <div key={c.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white">{c.nome}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5">Final do cartão: {c.finalCartao}</p>
                        </div>
                        {perfil === 'admin' && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_BASE_URL}/config/cards/${c.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                  exibirNotificacao('Cartão deletado com sucesso.', 'sucesso');
                                  fetchData();
                                }
                              } catch (err: any) {
                                console.error(err);
                                exibirNotificacao('Falha ao deletar cartão no servidor.', 'erro');
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {perfil === 'admin' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const nome = (form.elements.namedItem('cardNome') as HTMLInputElement).value;
                      const finalCartao = (form.elements.namedItem('cardFinal') as HTMLInputElement).value;
                      
                      try {
                        const res = await fetch(`${API_BASE_URL}/config/cards`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ nome, finalCartao }),
                        });
                        if (res.ok) {
                          exibirNotificacao('Cartão cadastrado com sucesso!', 'sucesso');
                          fetchData();
                          form.reset();
                        }
                      } catch (err: any) {
                        console.error(err);
                        exibirNotificacao('Falha ao cadastrar cartão no servidor.', 'erro');
                      }
                    }}
                    className="space-y-3 pt-4 border-t border-slate-900 text-xs"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-500 block mb-1">Nome do Cartão (Instituição)</label>
                        <input name="cardNome" required placeholder="Ex: Santander" className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white" />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-1">Final do Cartão (4 dígitos)</label>
                        <input name="cardFinal" required placeholder="Ex: 8685" maxLength={4} className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono" />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 rounded text-xs transition-all shadow">
                      Cadastrar Cartão
                    </button>
                  </form>
                )}
              </div>

              {/* Chaves da API Gemini */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><ScanQrCode className="w-5 h-5 text-cyan-400" /> Configuração do Gemini OCR</h3>
                
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-xs space-y-2">
                  <p className="font-semibold text-slate-400">Instruções para chave de API:</p>
                  <p className="text-slate-500 text-[10px] leading-relaxed">Para habilitar a leitura real de imagens e comprovantes com inteligência artificial, configure a Gemini API Key no backend. Sem a chave, o OCR retorna erro e não salva rascunho.</p>
                </div>

                {perfil === 'admin' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const value = (form.elements.namedItem('geminiKey') as HTMLInputElement).value;
                      
                      try {
                        const res = await fetch(`${API_BASE_URL}/config/keys`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ key: 'gemini_api_key', value }),
                        });
                        if (res.ok) {
                          exibirNotificacao('Chave da Gemini API salva com sucesso!', 'sucesso');
                          form.reset();
                        }
                      } catch (err: any) {
                        console.error(err);
                        exibirNotificacao('Falha ao salvar chave da Gemini API no servidor.', 'erro');
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="text-slate-500 block mb-1">Gemini API Key (Google AI Studio)</label>
                      <input name="geminiKey" type="password" placeholder="Insira a chave AI..." className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white" />
                    </div>
                    <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 rounded text-xs transition-all shadow">
                      Salvar Chave
                    </button>
                  </form>
                )}
              </div>

            </div>
          )}

        </div>

      </main>

    </div>
  );
}
