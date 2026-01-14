import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Switch,
    ScrollView,
    Platform,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { Marker, Polyline } from './NativeMap';
import Constants from 'expo-constants';

interface DeliveryDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    // Data
    isDelivery: boolean;
    setIsDelivery: (v: boolean) => void;
    deliveryAddress: string;
    setDeliveryAddress: (v: string) => void;
    deliveryDistance: number;
    setDeliveryDistance: (v: number) => void;
    deliveryFee: number;
    setDeliveryFee: (v: number) => void;
    deliveryCoords: { lat: number, lng: number } | null;
    setDeliveryCoords: (v: { lat: number, lng: number } | null) => void;
    companyConfig: any;
    
    // Selection Handlers
    selectedCliente: any;
    onSelectClient: () => void;
    selectedEntregador: any;
    onSelectEntregador: () => void;
    user: any; // attendant

    // Actions
    onConfirm: () => void;
    loading: boolean;
    
    // Config
    GOOGLE_API_KEY: string;
}

const DeliveryDetailsModal: React.FC<DeliveryDetailsModalProps> = ({
    visible,
    onClose,
    isDelivery,
    setIsDelivery,
    deliveryAddress,
    setDeliveryAddress,
    deliveryDistance,
    setDeliveryDistance,
    deliveryFee,
    setDeliveryFee,
    deliveryCoords,
    setDeliveryCoords,
    companyConfig,
    selectedCliente,
    onSelectClient,
    selectedEntregador,
    onSelectEntregador,
    user,
    onConfirm,
    loading,
    GOOGLE_API_KEY
}) => {
    const [cep, setCep] = useState('');
    
    const handleCepSearch = async () => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) {
            Alert.alert('Erro', 'CEP inválido. Digite 8 números.');
            return;
        }
        
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();
            
            if (data.erro) {
                Alert.alert('Erro', 'CEP não encontrado.');
                return;
            }
            
            // Formata: Rua, Bairro, Cidade - UF
            const formatted = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
            setDeliveryAddress(formatted);
            // Opcional: focar no campo de endereço ou já disparar busca (melhor deixar usuário por número)
            
            if (Platform.OS === 'web') {
                 window.alert('Endereço carregado! Complete com o número e clique em Buscar.');
            } else {
                 Alert.alert('Sucesso', 'Endereço carregado! Complete com o número e clique em Buscar.');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao buscar CEP.');
        }
    };
    
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; 
        const dLat = deg2rad(lat2 - lat1); 
        const dLon = deg2rad(lon2 - lon1); 
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; 
        return d;
    };
  
    const deg2rad = (deg: number) => {
      return deg * (Math.PI/180);
    };

    const handlePlaceSelect = (data: any, details: any = null) => {
        if (details && companyConfig?.latitude && companyConfig?.longitude) {
            const { lat, lng } = details.geometry.location;
            setDeliveryCoords({ lat, lng });
            setDeliveryAddress(data.description || details.formatted_address);

            // Calcular distância
            const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng);
            const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
            setDeliveryDistance(estRoadDist);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Detalhes da Entrega</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 16 }}>
                        
                        {/* Toggle Mode */}
                        <View style={styles.toggleRow}>
                            <Text style={styles.label}>Modo Delivery</Text>
                            <Switch 
                                value={isDelivery} 
                                onValueChange={(v) => {
                                    setIsDelivery(v);
                                    if (!v) {
                                        setDeliveryFee(0);
                                        setDeliveryDistance(0);
                                    }
                                }} 
                            />
                        </View>

                        {isDelivery && (
                            <>
                                {/* Client & Employee Selectors */}
                                <View style={styles.section}>
                                    <TouchableOpacity onPress={onSelectClient} style={styles.selectorItem}>
                                        <Ionicons name="person" size={20} color="#666" style={{ width: 30 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.selectorLabel}>Cliente</Text>
                                            <Text style={styles.selectorValue}>
                                                {selectedCliente ? selectedCliente.nome : 'Selecionar Cliente'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={onSelectEntregador} style={styles.selectorItem}>
                                        <Ionicons name="bicycle" size={20} color="#666" style={{ width: 30 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.selectorLabel}>Entregador</Text>
                                            <Text style={styles.selectorValue}>
                                                {selectedEntregador ? selectedEntregador.nome : 'Selecionar Entregador'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                                    </TouchableOpacity>
                                    
                                    <View style={styles.selectorItemNoBorder}>
                                        <Ionicons name="id-card" size={20} color="#666" style={{ width: 30 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.selectorLabel}>Atendente</Text>
                                            <Text style={[styles.selectorValue, { color: '#000' }]}>
                                                {user?.nome || 'Desconhecido'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Address Section */}
                                <Text style={styles.sectionTitle}>Endereço de Entrega</Text>
                                
                                {/* CEP Input */}
                                <View style={styles.webAddressContainer}>
                                    <TextInput 
                                        style={styles.webInput} 
                                        placeholder="CEP (apenas números)" 
                                        value={cep}
                                        onChangeText={(t) => setCep(t.replace(/\D/g, ''))}
                                        keyboardType="numeric"
                                        maxLength={8}
                                    />
                                    <TouchableOpacity 
                                        style={[styles.webSearchButton, { backgroundColor: '#607D8B' }]}
                                        onPress={handleCepSearch}
                                    >
                                        <Ionicons name="search" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                
                                {Platform.OS !== 'web' ? (
                                    <View style={{ height: 44, marginBottom: 10, zIndex: 9999 }}>
                                        <GooglePlacesAutocomplete
                                            placeholder='Buscar endereço...'
                                            onPress={handlePlaceSelect}
                                            query={{
                                                key: GOOGLE_API_KEY,
                                                language: 'pt-BR',
                                            }}
                                            fetchDetails={true}
                                            styles={{
                                                textInput: styles.placesInput,
                                                listView: { zIndex: 10000, position: 'absolute', top: 40, width: '100%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' }
                                            }}
                                            enablePoweredByContainer={false}
                                            textInputProps={{
                                                value: deliveryAddress,
                                                onChangeText: setDeliveryAddress
                                            }}
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.webAddressContainer}>
                                        <TextInput 
                                            style={styles.webInput} 
                                            placeholder="Ex: Av Paulista, 1000, São Paulo" 
                                            value={deliveryAddress}
                                            onChangeText={setDeliveryAddress}
                                        />
                                        <TouchableOpacity 
                                            style={styles.webSearchButton}
                                            onPress={async () => {
                                                const safeAlert = (title: string, msg: string) => {
                                                    setTimeout(() => window.alert(`${title}\n${msg}`), 50);
                                                };

                                                if (!deliveryAddress) {
                                                    safeAlert('Atenção', 'Digite um endereço.');
                                                    return;
                                                }

                                                if (!companyConfig?.latitude || !companyConfig?.longitude) {
                                                    safeAlert('Configuração Pendente', 'Endereço da loja não configurado.');
                                                    return;
                                                }

                                                const doSearch = async (addr: string) => {
                                                    const query = encodeURIComponent(addr);
                                                    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`;
                                                    // Usar um UA mais descritivo para evitar bloqueios, idealmente com contato
                                                    const res = await fetch(url, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
                                                    return await res.json();
                                                };

                                                const doStructuredSearch = async (street: string, city: string, state: string) => {
                                                    const params = new URLSearchParams();
                                                    params.append('street', street);
                                                    if (city) params.append('city', city);
                                                    if (state) params.append('state', state);
                                                    params.append('countrycodes', 'br');
                                                    params.append('format', 'json');
                                                    params.append('limit', '1');
                                                    
                                                    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
                                                    const res = await fetch(url, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
                                                    return await res.json();
                                                };

                                                const normalizeAddress = (addr: string) => {
                                                    return addr
                                                        .replace(/\bCap\b\.?/gi, 'Capitão') // Ajuste no regex para pegar Cap ou Cap.
                                                        .replace(/\bCapitao\b/gi, 'Capitão')
                                                        .replace(/\bDr\b\.?/gi, 'Doutor')
                                                        .replace(/\bProf\b\.?/gi, 'Professor')
                                                        .replace(/\bAv\b\.?/gi, 'Avenida')
                                                        .replace(/\bPç\b\.?/gi, 'Praça')
                                                        .replace(/\bAl\b\.?/gi, 'Alameda');
                                                };

                                                const stripPrefix = (addr: string) => {
                                                    return addr.replace(/^(Rua|Avenida|Travessa|Alameda|Praça|Rodovia)\s+/i, '');
                                                };

                                                try {
                                                    // 1. Tentar endereço exato (Query completa)
                                                    let json = await doSearch(deliveryAddress);
                                                    let isApprox = false;

                                                    // 1.5 Tentar endereço normalizado
                                                    let normAddr = normalizeAddress(deliveryAddress);
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        if (normAddr !== deliveryAddress) {
                                                            json = await doSearch(normAddr);
                                                            if (Array.isArray(json) && json.length > 0) {
                                                                setDeliveryAddress(normAddr); 
                                                            }
                                                        }
                                                    }

                                                    // 2. Tentar remover o prefixo (Ex: "Capitão..." em vez de "Rua Capitão...")
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        const noPrefixAddr = stripPrefix(normAddr);
                                                        if (noPrefixAddr !== normAddr) {
                                                            json = await doSearch(noPrefixAddr);
                                                            // Se achar sem prefixo, é válido
                                                        }
                                                    }

                                                    // 3. Se falhar, tentar busca estruturada (Separando por vírgula ou hífen)
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        const parts = normAddr.split(/[,–-]/).map(p => p.trim()).filter(p => p.length > 0);
                                                        
                                                        if (parts.length >= 2) {
                                                            const street = parts[0];
                                                            let city = '';
                                                            let state = '';
                                                            
                                                            let lastPart = parts[parts.length - 1];
                                                            let cityIndex = parts.length - 1;
                                                            
                                                            if (lastPart.length === 2 && isNaN(Number(lastPart))) {
                                                                state = lastPart;
                                                                cityIndex--;
                                                            }
                                                            
                                                            if (cityIndex > 0) {
                                                                let potentialCity = parts[cityIndex];
                                                                if (isNaN(Number(potentialCity))) {
                                                                    city = potentialCity;
                                                                }
                                                            }

                                                            const removeAccents = (str: string) => {
                                                                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                                            };

                                                            const stripTitles = (str: string) => {
                                                                return str.replace(/\b(Capitão|Capitao|Cap|Doutor|Dr|Professor|Prof|General|Gen|Coronel|Cel|Major|Maj|Vereador|Ver|Deputado|Dep|Presidente|Pres)\b\.?/gi, '').trim();
                                                            };

                                                            if (street && (city || state)) {
                                                                // 1. Estruturada Normal
                                                                let structRes = await doStructuredSearch(street, city, state);
                                                                
                                                                // 2. Estruturada Sem Acentos e Sem 'Rua'
                                                                if (!Array.isArray(structRes) || structRes.length === 0) {
                                                                    const streetClean = removeAccents(stripPrefix(street));
                                                                    if (streetClean !== street) {
                                                                        structRes = await doStructuredSearch(streetClean, city, state);
                                                                    }
                                                                }

                                                                // 3. Estruturada Sem Títulos (Ex: "Capitão Angelo" -> "Angelo")
                                                                // Isso ajuda muito quando o usuário erra o título ou abreviação
                                                                if (!Array.isArray(structRes) || structRes.length === 0) {
                                                                    const streetNoTitles = stripTitles(stripPrefix(street));
                                                                    if (streetNoTitles.length > 3 && streetNoTitles !== street) { // Só busca se sobrou algo relevante
                                                                        structRes = await doStructuredSearch(streetNoTitles, city, state);
                                                                    }
                                                                }

                                                                // 4. Última tentativa: Sem títulos e sem acentos (Core Name puríssimo)
                                                                if (!Array.isArray(structRes) || structRes.length === 0) {
                                                                    const streetCore = removeAccents(stripTitles(stripPrefix(street)));
                                                                    if (streetCore.length > 3 && streetCore !== street) {
                                                                        structRes = await doStructuredSearch(streetCore, city, state);
                                                                    }
                                                                }
                                                                

                                                                
                                                                if (Array.isArray(structRes) && structRes.length > 0) {
                                                                    json = structRes;
                                                                    isApprox = true;
                                                                }
                                                            }
                                                        }
                                                    }

                                                    // 5. Fallback Finalissimo: Tentar busca pelo CEP (que temos no estado)
                                                    // Se tudo falhou, mas temos um CEP válido, pegamos a coordenada do CEP.
                                                    // Isso garante que o cálculo de entrega funcione.
                                                    if ((!Array.isArray(json) || json.length === 0) && cep && cep.length === 8) {
                                                         const cleanCep = cep.replace(/\D/g, '');
                                                         // Formato aceito pelo nominatim: q=CEP ou postalcode=CEP
                                                         // Vamos usar estruturado
                                                         const cepUrl = `https://nominatim.openstreetmap.org/search?postalcode=${cleanCep}&countrycodes=br&format=json&limit=1`;
                                                         const resCep = await fetch(cepUrl, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
                                                         const jsonCep = await resCep.json();
                                                         
                                                         if (Array.isArray(jsonCep) && jsonCep.length > 0) {
                                                             json = jsonCep;
                                                             isApprox = true;
                                                             // Aviso que foi pelo CEP
                                                             safeAlert('Aviso', 'Endereço exato não localizado. Usando localização do CEP para cálculo.');
                                                         }
                                                    }

                                                    // 4. Fallback final: Remover número da string NORMALIZADA
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        // Remover número isolado por vírgulas ou hifens
                                                        const cleanAddr = normAddr.replace(/[,–-]?\s*\d+\s*[,–-]?/, ','); 
                                                        if (cleanAddr !== normAddr) {
                                                            const cleanAddrFinal = cleanAddr.replace(/^,|,$/g, '').trim(); // Limpa vírgulas soltas
                                                            json = await doSearch(cleanAddrFinal);
                                                            isApprox = true;
                                                        }
                                                    }

                                                    if (Array.isArray(json) && json.length > 0) {
                                                        const result = json[0];
                                                        const lat = parseFloat(result.lat);
                                                        const lon = parseFloat(result.lon);
                                                        
                                                        // Se foi aproximado, manter o texto original digitado, mas usar coord da rua
                                                         if (isApprox) {
                                                             safeAlert('Endereço Aproximado', 'Número não encontrado exato. Usando centro da rua/bairro para cálculo.');
                                                         } else {
                                                             setDeliveryAddress(result.display_name); // Atualiza com o formatado bonitinho se for exato
                                                         }

                                                        setDeliveryCoords({ lat, lng: lon });
                                                        
                                                        const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lon);
                                                        const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
                                                        setDeliveryDistance(estRoadDist);
                                                        
                                                        if (!isApprox) safeAlert('Endereço Encontrado', `Distância: ${estRoadDist} km`);
                                                    } else {
                                                        safeAlert('Não encontrado', 'Tente verificar a formatação (Rua, Número, Cidade - UF).');
                                                    }
                                                } catch (e: any) {
                                                    console.error(e);
                                                    safeAlert('Erro', 'Falha ao buscar endereço.');
                                                }
                                            }}
                                        >
                                            <Text style={styles.webSearchButtonText}>Buscar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Map */}
                                {Platform.OS !== 'web' && companyConfig?.latitude && companyConfig?.longitude && deliveryCoords && (
                                    <View style={styles.mapContainer}>
                                        <MapView
                                            style={{ flex: 1 }}
                                            initialRegion={{
                                                latitude: Number(companyConfig.latitude),
                                                longitude: Number(companyConfig.longitude),
                                                latitudeDelta: 0.05,
                                                longitudeDelta: 0.05,
                                            }}
                                        >
                                            <Marker coordinate={{ latitude: Number(companyConfig.latitude), longitude: Number(companyConfig.longitude) }} title="Loja" pinColor="blue" />
                                            <Marker coordinate={{ latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }} title="Cliente" />
                                            <Polyline 
                                                coordinates={[
                                                    { latitude: Number(companyConfig.latitude), longitude: Number(companyConfig.longitude) },
                                                    { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }
                                                ]}
                                                strokeColor="#2196F3"
                                                strokeWidth={3}
                                            />
                                        </MapView>
                                    </View>
                                )}

                                {/* Info Row */}
                                <View style={styles.infoRow}>
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoLabel}>Distância</Text>
                                        <Text style={styles.infoValue}>{deliveryDistance.toFixed(2)} km</Text>
                                    </View>
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoLabel}>Taxa</Text>
                                        <Text style={styles.infoValue}>R$ {deliveryFee.toFixed(2)}</Text>
                                    </View>
                                </View>
                            </>
                        )}

                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Voltar</Text>
                        </TouchableOpacity>
                        
                        {isDelivery && (
                            <TouchableOpacity 
                                style={[styles.confirmButton, loading && { opacity: 0.7 }]} 
                                onPress={onConfirm}
                                disabled={loading}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {loading ? 'Processando...' : 'Lançar Entrega & Imprimir'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        maxHeight: '90%',
        minHeight: 400,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333'
    },
    closeButton: {
        padding: 5
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8
    },
    label: {
        fontSize: 16,
        fontWeight: '500', 
        color: '#333'
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 20
    },
    selectorItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    selectorItemNoBorder: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12
    },
    selectorLabel: {
        fontSize: 12,
        color: '#888'
    },
    selectorValue: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333'
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 8,
        marginTop: 10
    },
    placesInput: {
        height: 44,
        color: '#333',
        fontSize: 16,
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 10,
        borderRadius: 6
    },
    webAddressContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10
    },
    webInput: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        paddingHorizontal: 12,
        backgroundColor: '#fff'
    },
    webSearchButton: {
        backgroundColor: '#2196F3',
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: 6
    },
    webSearchButtonText: {
        color: '#fff',
        fontWeight: 'bold'
    },
    mapContainer: {
        height: 150,
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 10,
        marginBottom: 10
    },
    infoRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20
    },
    infoBox: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center'
    },
    infoLabel: {
        fontSize: 12,
        color: '#666'
    },
    infoValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2196F3'
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        gap: 10
    },
    cancelButton: {
        flex: 1,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 8
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: 'bold'
    },
    confirmButton: {
        flex: 2,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF9800',
        borderRadius: 8
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold'
    }
});

export default DeliveryDetailsModal;
