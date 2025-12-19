import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { router } from 'expo-router';

import { View, ActivityIndicator } from 'react-native';

import { HapticTab } from '../../components/haptic-tab';
import ProductsTabButton from '../../src/components/ProductsTabButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { SafeIcon } from '../../components/SafeIcon';

export default function TabLayout() {
  const authContext = useAuth() as any;
  const { user, isAuthenticated, loading, hasPermission, isAdmin } = authContext;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Redireciona para a tela de login sempre que a autenticação ficar falsa
      router.replace('/login');
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Removido: useEffect duplicado abaixo para evitar Hook condicional
  // useEffect(() => {
  //   if (!loading && !isAuthenticated) {
  //     router.replace('/login');
  //   }
  // }, [loading, isAuthenticated]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#666',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerTitle: 'BarApp - Sistema de Vendas',
          tabBarIcon: ({ color }) => <SafeIcon name="home" size={24} color={color} fallbackText="Início" />,
        }}
      />
      <Tabs.Screen
        name="mesas"
        options={{
          title: 'Mesas',
          headerTitle: 'Gerenciar Mesas',
          tabBarIcon: ({ color }) => <SafeIcon name="restaurant" size={24} color={color} fallbackText="Mesas" />,
        }}
      />
      <Tabs.Screen
        name="comandas"
        options={{
          title: 'Comandas',
          headerTitle: 'Comandas Abertas',
          tabBarIcon: ({ color }) => <SafeIcon name="receipt" size={24} color={color} fallbackText="Comandas" />,
        }}
      />
      <Tabs.Screen
        name="caixa"
        options={{
          title: 'Caixa',
          headerTitle: 'Caixa - Vendas Abertas',
          tabBarIcon: () => <SafeIcon name="cash" size={24} color="#FF0000" fallbackText="R$" />,
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          headerTitle: 'Histórico de Vendas',
          tabBarIcon: ({ color }) => <SafeIcon name="time" size={24} color={color} fallbackText="Hist." />,
        }}
      />
      
      {/* Abas Administrativas - Visíveis apenas para usuários com permissões */}
      {hasPermission('produtos') && (
        <Tabs.Screen
          name="admin-produtos"
          options={{
            title: 'Produtos',
            headerTitle: 'Gerenciar Produtos',
            tabBarButton: (props) => (
              <ProductsTabButton 
                focused={props.accessibilityState?.selected || false} 
              />
            ),
          }}
        />
      )}
      
      {hasPermission('funcionarios') && (
        <Tabs.Screen
          name="admin-funcionarios"
          options={{
            title: 'Funcionários',
            headerTitle: 'Gerenciar Funcionários',
            tabBarIcon: ({ color }) => <SafeIcon name="people" size={24} color={color} fallbackText="Func." />,
          }}
        />
      )}
      
      {hasPermission('clientes') && (
        <Tabs.Screen
          name="admin-clientes"
          options={{
            title: 'Clientes',
            headerTitle: 'Gerenciar Clientes',
            tabBarIcon: ({ color }) => <SafeIcon name="person" size={24} color={color} fallbackText="Cli." />,
          }}
        />
      )}
      
      {isAdmin() && (
        <Tabs.Screen
          name="admin-configuracoes"
          options={{
            title: 'Config',
            headerTitle: 'Configurações do Sistema',
            tabBarIcon: ({ color }) => <SafeIcon name="settings" size={24} color={color} fallbackText="Conf." />,
          }}
        />
      )}
    </Tabs>
  );
}
