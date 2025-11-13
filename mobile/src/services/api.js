import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, NativeModules } from 'react-native';
import { getSecureItem, STORAGE_KEYS } from './storage';
import { attach, getConfig } from 'retry-axios';

// Hosts locais que devem ser evitados em produção/dispositivos móveis
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const getEnvBaseUrl = () => {
  try {
    return typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : undefined;
  } catch {
    return undefined;
  }
};

// Helper para detectar URLs locais inválidas em dispositivos
function isLocalUrl(url) {
  try {
    const u = new URL(String(url));
    return LOCAL_HOSTNAMES.has(u.hostname);
  } catch {
    return false;
  }
}

// Resolve dinamicamente a URL base da API
function resolveApiBaseUrl() {
  const DEFAULT_PORT = 4000;

  // Prioridade absoluta para variável de ambiente, se existir
  const ENV_URL = getEnvBaseUrl();
  if (ENV_URL) return ENV_URL;

  // Ambiente Web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:${DEFAULT_PORT}/api`;
  }

  // Expo Go / Native: múltiplos fallbacks
  const expoHost = Constants?.expoGo?.developer?.host;
  const manifestHost = Constants?.manifest?.debuggerHost;
  const configHostUri = Constants?.expoConfig?.hostUri;
  // Adicionar host do bundle JS (React Native) como fallback confiável
  let bundleHost = '';
  try {
    const scriptUrl = NativeModules?.SourceCode?.scriptURL;
    if (scriptUrl) {
      const parsed = new URL(String(scriptUrl));
      bundleHost = parsed.hostname;
    }
  } catch {}

  const hostCandidates = [bundleHost, expoHost, manifestHost, configHostUri].filter(Boolean);

  for (const h of hostCandidates) {
    const hostPart = String(h).split(':')[0];
    if (hostPart && !LOCAL_HOSTNAMES.has(hostPart)) {
      return `http://${hostPart}:${DEFAULT_PORT}/api`;
    }
  }

  // Fallback final: manter vazio para evitar localhost/127.0.0.1
  try {
    const envPackagerHost = (typeof process !== 'undefined' ? process.env?.REACT_NATIVE_PACKAGER_HOSTNAME : '') || '';
    if (envPackagerHost && !LOCAL_HOSTNAMES.has(envPackagerHost)) {
      return `http://${envPackagerHost}:${DEFAULT_PORT}/api`;
    }
  } catch {}
  // Fallback final para ambiente nativo
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}/api`;
  }
  return `http://localhost:${DEFAULT_PORT}/api`;
}

// Primeiro: variável de ambiente pública
const ENV_BASE_URL = getEnvBaseUrl();

// Segundo: override salvo em storage
let initialBaseUrl = ENV_BASE_URL || resolveApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 7000;

const api = axios.create({
  baseURL: initialBaseUrl || '',
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// Configurar retry-axios na instância
api.defaults.raxConfig = {
  instance: api,
  retry: 3,
  noResponseRetries: 2,
  backoffType: 'exponential',
  httpMethodsToRetry: ['GET', 'HEAD', 'OPTIONS', 'DELETE', 'PUT', 'POST'],
  statusCodesToRetry: [[100, 199], [429, 429], [500, 599]],
  onRetryAttempt: (err) => {
    const cfg = getConfig(err);
    console.log(`🔁 Retry #${cfg?.currentRetryAttempt} para:`, err?.config?.url);
  },
};
attach(api);

// Mapa para cancelamentos de operações concorrentes (add/update/remove item)
const inFlightMap = new Map();
function startCancelableOp(key) {
  const prev = inFlightMap.get(key);
  if (prev) {
    try { prev.abort(); } catch {}
    inFlightMap.delete(key);
  }
  const controller = new AbortController();
  inFlightMap.set(key, controller);
  return controller;
}
function endCancelableOp(key) {
  inFlightMap.delete(key);
}

// Interceptor para adicionar token e permitir override dinâmico de baseURL
api.interceptors.request.use(
  async (config) => {
    try {
      // Override de baseURL via AsyncStorage (opcional)
      const storedBaseUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
      if (storedBaseUrl) {
        const isLocal = isLocalUrl(storedBaseUrl);
        if (isLocal && Platform.OS !== 'web') {
          await AsyncStorage.removeItem(STORAGE_KEYS.API_BASE_URL);
        } else {
          config.baseURL = storedBaseUrl;
        }
      } else if (ENV_BASE_URL) {
        config.baseURL = ENV_BASE_URL;
      }

      if (!config.baseURL) {
        const fallback = api.defaults.baseURL || initialBaseUrl || resolveApiBaseUrl();
        config.baseURL = fallback;
      }

      // Timeout configurável
      const savedTimeoutStr = await AsyncStorage.getItem(STORAGE_KEYS.API_TIMEOUT_MS);
      const savedTimeout = savedTimeoutStr ? parseInt(savedTimeoutStr, 10) : NaN;
      if (!isNaN(savedTimeout) && savedTimeout > 0) {
        config.timeout = savedTimeout;
      }

      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const apiKey = await getSecureItem(STORAGE_KEYS.API_AUTH_KEY);
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }

      // Log mínimo de cada requisição para depuração de endpoints desconhecidos
      try {
        const base = config.baseURL || api.defaults.baseURL || '';
        const fullUrl = String(base).replace(/\/$/, '') + String(config.url || '');
        const method = (config.method || 'GET').toUpperCase();
        console.log(`➡️  ${method} ${fullUrl}`);
      } catch {}
    } catch (error) {
      console.error('Erro no request interceptor:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta para logar erros/timeout e facilitar rastreamento
api.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const cfg = error?.config || {};
      const base = cfg.baseURL || api.defaults.baseURL || '';
      const fullUrl = String(base).replace(/\/$/, '') + String(cfg.url || '');
      const method = (cfg.method || 'GET').toUpperCase();
      const status = error?.response?.status;
      const code = error?.code;
      const isTimeout = code === 'ECONNABORTED' || /timeout/i.test(error?.message || '');
      console.warn(`⚠️  Erro API ${method} ${fullUrl} | status=${status ?? 'N/A'} | timeout=${isTimeout ? 'sim' : 'não'}`);
    } catch {}
    return Promise.reject(error);
  }
);

// Inicialização assíncrona para aplicar override salvo assim que o app inicia
  (async () => {
    try {
      const storedBaseUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
      if (storedBaseUrl) {
        const isLocal = isLocalUrl(storedBaseUrl);
        if (isLocal && Platform.OS !== 'web') {
          await AsyncStorage.removeItem(STORAGE_KEYS.API_BASE_URL);
          if (ENV_BASE_URL) {
            initialBaseUrl = ENV_BASE_URL;
            api.defaults.baseURL = ENV_BASE_URL;
          }
        } else {
          initialBaseUrl = storedBaseUrl;
          api.defaults.baseURL = storedBaseUrl;
        }
    } else if (ENV_BASE_URL) {
      initialBaseUrl = ENV_BASE_URL;
      api.defaults.baseURL = ENV_BASE_URL;
    } else {
      const next = resolveApiBaseUrl();
      initialBaseUrl = next;
      api.defaults.baseURL = next;
    }

    // Aplicar timeout salvo, se existir
    const savedTimeoutStr = await AsyncStorage.getItem(STORAGE_KEYS.API_TIMEOUT_MS);
    const savedTimeout = savedTimeoutStr ? parseInt(savedTimeoutStr, 10) : NaN;
    if (!isNaN(savedTimeout) && savedTimeout > 0) {
      api.defaults.timeout = savedTimeout;
    }
    } catch {
      // silencioso
    }
  })();

// Helper: persistir override no storage (para ajustes via tela de Configurações)
export async function setApiBaseUrl(url) {
  await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, url);
  initialBaseUrl = url;
  api.defaults.baseURL = url;
}

// Permite limpar rapidamente o override salvo da baseURL
export async function clearApiBaseUrl() {
  await AsyncStorage.removeItem(STORAGE_KEYS.API_BASE_URL);
  const next = ENV_BASE_URL || resolveApiBaseUrl();
  initialBaseUrl = next;
  api.defaults.baseURL = next;
}

export async function setApiTimeoutMs(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return false;
  await AsyncStorage.setItem(STORAGE_KEYS.API_TIMEOUT_MS, String(value));
  api.defaults.timeout = value;
  return true;
}

export async function getApiTimeoutMs() {
  const savedTimeoutStr = await AsyncStorage.getItem(STORAGE_KEYS.API_TIMEOUT_MS);
  const savedTimeout = savedTimeoutStr ? parseInt(savedTimeoutStr, 10) : NaN;
  return !isNaN(savedTimeout) && savedTimeout > 0 ? savedTimeout : api.defaults.timeout;
}

// Adicionado: função de teste de conexão da API usada pela tela de Configurações
export async function testApiConnection(baseUrl, apiKey) {
  try {
    const baseCandidate = baseUrl || ENV_BASE_URL || initialBaseUrl || '';
    const effectiveBase = String(baseCandidate).replace(/\/$/, '');
    const url = `${effectiveBase}/tipo/list`;
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
    });
    return { ok: true, status: res.status };
  } catch (error) {
    const status = error?.response?.status ?? 0;
    const reason = error?.response?.data ?? error?.message ?? 'Erro desconhecido';
    return { ok: false, status, reason };
  }
}

export const API_URL = initialBaseUrl;
export default api;

// Serviços específicos (restaurados)
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
};

export const employeeService = {
  getAll: () => api.get('/employee/list'),
  getById: (id) => api.get(`/employee/${id}`),
  create: (data) => api.post('/employee/create', data),
  update: (id, data) => api.put(`/employee/${id}`, data),
  delete: (id) => api.delete(`/employee/${id}`),
};

export const customerService = {
  getAll: () => api.get('/customer/list'),
  getById: (id) => api.get(`/customer/${id}`),
  create: (data) => api.post('/customer/create', data),
  update: (id, data) => api.put(`/customer/${id}`, data),
  delete: (id) => api.delete(`/customer/${id}`),
};

export const productService = {
  list: () => api.get('/product/list'),
  getAll: () => api.get('/product/list'),
  getById: (id) => api.get(`/product/${id}`),
  create: (data) => api.post('/product/create', data),
  update: (id, data) => api.put(`/product/${id}`, data),
  delete: (id) => api.delete(`/product/${id}`),
  getUsedCategories: () => api.get('/product/categories/used'),
  getUsedTypes: () => api.get('/product/types/used'),
  getUsedGroups: () => api.get('/product/groups/used'),
};

export const categoryService = {
  list: () => api.get('/categoria/list'),
  getAll: async () => (await api.get('/categoria/list')).data,
  getById: (id) => api.get(`/categoria/${id}`),
  create: (data) => api.post('/categoria/create', data),
  update: (id, data) => api.put(`/categoria/update/${id}`, data),
  delete: (id) => api.delete(`/categoria/delete/${id}`),
};

export const categoriaService = {
  list: () => api.get('/categoria/list'),
};

export const tipoService = {
  list: () => api.get('/tipo/list'),
  getAll: async () => (await api.get('/tipo/list')).data,
  getById: (id) => api.get(`/tipo/${id}`),
  create: (data) => api.post('/tipo/create', data),
  update: (id, data) => api.put(`/tipo/update/${id}`, data),
  delete: (id) => api.delete(`/tipo/delete/${id}`),
};

// Alias para compatibilidade com importações existentes
export const typeService = tipoService;

export const unidadeMedidaService = {
  list: () => api.get('/unidade-medida/list'),
  getAll: async () => (await api.get('/unidade-medida/list')).data,
  create: (data) => api.post('/unidade-medida/create', data),
  update: (id, data) => api.put(`/unidade-medida/update/${id}`, data),
  delete: (id) => api.delete(`/unidade-medida/delete/${id}`),
};

export const saleService = {
  create: (data) => api.post('/sale/create', data),
  addItem: (id, item) => api.post(`/sale/${id}/item`, item),
  removeItem: (id, produtoId) => api.delete(`/sale/${id}/item/${produtoId}`),
  updateItemQuantity: (id, produtoId, quantidade) => api.put(`/sale/${id}/item/${produtoId}`, { quantidade }),
  finalize: (id, payload) => {
    const body = typeof payload === 'string'
      ? { formaPagamento: payload }
      : payload && payload.metodoPagamento
        ? { formaPagamento: payload.metodoPagamento }
        : { formaPagamento: payload?.formaPagamento || 'dinheiro' };
    return api.put(`/sale/${id}/finalize`, body);
  },
  open: () => api.get('/sale/open'),
  list: (params) => api.get('/sale/list', { params }),
  getAll: () => api.get('/sale/list'),
  getById: (id) => api.get(`/sale/${id}`),
  getByMesa: (mesaId) => api.get(`/sale/mesa/${mesaId}`),
};

export const mesaService = {
  list: () => api.get('/mesa/list'),
  getAll: () => api.get('/mesa/list'),
  getById: (id) => api.get(`/mesa/${id}`),
  create: (data) => api.post('/mesa/create', data),
  update: (id, data) => api.put(`/mesa/${id}`, data),
  delete: (id) => api.delete(`/mesa/${id}`),
  abrir: (id, funcionarioId, nomeResponsavel, observacoes) => 
    api.post(`/mesa/${id}/abrir`, { funcionarioId, nomeResponsavel, observacoes }),
  fechar: (id) => api.post(`/mesa/${id}/fechar`),
};

export const comandaService = {
  getAll: () => api.get('/sale/list'),
  // Criação de comanda (usa mesma rota de criação de venda)
  create: (data) => saleService.create(data),
  // Buscar comanda específica por ID (usa endpoint de sale)
  getById: (id) => api.get(`/sale/${id}`),
  // Adicionar item na comanda (mapeia para rota de venda)
  addItem: (id, item) => saleService.addItem(id, item),
  // Remover item da comanda (mapeia para rota de venda)
  removeItem: (id, produtoId) => saleService.removeItem(id, produtoId),
  // Atualizar quantidade de item na comanda
  updateItemQuantity: (id, produtoId, quantidade) => api.put(`/sale/${id}/item/${produtoId}`, { quantidade }),
  // Finalizar/fechar comanda (reaproveita a mesma rota de finalizar venda)
  finalize: (id, payload) => saleService.finalize(id, payload),
  // Fechar comanda com pagamento padrão 'dinheiro'
  close: (id) => saleService.finalize(id, 'dinheiro'),
};

export const caixaService = {
  statusAberto: () => api.get('/caixa/status/aberto'),
  abrir: (funcionarioId, valorAbertura = 0, observacoes = '') => 
    api.post('/caixa/abrir', { funcionarioId, valorAbertura, observacoes }),
  fechar: (id, funcionarioId, valorFechamento, observacoes = '') => 
    api.put(`/caixa/${id}/fechar`, { funcionarioId, valorFechamento, observacoes }),
  registrarVenda: (vendaId, valor, formaPagamento) => 
    api.post('/caixa/registrar-venda', { vendaId, valor, formaPagamento }),
};

export const userService = {
  list: () => api.get('/user/list'),
  getAll: async () => (await api.get('/user/list')).data,
  getById: (id) => api.get(`/user/${id}`),
  create: (data) => api.post('/user/create', data),
  update: (id, data) => api.put(`/user/${id}`, data),
  updatePermissions: (id, permissoes) => api.put(`/user/${id}/permissions`, { permissoes }),
  updateStatus: (id, ativo) => api.put(`/user/${id}/status`, { ativo }),
  delete: (id) => api.delete(`/user/${id}`),
};