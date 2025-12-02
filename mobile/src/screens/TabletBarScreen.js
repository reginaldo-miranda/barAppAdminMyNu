import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Vibration, Animated, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService, authService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../services/storage';
import { Ionicons } from '@expo/vector-icons';
import { useSetorSync } from '../hooks/useSetorSync';
import { imprimirPedidoSetor } from '../utils/printSetor';

export default function TabletBarScreen(props = {}) {
  const { setorIdOverride, setorNomeOverride, forceFilterStatus, hiddenIds } = props || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setorId, setSetorId] = useState(null);
  const [setorNome, setSetorNome] = useState('Bar');
  const [submittingId, setSubmittingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: null, text: '' });

  const ensureToken = React.useCallback(async () => {
    try {
      const existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!existingToken) {
        const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
        const token = login?.data?.token;
        if (token) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      }
    } catch {}
  }, []);

  React.useEffect(() => { ensureToken(); }, [ensureToken]);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [sound, setSound] = useState();
  const [filterStatus, setFilterStatus] = useState(forceFilterStatus || 'pendente');

  // Sincronização em tempo real
  const handleUpdate = (updateData) => {
    console.log('Atualização recebida:', updateData);
    // Recarregar lista quando houver atualização
    if (setorId) {
      buscarItensDoSetor(setorId);
      // Notificar novo pedido
      notificarNovoPedido();
    }
  };

  // Função para notificar novo pedido
  const notificarNovoPedido = async () => {
    // Vibração
    Vibration.vibrate([0, 200, 100, 200]);
    
    // Animação de fade
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const { connected } = useSetorSync(setorId, handleUpdate);

  // Buscar ID do setor bar
  const buscarSetorBar = async () => {
    try {
      const response = await apiService.request({
        method: 'GET',
        url: '/setor-impressao/list'
      });

      if (response.data?.success) {
        const setores = response.data.data;
        const bar = setores.find(s => 
          s.nome.toLowerCase().includes('bar') || 
          s.nome.toLowerCase().includes('balcão') ||
          s.nome.toLowerCase().includes('balcao')
        );
        
        if (bar) {
          setSetorId(bar.id);
          setSetorNome(bar.nome);
          return bar.id;
        } else {
          // Se não encontrar "bar", procurar por nomes similares
          const similar = setores.find(s => 
            s.nome.toLowerCase().includes('bebidas') ||
            s.nome.toLowerCase().includes('drink')
          );
          if (similar) {
            setSetorId(similar.id);
            setSetorNome(similar.nome);
            return similar.id;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar setor bar:', error);
      return null;
    }
  };

  // Buscar itens do setor
  const buscarItensDoSetor = async (idSetor) => {
    if (!idSetor) return;
    
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const response = await apiService.request({
        method: 'GET',
        url: `/setor-impressao-queue/${idSetor}/queue?status=${forceFilterStatus || filterStatus}`,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data?.success) {
        const arr = response.data.data || [];
        const filtered = Array.isArray(hiddenIds) && hiddenIds.length > 0 ? arr.filter((i) => !hiddenIds.includes(Number(i.id))) : arr;
        setItems(filtered);
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      Alert.alert('Erro', 'Não foi possível carregar os pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Alterar status do item (pendente -> pronto -> entregue)
  const alterarStatus = async (item, novoStatus) => {
    try {
      let existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!existingToken) {
        try {
          const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
          const token = login?.data?.token;
          if (token) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
          existingToken = token;
        } catch {}
      }
      setSubmittingId(item.id);
      Vibration.vibrate(100);
      const response = await apiService.request({
        method: 'PATCH',
        url: `/setor-impressao-queue/sale/${item.saleId}/item/${item.id}/status`,
        data: { status: novoStatus },
        headers: existingToken ? { Authorization: `Bearer ${existingToken}` } : {}
      });
      if (response?.success && response.data?.success) {
        notificarSucesso();
        setItems(prevItems => prevItems.filter(i => i.id !== item.id));
        Alert.alert('Sucesso', novoStatus === 'pronto' ? 'Item marcado como pronto' : 'Item marcado como entregue');
        setFeedbackMsg({ type: 'success', text: novoStatus === 'pronto' ? 'Item marcado como pronto' : 'Item marcado como entregue' });
        buscarItensDoSetor(setorId);
      } else {
        const msg = response?.data?.message || `Falha ao marcar como ${novoStatus} (status ${response?.status || 'N/A'})`;
        Alert.alert('Erro', msg);
        setFeedbackMsg({ type: 'error', text: msg });
      }
    } catch (error) {
      console.error(`Erro ao marcar item como ${novoStatus}:`, error);
      Alert.alert('Erro', `Não foi possível marcar o item como ${novoStatus}`);
    } finally {
      setSubmittingId(null);
    }
  };

  // Notificar sucesso
  const notificarSucesso = () => {
    Vibration.vibrate(50);
    // Aqui você pode adicionar som de sucesso se desejar
  };

  // Função para imprimir todos os pedidos atuais
  const imprimirPedidos = async () => {
    if (items.length === 0) {
      Alert.alert('Aviso', 'Não há pedidos para imprimir');
      return;
    }

    try {
      const resultado = await imprimirPedidoSetor(items, setorNome);
      if (resultado.success) {
        Alert.alert('Sucesso', 'Pedidos preparados para impressão');
      } else {
        Alert.alert('Erro', resultado.message);
      }
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      Alert.alert('Erro', 'Não foi possível preparar os pedidos para impressão');
    }
  };

  // Agrupar itens por mesa
  const agruparPorMesa = (items) => {
    const agrupado = {};
    items.forEach(item => {
      if (!agrupado[item.mesa]) {
        agrupado[item.mesa] = [];
      }
      agrupado[item.mesa].push(item);
    });
    return agrupado;
  };

  // Atualizar quando a tela entrar em foco
  useFocusEffect(
    useCallback(() => {
      const carregarDados = async () => {
        let idSetor = setorIdOverride ?? null;
        if (idSetor) {
          setSetorId(idSetor);
          if (setorNomeOverride) setSetorNome(setorNomeOverride);
        } else {
          idSetor = await buscarSetorBar();
        }
        if (idSetor) {
          await buscarItensDoSetor(idSetor);
        } else {
          Alert.alert('Aviso', 'Setor "Bar" não encontrado. Verifique o cadastro de setores.');
          setLoading(false);
        }
      };
      carregarDados();
      const interval = setInterval(() => {
        const id = setorIdOverride ?? setorId;
        if (id) {
          buscarItensDoSetor(id);
        }
      }, 30000);
      return () => clearInterval(interval);
    }, [setorId, setorIdOverride, setorNomeOverride, filterStatus, forceFilterStatus, hiddenIds])
  );

  React.useEffect(() => {
    const id = setorIdOverride ?? setorId;
    if (id) {
      buscarItensDoSetor(id);
    }
  }, [setorId, setorIdOverride, filterStatus, forceFilterStatus, hiddenIds]);

  const mesasAgrupadas = agruparPorMesa(items);

  const getWaitingMinutes = (dt) => {
    const t = new Date(dt).getTime();
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
  };

  const renderItem = ({ item }) => {
    const waiting = getWaitingMinutes(item.horario);
    const urgencyStyle = waiting >= 20 ? styles.urgentHigh : waiting >= 10 ? styles.urgentMedium : waiting >= 5 ? styles.urgentLow : null;
    const timeStr = new Date(item.horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return (
      <Animated.View style={[styles.itemContainer, urgencyStyle, { opacity: fadeAnim }]}> 
        <View style={styles.itemInfo}>
          <View style={styles.itemTopRow}>
            <Text style={styles.itemTitle}>
              {item.quantidade}x {item.produto}
            </Text>
            <View style={styles.itemMeta}>
              <Ionicons name="time" size={16} color="#333" />
              <Text style={styles.waitText}>{waiting} min</Text>
            </View>
          </View>
          <View style={{ marginBottom: 6 }}>
            <Text style={[
              styles.statusPill,
              item.status === 'pendente'
                ? styles.statusPending
                : item.status === 'pronto'
                ? styles.statusReady
                : styles.statusDelivered
            ]}>
              {item.status === 'pendente' ? 'Em preparação' : item.status === 'pronto' ? 'Pronto' : 'Entregue'}
            </Text>
          </View>
          <Text style={styles.itemDetail}>Mesa/Comanda: {item.mesa}</Text>
          <Text style={styles.itemDetail}>Responsável: {item.responsavel || 'Não informado'}</Text>
          <Text style={styles.itemDetail}>Funcionário: {item.funcionario}</Text>
          <Text style={styles.itemDetail}>Horário: {timeStr}</Text>
        </View>
        {item.status === 'pendente' ? (
          <TouchableOpacity style={[styles.checkbox, { borderColor: '#9E9E9E' }]} onPress={() => alterarStatus(item, 'pronto')} activeOpacity={0.8}>
            <Ionicons name="square-outline" size={24} color="#616161" />
            <Text style={[styles.checkboxText, { color: '#616161' }]}>Marcar como pronto</Text>
          </TouchableOpacity>
        ) : item.status === 'pronto' ? (
          <TouchableOpacity
            style={[styles.checkbox, { borderColor: '#9E9E9E', opacity: submittingId === item.id ? 0.6 : 1 }]}
            onPress={() => {
              try {
                console.log('Entregar clique (bar)', { id: item.id, saleId: item.saleId, status: item.status });
                if (!item?.id || !item?.saleId) {
                  Alert.alert('Erro', 'Item inválido para entrega');
                  return;
                }
                alterarStatus(item, 'entregue');
              } catch (e) {
                Alert.alert('Erro', 'Falha ao iniciar entrega');
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
            disabled={submittingId === item.id}
          >
            <Ionicons name="square-outline" size={24} color="#616161" />
            <Text style={[styles.checkboxText, { color: '#616161' }]}>Marcar como entregue</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.checkbox, { borderColor: '#9E9E9E' }]}> 
            <Ionicons name="checkmark-circle" size={24} color="#9E9E9E" />
            <Text style={[styles.checkboxText, { color: '#9E9E9E' }]}>Entregue</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderMesa = ({ item: mesa }) => {
    const mesaItems = mesasAgrupadas[mesa];
    return (
      <View style={styles.mesaContainer}>
        <View style={styles.mesaHeader}>
          <Text style={styles.mesaTitle}>{mesa}</Text>
          <Text style={styles.mesaItemsCount}>{mesaItems.length} item(s)</Text>
        </View>
        <FlatList
          data={mesaItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="wine" size={48} color="#4CAF50" style={styles.loadingIcon} />
          <Text style={styles.loadingText}>Carregando pedidos...</Text>
          <Text style={styles.loadingSubtext}>Preparando bar</Text>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="wine" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Nenhum pedido pendente</Text>
          <Text style={styles.emptySubtext}>Os pedidos aparecerão aqui quando forem realizados</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Ionicons name="wine" size={32} color="#4CAF50" />
          <TouchableOpacity style={styles.printButton} onPress={imprimirPedidos}>
            <Ionicons name="print" size={20} color="#fff" />
            <Text style={styles.printButtonText}>Imprimir</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>{setorNome}</Text>
        <Text style={styles.headerSubtitle}>{forceFilterStatus === 'pronto' ? 'Prontos para entregar' : `${items.length} pedido(s) ${filterStatus === 'pendente' ? 'pendente(s)' : filterStatus === 'pronto' ? 'pronto(s)' : 'entregue(s)'}`}</Text>
        {feedbackMsg.text ? (
          <Text style={[styles.feedbackMsg, feedbackMsg.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
            {feedbackMsg.text}
          </Text>
        ) : null}
        <View style={[styles.connectionStatus, connected ? styles.connected : styles.disconnected]}>
          <Ionicons name={connected ? 'wifi' : 'wifi-off'} size={16} color="#fff" />
          <Text style={styles.connectionText}>
            {connected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
      </View>
      {!forceFilterStatus && (
      <View style={styles.filtersRow}>
        <TouchableOpacity onPress={() => { setFilterStatus('pendente'); }} style={[styles.filterChip, filterStatus === 'pendente' && styles.filterChipActive]}>
          <Text style={[styles.filterText, filterStatus === 'pendente' && styles.filterTextActive]}>Em preparação</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setFilterStatus('pronto'); }} style={[styles.filterChip, filterStatus === 'pronto' && styles.filterChipActive]}>
          <Text style={[styles.filterText, filterStatus === 'pronto' && styles.filterTextActive]}>Prontos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setFilterStatus('entregue'); }} style={[styles.filterChip, filterStatus === 'entregue' && styles.filterChipActive]}>
          <Text style={[styles.filterText, filterStatus === 'entregue' && styles.filterTextActive]}>Entregues</Text>
        </TouchableOpacity>
      </View>
      )}
      
      <FlatList
        data={[...items].sort((a, b) => new Date(a.horario).getTime() - new Date(b.horario).getTime())}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator
        initialNumToRender={12}
        windowSize={10}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => buscarItensDoSetor(setorId)}
            colors={['#4CAF50']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wine" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum pedido pendente</Text>
            <Text style={styles.emptySubtext}>Os pedidos aparecerão aqui quando forem realizados</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  printButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 3,
  },
  printButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    fontWeight: '500',
  },
  feedbackMsg: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center'
  },
  feedbackError: {
    color: '#d32f2f'
  },
  feedbackSuccess: {
    color: '#2e7d32'
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connected: {
    backgroundColor: '#4CAF50',
  },
  disconnected: {
    backgroundColor: '#f44336',
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingIcon: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 22,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
  },
  mesaContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  mesaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  mesaTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  mesaItemsCount: {
    fontSize: 14,
    color: '#fff',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: 'bold',
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  itemInfo: {
    flex: 1,
    marginRight: 15,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  itemDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
    fontWeight: '500',
  },
  readyButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 90,
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  readyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#e7f5e7',
  },
  filterText: {
    color: '#666',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    minWidth: 100,
    justifyContent: 'center',
  },
  checkboxText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 16,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  statusPending: {
    backgroundColor: '#e7f5e7',
    color: '#4CAF50',
  },
  statusReady: {
    backgroundColor: '#c8e6c9',
    color: '#2e7d32',
  },
  statusDelivered: {
    backgroundColor: '#e0e0e0',
    color: '#616161',
  },
  urgentLow: {
    backgroundColor: '#f1f8e9',
    borderColor: '#c5e1a5',
    borderWidth: 1,
  },
  urgentMedium: {
    backgroundColor: '#e8f5e9',
    borderColor: '#81c784',
    borderWidth: 1,
  },
  urgentHigh: {
    backgroundColor: '#ffebee',
    borderColor: '#ef5350',
    borderWidth: 1,
  },
});