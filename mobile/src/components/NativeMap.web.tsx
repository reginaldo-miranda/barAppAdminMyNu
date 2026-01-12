import React from 'react';
import { View, Text } from 'react-native';

export const Marker = (props: any) => null;
export const Polyline = (props: any) => null;

const MapView = (props: any) => {
    return (
        <View style={{ flex: 1, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#888' }}>Mapa não disponível na versão Web</Text>
        </View>
    );
};

export default MapView;
