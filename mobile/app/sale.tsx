
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Platform,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { saleService, mesaService, comandaService, getWsUrl, authService, API_URL } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../src/services/storage';
import { useAuth } from '../src/contexts/AuthContext';
import AddProductToTable from '../src/components/AddProductToTable';
import ScreenIdentifier from '../src/components/ScreenIdentifier';
import { Sale, CartItem, PaymentMethod, Product } from '../src/types/index';
import SaleItemsModal from '../src/components/SaleItemsModal';

import VariationSelectorModal from '../src/components/VariationSelectorModal';
import PaymentSplitModal from '../src/components/PaymentSplitModal';
import { events } from '../src/utils/eventBus';

export default function SaleScreen() {
  const { tipo, mesaId, vendaId, viewMode } = useLocalSearchParams();
  const { user } = useAuth() as any;
  // const { confirmRemove } = useConfirmation();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [isViewMode, setIsViewMode] = useState(false);
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [mesa, setMesa] = useState<any>(null);
  const [comanda, setComanda] = useState<any>(null);
  const [itemsModalVisible, setItemsModalVisible] = useState(false);
  const isPhone = Dimensions.get('window').width < 768;
  const [initialItemsModalShown, setInitialItemsModalShown] = useState(false);
  const latestReqRef = useRef<Map<string, number>>(new Map());
  const [variationVisible, setVariationVisible] = useState(false);

  const [variationProduct, setVariationProduct] = useState<Product | null>(null);
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [sizeSelectorVisible, setSizeSelectorVisible] = useState(false);
  const [selectedProductForSize, setSelectedProductForSize] = useState<Product | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!existingToken) {
          const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
          const token = login?.data?.token;
          if (token && mounted) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const w = Dimensions.get('window').width;
    const shouldTablet = Platform.OS === 'web' || w >= 1024;
    (async () => {
      try {
        if (shouldTablet) await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_MODE, 'tablet');
      } catch {}
    })();
    return () => { AsyncStorage.removeItem(STORAGE_KEYS.CLIENT_MODE).catch(() => {}); };
  }, []);

  useEffect(() => {
    if (isPhone && !isViewMode && cart.length > 0 && !initialItemsModalShown) {
      setItemsModalVisible(true);
      setInitialItemsModalShown(true);
    }
  }, [isPhone, isViewMode, cart.length, initialItemsModalShown]);

  useEffect(() => {
    try {
      let ws: any = null;
      let sse: any = null;
      const url = getWsUrl();
      if (url) {
        ws = new (globalThis as any).WebSocket(url);
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              const id = String(msg?.payload?.id || '');
              const currentId = String((sale as any)?._id || (sale as any)?.id || vendaId || '');
              if (!id || !currentId || id !== currentId) {
                console.log('[WS] sale:update ignorado', { id, currentId });
                return;
              }
              console.log('[WS] sale:update aceito', { id, currentId });
              const r = await saleService.getById(currentId);
              const v = r.data;
              if (v) {
                setSale(v);
                setCart(v.itens || []);
              }
            }
          } catch (err) {
            const e = err as any;
            console.warn('[WS] erro onmessage', e?.message || e);
          }
        };
      }
      try {
        const isWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !!(window as any).EventSource;
        if (isWeb) {
          const base = (API_URL || '').replace(/\/$/, '');
          if (base) {
            const sseUrl = `${base}/sale/stream`;
            sse = new (window as any).EventSource(sseUrl);
            sse.onmessage = async (evt: any) => {
              try {
                const msg = JSON.parse(String(evt?.data || '{}'));
                if (msg?.type === 'sale:update') {
                  const id = String(msg?.payload?.id || '');
                  const currentId = String((sale as any)?._id || (sale as any)?.id || vendaId || '');
                  if (!id || !currentId || id !== currentId) {
                    console.log('[SSE] sale:update ignorado', { id, currentId });
                    return;
                  }
                  console.log('[SSE] sale:update aceito', { id, currentId });
                  const r = await saleService.getById(currentId);
                  const v = r.data;
                  if (v) {
                    setSale(v);
                    setCart(v.itens || []);
                  }
                }
              } catch (e2) {
                const ee = e2 as any;
                console.warn('[SSE] erro onmessage', ee?.message || ee);
              }
            };
          }
        }
      } catch {}
      return () => {
        try { ws && ws.close(); } catch {}
        try { sse && sse.close && sse.close(); } catch {}
      };
    } catch {}
  }, [sale, vendaId]);

  // Listener para eventos de Polling dispostos pelos modais
  useEffect(() => {
    const unsub = events.on('sale:polling-update', (updatedSale: Sale) => {
      const currentId = (sale as any)?.id || (sale as any)?._id;
      const updatedId = (updatedSale as any)?.id || (updatedSale as any)?._id;
      
      if (currentId && updatedId && String(currentId) === String(updatedId)) {
        console.log('[SaleScreen] Recebido update via polling event');
        setSale(updatedSale);
        setCart(updatedSale.itens || []);
        
        // Se foi finalizada remotamente, fecha split modal e avisa
        if (updatedSale.status === 'finalizada' && splitModalVisible) {
          setSplitModalVisible(false);
          Alert.alert('Aviso', 'Venda finalizada remotamente.');
          router.back();
        }
      }
    });
    return () => unsub();
  }, [sale, splitModalVisible]);

  const paymentMethods: PaymentMethod[] = [
    { key: 'dinheiro', label: 'Dinheiro', icon: 'cash' },
    { key: 'cartao', label: 'Cartão', icon: 'card' },
    { key: 'pix', label: 'PIX', icon: 'phone-portrait' },
  ];

  const loadSale = useCallback(async () => {
    try {
      setLoading(true);
      const response = await saleService.getById(vendaId as string);
      setSale(response.data);
      setCart(response.data.itens || []);
      
      if (response.data.mesa) {
        setMesa(response.data.mesa);
        setNomeResponsavel(response.data.mesa.nomeResponsavel || '');
      }
    } catch (error) {
      console.error('Erro ao carregar venda:', error);
      Alert.alert('Erro', 'Não foi possível carregar a venda');
    } finally {
      setLoading(false);
    }
  }, [vendaId]);

  const loadMesaData = useCallback(async () => {
    try {
      const response = await mesaService.getById(mesaId as string);
      setMesa(response.data);
      setNomeResponsavel(response.data.nomeResponsavel || '');
    } catch (error) {
      console.error('Erro ao carregar dados da mesa:', error);
    }
  }, [mesaId]);

  // Helper: confirmação via Alert (usado apenas para remoção explícita)
  const confirmRemoveAlert = (itemName: string): Promise<boolean> => {
    if ((typeof window !== 'undefined') && (Platform as any)?.OS === 'web' && typeof (window as any).confirm === 'function') {
      const ok = (window as any).confirm(`Tem certeza que deseja remover ${itemName}?`);
      return Promise.resolve(ok);
    }

    // Mobile nativo: usar Alert.alert
    return new Promise((resolve) => {
      Alert.alert(
        'Confirmar Remoção',
        `Tem certeza que deseja remover ${itemName}?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Remover', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });
  };

  const loadComandaSale = useCallback(async () => {
    try {
      setLoading(true);
      const response = await comandaService.getById(vendaId as string);
      setSale(response.data);
      setCart(response.data.itens || []);
      setComanda(response.data);
    } catch (error) {
      console.error('Erro ao carregar comanda:', error);
      Alert.alert('Erro', 'Não foi possível carregar a comanda');
    } finally {
      setLoading(false);
    }
  }, [vendaId]);

  const createNewSale = useCallback(async () => {
    try {
      console.log('=== CRIANDO NOVA VENDA ===');
      console.log('User:', user);
      console.log('User ID:', user?._id);
      console.log('Mesa ID:', mesaId);
      console.log('Tipo:', tipo);

      if (!user || !user._id) {
        console.log('❌ Usuário não está logado');
        Alert.alert('Erro', 'Usuário não está logado');
        return;
      }

      const saleData = {
        funcionario: user._id,
        tipoVenda: tipo || 'mesa',
        ...(mesaId && { mesa: mesaId }),
        status: 'aberta',
        itens: [],
        total: 0
      };

      console.log('Dados da venda a serem enviados:', saleData);

      const response = await saleService.create(saleData);
      console.log('✅ Venda criada com sucesso:', response.data);
      
      setSale(response.data);
      setCart([]);
    } catch (error: any) {
      console.error('❌ Erro ao criar venda:', error);
      console.error('Detalhes do erro:', error.response?.data);
      const errMsg = ((error && (error as any)?.message) || 'Erro desconhecido');
      Alert.alert('Erro ao criar venda', `Detalhes: ${JSON.stringify(error?.response?.data || errMsg)}`);
    } finally {
      setLoading(false);
    }
  }, [user, mesaId, tipo]);

  const loadMesaSale = useCallback(async () => {
    try {
      setLoading(true);
      await loadMesaData();
      
      const response = await saleService.getByMesa(mesaId as string);
      if (response.data && response.data.length > 0) {
        // Pega SOMENTE a venda ativa (status 'aberta') em modo normal
        const activeSale = response.data.find((sale: Sale) => sale.status === 'aberta');
        if (activeSale) {
          setSale(activeSale);
          setCart(activeSale.itens || []);
        } else if (!isViewMode) {
          // Sem venda aberta: cria uma nova venda para evitar reutilizar itens antigos
          await createNewSale();
        } else {
          // Em modo visualização, permitir ver a última venda (mesmo finalizada)
          const lastSale = response.data[0];
          setSale(lastSale);
          setCart(lastSale.itens || []);
        }
      } else if (!isViewMode) {
        await createNewSale();
      }
    } catch (error) {
      console.error('Erro ao carregar venda da mesa:', error);
      if (!isViewMode) {
        createNewSale();
      }
    } finally {
      setLoading(false);
    }
  }, [mesaId, isViewMode, loadMesaData, createNewSale]);

  

  useEffect(() => {
    if (viewMode === 'view') {
      setIsViewMode(true);
      loadMesaSale();
    } else {
      setIsViewMode(false);
      
      if (vendaId) {
        if (tipo === 'comanda') {
          loadComandaSale();
        } else {
          loadSale();
        }
      } else if (mesaId) {
        loadMesaSale();
      } else {
        createNewSale();
      }
    }
  }, [viewMode, vendaId, mesaId, tipo, loadSale, loadComandaSale, loadMesaSale, createNewSale]);

  const addToCart = async (product: Product) => {
    if (!sale) {
      Alert.alert('Erro', 'Nenhuma venda ativa encontrada');
      return;
    }

    try {
      if ((product as any)?.possuiVariacaoTamanho) {
        if (!product.sizes || product.sizes.length === 0) {
           Alert.alert('Aviso', 'Produto requer tamanho, mas nenhum foi cadastrado.');
           return;
        }
        setSelectedProductForSize(product);
        setSizeSelectorVisible(true);
        return;
      }
      if ((product as any)?.temVariacao) {
        setVariationProduct(product);
        setVariationVisible(true);
        return;
      }
      // Adiciona o item no backend
      const itemData = {
        produtoId: parseInt(String((product as any)?._id ?? (product as any)?.id ?? 0), 10),
        quantidade: 1
      };
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(clientMode).toLowerCase() === 'tablet') {
        (itemData as any).origem = 'tablet';
      }
      
      console.log('Adicionando item ao carrinho:', itemData);
      const response = await saleService.addItem(sale._id, itemData);
      
      // Atualiza o estado local com os dados do backend
      setSale(response.data);
      setCart(response.data.itens || []);
      Alert.alert('Sucesso', `${product.nome} foi adicionado ao carrinho!`);
      

      try {
        const whatsTargets = Array.isArray(response?.data?.whatsTargets) ? response.data.whatsTargets : [];
        if (whatsTargets.length > 0) {
          const msg = `Pedido: ${product.nome} x1`;
          Alert.alert(
            'Enviar via WhatsApp',
            'Deseja enviar este pedido por WhatsApp ou imprimir?',
            [
              { text: 'Imprimir', style: 'default' },
              {
                text: 'WhatsApp',
                onPress: async () => {
                  try {
                    const phone = String(whatsTargets[0]).replace(/[^0-9+]/g, '');
                    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                    const can = await Linking.canOpenURL(url);
                    if (can) await Linking.openURL(url);
                    else Alert.alert('Erro', 'Não foi possível abrir o WhatsApp');
                  } catch {
                    Alert.alert('Erro', 'Falha ao abrir o WhatsApp');
                  }
                }
              }
            ]
          );
        }
      } catch {}
      
      console.log('Item adicionado com sucesso via backend');
      
    } catch (error: any) {
      console.error('Erro ao adicionar item no backend:', error);
      
      // Fallback: adiciona localmente se o backend falhar
      console.log('Adicionando item localmente como fallback');
      
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      const isTabletMode = String(clientMode).toLowerCase() === 'tablet';
      setCart(prevCart => {
        const exists = prevCart.find(item => item.produto && item.produto._id === product._id);
        if (exists) {
          return prevCart.map(item => {
            if (item.produto && item.produto._id === product._id) {
              const newQuantity = item.quantidade + 1;
              return {
                ...item,
                quantidade: newQuantity,
                subtotal: ((item.precoUnitario ?? item.produto?.preco ?? 0) * newQuantity)
              };
            }
            return item;
          });
        }
        const newItem: CartItem = {
          _id: `temp_${Date.now()}_${Math.random()}`,
          productId: parseInt(String((product as any)?._id ?? (product as any)?.id ?? 0), 10),
          produto: {
            _id: product._id,
            nome: product.nome,
            preco: product.precoVenda
          },
          nomeProduto: product.nome,
          quantidade: 1,
          precoUnitario: product.precoVenda,
          subtotal: product.precoVenda
        };
        return [...prevCart, newItem];
      });
      
      // Mostra feedback visual de que o item foi adicionado
      Alert.alert('Sucesso', `${product.nome} foi adicionado ao carrinho!`);
    }
  };

  const [selectedSizeForVariation, setSelectedSizeForVariation] = useState<any>(null);

  const confirmVariation = async (payload: any) => {
    try {
      if (!sale || !variationProduct) return;
      const itemData: any = {
        produtoId: parseInt(String((variationProduct as any)?._id ?? (variationProduct as any)?.id ?? 0), 10),
        quantidade: 1,
        variacao: payload,
      };
      
      // Se tiver tamanho selecionado previamente, inclui no payload
      if (selectedSizeForVariation) {
        itemData.tamanhoId = selectedSizeForVariation.id;
      }

      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(clientMode).toLowerCase() === 'tablet') itemData.origem = 'tablet';
      const response = await saleService.addItem(sale._id, itemData);
      setSale(response.data);
      setCart(response.data.itens || []);
      
      const sizeMsg = selectedSizeForVariation ? ` (${selectedSizeForVariation.nome})` : '';
      Alert.alert('Sucesso', `${variationProduct.nome}${sizeMsg} foi adicionado com variação!`);
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.error || 'Não foi possível adicionar com variação');
    } finally {
      setVariationVisible(false);
      setVariationProduct(null);
      setSelectedSizeForVariation(null);
    }
  };

  const handleSizeSelected = async (size: any) => {
    if (!sale || !selectedProductForSize) return;
    
    // VERIFICAÇÃO CRÍTICA: Se o produto TAMBÉM tem variação (meio a meio), 
    // não adiciona direto! Abre o modal de variação primeiro.
    if ((selectedProductForSize as any)?.temVariacao) {
      console.log('Product has size AND variation. Chaining to Variation Modal...');
      setSelectedSizeForVariation(size);
      setVariationProduct(selectedProductForSize);
      setVariationVisible(true);
      
      // Fecha o modal de tamanho e limpa o produto de seleção de tamanho
      setSizeSelectorVisible(false);
      setSelectedProductForSize(null);
      return;
    }

    const itemData: any = {
      produtoId: parseInt(String(selectedProductForSize._id || (selectedProductForSize as any).id), 10),
      quantidade: 1,
      tamanhoId: size.id
    };
    const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
    if (String(clientMode).toLowerCase() === 'tablet') itemData.origem = 'tablet';

    try {
       const response = await saleService.addItem(sale._id, itemData);
       setSale(response.data);
       setCart(response.data.itens || []);
       Alert.alert('Sucesso', `${selectedProductForSize.nome} (${size.nome}) adicionado!`);
    } catch (error: any) {
       console.error('Erro ao adicionar tamanho:', error);
       Alert.alert('Erro', error?.response?.data?.error || 'Falha ao adicionar produto.');
    } finally {
       setSizeSelectorVisible(false);
       setSelectedProductForSize(null);
    }
  };

  const confirmVariationWhole = async () => {
    try {
      if (!sale || !variationProduct) return;
      const itemData: any = {
        produtoId: parseInt(String((variationProduct as any)?._id ?? (variationProduct as any)?.id ?? 0), 10),
        quantidade: 1,
      };
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(clientMode).toLowerCase() === 'tablet') itemData.origem = 'tablet';
      const response = await saleService.addItem(sale._id, itemData);
      setSale(response.data);
      setCart(response.data.itens || []);
      Alert.alert('Sucesso', `${variationProduct.nome} foi adicionado inteiro!`);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível adicionar o produto.');
    } finally {
      setVariationVisible(false);
      setVariationProduct(null);
    }
  };

  // Atualização de item com UI otimista e sem alert no decremento
  const updateCartItem = async (item: CartItem, newQuantity: number) => {
    console.log('[Sale] updateCartItem', { itemId: item._id, from: item.quantidade, to: newQuantity });

    // Resolver produtoId de forma robusta
    const resolveProdutoId = (): string => {
      const pn = (item as any)?.productId;
      if (Number.isInteger(pn) && pn > 0) return String(pn);
      const raw = (item as any)?.produto;
      const pid = (raw && typeof raw === 'object' && raw?._id)
        || (typeof raw === 'string' ? raw : undefined)
        || (item as any)?.produtoId
        || (item as any)?.idProduto
        || '';
      const s = pid ? String(pid) : '';
      const digits = s.match(/\d+/)?.[0] || '';
      return digits;
    };

    let produtoId = resolveProdutoId();
    console.log('[Sale] produtoId resolvido', { produtoId });

    if (!sale) {
      Alert.alert('Erro', 'Venda não encontrada.');
      return;
    }

    if (!produtoId) {
      const fromItemProductId = (item as any)?.productId;
      if (Number.isInteger(fromItemProductId)) {
        produtoId = String(fromItemProductId);
      } else {
        const found = (sale?.itens || []).find((ci: any) =>
          String(ci?._id) === String(item?._id) ||
          String(ci?.id) === String((item as any)?.id) ||
          String(ci?.nomeProduto) === String(item?.nomeProduto)
        );
        const candidate = (found as any)?.productId || (found as any)?.produto?._id || '';
        const digits = String(candidate).match(/\d+/)?.[0] || '';
        if (digits) {
          produtoId = digits;
          console.log('[Sale] produtoId fallback (found)', { produtoId });
        }
      }
      if (!produtoId) {
        Alert.alert('Erro', 'Produto inválido para atualização.');
        return;
      }
    }

    if (sale?.status && sale.status !== 'aberta') {
      Alert.alert('Venda finalizada', 'Não é possível alterar itens desta venda.');
      return;
    }

    if (!/^[0-9]+$/.test(String(produtoId))) {
      const found = (sale?.itens || []).find((ci: any) => String(ci?._id) === String(item?._id));
      const raw = (found as any)?.produto;
      const fb = (raw && typeof raw === 'object' && raw?._id) || (typeof raw === 'string' ? raw : '');
      const digits = String(fb).match(/\d+/)?.[0] || '';
      if (digits) {
        produtoId = digits;
        console.log('[Sale] produtoId fallback', { produtoId });
      } else {
        Alert.alert('Erro', 'Produto inválido para atualização.');
        return;
      }
    }

    // Nunca permitir quantidade negativa
    const clampedQty = Math.max(0, Math.floor(Number(newQuantity) || 0));
    const currentCartItem = cart.find((ci) => ci._id === item._id) || item;
    const currentQty = Math.max(0, Math.floor(Number(currentCartItem.quantidade) || 0));
    const isIncrement = clampedQty > currentQty;
    const isDecrement = clampedQty < currentQty;

    // Snapshot do estado atual para possível reversão
    const prevCart = [...cart];

    const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
    const isTabletMode = String(clientMode).toLowerCase() === 'tablet';
    if (clampedQty <= 0) {
      setCart(prev => prev.filter(cartItem => cartItem._id !== item._id));
    } else if (!isTabletMode) {
      setCart(prev => prev.map(cartItem => {
        if (cartItem._id !== item._id) return cartItem;
        const unitPrice = cartItem.precoUnitario ?? cartItem.produto?.preco ?? (cartItem as any)?.produto?.precoVenda ?? 0;
        return {
          ...cartItem,
          quantidade: clampedQty,
          subtotal: unitPrice * clampedQty,
        };
      }));
    }

    let reqSeq = 0;
    try {
      const key = `${String((sale as any)?._id || (sale as any)?.id || '')}:${String(produtoId)}`;
      reqSeq = Date.now();
      latestReqRef.current.set(key, reqSeq);
      let response;
            if (isIncrement) {
              // Unificado: Incremento sempre atualiza a quantidade do item existente
              // Passamos itemId explicitamente para garantir que o backend atualize a linha correta
              const opts = { itemId: Number((item as any)?.id || (item as any)?._id) || undefined };
              
              if (tipo === 'comanda') {
                response = await comandaService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              } else {
                response = await saleService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              }
            } else if (clampedQty <= 0) {
              // Remover item
              console.log('[Sale] remove item', { produtoId });
              const opts = { itemId: Number((item as any)?.id || (item as any)?._id) || undefined };
              
              if (tipo === 'comanda') {
                response = await comandaService.removeItem(sale._id, parseInt(String(produtoId), 10), opts);
              } else {
                response = await saleService.removeItem(sale._id, parseInt(String(produtoId), 10), opts);
              }
            } else if (isDecrement) {
              // Decremento
              console.log('[Sale] decrement to', { quantidade: clampedQty });
              const opts = { itemId: Number((item as any)?.id || (item as any)?._id) || undefined };
              
              if (tipo === 'comanda') {
                response = await comandaService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              } else {
                response = await saleService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              }
            } else {
        // Quantidade igual (nenhuma mudança) ou ajuste direto: sincronizar para garantir consistência
        if (tipo === 'comanda') {
          response = await comandaService.getById(sale._id);
        } else {
          response = await saleService.getById(sale._id);
        }
      }

      // Sincronizar estado local com resposta do backend
      if (response?.data) {
        const latest = latestReqRef.current.get(key);
        if (latest !== reqSeq) {
          console.log('[Sale] resposta obsoleta ignorada', { key, reqSeq, latest });
          return;
        }
        setSale(response.data);
        setCart(response.data.itens || []);
        if (isIncrement) {
          Alert.alert('Sucesso', 'Quantidade incrementada');
        } else if (isDecrement) {
          Alert.alert('Sucesso', 'Quantidade decrementada');
        } else if (clampedQty <= 0) {
          Alert.alert('Sucesso', 'Item removido');
        }
        const updatedItems = response.data.itens || [];
        const updated = updatedItems.find((ci: any) => {
          const raw = (ci as any)?.produto;
          const id = (raw && typeof raw === 'object' && raw?._id) || (typeof raw === 'string' ? raw : '');
          return String(id) === String(produtoId) || String(ci?._id) === String(item?._id);
        });
        const updatedQty = Math.max(0, Math.floor(Number(updated?.quantidade) || 0));
        if (!updated || updatedQty !== clampedQty) {
          try {
            const refreshed = tipo === 'comanda'
              ? await comandaService.getById(sale._id)
              : await saleService.getById(sale._id);
            setSale(refreshed.data);
            setCart(refreshed.data.itens || []);
          } catch {}
        }
      }
    } catch (error: any) {
      const status = error?.response?.status ?? 0;
      const data = error?.response?.data;
      console.error('Erro ao atualizar item:', { status, data });
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível atualizar o item.');
      // Reverter UI para estado anterior
      try {
        const key = `${String((sale as any)?._id || (sale as any)?.id || '')}:${String(produtoId)}`;
        const latest = latestReqRef.current.get(key);
        if (latest === reqSeq) {
          setCart(prevCart);
        }
        const log = { ts: Date.now(), action: 'updateItem', produtoId, desiredQty: clampedQty, status, data };
        try {
          const prev = await AsyncStorage.getItem('SYNC_ERROR_LOG');
          const arr = prev ? JSON.parse(prev) : [];
          const next = Array.isArray(arr) ? [...arr.slice(-19), log] : [log];
          await AsyncStorage.setItem('SYNC_ERROR_LOG', JSON.stringify(next));
        } catch {}
      } catch {}
      // Tentar re-sincronizar com backend
      try {
        if (tipo === 'comanda') {
          const refreshed = await comandaService.getById(sale._id);
          setSale(refreshed.data);
          setCart(refreshed.data.itens || []);
        } else {
          const refreshed = await saleService.getById(sale._id);
          setSale(refreshed.data);
          setCart(refreshed.data.itens || []);
        }
      } catch {}
    }
  };

  const removeFromCart = async (item: CartItem) => {
    if (!sale || !item?.produto?._id) {
      Alert.alert('Erro', 'Venda não encontrada ou item inválido.');
      return;
    }

    const confirmed = await confirmRemoveAlert(`${item.nomeProduto} do carrinho`);
    if (!confirmed) return;

    const produtoId = item.produto._id;

    try {
      let response;
      if (tipo === 'comanda') {
        response = await comandaService.removeItem(sale._id, produtoId);
      } else {
        response = await saleService.removeItem(sale._id, produtoId);
      }

      if (response?.data) {
        setSale(response.data);
        setCart(response.data.itens || []);
      } else {
        setCart(prevCart => prevCart.filter(cartItem => cartItem._id !== item._id));
      }
    } catch (error: any) {
      console.error('Erro ao remover item:', error);
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível remover o item.');
    }
  };

  // Estado específico para loading do botão de finalizar
  const [finalizing, setFinalizing] = useState(false);

  const finalizeSale = async (options?: { silent?: boolean }) => {
    console.log('🔄 FINALIZAR VENDA - Iniciando processo');
    
    if (!sale || cart.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos um item à venda');
      return;
    }

    try {
      setFinalizing(true);
      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
      const finalizeData = {
        formaPagamento: paymentMethod,
        total: total
      };
      
      let response;
      if (tipo === 'comanda') {
        response = await comandaService.finalize(sale._id, finalizeData);
      } else {
        response = await saleService.finalize(sale._id, finalizeData);
      }
      
      // Limpar dados após finalização bem-sucedida
      setCart([]);
      setSale(null);
      setNomeResponsavel('');
      setMesa(null);
      setComanda(null);
      setModalVisible(false);

      // Disparar eventos de atualização para outras telas
      events.emit('caixa:refresh');
      events.emit('mesas:refresh');
      events.emit('comandas:refresh');

      if (options?.silent) {
        console.log('🔄 Finalização silenciosa: voltando imediatamente...');
        router.back();
      } else {
        // Navegação NÃO BLOQUEANTE (Fire and forget visual)
        console.log('🔄 Voltando para tela anterior imediatamente...');
        router.back();

        // Alerta não bloqueante
        if (Platform.OS === 'web') {
           setTimeout(() => window.alert('Venda finalizada com sucesso!'), 300);
        } else {
           // No mobile, router.back() desmonta a tela. 
           // O Alert pode não aparecer se a tela morrer, mas a navegação é prioritária.
           // Se quisermos garantir o alert no mobile, teríamos que esperar, mas o usuário pediu "mesmo comportamento" (rápido).
           // O comportamento "roxo" da mesa exibe alert e fecha.
           // Vamos tentar exibir o alert logo antes de sair, mas sem callback bloqueante.
           Alert.alert('Sucesso', 'Venda finalizada com sucesso!');
        }
      }
      
    } catch (error: any) {
      console.error('❌ ERRO DETALHADO ao finalizar venda:', error);
      
      let errorMessage = 'Não foi possível finalizar a venda';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else {
        const errMsg = (error && (error as any)?.message) || '';
        if (errMsg) errorMessage = errMsg;
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setFinalizing(false);
    }
  };

  const formatMesaNumero = (numero: number | undefined | null) => {
    if (numero === undefined || numero === null) {
      return '00';
    }
    return numero.toString().padStart(2, '0');
  };

  const totalItems = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalPaid = (sale as any)?.caixaVendas?.reduce((sum: number, cv: any) => sum + Number(cv.valor), 0) || 0;
  const totalRemaining = Math.max(0, totalItems - totalPaid);
  const isFullyPaid = totalItems > 0 && totalRemaining <= 0.01;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenIdentifier screenName="Nova Venda" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isViewMode ? 'Visualizar Venda' : 'Nova Venda'}
          </Text>
          {mesa && (
            <Text style={styles.headerSubtitle}>
              Mesa {formatMesaNumero(mesa.numero)} {nomeResponsavel && `- ${nomeResponsavel}`}
            </Text>
          )}
          {sale && tipo === 'comanda' && comanda && (
             <Text style={styles.headerSubtitle}>
               Comanda: {comanda.nomeComanda || comanda.numeroComanda || 'Sem nome'}
             </Text>
           )}
        </View>
        
        <View style={styles.headerRight}>
          {isPhone && !isViewMode && cart.length > 0 && (
            <TouchableOpacity onPress={() => setItemsModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="list" size={18} color="#fff" />
              <Text style={styles.headerRightButtonText}>Ver itens</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <AddProductToTable
        saleItems={isPhone ? [] : cart}
        onAddProduct={addToCart}
        onUpdateItem={(item, newQty) => { updateCartItem(item, newQty); }}
        onRemoveItem={removeFromCart}
        isViewMode={isViewMode}
        hideSaleSection={isPhone}
      />

      {isPhone && (
        <SaleItemsModal
          visible={itemsModalVisible}
          items={cart}
          total={totalItems}
          onClose={() => setItemsModalVisible(false)}
          onAddItems={() => setItemsModalVisible(false)}
          onIncrementItem={(item) => updateCartItem(item, item.quantidade + 1)}
          onDecrementItem={(item) => {
            const nextQty = Math.max((item?.quantidade ?? 0) - 1, 0);
            const msg = nextQty <= 0
              ? `Zerar quantidade e remover ${item?.nomeProduto}?`
              : `Diminuir quantidade de ${item?.nomeProduto}?`;
            if ((typeof window !== 'undefined') && (Platform as any)?.OS === 'web' && typeof (window as any).confirm === 'function') {
              const ok = (window as any).confirm(msg);
              if (ok) updateCartItem(item, nextQty);
            } else {
              Alert.alert(
                'Confirmar',
                msg,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'OK', style: 'destructive', onPress: () => updateCartItem(item, nextQty) },
                ]
              );
            }
          }}
          onRemoveItem={removeFromCart}
        />
      )}

      <VariationSelectorModal
        visible={variationVisible}
        product={variationProduct as any}
        onClose={() => { setVariationVisible(false); setVariationProduct(null); setSelectedSizeForVariation(null); }}
        onConfirm={confirmVariation}
        onConfirmWhole={confirmVariationWhole}
        selectedSize={selectedSizeForVariation}
      />

      {!isViewMode && cart.length > 0 && (
        <TouchableOpacity
          style={[styles.finalizeButton, cart.length === 0 && styles.finalizeButtonDisabled]}
          onPress={() => {
            console.log('🔥 BOTÃO FINALIZAR CLICADO!');
            console.log('📊 Estado do carrinho:', cart.length);
            console.log('💰 Total:', totalRemaining);
            setModalVisible(true);
          }}
          disabled={cart.length === 0}
        >
          <Text style={styles.finalizeButtonText}>
            Finalizar Venda - R$ {totalRemaining.toFixed(2)}
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >

        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finalizar Venda</Text>
            <Text style={styles.modalSubtitle}>Total: R$ {totalItems.toFixed(2)}</Text>
            {totalPaid > 0 && (
              <>
                <Text style={[styles.modalSubtitle, { color: '#4CAF50', marginTop: -20 }]}>Pago: R$ {totalPaid.toFixed(2)}</Text>
                <Text style={[styles.modalSubtitle, { color: '#F44336', marginTop: -20 }]}>Falta: R$ {totalRemaining.toFixed(2)}</Text>
              </>
            )}
            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: '#FF9800', marginBottom: 20, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
              onPress={() => {
                setModalVisible(false);
                setSplitModalVisible(true);
              }}
            >
              <Ionicons name="people" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Dividir / Parcial</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Método de Pagamento (Restante):</Text>
            {paymentMethods.map(method => (
              <TouchableOpacity
                key={method.key}
                style={[
                  styles.paymentOption,
                  paymentMethod === method.key && styles.paymentOptionSelected
                ]}
                onPress={() => setPaymentMethod(method.key)}
              >
                <Ionicons 
                  name={method.icon} 
                  size={20} 
                  color={paymentMethod === method.key ? '#2196F3' : '#666'} 
                />
                <Text style={[
                  styles.paymentOptionText,
                  paymentMethod === method.key && styles.paymentOptionTextSelected
                ]}>
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              {totalRemaining > 0.05 && (
                <Text style={{ textAlign: 'center', color: '#F44336', marginBottom: 10, width: '100%' }}>
                  Para finalizar, o saldo deve ser zero. Realize o pagamento pelo botão "Dividir / Parcial".
                </Text>
              )}
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.confirmButton,
                  // Se faltar pagar (totalRemaining > 0.05), o botão fica cinza e desabilitado
                  // Se já estiver pago (totalRemaining <= 0.05), o botão fica verde e habilitado para FINALIZAR
                  totalRemaining > 0.05 && { backgroundColor: '#ccc' }
                ]}
                disabled={totalRemaining > 0.05}
                onPress={() => {
                  console.log('🔥 BOTÃO CONFIRMAR CLICADO!');
                  
                  // Se já está pago, apenas finaliza
                  if (totalRemaining <= 0.05) {
                     console.log('✅ Tudo pago. Finalizando venda...');
                     finalizeSale();
                     return;
                  }

                  // Código inalcançável se o botão estiver disabled, mas por segurança:
                  console.log('💰 Total restante:', totalRemaining);
                }}
              >
                <Text style={styles.confirmButtonText}>
                  {totalRemaining <= 0.05 ? 'Finalizar Venda' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      <PaymentSplitModal
        visible={splitModalVisible}
        sale={sale}
        onClose={() => setSplitModalVisible(false)}
        onPaymentSuccess={(isFullPayment) => {
           // Recarregar venda sempre para garantir consistência visual imediata
           if (vendaId) {
             if (tipo === 'comanda') loadComandaSale(); else loadSale();
           } else if (mesaId) {
             loadMesaSale();
           }

           // Se quitou tudo, finaliza a venda (fecha status e volta)
           if (isFullPayment) {
             // Força o fechamento do modal antes de prosseguir
             setSplitModalVisible(false);
             
             // Chama finalização, mas garantimos a navegação aqui também caso a função falhe silenciosamente
             finalizeSale({ silent: true }).then(() => {
                // Failsafe de navegação: se ainda estiver montado, voltar.
                router.back();
             });
           }
        }}
      />
      <Modal visible={sizeSelectorVisible} transparent animationType="slide" onRequestClose={() => setSizeSelectorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Selecione o Tamanho</Text>
            <Text style={[styles.modalSubtitle, { marginBottom: 10 }]}>{selectedProductForSize?.nome}</Text>
            
            <View>
              {selectedProductForSize?.sizes?.map((size) => (
                <TouchableOpacity 
                   key={size.id} 
                   style={[styles.paymentOption, { justifyContent: 'space-between' }]}
                   onPress={() => handleSizeSelected(size)}
                >
                   <Text style={{ fontSize: 16 }}>{size.nome}</Text>
                   <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#4CAF50' }}>
                     R$ {Number(size.preco).toFixed(2)}
                   </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setSizeSelectorVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  finalizeButton: {
    backgroundColor: '#4CAF50',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  finalizeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finalizeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  paymentOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#f0f8ff',
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  paymentOptionTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  headerRightButton: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerRightButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

