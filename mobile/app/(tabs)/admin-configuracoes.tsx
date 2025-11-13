import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeIcon } from '../../components/SafeIcon';
import { employeeService, userService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';

interface Employee {
  _id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
}

interface UserPermissions {
  _id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'funcionario';
  funcionario?: Employee;
  permissoes: {
    produtos: boolean;
    funcionarios: boolean;
    clientes: boolean;
    vendas: boolean;
    relatorios: boolean;
    configuracoes: boolean;
  };
  ativo: boolean;
}

export default function AdminConfiguracoesScreen() {
  const { isAdmin, user } = useAuth() as any;
  const [users, setUsers] = useState<UserPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);

  useEffect(() => {
    if (!isAdmin()) {
      Alert.alert('Acesso Negado', 'Apenas administradores podem acessar as configurações');
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAll();
      // Ajuste: getAll agora retorna um array diretamente; manter compatibilidade caso venha com .data
      setUsers(Array.isArray(response) ? response : (response?.data ?? []));
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      Alert.alert('Erro', 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPermissions = (userToEdit: UserPermissions) => {
    setSelectedUser({ ...userToEdit });
    setModalVisible(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      await userService.updatePermissions(selectedUser._id, selectedUser.permissoes);
      
      // Atualizar lista local
      setUsers(users.map(u => u._id === selectedUser._id ? selectedUser : u));
      
      Alert.alert('Sucesso', 'Permissões atualizadas com sucesso');
      setModalVisible(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      Alert.alert('Erro', 'Erro ao salvar permissões');
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await userService.updateStatus(userId, !currentStatus);
      
      setUsers(users.map(u => 
        u._id === userId ? { ...u, ativo: !currentStatus } : u
      ));
      
      Alert.alert('Sucesso', `Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error: any) {
      console.error('Erro ao alterar status do usuário:', error);
      Alert.alert('Erro', 'Erro ao alterar status do usuário');
    }
  };

  const updatePermission = (permission: keyof UserPermissions['permissoes'], value: boolean) => {
    if (!selectedUser) return;
    
    setSelectedUser({
      ...selectedUser,
      permissoes: {
        ...selectedUser.permissoes,
        [permission]: value,
      },
    });
  };

  const renderUserCard = (userItem: UserPermissions) => (
    <View key={userItem._id} style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userItem.nome}</Text>
          <Text style={styles.userEmail}>{userItem.email}</Text>
          <Text style={styles.userType}>
            {userItem.tipo === 'admin' ? 'Administrador' : 'Funcionário'}
          </Text>
        </View>
        
        <View style={styles.userActions}>
          <Switch
            value={userItem.ativo}
            onValueChange={(value) => toggleUserStatus(userItem._id, userItem.ativo)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
          
          {userItem.tipo === 'funcionario' && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPermissions(userItem)}
            >
              <SafeIcon name="settings" size={24} color="#2196F3" fallbackText="⚙️" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {userItem.tipo === 'funcionario' && (
        <View style={styles.permissionsPreview}>
          <Text style={styles.permissionsTitle}>Permissões:</Text>
          <View style={styles.permissionsList}>
            {Object.entries(userItem.permissoes).map(([key, value]) => (
              <View key={key} style={styles.permissionItem}>
                <SafeIcon 
                  name={value ? "checkmark-circle" : "close-circle"} 
                  size={16} 
                  color={value ? "#4CAF50" : "#f44336"} 
                  fallbackText={value ? "✓" : "×"}
                />
                <Text style={[styles.permissionText, { color: value ? "#4CAF50" : "#f44336" }]}>
                  {getPermissionLabel(key)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const getPermissionLabel = (permission: string) => {
    const labels: { [key: string]: string } = {
      produtos: 'Produtos',
      funcionarios: 'Funcionários',
      clientes: 'Clientes',
      vendas: 'Vendas',
      relatorios: 'Relatórios',
      configuracoes: 'Configurações',
    };
    return labels[permission] || permission;
  };

  const getPermissionIcon = (permission: string) => {
    const icons: { [key: string]: string } = {
      produtos: 'cube',
      funcionarios: 'people',
      clientes: 'person',
      vendas: 'card',
      relatorios: 'bar-chart',
      configuracoes: 'settings',
    };
    return icons[permission] || 'help';
  };

  if (!isAdmin()) {
    return (
      <View style={styles.accessDenied}>
        <SafeIcon name="lock-closed" size={64} color="#ccc" fallbackText="🔒" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Apenas administradores podem acessar as configurações
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Configurações" />
      <ScrollView style={styles.content}>
        {/* Seção de Informações do Sistema */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações do Sistema</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <SafeIcon name="person-circle" size={24} color="#2196F3" fallbackText="👤" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Usuário Logado</Text>
                <Text style={styles.infoValue}>{user?.nome || user?.email}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <SafeIcon name="shield-checkmark" size={24} color="#4CAF50" fallbackText="✓" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nível de Acesso</Text>
                <Text style={styles.infoValue}>Administrador</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <SafeIcon name="time" size={24} color="#FF9800" fallbackText="⏱" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Último Login</Text>
                <Text style={styles.infoValue}>
                  {user?.ultimoLogin ? new Date(user.ultimoLogin).toLocaleString('pt-BR') : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Seção de Gerenciamento de Usuários */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gerenciamento de Usuários</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Carregando usuários...</Text>
            </View>
          ) : (
            users.map(renderUserCard)
          )}
        </View>

        {/* Seção de Configurações Gerais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações Gerais</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="notifications" size={24} color="#2196F3" fallbackText="🔔" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Notificações</Text>
                  <Text style={styles.settingDescription}>
                    Configurar notificações do sistema
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="cloud-upload" size={24} color="#4CAF50" fallbackText="⤴︎" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Backup</Text>
                  <Text style={styles.settingDescription}>
                    Configurar backup automático
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="shield" size={24} color="#FF9800" fallbackText="🛡" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Segurança</Text>
                  <Text style={styles.settingDescription}>
                    Configurações de segurança
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Edição de Permissões */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar Permissões</Text>
            <TouchableOpacity onPress={handleSavePermissions}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          {selectedUser && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.userInfoModal}>
                <Text style={styles.modalUserName}>{selectedUser.nome}</Text>
                <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
              </View>

              <Text style={styles.permissionsHeader}>Permissões de Acesso</Text>
              
              {Object.entries(selectedUser.permissoes).map(([key, value]) => (
                <View key={key} style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <SafeIcon 
                      name={getPermissionIcon(key) as any} 
                      size={24} 
                      color="#2196F3" 
                      fallbackText="✓" 
                    />
                    <View style={styles.permissionDetails}>
                      <Text style={styles.permissionLabel}>
                        {getPermissionLabel(key)}
                      </Text>
                      <Text style={styles.permissionDescription}>
                        {getPermissionDescription(key)}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(newValue) => updatePermission(key as keyof UserPermissions['permissoes'], newValue)}
                    trackColor={{ false: '#ccc', true: '#2196F3' }}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const getPermissionDescription = (permission: string) => {
  const descriptions: { [key: string]: string } = {
    produtos: 'Gerenciar produtos, categorias e estoque',
    funcionarios: 'Gerenciar funcionários e suas informações',
    clientes: 'Gerenciar clientes e seus dados',
    vendas: 'Realizar vendas e gerenciar pedidos',
    relatorios: 'Visualizar relatórios e estatísticas',
    configuracoes: 'Acessar configurações do sistema',
  };
  return descriptions[permission] || '';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  userType: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    marginLeft: 12,
    padding: 8,
  },
  permissionsPreview: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 12,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  userInfoModal: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 16,
    color: '#666',
  },
  permissionsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
  },
});