import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/contexts/AuthContext';
import { saleService, mesaService } from '../../src/services/api';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus'
import { SafeIcon } from '../../components/SafeIcon';

export default function HomeScreen() {
  const authContext = useAuth() as any;
  const { user, logout } = authContext;
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    openTables: 0,
    openComandas: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const [salesResponse, mesasResponse] = await Promise.all([
        saleService.getAll(),
        mesaService.list(),
      ]);

      const today = new Date().toDateString();
      
      // Filtrar todas as vendas/comandas de hoje
      const todaySales = (salesResponse?.data || []).filter(
        (sale: any) =>
          new Date(sale.createdAt).toDateString() === today
      );

      // Separar por tipo para estatísticas específicas
      const todayVendasBalcao = todaySales.filter((sale: any) => 
        sale.tipoVenda === 'balcao' && sale.status === 'finalizada'
      );
      
      const todayVendasMesa = todaySales.filter((sale: any) => 
        sale.tipoVenda === 'mesa' && sale.status === 'finalizada'
      );
      
      const todayComandas = todaySales.filter((sale: any) => 
        sale.tipoVenda === 'comanda'
      );

      // Contar mesas ocupadas
      const openTables = (mesasResponse?.data || []).filter(
        (mesa: any) => mesa.status === 'ocupada'
      ).length;

      // Contar TODAS as comandas abertas (não apenas do dia)
      const allComandas = (salesResponse?.data || []).filter((sale: any) => 
        sale.tipoVenda === 'comanda'
      );
      
      const openComandas = allComandas.filter(
        (comanda: any) => comanda.status === 'aberta'
      ).length;

      // Calcular vendas finalizadas (todas as vendas fechadas do dia)
      const finalizedSales = todaySales.filter((sale: any) => 
        sale.status === 'finalizada' || sale.status === 'fechada'
      );

      // Calcular receita total (sem duplicação)
      const totalRevenue = finalizedSales.reduce((sum: number, sale: any) => {
        return sum + (parseFloat(sale.total) || 0);
      }, 0);

      setStats({
        totalSales: finalizedSales.length, // Total de vendas finalizadas
        totalRevenue: totalRevenue, // Faturamento total sem duplicação
        openTables,
        openComandas,
      });
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  useEffect(() => {
    loadStats();
    const off1 = events.on('mesas:refresh', loadStats);
    const off2 = events.on('comandas:refresh', loadStats);
    const off3 = events.on('caixa:refresh', loadStats);
    return () => { off1(); off2(); off3(); };
  }, [loadStats]);

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair do sistema?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: logout },
      ]
    );
  };

  const menuItems = [
    {
      title: 'Nova Venda - Balcão',
      subtitle: 'Venda direta no balcão',
      icon: 'storefront',
      color: '#4CAF50',
      onPress: () => router.push('/sale?type=balcao'),
    },
    {
      title: 'Gerenciar Mesas',
      subtitle: 'Abrir e fechar mesas',
      icon: 'restaurant',
      color: '#2196F3',
      onPress: () => router.push('/(tabs)/mesas'),
    },
    {
      title: 'Comandas',
      subtitle: 'Comandas nomeadas',
      icon: 'receipt',
      color: '#FF9800',
      onPress: () => router.push('/(tabs)/comandas'),
    },
    {
      title: 'Histórico de Vendas',
      subtitle: 'Vendas finalizadas',
      icon: 'time',
      color: '#9C27B0',
      onPress: () => router.push('/(tabs)/historico'),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ScreenIdentifier screenName="Home" />
      {/* Header com informações do usuário */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Bem-vindo(a),</Text>
          <Text style={styles.userName}>{user?.name || 'Usuário'}</Text>
          <Text style={styles.userRole}>{user?.role || 'Funcionário'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleOpenSettings}
            activeOpacity={0.8}
            accessibilityLabel="Abrir Configurações"
          >
            <SafeIcon name="settings" size={22} color="#fff" fallbackText="Cfg" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <SafeIcon name="log-out" size={22} color="#fff" fallbackText="Sair" />
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Sair</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Rápido */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Status de Hoje</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#E8F5E8' }]}>
            <SafeIcon name="trending-up" size={24} color="#4CAF50" fallbackText="↑" />
            <Text style={styles.statNumber}>{stats.totalSales}</Text>
            <Text style={styles.statLabel}>Vendas</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
            <SafeIcon name="cash" size={24} color="#FF0000" fallbackText="R$" />
            <Text style={styles.statNumber}>R$ {stats.totalRevenue.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Faturamento</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
            <SafeIcon name="restaurant" size={24} color="#FF9800" fallbackText="🍽" />
            <Text style={styles.statNumber}>{stats.openTables}</Text>
            <Text style={styles.statLabel}>Mesas Abertas</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F3E5F5' }]}>
            <SafeIcon name="receipt" size={24} color="#9C27B0" fallbackText="Rec" />
            <Text style={styles.statNumber}>{stats.openComandas}</Text>
            <Text style={styles.statLabel}>Comandas Abertas</Text>
          </View>
        </View>
      </View>

      {/* Menu Principal */}
      <View style={styles.menuContainer}>
        <Text style={styles.sectionTitle}>Menu Principal</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderLeftColor: item.color }]}
              onPress={item.onPress}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
                <SafeIcon name={item.icon as any} size={28} color="#fff" fallbackText="▶" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>


            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  welcomeText: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  userRole: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
  logoutButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  menuContainer: {
    padding: 20,
  },
  menuGrid: {
    gap: 12,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});

const handleOpenSettings = () => {
  router.push('/configuracoes');
};
