import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  NativeModules,
  Modal,
} from 'react-native';
// import removido: Ionicons não é necessário, usamos SafeIcon
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { SafeIcon } from '../components/SafeIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setApiBaseUrl, testApiConnection, switchServerDbTarget } from '../src/services/api';
import { STORAGE_KEYS } from '../src/services/storage';
import Constants from 'expo-constants';
import { events } from '../src/utils/eventBus';

export default function LoginScreen() {
  const [email, setEmail] = useState('admin@barapp.com');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, clearAllStorage } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const ignoreStorageInitRef = useRef(false);

  // Estado para seleção e teste da base da API
  const [dbOption, setDbOption] = useState<'lan' | 'railway' | 'custom' | ''>('lan');
  const [apiUrl, setApiUrl] = useState('');

  // Tentativa automática de conexão LAN ao selecionar/estar em 'lan'
  const autoLanAttemptedRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (autoLanAttemptedRef.current) return;
      autoLanAttemptedRef.current = true;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
        const storedTarget = await AsyncStorage.getItem(STORAGE_KEYS.DB_TARGET);
        const envUrl = (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_URL : '') || '';
        let initial = stored || envUrl || '';
        if (initial && isLocalHost(initial)) {
          initial = '';
        }
        if (initial) {
          setApiUrl(initial);
          const fromStored = Boolean(stored);
          setDbOption(initial.includes('railway.app') ? 'railway' : (fromStored ? 'custom' : 'lan'));
          setBaseStatus('testing');
          setBaseMessage('Testando base...');
          if (storedTarget === 'railway' || storedTarget === 'local') {
            try { await switchServerDbTarget(initial, storedTarget as any); } catch {}
          }
          const res = await retryTestApi(initial, 8, 1500);
          if (res.ok) {
            setBaseStatus('ok');
            const dbTarget = res?.data?.dbTarget || (initial.includes('railway') ? 'railway' : 'local');
            const host = new URL(initial).hostname;
            setActiveDbLabel(`API • ${host} | DB • ${String(dbTarget).toUpperCase()}`);
            setBaseMessage(`Sucesso: Conexão validada! API: ${host} • DB: ${String(dbTarget).toUpperCase()}`);
            setShowDbModal(false);
          } else {
            setBaseStatus('error');
            setBaseMessage(`Falha ao conectar (status ${res.status || 'N/A'})`);
            setDbOption('lan');
            setShowDbModal(true);
          }
        } else {
          // Nenhuma base válida em storage: abrir modal já com LAN pré-selecionado
          setDbOption('lan');
          setShowDbModal(true);
        }
      } catch {
        setDbOption('lan');
        setShowDbModal(true);
      }
    })();
  }, []);
  const [baseStatus, setBaseStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [baseMessage, setBaseMessage] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [activeDbLabel, setActiveDbLabel] = useState('');

  // (removido bloco duplicado de inicialização para evitar conflito de estado)

  // Detecta automaticamente o IP/host da LAN do Metro e monta a URL da API
  const getLanBaseUrl = (): string => {
    const DEFAULT_PORT = 4000;
    try {
      const candidates: string[] = [];
      // Host do bundle JS (mais confiável)
      const scriptUrl = (NativeModules as any)?.SourceCode?.scriptURL;
      if (scriptUrl) {
        const parsed = new URL(String(scriptUrl));
        if (parsed.hostname) candidates.push(parsed.hostname);
      }
      // expoGo developer host, expoConfig.hostUri e manifest.debuggerHost como fallbacks
      const devHost = (Constants as any)?.expoGo?.developer?.host;
      if (devHost) candidates.push(String(devHost).split(':')[0]);
      const hostUri = (Constants as any)?.expoConfig?.hostUri;
      if (hostUri) candidates.push(String(hostUri).split(':')[0]);
      const dbgHost = (Constants as any)?.manifest?.debuggerHost;
      if (dbgHost) candidates.push(String(dbgHost).split(':')[0]);
      // REACT_NATIVE_PACKAGER_HOSTNAME como último fallback
      const envPackagerHost = (typeof process !== 'undefined' ? (process as any)?.env?.REACT_NATIVE_PACKAGER_HOSTNAME : '') || '';
      if (envPackagerHost) candidates.push(envPackagerHost);

      for (const h of candidates) {
        const host = String(h);
        if (host && !['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) {
          return `http://${host}:${DEFAULT_PORT}/api`;
        }
      }
    } catch {}
    return '';
  };

  // URL da API para ambiente Railway a partir do .env (EXPO_PUBLIC_API_URL_RAILWAY) ou heurística
  const getRailwayApiUrl = (): string => {
    try {
      const envRail = typeof process !== 'undefined' ? (process as any)?.env?.EXPO_PUBLIC_API_URL_RAILWAY : '';
      if (envRail && !isLocalHost(envRail)) return envRail;
      const envUrl = typeof process !== 'undefined' ? (process as any)?.env?.EXPO_PUBLIC_API_URL : '';
      // Se o ENV padrão já aponta para um domínio público (loca.lt/railway), reutilize
      if (envUrl && /loca\.lt|railway\.app|rlwy\.net/i.test(envUrl) && !isLocalHost(envUrl)) return envUrl;
    } catch {}
    return '';
  };

  const handleSelectLanAuto = async () => {
    try {
      setDbOption('lan');
      setSaveLoading(true);
      setBaseStatus('testing');
      setBaseMessage('Preparando base LOCAL (usando ENV se disponível)...');

      // Preferir ENV da URL da API; fallback para detecção de LAN
      let autoUrl = '';
      try {
        const envUrl = typeof process !== 'undefined' ? (process as any)?.env?.EXPO_PUBLIC_API_URL : '';
        if (envUrl && !isLocalHost(envUrl)) autoUrl = envUrl;
      } catch {}
      if (!autoUrl) autoUrl = getLanBaseUrl();
      if (!autoUrl || isLocalHost(autoUrl)) {
        Alert.alert('Erro', 'Não foi possível detectar IP da LAN. Inicie com npx expo start --host lan e tente novamente.');
        setBaseStatus('error');
        setBaseMessage('Falha ao detectar IP da LAN.');
        return;
      }

      // Persistir URL da API local
      setApiUrl(autoUrl);
      await setApiBaseUrl(autoUrl);

      // Alternar explicitamente o servidor para DB_TARGET=local antes de validar
      setBaseMessage('Alternando servidor para DB • LOCAL...');
      const switched = await switchServerDbTarget(autoUrl, 'local');
      if (!switched.ok) {
        setBaseStatus('error');
        const reason = String(switched.reason || 'Falha ao alternar DB para LOCAL');
        setBaseMessage(reason);
        Alert.alert('Erro', reason);
        return;
      }

      // Validar saúde com tentativas/backoff
      const res = await retryTestApi(autoUrl, 8, 1000);
      const apiHost = new URL(autoUrl).hostname;
      if (res.ok) {
        const detectedDbTarget = String(res?.data?.dbTarget || 'local').toUpperCase();
        setBaseStatus('ok');
        setActiveDbLabel(`API • ${apiHost} | DB • ${detectedDbTarget}`);
        await AsyncStorage.setItem(STORAGE_KEYS.DB_TARGET, 'local');
        events.emit('dbTargetChanged', 'local');
        setBaseMessage(`Sucesso: API • ${apiHost} | DB • ${detectedDbTarget}`);
        Alert.alert('Sucesso', 'Conexão local validada e DB • LOCAL ativo!');
        // manter modal aberto para o usuário visualizar status
      } else {
        setBaseStatus('error');
        setBaseMessage(`Falha ao conectar (status ${res.status || 'N/A'})`);
        Alert.alert('Erro', `Falha ao conectar (status ${res.status || 'N/A'})`);
      }
    } catch (e) {
      setBaseStatus('error');
      setBaseMessage('Erro inesperado ao conectar via LAN.');
      Alert.alert('Erro', 'Erro inesperado ao conectar via LAN.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleQuickSelect = async (option: 'lan' | 'railway' | 'custom') => {
    try {
      if (option === 'lan') {
        setDbOption('lan');
        const detected = getLanBaseUrl();
        if (detected && !isLocalHost(detected)) {
          setApiUrl(detected);
          setBaseStatus('idle');
          setBaseMessage('LAN detectada. Toque em "Salvar e Testar" para aplicar.');
        } else {
          setBaseStatus('error');
          setBaseMessage('Falha ao detectar LAN. Informe a URL ou tente novamente.');
        }
        return;
      }
      if (option === 'railway') {
        setDbOption('railway');
        setBaseStatus('idle');
        setBaseMessage('Selecionar DB • RAILWAY. Toque em "Salvar e Testar" para aplicar.');
        return;
      }
      if (option === 'custom') {
        setDbOption('custom');
        setShowDbModal(true);
        return;
      }
    } catch (e) {
      setBaseStatus('error');
      Alert.alert('Erro', 'Erro inesperado ao selecionar base.');
    }
  };

  const handleSaveAndTest = async () => {
    try {
      if (!dbOption) {
        Alert.alert('Seleção obrigatória', 'Escolha uma opção de base antes de salvar: Local (LAN), API Pública ou URL Personalizada.');
        return;
      }

      setSaveLoading(true);
      setBaseStatus('testing');
      setBaseMessage('Salvando URL e testando conexão...');

      let targetUrl = apiUrl?.trim();
      if (dbOption === 'lan') {
        const envUrl = typeof process !== 'undefined' ? (process as any)?.env?.EXPO_PUBLIC_API_URL : '';
        let autoUrl = envUrl;
        if (!autoUrl || isLocalHost(autoUrl)) {
          const detected = getLanBaseUrl();
          if (!detected || isLocalHost(detected)) {
            Alert.alert('Erro', 'Não foi possível detectar IP da LAN. Inicie com npx expo start --host lan e tente novamente.');
            return;
          }
          autoUrl = detected;
        }
        targetUrl = autoUrl;
        setApiUrl(autoUrl);
      } else if (dbOption === 'railway') {
        // Priorizar URL pública da API Railway; fallback para ENV padrão e LAN
        let autoUrl = getRailwayApiUrl();
        if (!autoUrl || isLocalHost(autoUrl)) {
          const envUrl = typeof process !== 'undefined' ? (process as any)?.env?.EXPO_PUBLIC_API_URL : '';
          autoUrl = envUrl && !isLocalHost(envUrl) ? envUrl : getLanBaseUrl();
        }
        if (!autoUrl || isLocalHost(autoUrl)) {
          Alert.alert('Erro', 'Não foi possível determinar URL da API Railway nem IP da LAN.');
          return;
        }
        targetUrl = autoUrl;
        setApiUrl(autoUrl);
      } else {
        if (!targetUrl) {
          const placeholder = 'http://192.168.x.x:4000/api';
          Alert.alert('Erro', `Informe a URL da API (${placeholder}).`);
          return;
        }
      }

      try {
        const u = new URL(String(targetUrl));
        if (!/\/(api)\/?$/.test(u.pathname)) {
          targetUrl = `${u.origin}${u.pathname.replace(/\/$/, '')}/api`;
        }
      } catch {}

      if (isLocalHost(targetUrl)) {
        Alert.alert('Erro', 'Não use localhost/127.0.0.1 no mobile com Expo Go. Use IP da rede local ou URL pública.');
        return;
      }

      // Salvar base selecionada
      await setApiBaseUrl(targetUrl!);

      // Alternar DB_TARGET conforme opção escolhida e validar saúde da API
      if (dbOption === 'railway') {
        const sw = await switchServerDbTarget(targetUrl!, 'railway');
        if (!sw.ok) {
          setBaseStatus('error');
          const reason = String(sw.reason || 'Falha ao alternar para Railway');
          setBaseMessage(reason);
          Alert.alert('Erro', reason);
          setSaveLoading(false);
          return;
        }
        await AsyncStorage.setItem(STORAGE_KEYS.DB_TARGET, 'railway');
        events.emit('dbTargetChanged', 'railway');
      } else if (dbOption === 'lan') {
        const swLocal = await switchServerDbTarget(targetUrl!, 'local');
        if (!swLocal.ok) {
          setBaseStatus('error');
          const reason = String(swLocal.reason || 'Falha ao alternar para base local');
          setBaseMessage(reason);
          Alert.alert('Erro', reason);
          setSaveLoading(false);
          return;
        }
        await AsyncStorage.setItem(STORAGE_KEYS.DB_TARGET, 'local');
        events.emit('dbTargetChanged', 'local');
      }

      const result = await retryTestApi(targetUrl!, 8, 1500);

      if (result.ok) {
        setBaseStatus('ok');
        const host = new URL(targetUrl!).hostname;
        const dbTargetRaw = (result as any)?.data?.dbTarget || (dbOption === 'railway' ? 'railway' : 'local');
        const dbTarget = String(dbTargetRaw).toUpperCase();
        setActiveDbLabel(`API • ${host} | DB • ${dbTarget}`);
        setApiUrl(targetUrl!);
        setBaseMessage(`Sucesso: Conexão validada! API: ${host} • DB: ${dbTarget}`);
        Alert.alert('Sucesso', 'Base salva e conexão validada!');
        setShowDbModal(false);
      } else {
        setBaseStatus('error');
        const msg = `Falha ao conectar (status ${result.status || 'N/A'}). ${String(result.reason || '')}`;
        setBaseMessage(msg);
        Alert.alert('Erro', msg);
      }
    } catch (err: any) {
      setBaseStatus('error');
      setBaseMessage('Erro inesperado ao salvar/testar a base.');
      Alert.alert('Erro', 'Erro inesperado ao salvar/testar a base.');
    } finally {
      setSaveLoading(false);
    }
  };

  const ensureBaseReadyForLogin = async () => {
    try {
      let base = apiUrl || getLanBaseUrl();
      if (base && !isLocalHost(base)) {
        const res = await retryTestApi(base, 4, 1000);
        if (res?.ok) {
          const host = new URL(base).hostname;
          const dbTargetRaw = res?.data?.dbTarget || 'local';
          const dbTarget = String(dbTargetRaw).toUpperCase();
          setBaseStatus('ok');
          setActiveDbLabel(`API • ${host} | DB • ${dbTarget}`);
          await setApiBaseUrl(base);
          return true;
        }
      }
      await handleSelectLanAuto();
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
      base = stored || getLanBaseUrl();
      if (base && !isLocalHost(base)) {
        const res2 = await retryTestApi(base, 6, 1000);
        if (res2?.ok) {
          const host = new URL(base).hostname;
          const dbTargetRaw = res2?.data?.dbTarget || 'local';
          const dbTarget = String(dbTargetRaw).toUpperCase();
          setBaseStatus('ok');
          setActiveDbLabel(`API • ${host} | DB • ${dbTarget}`);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleLogin = async () => {
    if (baseStatus !== 'ok') {
      const ready = await ensureBaseReadyForLogin();
      if (!ready) {
        setShowDbModal(true);
        Alert.alert('Seleção obrigatória', 'Antes de entrar, selecione a base da API, salve e teste a conexão.');
        return;
      }
    }
    console.log('🚀 handleLogin chamado com:', { email, password: '***' });
    
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    try {
      setLoginLoading(true);
      console.log('🚀 Chamando função login do contexto...');
      const result = await login({ email, password });
      console.log('🚀 Resultado do login:', result);
      
      if (result.success) {
        console.log('🚀 Login bem-sucedido, redirecionando...');
        router.replace('/(tabs)');
      } else {
        console.log('🚀 Login falhou:', result.message);
        Alert.alert('Erro de Login', result.message || 'Email ou senha incorretos');
      }
    } catch (error: any) {
      console.error('🚀 Erro inesperado no login:', error);
      Alert.alert('Erro de Login', 'Erro inesperado ao fazer login');
    } finally {
      setLoginLoading(false);
    }
  };



  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.topRightSwitcher}>
          <TouchableOpacity style={styles.topRightButton} onPress={() => setShowDbModal(true)}>
            <SafeIcon name="link" size={16} color="#0B67C2" fallbackText="🔗" />
            <Text style={styles.topRightText}>{activeDbLabel ? activeDbLabel : 'Selecionar Base'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <SafeIcon name="restaurant" size={64} color="#2196F3" fallbackText="🍽" />
          </View>
          <Text style={styles.title}>BarApp</Text>
          <Text style={styles.subtitle}>Sistema de Vendas</Text>
        </View>

        {activeDbLabel ? (
          <View style={styles.activeDbBadge}>
            <Text style={styles.activeDbBadgeText}>{activeDbLabel}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {/* Campos de Login */}
          <View style={styles.inputContainer}>
            <SafeIcon name="mail" size={20} color="#666" fallbackText="@" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Enter') {
                  passwordRef.current?.focus();
                }
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <SafeIcon name="link-closed" size={20} color="#666" fallbackText="🔒" style={styles.inputIcon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Enter') {
                  handleLogin();
                }
              }}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <SafeIcon
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#666"
                fallbackText={showPassword ? '🙈' : '👁'}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, (loginLoading || baseStatus !== 'ok') && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loginLoading || baseStatus !== 'ok'}
          >
            {loginLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Digite qualquer email e senha para testar
          </Text>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={async () => {
              await clearAllStorage();
              Alert.alert('Debug', 'Cache limpo com sucesso!');
            }}
          >
            <Text style={styles.debugButtonText}>Limpar Cache (Debug)</Text>
          </TouchableOpacity>
        </View>

        {/* Modal de seleção de base de dados */}
        <Modal
          visible={showDbModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowDbModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Selecionar base de dados</Text>

              <View style={styles.segmentedRow}>
                <TouchableOpacity
                  style={[styles.segmentButton, dbOption === 'lan' && styles.segmentButtonActive]}
                  onPress={() => handleQuickSelect('lan')}
                >
                  <Text style={[styles.segmentText, dbOption === 'lan' && styles.segmentTextActive]}>Local (LAN)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentButton, dbOption === 'railway' && styles.segmentButtonActive]}
                  onPress={() => handleQuickSelect('railway')}
                >
                  <Text style={[styles.segmentText, dbOption === 'railway' && styles.segmentTextActive]}>API Pública</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentButton, dbOption === 'custom' && styles.segmentButtonActive]}
                  onPress={() => handleQuickSelect('custom')}
                >
                  <Text style={[styles.segmentText, dbOption === 'custom' && styles.segmentTextActive]}>URL Personalizada</Text>
                </TouchableOpacity>
              </View>

              {(dbOption === 'railway' || dbOption === 'custom') && (
                <View style={styles.inputContainer}>
                  <SafeIcon name="link" size={20} color="#666" fallbackText="🔗" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={dbOption === 'railway' ? 'http://192.168.x.x:4000/api' : 'http://192.168.x.x:4000/api'}
                    value={apiUrl}
                    onChangeText={setApiUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                  />
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.saveTestButton, { flex: 1, marginRight: 8, backgroundColor: '#1976D2' }]}
                  onPress={handleSelectLanAuto}
                >
                  {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTestButtonText}>Detectar LAN e Testar</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveTestButton, { flex: 1, marginLeft: 8 }]}
                  onPress={handleSaveAndTest}
                  disabled={saveLoading}
                >
                  {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTestButtonText}>Salvar e Testar</Text>}
                </TouchableOpacity>
              </View>

              {activeDbLabel ? (
                <Text style={[styles.statusText, styles.statusOk, { marginTop: 8 }]}>Base ativa: {activeDbLabel}</Text>
              ) : null}
              {baseMessage ? (
                <Text style={[styles.statusText, baseStatus === 'ok' ? styles.statusOk : baseStatus === 'error' ? styles.statusError : null, { marginTop: 4 }]}>
                  {baseMessage}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.saveTestButton, { marginTop: 12, backgroundColor: '#9E9E9E' }]}
                onPress={() => setShowDbModal(false)}
              >
                <Text style={styles.saveTestButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    marginBottom: 32,
  },
  // Estilos adicionados para o seletor de base e status
  selectorContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  segmentedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#2196F3',
  },
  segmentText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  saveTestButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveTestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 13,
    marginTop: 8,
    color: '#666',
  },
  statusOk: {
    color: '#2e7d32',
  },
  statusError: {
    color: '#d32f2f',
  },
  // Badge para exibir base ativa com visual mais limpo
  activeDbBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  activeDbBadgeText: {
    color: '#0B67C2',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  debugButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topRightSwitcher: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    alignItems: 'flex-end',
  },
  topRightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  topRightText: {
    color: '#0B67C2',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});


// Helper: testar /health com tentativas e backoff
async function retryTestApi(baseUrl: string, attempts = 6, intervalMs = 2000) {
  let last = { ok: false, status: 0, reason: '' } as any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await testApiConnection(baseUrl, undefined);
      if (res?.ok) return res;
      last = res || last;
    } catch (e: any) {
      last = { ok: false, status: 0, reason: e?.message || 'Erro ao testar API' };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

// Helper para identificar hosts locais inválidos para mobile (localhost/127.0.0.1/::1/0.0.0.0)
const isLocalHost = (url?: string): boolean => {
  if (!url) return false;
  try {
    const u = new URL(String(url));
    const host = u.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
  } catch {
    const s = String(url).toLowerCase();
    const withoutProto = s.includes('://') ? s.split('://')[1] : s;
    const hostOnly = withoutProto.split('/')[0].split(':')[0];
    return hostOnly === 'localhost' || hostOnly.startsWith('127.') || hostOnly === '::1' || hostOnly === '0.0.0.0';
  }
};