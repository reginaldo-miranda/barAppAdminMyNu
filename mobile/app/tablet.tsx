import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import TabletCozinhaScreen from '../src/screens/TabletCozinhaScreen';
import TabletBarScreen from '../src/screens/TabletBarScreen';
import { apiService } from '../src/services/api';
import { authService } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../src/services/storage';

export default function TabletMode() {
  const { width } = useWindowDimensions();
  const split = width >= 900;
  const [setores, setSetores] = React.useState<any[]>([]);
  const [activeSetorId, setActiveSetorId] = React.useState<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!existingToken) {
          try {
            const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
            const token = login?.data?.token;
            if (token) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
          } catch (_e) {
            // silencioso: tablet deve continuar tentando listar setores
          }
        }
        const resp = await apiService.request({ method: 'GET', url: '/setor-impressao/list' });
        const arr = resp?.data?.data || [];
        const ativos = Array.isArray(arr) ? arr.filter((s: any) => s?.ativo !== false) : [];
        if (alive) {
          setSetores(ativos);
          setActiveSetorId(ativos.length > 0 ? Number(ativos[0].id) : null);
        }
      } catch (err) {
        // silencioso
      }
    })();
    return () => { alive = false; };
  }, []);

  const onBack = () => {
    try {
      router.back();
    } catch {
      try {
        router.replace('/');
      } catch {}
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Pedidos</Text>
        <View style={{ width: 48, height: 48 }} />
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {setores.map((s) => {
            const isActive = Number(s.id) === activeSetorId;
            return (
              <TouchableOpacity
                key={String(s.id)}
                style={[styles.tabDynamic, isActive && styles.activeTab]}
                onPress={() => setActiveSetorId(Number(s.id))}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>{s.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={split ? styles.splitContent : styles.content}>
        {split && setores.length >= 1 ? (
          (() => {
            const left = setores.find((s) => Number(s.id) === activeSetorId) || setores[0];
            const right = setores.find((s) => Number(s.id) !== Number(left?.id));
            return (
              <>
                <View style={styles.column}>
                  {left && (
                    String(left.nome || '').toLowerCase().includes('cozinha') ? (
                      <TabletCozinhaScreen setorIdOverride={Number(left.id)} setorNomeOverride={left.nome} />
                    ) : (
                      <TabletBarScreen setorIdOverride={Number(left.id)} setorNomeOverride={left.nome} />
                    )
                  )}
                </View>
                <View style={styles.column}>
                  {right && (
                    String(right.nome || '').toLowerCase().includes('cozinha') ? (
                      <TabletCozinhaScreen setorIdOverride={Number(right.id)} setorNomeOverride={right.nome} />
                    ) : (
                      <TabletBarScreen setorIdOverride={Number(right.id)} setorNomeOverride={right.nome} />
                    )
                  )}
                </View>
              </>
            );
          })()
        ) : (
          (() => {
            const ativo = setores.find((s) => Number(s.id) === activeSetorId);
            if (!ativo) return null;
            return ativo.nome?.toLowerCase().includes('cozinha') ? (
              <TabletCozinhaScreen setorIdOverride={Number(ativo.id)} setorNomeOverride={ativo.nome} />
            ) : (
              <TabletBarScreen setorIdOverride={Number(ativo.id)} setorNomeOverride={ativo.nome} />
            );
          })()
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  navbar: {
    height: 56,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e88e5',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  navTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDynamic: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    minWidth: 110,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#ff6b6b',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  splitContent: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#eee',
  },
});