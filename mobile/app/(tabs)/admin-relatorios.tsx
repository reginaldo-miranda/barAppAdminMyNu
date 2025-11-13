import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeIcon } from '../../components/SafeIcon';
import { saleService, productService, customerService, employeeService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';

interface ReportStats {
  totalVendas: number;
  faturamentoTotal: number;
  faturamentoMedio: number;
  produtoMaisVendido: string;
  totalClientes: number;
  totalFuncionarios: number;
  vendasPorTipo: {
    balcao: number;
    mesa: number;
    comanda: number;
  };
  vendasPorStatus: {
    finalizadas: number;
    abertas: number;
    canceladas: number;
  };
}

export default function AdminRelatoriosScreen() {
  const { hasPermission } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ReportStats>({
    totalVendas: 0,
    faturamentoTotal: 0,
    faturamentoMedio: 0,
    produtoMaisVendido: 'N/A',
    totalClientes: 0,
    totalFuncionarios: 0,
    vendasPorTipo: {
      balcao: 0,
      mesa: 0,
      comanda: 0,
    },
    vendasPorStatus: {
      finalizadas: 0,
      abertas: 0,
      canceladas: 0,
    },
  });
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'total'>('hoje');

  useEffect(() => {
    if (!hasPermission('relatorios')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela');
      return;
    }
    loadReports();
  }, [periodo]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      const [salesResponse, productsResponse, customersResponse, employeesResponse] = await Promise.all([
        saleService.getAll(),
        productService.getAll(),
        customerService.getAll(),
        employeeService.getAll(),
      ]);

      const sales = salesResponse.data || [];
      const products = productsResponse.data || [];
      const customers = customersResponse.data || [];
      const employees = employeesResponse.data || [];

      // Filtrar vendas por período
      const now = new Date();
      let filteredSales = sales;

      if (periodo === 'hoje') {
        const today = now.toDateString();
        filteredSales = sales.filter((sale: any) => 
          new Date(sale.createdAt).toDateString() === today
        );
      } else if (periodo === 'semana') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredSales = sales.filter((sale: any) => 
          new Date(sale.createdAt) >= weekAgo
        );
      } else if (periodo === 'mes') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredSales = sales.filter((sale: any) => 
          new Date(sale.createdAt) >= monthAgo
        );
      }

      // Calcular estatísticas
      const totalVendas = filteredSales.length;
      const vendasFinalizadas = filteredSales.filter((sale: any) => sale.status === 'finalizada');
      const faturamentoTotal = vendasFinalizadas.reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);
      const faturamentoMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;

      // Vendas por tipo
      const vendasPorTipo = {
        balcao: filteredSales.filter((sale: any) => sale.tipoVenda === 'balcao').length,
        mesa: filteredSales.filter((sale: any) => sale.tipoVenda === 'mesa').length,
        comanda: filteredSales.filter((sale: any) => sale.tipoVenda === 'comanda').length,
      };

      // Vendas por status
      const vendasPorStatus = {
        finalizadas: filteredSales.filter((sale: any) => sale.status === 'finalizada').length,
        abertas: filteredSales.filter((sale: any) => sale.status === 'aberta').length,
        canceladas: filteredSales.filter((sale: any) => sale.status === 'cancelada').length,
      };

      // Produto mais vendido (simplificado)
      const produtoMaisVendido = 'Produto A'; // Implementar lógica real se necessário

      setStats({
        totalVendas,
        faturamentoTotal,
        faturamentoMedio,
        produtoMaisVendido,
        totalClientes: customers.length,
        totalFuncionarios: employees.length,
        vendasPorTipo,
        vendasPorStatus,
      });

    } catch (error: any) {
      console.error('Erro ao carregar relatórios:', error);
      Alert.alert('Erro', 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const renderPeriodButton = (periodValue: typeof periodo, label: string) => (
    <TouchableOpacity
      style={[
        styles.periodButton,
        periodo === periodValue && styles.periodButtonActive,
      ]}
      onPress={() => setPeriodo(periodValue)}
    >
      <Text
        style={[
          styles.periodButtonText,
          periodo === periodValue && styles.periodButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderStatCard = (title: string, value: string | number, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statCardHeader}>
        <SafeIcon name={icon as any} size={24} color={color} fallbackText="•" />
        <Text style={styles.statCardTitle}>{title}</Text>
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando relatórios...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ScreenIdentifier screenName="Admin - Relatórios" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <Text style={styles.headerSubtitle}>Análise de vendas e estatísticas</Text>
      </View>

      {/* Seletor de Período */}
      <View style={styles.periodSelector}>
        <Text style={styles.sectionTitle}>Período</Text>
        <View style={styles.periodButtons}>
          {renderPeriodButton('hoje', 'Hoje')}
          {renderPeriodButton('semana', 'Semana')}
          {renderPeriodButton('mes', 'Mês')}
          {renderPeriodButton('total', 'Total')}
        </View>
      </View>

      {/* Estatísticas Principais */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo Geral</Text>
        {renderStatCard('Total de Vendas', stats.totalVendas, 'receipt', '#4CAF50')}
        {renderStatCard('Faturamento Total', formatCurrency(stats.faturamentoTotal), 'cash', '#2196F3')}
        {renderStatCard('Faturamento Médio', formatCurrency(stats.faturamentoMedio), 'trending-up', '#FF9800')}
        {renderStatCard('Produto Mais Vendido', stats.produtoMaisVendido, 'star', '#9C27B0')}
      </View>

      {/* Vendas por Tipo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vendas por Tipo</Text>
        <View style={styles.chartContainer}>
          {renderStatCard('Balcão', stats.vendasPorTipo.balcao, 'storefront', '#4CAF50')}
          {renderStatCard('Mesa', stats.vendasPorTipo.mesa, 'restaurant', '#2196F3')}
          {renderStatCard('Comanda', stats.vendasPorTipo.comanda, 'receipt', '#FF9800')}
        </View>
      </View>

      {/* Vendas por Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vendas por Status</Text>
        <View style={styles.chartContainer}>
          {renderStatCard('Finalizadas', stats.vendasPorStatus.finalizadas, 'checkmark-circle', '#4CAF50')}
          {renderStatCard('Abertas', stats.vendasPorStatus.abertas, 'time', '#FF9800')}
          {renderStatCard('Canceladas', stats.vendasPorStatus.canceladas, 'close-circle', '#f44336')}
        </View>
      </View>

      {/* Informações Gerais */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações Gerais</Text>
        {renderStatCard('Total de Clientes', stats.totalClientes, 'people', '#2196F3')}
        {renderStatCard('Total de Funcionários', stats.totalFuncionarios, 'person', '#9C27B0')}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  periodSelector: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  periodButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#2196F3',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardTitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  chartContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});