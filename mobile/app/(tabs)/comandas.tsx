import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, ActivityIndicator, Modal, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import CriarComandaModal from '../../src/components/CriarComandaModal';
// import ProdutosComandaModal from '../../src/components/ProdutosComandaModal';
import SearchAndFilter from '../../src/components/SearchAndFilter';
import { comandaService, employeeService, saleService, getWsUrl } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { Comanda } from '../../src/types/index';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus';
import { SafeIcon } from '../../components/SafeIcon';

export default function ComandasAbertasScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  // Estados de modal de produtos removidos após migração para SaleScreen
  // const [produtosModalVisible, setProdutosModalVisible] = useState(false);
  // const [comandaSelecionada, setComandaSelecionada] = useState<any>(null);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [filteredComandas, setFilteredComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para fechamento de comanda (idêntico às mesas)
  const [fecharComandaModalVisible, setFecharComandaModalVisible] = useState(false);
  const [fecharComandaSelecionada, setFecharComandaSelecionada] = useState<any>(null);
  const [fecharPaymentMethod, setFecharPaymentMethod] = useState('dinheiro');
  const [fecharTotal, setFecharTotal] = useState(0);
  const [fecharSaleId, setFecharSaleId] = useState<string | null>(null);
  const [finalizandoComanda, setFinalizandoComanda] = useState(false);
  
  // Estados para filtros (igual à tela de produtos)
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<any[]>([]);
  
  const { user } = useAuth() as any;

  // Utilidades para lidar com totais possivelmente retornados como string/Decimal
  const toNum = (v: any): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const calcSaleTotal = (sale: any): number => {
    const t = toNum(sale?.total);
    if (t > 0) return t;
    const itens = Array.isArray(sale?.itens) ? sale.itens : [];
    const subtotal = itens.reduce((sum: number, it: any) => sum + toNum(it?.subtotal ?? (toNum(it?.quantidade) * toNum(it?.precoUnitario))), 0);
    const desconto = toNum(sale?.desconto);
    return Math.max(0, subtotal - (Number.isFinite(desconto) ? desconto : 0));
  };
  const formatMoney = (v: any): string => toNum(v).toFixed(2);

  useEffect(() => {
    loadStatusFilters();
  }, []);

  // Aplicar filtros sempre que os dados ou filtros mudarem (igual à tela de produtos)
  useEffect(() => {
    filterComandas();
  }, [searchText, comandas, selectedFilter]);

  const loadStatusFilters = () => {
    // Configuração dos filtros de status igual à tela de produtos
    const filters = [
      { key: '', label: 'Todas', icon: 'apps' },
      { key: 'aberta', label: 'Abertas', icon: 'checkmark-circle' },
      { key: 'finalizada', label: 'Finalizadas', icon: 'close-circle' },
      { key: 'cancelada', label: 'Canceladas', icon: 'ban' }
    ];
    setStatusFilters(filters);
  };

  const loadComandas = async () => {
    try {
      setLoading(true);
      const response = await comandaService.getAll();
      const todasComandas = response.data?.filter((venda: Comanda) => venda.tipoVenda === 'comanda') || [];
      setComandas(todasComandas);
    } catch (error: any) {
      console.error('Erro ao carregar comandas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as comandas.');
    } finally {
      setLoading(false);
    }
  };

  const softRefreshComandas = async () => {
    try {
      const response = await comandaService.getAll();
      const todasComandas = response.data?.filter((venda: Comanda) => venda.tipoVenda === 'comanda') || [];
      setComandas(todasComandas);
    } catch {}
  };

  // Lógica de filtragem igual à tela de produtos
  const filterComandas = () => {
    let filtered = comandas;

    // Filtro por status (igual à tela de produtos)
    if (selectedFilter) {
      filtered = filtered.filter(comanda => comanda.status === selectedFilter);
    }

    // Filtro por texto de busca (igual à tela de produtos)
    if (searchText.trim()) {
      filtered = filtered.filter(comanda =>
        (comanda.nomeComanda && comanda.nomeComanda.toLowerCase().includes(searchText.toLowerCase())) ||
        (comanda.numeroComanda && comanda.numeroComanda.toLowerCase().includes(searchText.toLowerCase())) ||
        (comanda.funcionario?.nome && comanda.funcionario.nome.toLowerCase().includes(searchText.toLowerCase())) ||
        (comanda.cliente?.nome && comanda.cliente.nome.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    setFilteredComandas(filtered);
  };

  // Função de mudança de filtro igual à tela de produtos
  const handleFilterChange = (filterKey: string) => {
    setSelectedFilter(filterKey);
  };

  useFocusEffect(
    useCallback(() => {
      const off = events.on('comandas:refresh', () => {
        loadComandas();
      });
      return () => off();
    }, [loadComandas])
  );

  useFocusEffect(useCallback(() => {
    const intervalId = setInterval(() => {
      loadComandas();
    }, 2000);
    return () => clearInterval(intervalId);
  }, [loadComandas]));

  useEffect(() => {
    let since = Date.now();
    const t = setInterval(async () => {
      try {
        const res = await saleService.updates(since);
        if (res?.data?.updates?.length) {
          since = res?.data?.now || Date.now();
          await softRefreshComandas();
        }
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const url = getWsUrl();
      if (url) {
        const ws = new (globalThis as any).WebSocket(url);
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              const id = String(msg?.payload?.id || '');
              if (!id) return;
              const r = await saleService.getById(id);
              const v = r.data;
              if (v && v.tipoVenda === 'comanda') {
                setComandas((prev) => {
                  const byId = new Map<string, any>();
                  prev.forEach((x: any) => byId.set(String(x._id || x.id), x));
                  byId.set(String(v._id || v.id), v);
                  return Array.from(byId.values());
                });
              }
            }
          } catch {}
        };
        return () => { try { ws.close(); } catch {} };
      }
    } catch {}
  }, []);

  const handleOpenModal = () => {
    if (Platform.OS === 'ios') {
      console.log('✅ iOS: Toque capturado: abrindo modal Nova Comanda com Alert');
      Alert.alert('Abrindo', 'Nova Comanda', [
        {
          text: 'OK',
          onPress: () => {
            console.log('👉 OK do Alert pressionado, abrindo modal');
            setModalVisible(true);
          },
        },
      ]);
    } else {
      console.log('✅ Web/Android: abrindo modal Nova Comanda imediatamente');
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleOpenProdutosModal = (comanda: any) => {
    // Navegar para a SaleScreen usando o fluxo já consolidado das Mesas
    router.push({
      pathname: '/sale',
      params: { tipo: 'comanda', vendaId: comanda._id }
    });
  };

  // Fluxo antigo de modal de produtos substituído por navegação para /sale
  // const handleCloseProdutosModal = () => {
  //   setProdutosModalVisible(false);
  //   setComandaSelecionada(null);
  // };

  // const handleUpdateComanda = async () => {
  //   // Recarrega as comandas após adicionar/remover produtos
  //   await loadComandas();
  //   
  //   // Se há uma comanda selecionada no modal, atualiza seus dados também
  //   if (comandaSelecionada) {
  //     try {
  //       const response = await comandaService.getById(comandaSelecionada._id);
  //       setComandaSelecionada(response.data);
  //     } catch (error: any) {
  //       console.error('Erro ao atualizar comanda selecionada:', error);
  //     }
  //   }
  // };

  // Função para abrir modal de fechamento de comanda (idêntico às mesas)
  const fecharModalFecharComanda = async (comanda: any) => {
    try {
      setFecharComandaSelecionada(comanda);
      setFecharPaymentMethod('dinheiro');
      setFecharTotal(0);
      setFecharSaleId(null);

      // Buscar a venda ativa da comanda (igual às mesas)
      const response = await comandaService.getById(comanda._id);
      const comandaData = response.data;

      if (!comandaData) {
        Alert.alert('Erro', 'Nenhuma venda encontrada para esta comanda.');
        return;
      }

      const total = (comandaData.itens || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
      setFecharTotal(total);
      setFecharSaleId(comandaData._id);
      setFecharComandaSelecionada(comandaData);
      setFecharComandaModalVisible(true);
    } catch (error) {
      console.error('Erro ao carregar venda da comanda:', error);
      Alert.alert('Erro', 'Não foi possível buscar a venda da comanda.');
    }
  };

  // Função para confirmar fechamento de comanda com validações
  const confirmarFechamentoComanda = async () => {
    if (!fecharPaymentMethod) {
      Alert.alert('Erro', 'Selecione um método de pagamento.');
      return;
    }

    if (!fecharSaleId || !fecharComandaSelecionada) {
      Alert.alert('Erro', 'Dados da comanda não encontrados.');
      return;
    }

    // Validações antes de finalizar: comanda aberta e venda com itens
    try {
      if (fecharComandaSelecionada.status !== 'aberta') {
        Alert.alert('Erro', 'Para fechar, a comanda precisa estar ABERTA.');
        return;
      }

      const vendaResp = await comandaService.getById(fecharSaleId);
      const venda = vendaResp?.data;

      if (!venda) {
        Alert.alert('Erro', 'Venda não encontrada.');
        return;
      }

      if (venda.status !== 'aberta') {
        Alert.alert('Erro', 'A venda precisa estar ABERTA para finalizar.');
        return;
      }

      const itens = Array.isArray(venda.itens) ? venda.itens : [];
      if (itens.length === 0) {
        Alert.alert('Erro', 'Não é possível finalizar uma venda sem itens.');
        return;
      }

      const totalAtual = itens.reduce((sum: number, it: any) => sum + (it.subtotal || 0), 0);
      setFecharTotal(totalAtual);
    } catch (validError: any) {
      console.error('Erro ao validar venda/comanda antes de finalizar:', validError);
      Alert.alert('Erro', validError?.response?.data?.error || 'Falha ao validar venda.');
      return;
    }

    try {
      setFinalizandoComanda(true);

      const response = await saleService.finalize(fecharSaleId, { formaPagamento: fecharPaymentMethod });
      
      if (response.data && response.data.status === 'finalizada') {
        Alert.alert('Sucesso', 'Comanda finalizada com sucesso!');
        
        setFecharComandaModalVisible(false);
        setFecharComandaSelecionada(null);
        setFecharPaymentMethod('dinheiro');
        setFecharTotal(0);
        setFecharSaleId(null);
        
        await loadComandas();
        events.emit('caixa:refresh');
      } else {
        Alert.alert('Erro', 'Falha ao finalizar a comanda.');
      }
    } catch (error: any) {
      console.error('Erro ao finalizar comanda:', error);
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao finalizar comanda.');
    } finally {
      setFinalizandoComanda(false);
    }
  };

  const handleSubmitComanda = async (data: any) => {
    const newComandaData = {
      tipoVenda: 'comanda',
      nomeComanda: data.nomeComanda,
      cliente: data.cliente || null,
      funcionario: data.funcionario,
      valorTotal: data.valorTotalEstimado || 0,
      observacoes: data.observacoes || '',
    };

    console.log('Enviando dados para criar comanda:', JSON.stringify(newComandaData, null, 2));

    try {
      console.log('Criando comanda com dados:', newComandaData);
      const response = await comandaService.create(newComandaData);
      console.log('Resposta da criação:', response.data);
      Alert.alert('Sucesso', 'Comanda criada com sucesso!');
      handleCloseModal();
      // Redireciona imediatamente para a SaleScreen desta comanda
      router.push({ pathname: '/sale', params: { tipo: 'comanda', vendaId: response.data._id } });
      await loadComandas(); // Recarrega as comandas
      events.emit('comandas:refresh');
    } catch (error: any) {
      console.error('Erro detalhado ao criar comanda:', error);
      console.error('Response error:', error.response?.data);
      Alert.alert('Erro', `Não foi possível criar a comanda: ${error.response?.data?.error || error.message || 'Erro desconhecido'}`);
    }
  };

  // Função para obter a cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberta':
        return '#4CAF50';
      case 'finalizada':
        return '#2196F3';
      case 'cancelada':
        return '#f44336';
      default:
        return '#666';
    }
  };

  // Função para obter o texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'aberta':
        return 'Aberta';
      case 'finalizada':
        return 'Finalizada';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status;
    }
  };

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Comandas" />
      
      {/* Componente de busca e filtros igual à tela de produtos */}
      <SearchAndFilter
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Buscar comandas..."
        filters={statusFilters}
        selectedFilter={selectedFilter}
        onFilterChange={handleFilterChange}
      />
      
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/')} accessibilityLabel="Voltar para Home" style={{ marginRight: 12 }}>
            <SafeIcon name="arrow-back" size={24} color="#2196F3" fallbackText="←" />
          </TouchableOpacity>
          <Text style={styles.title}>Comandas</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleOpenModal}>
          <Text style={styles.buttonText}>Nova Comanda</Text>
        </TouchableOpacity>
      </View>
      
      <CriarComandaModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSubmit={handleSubmitComanda}
      />
      
      {/* ProdutosComandaModal removido: fluxo migrado para SaleScreen (/sale) */}
      
      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" />
      ) : (
        <FlatList
          data={filteredComandas}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            console.log('📋 Renderizando comanda:', item.nomeComanda, 'Status:', item.status);
            return (
            <View style={styles.comandaItem}>
              <TouchableOpacity 
                style={styles.comandaContent}
                onPress={() => handleOpenProdutosModal(item)}
              >
                <View style={styles.comandaInfo}>
                  <View style={styles.comandaHeader}>
                    <Text style={styles.comandaNome}>{item.nomeComanda || item.numeroComanda || 'Sem nome'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.comandaFuncionario}>Funcionário: {item.funcionario?.nome || 'Não definido'}</Text>
                  {item.cliente?.nome && (
                    <Text style={styles.comandaCliente}>Cliente: {item.cliente.nome}</Text>
                  )}
                  <Text style={styles.comandaItens}>{item.itens?.length || 0} itens</Text>
                </View>
                <View style={styles.comandaTotal}>
                  <Text style={styles.comandaValor}>R$ {formatMoney(calcSaleTotal(item))}</Text>
                </View>
              </TouchableOpacity>
              
              {/* Botão de fechar comanda - só aparece se a comanda estiver aberta */}
              {item.status === 'aberta' && (
                <TouchableOpacity 
                  style={[styles.fecharButton, (item.itens?.length || 0) === 0 && { opacity: 0.6 }]}
                  onPress={() => {
                    console.log('🔴 BOTÃO FECHAR COMANDA CLICADO!', item);
                    fecharModalFecharComanda(item);
                  }}
                  disabled={(item.itens?.length || 0) === 0}
                >
                  <View style={{ marginRight: 4 }}>
                    <SafeIcon name="close-circle" size={16} color="#fff" fallbackText="×" />
                  </View>
                  <Text style={styles.fecharButtonText}>🔴 FECHAR COMANDA</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma comanda encontrada.</Text>
            </View>
          }
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal de fechamento de comanda (idêntico às mesas) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={fecharComandaModalVisible}
        onRequestClose={() => setFecharComandaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📋 Finalizar Comanda</Text>
            
            {fecharComandaSelecionada && (
              <View style={styles.comandaDetails}>
                <Text style={styles.comandaDetailTitle}>
                  {fecharComandaSelecionada.nomeComanda || fecharComandaSelecionada.numeroComanda || 'Sem nome'}
                </Text>
                <Text style={styles.comandaDetailText}>
                  Funcionário: {fecharComandaSelecionada.funcionario?.nome || 'Não definido'}
                </Text>
                {fecharComandaSelecionada.cliente?.nome && (
                  <Text style={styles.comandaDetailText}>
                    Cliente: {fecharComandaSelecionada.cliente.nome}
                  </Text>
                )}
                <Text style={styles.comandaDetailText}>
                  Itens: {fecharComandaSelecionada.itens?.length || 0}
                </Text>
                <Text style={styles.totalText}>
                  💰 Total da Comanda: R$ {formatMoney(fecharTotal)}
                </Text>
              </View>
            )}

            <Text style={styles.paymentLabel}>Método de Pagamento:</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  fecharPaymentMethod === 'dinheiro' && styles.paymentOptionSelected
                ]}
                onPress={() => setFecharPaymentMethod('dinheiro')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  fecharPaymentMethod === 'dinheiro' && styles.paymentOptionTextSelected
                ]}>
                  Dinheiro
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  fecharPaymentMethod === 'cartao' && styles.paymentOptionSelected
                ]}
                onPress={() => setFecharPaymentMethod('cartao')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  fecharPaymentMethod === 'cartao' && styles.paymentOptionTextSelected
                ]}>
                  Cartão
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  fecharPaymentMethod === 'pix' && styles.paymentOptionSelected
                ]}
                onPress={() => setFecharPaymentMethod('pix')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  fecharPaymentMethod === 'pix' && styles.paymentOptionTextSelected
                ]}>
                  PIX
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setFecharComandaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (finalizandoComanda || fecharComandaSelecionada?.status !== 'aberta' || (fecharComandaSelecionada?.itens?.length || 0) === 0 || !fecharPaymentMethod) && { opacity: 0.6 }
                ]}
                onPress={confirmarFechamentoComanda}
                disabled={
                  finalizandoComanda ||
                  fecharComandaSelecionada?.status !== 'aberta' ||
                  (fecharComandaSelecionada?.itens?.length || 0) === 0 ||
                  !fecharPaymentMethod
                }
              >
                {finalizandoComanda ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Finalizar Comanda</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  comandaItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  comandaContent: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  fecharButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  fecharButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  comandaInfo: {
    flex: 1,
  },
  comandaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comandaNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  comandaFuncionario: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  comandaCliente: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  comandaItens: {
    fontSize: 14,
    color: '#666',
  },
  comandaTotal: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  comandaValor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Estilos do modal de fechamento
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  comandaDetails: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  comandaDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  comandaDetailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 8,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  paymentOption: {
    flex: 1,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  paymentOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  paymentOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  paymentOptionTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});