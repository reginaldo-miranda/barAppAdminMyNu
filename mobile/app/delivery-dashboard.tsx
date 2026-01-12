import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { saleService, apiService, getWsUrl, API_URL } from '../src/services/api'; // Ensure correct imports
import ScreenIdentifier from '../src/components/ScreenIdentifier';
import { Linking } from 'react-native';

export default function DeliveryDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDeliveries = async () => {
    try {
      // Fetch sales with isDelivery=true
      // Note: Endpoint listing might need 'status' filter. 
      // We want 'aberta' and 'pending'/'out_for_delivery'
      // If we confirm delivery -> 'finalizada' + 'delivered', so we filter those OUT usually, or show in history.
      // Let's first fetch active ones.
      // Our API supports 'isDelivery=true'. Default listing usually returns active? 
      // GET /sale/list expects status? Default is usually all or active?
      // Let's try listing all 'aberta' with isDelivery.
      const res = await saleService.list({ status: 'aberta', isDelivery: true });
      if (res.data && Array.isArray(res.data)) {
         // Sort by date desc
         const sorted = res.data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
         setDeliveries(sorted);
      } else {
         setDeliveries([]);
      }
    } catch (error) {
      console.error('Erro ao buscar entregas', error);
      Alert.alert('Erro', 'Não foi possível carregar entregas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  const onRefresh = () => {
      setRefreshing(true);
      loadDeliveries();
  };

  const handleConfirmDelivery = async (saleId: number) => {
      // Call endpoint to confirm
      try {
          await api.post(`/sale/${saleId}/confirm-delivery`);
          
          Alert.alert('Sucesso', 'Entrega confirmada e venda finalizada.');
          loadDeliveries(); // Reload list
      } catch (error) {
          console.error(error);
          Alert.alert('Erro', 'Falha ao confirmar entrega.');
      }
  };

  const openMaps = (address: string) => {
      const url = Platform.select({
          ios: `maps:0,0?q=${encodeURIComponent(address)}`,
          android: `geo:0,0?q=${encodeURIComponent(address)}`,
          web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      });
      if (url) {
        Linking.openURL(url);
      }
  };

  if (loading) {
      return (
          <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
          </View>
      );
  }

  return (
    <View style={styles.container}>
        <ScreenIdentifier screenName="Dashboard Delivery" />
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Entregas em Andamento</Text>
        </View>

        <ScrollView 
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {deliveries.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="bicycle-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>Nenhuma entrega pendente.</Text>
                </View>
            ) : (
                deliveries.map((sale) => (
                    <View key={sale.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>#{sale.id} - {sale.cliente?.nome || 'Cliente'}</Text>
                            <Text style={styles.statusBadge}>{sale.deliveryStatus === 'pending' ? 'Pendente' : 'Saiu'}</Text>
                        </View>
                        
                        <Text style={styles.address} onPress={() => openMaps(sale.deliveryAddress)}>
                            <Ionicons name="location" size={14} color="#666" /> {sale.deliveryAddress}
                        </Text>
                        
                        <View style={styles.infoRow}>
                            <Text style={styles.infoText}>Dist: {sale.deliveryDistance} km</Text>
                            <Text style={styles.infoText}>Taxa: R$ {Number(sale.deliveryFee || 0).toFixed(2)}</Text>
                            <Text style={styles.totalText}>Total: R$ {Number(sale.total || 0).toFixed(2)}</Text>
                        </View>

                        <View style={styles.actions}>
                             <TouchableOpacity 
                                onPress={() => handleConfirmDelivery(sale.id)} 
                                style={styles.confirmButton}
                             >
                                 <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                 <Text style={styles.buttonText}>Confirmar Entrega</Text>
                             </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
      paddingTop: 50, 
      paddingBottom: 20, 
      paddingHorizontal: 20, 
      backgroundColor: '#2196F3', 
      flexDirection: 'row', 
      alignItems: 'center' 
    },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
    backButton: { padding: 4 },
    list: { padding: 16 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#888', marginTop: 16, fontSize: 16 },
    
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    statusBadge: { backgroundColor: '#FFEB3B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 12, fontWeight: 'bold' },
    address: { color: '#2196F3', marginBottom: 12, fontSize: 14 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    infoText: { color: '#666', fontSize: 12 },
    totalText: { fontSize: 14, fontWeight: 'bold', color: '#2e7d32' },
    
    actions: { flexDirection: 'row', justifyContent: 'flex-end' },
    confirmButton: { 
        backgroundColor: '#4CAF50', 
        flexDirection: 'row', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 8, 
        alignItems: 'center',
        gap: 8
    },
    buttonText: { color: '#fff', fontWeight: 'bold' }
});
