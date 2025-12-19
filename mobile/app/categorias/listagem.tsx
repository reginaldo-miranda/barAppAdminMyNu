import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { categoryService } from '../../src/services/api';

interface Category {
  id: number;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

export default function ListagemCategoriasScreen() {
  const { hasPermission } = useAuth() as any;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);



  // Verificar permissões
  useEffect(() => {
    if (!hasPermission('produtos')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta funcionalidade.');
      router.back();
    }
  }, [hasPermission]);

  useEffect(() => {
    if (hasPermission('produtos')) {
      loadCategories();
    }
  }, [hasPermission]);

  useEffect(() => {
    filterCategories();
  }, [searchText, categories]);

  if (!hasPermission('produtos')) {
    return null;
  }

  const loadCategories = async () => {
    try {
      setLoading(true);
      
      const response = await categoryService.getAll();
      
      // A API retorna os dados diretamente como array
      if (Array.isArray(response)) {
        setCategories(response);
      } else if (response.data && Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        console.log('Resposta da API:', response);
        setCategories([]);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      Alert.alert('Erro', 'Erro ao carregar categorias. Verifique sua conexão e tente novamente.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const filterCategories = () => {
    if (!searchText.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const filtered = categories.filter(category =>
      category.nome.toLowerCase().includes(searchText.toLowerCase()) ||
      (category.descricao && category.descricao.toLowerCase().includes(searchText.toLowerCase()))
    );
    setFilteredCategories(filtered);
  };

  const handleEdit = (category: Category) => {
  router.push(`/categorias/cadastro?id=${category.id}` as any);
};

  const handleDelete = (category: Category) => {
    Alert.alert(
      'Excluir Categoria',
      `Tem certeza que deseja excluir a categoria "${category.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            await categoryService.delete(category.id);
            setCategories(prev => prev.filter(c => c.id !== category.id));
            Alert.alert('Sucesso', 'Categoria excluída com sucesso!');
          } catch (error) {
            console.error('Erro ao excluir categoria:', error);
            Alert.alert('Erro', 'Erro ao excluir categoria. Tente novamente.');
          }
        }},
      ]
    );
  };

  const toggleStatus = (category: Category) => {
    const newStatus = !category.ativo;
    const action = newStatus ? 'ativar' : 'desativar';
    
    Alert.alert(
      'Alterar Status',
      `Deseja ${action} a categoria "${category.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: async () => {
          try {
            await categoryService.update(category.id, { ativo: newStatus });
            setCategories(prev => prev.map(c => 
              c.id === category.id ? { ...c, ativo: newStatus } : c
            ));
            Alert.alert('Sucesso', `Categoria ${newStatus ? 'ativada' : 'desativada'} com sucesso!`);
          } catch (error) {
            console.error('Erro ao alterar status da categoria:', error);
            Alert.alert('Erro', 'Erro ao alterar status da categoria. Tente novamente.');
          }
        }},
      ]
    );
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <View style={styles.categoryItem}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.nome}</Text>
          {item.descricao && (
            <Text style={styles.categoryDescription}>{item.descricao}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, item.ativo ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.statusText, item.ativo ? styles.activeText : styles.inactiveText]}>
            {item.ativo ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
      </View>
      
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="pencil" size={16} color="#2196F3" />
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => toggleStatus(item)}
        >
          <Ionicons 
            name={item.ativo ? "pause" : "play"} 
            size={16} 
            color={item.ativo ? "#FF9800" : "#4CAF50"} 
          />
          <Text style={[styles.toggleButtonText, { color: item.ativo ? "#FF9800" : "#4CAF50" }]}>
            {item.ativo ? 'Desativar' : 'Ativar'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={16} color="#F44336" />
          <Text style={styles.deleteButtonText}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando categorias...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categorias</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/categorias/cadastro' as any)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar categorias..."
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCategoryItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchText ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
            </Text>
            {!searchText && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/categorias/cadastro' as any)}
              >
                <Text style={styles.emptyButtonText}>Cadastrar Primeira Categoria</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  categoryItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryInfo: {
    flex: 1,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#E8F5E8',
  },
  inactiveBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#4CAF50',
  },
  inactiveText: {
    color: '#FF9800',
  },
  categoryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 2,
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  editButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  toggleButton: {
    backgroundColor: '#F3E5F5',
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
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
});