import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeIcon } from '../../components/SafeIcon';
import { authService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PasswordConfirmModal({ visible, title = 'Confirmar Ação', message = 'Digite sua senha para confirmar:', onConfirm, onCancel }: Props) {
  const { user } = useAuth();
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!senha) {
      Alert.alert('Erro', 'Por favor, digite sua senha.');
      return;
    }

    // Se o usuário não estiver logado (improvável no app, mas possível em dev), não prosseguir
    if (!user?.email) {
       Alert.alert('Erro', 'Usuário não identificado.');
       return;
    }

    setLoading(true);
    try {
      // Tenta fazer login novamente apenas para validar a credencial
      await authService.login({ email: user.email, senha });
      setSenha('');
      onConfirm();
    } catch (error) {
      console.error('Erro na validação de senha:', error);
      Alert.alert('Acesso Negado', 'Senha incorreta.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSenha('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <SafeIcon name="lock-closed" size={24} color="#F44336" fallbackText="🔒" />
            <Text style={styles.title}>{title}</Text>
          </View>

          <Text style={styles.message}>{message}</Text>
          <Text style={styles.subMessage}>Usuário: {user?.nome || user?.email}</Text>

          <TextInput
            style={styles.input}
            placeholder="Senha"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
            autoCapitalize="none"
          />

          <View style={styles.buttons}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.confirmButton]} 
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.confirmText}>Confirmar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  message: {
    fontSize: 16,
    color: '#444',
    marginBottom: 8,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#eee',
  },
  cancelText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#F44336',
  },
  confirmText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
